const ReportStaging = require('../models/ReportStaging');
const Match = require('../models/Match');
const Report = require('../models/Report');
const { generateReportPipelineV4 } = require('../services/reportPipelineV4');
const { WRITER_VERSION } = require('../services/matchReportWriterV4');
const { saveReportToDatabase } = require('./reportControllerV2');
const { withReportGenerationLock } = require('../services/reportGenerationLock');
const { assertGenerationEnabled, assertEnglishReportTeam, automaticReportSkipReason, generationDisabledReason } = require('../services/reportGenerationPolicy');
const ReportGenerationTrace = require('../models/ReportGenerationTrace');

function isCurrentV4Report(report, writerProvider) {
  return report?.meta?.pipeline_version === '4.0'
    && report.meta.writer_provider === writerProvider;
}

async function generateReportV4ForTeam(matchId, teamSlug, options = {}) {
  assertGenerationEnabled();
  teamSlug = String(teamSlug || '').trim().toLowerCase();
  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) throw Object.assign(new Error(`Match ${matchId} not found`), { status: 404 });
  await assertEnglishReportTeam(match, teamSlug);
  const automaticSkip = !options.force && await automaticReportSkipReason(match);
  if (automaticSkip) {
    console.warn(`[reports] Skipping ${matchId}/${teamSlug}: ${automaticSkip}`);
    options.onSkip?.(automaticSkip);
    return null;
  }
  return withReportGenerationLock(matchId, teamSlug, async assertOwnership => {
    const writerProvider = options.writerProvider || 'claude';
    if (!options.force) {
      const existing = await Report.findOne({ match_id: Number(matchId), team_slug: String(teamSlug).toLowerCase() }).lean();
      if (isCurrentV4Report(existing, writerProvider)) return existing;
      const previousFailure = await ReportGenerationTrace.findOne({
        match_id: Number(matchId), team_slug: teamSlug, status: 'failed',
        completed_at: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        'run2.requests.0': { $exists: true }
      }).lean();
      if (previousFailure) {
        console.warn(`[reports] Skipping automatic retry for ${matchId}/${teamSlug}: paid generation failed within the last six hours.`);
        options.onSkip?.('A writer attempt failed within the last six hours; automatic retry is cooling down.');
        return null;
      }
    }
    const result = await generateReportPipelineV4({
      matchId,
      teamSlug,
      options: { ...options, writerProvider, assertOwnership }
    });
    if (result.report.meta?.writer_provider !== writerProvider
      || result.report.meta?.pipeline_version !== '4.0'
      || result.report.meta?.writer_prompt_version !== WRITER_VERSION) {
      throw new Error(`Report generation for ${teamSlug} did not produce the current V4 ${writerProvider} report`);
    }
    await assertOwnership();
    const report = await saveReportToDatabase({ report: result.report, matchId, teamSlug, metadata: result.metadata });
    return options.includeDebug ? { report, interpretation: result.interpretation, dossier: result.dossier } : report;
  });
}

async function generateBothReportsV4ForMatch(matchId, { autoCollectTweets = true, writerProvider = 'claude', trigger = 'internal' } = {}) {
  const disabledReason = generationDisabledReason();
  if (disabledReason) {
    console.warn(`[reports] Skipping ${matchId}: ${disabledReason}`);
    return { reports: { home: null, away: null }, skipped: true, reason: disabledReason, pipeline_version: '4.0' };
  }
  const numericMatchId = Number(matchId);
  const match = await Match.findOne({ match_id: numericMatchId }).lean();
  if (!match) {
    const error = new Error(`Match ${numericMatchId} not found`);
    error.status = 404;
    throw error;
  }
  const skipReason = await automaticReportSkipReason(match);
  if (skipReason) {
    console.warn(`[reports] Skipping ${matchId}: ${skipReason}`);
    return { reports: { home: null, away: null }, skipped: true, reason: skipReason, pipeline_version: '4.0' };
  }

  const teamSlugs = {
    home: match.home_team_slug || match.teams?.home?.team_slug || `__home_${numericMatchId}`,
    away: match.away_team_slug || match.teams?.away?.team_slug || `__away_${numericMatchId}`
  };
  const reports = { home: null, away: null };
  const skippedTeams = {};

  await Promise.all(['home', 'away'].map(async side => {
    const teamSlug = teamSlugs[side];
    try {
      await assertEnglishReportTeam(match, teamSlug);
    } catch (error) {
      if (error.code !== 'REPORT_TEAM_NOT_ELIGIBLE') throw error;
      skippedTeams[side] = error.message;
      console.warn(`[reports] Skipping ${numericMatchId}/${teamSlug}: ${error.message}`);
      return;
    }
    const existing = await Report.findOne({ match_id: numericMatchId, team_slug: teamSlug }).lean();
    if (isCurrentV4Report(existing, writerProvider)) {
      reports[side] = existing;
      return;
    }

    reports[side] = await generateReportV4ForTeam(numericMatchId, teamSlug, {
      writerProvider,
      autoCollectTweets,
      trigger,
      onSkip: reason => { skippedTeams[side] = reason; }
    });
  }));

  const skipped = !reports.home && !reports.away;
  return { reports, skippedTeams, skipped, ...(skipped ? {
    reason: 'No reports generated. See skippedTeams for eligibility or retry-cooldown reasons.'
  } : {}), pipeline_version: '4.0' };
}

function buildStagingPreview(report, matchId, teamSlug) {
  const content = [report.headline, ...((report.summary_paragraphs || []))].filter(Boolean).join('\n\n');
  return {
    match_id: Number(matchId), team_slug: String(teamSlug), headline: report.headline,
    generated: {
      headline: report.headline, summary_paragraphs: report.summary_paragraphs, key_moments: report.key_moments,
      commentary: report.commentary, player_of_the_match: report.player_of_the_match, sources: report.sources,
      embedded_tweets: report.embedded_tweets
    },
    content, meta: report.meta, is_staging: true
  };
}

async function generateReportV4(req, res) {
  try {
    const writerProvider = req.body?.writerProvider || 'claude';
    if (!['openai', 'claude'].includes(writerProvider)) {
      return res.status(400).json({ error: 'writerProvider must be openai or claude' });
    }
    const debug = req.query.debug === 'true';
    const result = await generateReportV4ForTeam(req.params.matchId, req.params.teamSlug, {
      saveInterpretation: debug, includeDebug: debug, writerProvider, force: true, trigger: 'manual'
    });
    return res.json({ ok: true, report: debug ? result.report : result, pipeline_version: '4.0', debug: debug ? { interpretation: result.interpretation, dossier: result.dossier } : undefined });
  } catch (error) {
    console.error('[generateReportV4]', error);
    return res.status(error.status || 500).json({ error: 'Failed to generate V4 report', detail: error.message });
  }
}

async function generateBothReportsV4(req, res) {
  try {
    const matchId = Number(req.params.matchId);
    const writerProvider = req.body?.writerProvider || 'claude';
    if (!['openai', 'claude'].includes(writerProvider)) {
      return res.status(400).json({ error: 'writerProvider must be openai or claude' });
    }
    const result = await generateBothReportsV4ForMatch(matchId, { writerProvider, trigger: req.get('x-report-trigger')?.slice(0, 100) || 'manual-both' });
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[generateBothReportsV4]', error);
    return res.status(error.status || 500).json({ error: 'Failed to generate V4 reports', detail: error.message });
  }
}

async function generateStagingReportV4(req, res) {
  try {
    assertGenerationEnabled();
    const writerProvider = req.body?.writerProvider || 'claude';
    if (!['openai', 'claude'].includes(writerProvider)) {
      return res.status(400).json({ error: 'writerProvider must be openai or claude' });
    }
    return await withReportGenerationLock(req.params.matchId, req.params.teamSlug, async assertOwnership => {
      const result = await generateReportPipelineV4({ matchId: req.params.matchId, teamSlug: req.params.teamSlug, options: { saveInterpretation: req.query.debug === 'true', writerProvider, trigger: 'manual-staging', force: true, assertOwnership } });
      await assertOwnership();
      const staged = await ReportStaging.findOneAndUpdate(
        { match_id: Number(req.params.matchId), team_slug: String(req.params.teamSlug).toLowerCase() },
        { $set: { team_name: result.report.team_name, report: result.report, metadata: result.metadata, generated_by: result.report.meta?.generated_by, generated_at: new Date(), ...(req.query.debug === 'true' ? { interpretation: result.interpretation, dossier: result.dossier } : {}) } },
        { upsert: true, new: true }
      );
      return res.json({ ok: true, staging: true, pipeline_version: '4.0', report: buildStagingPreview(staged.report, req.params.matchId, req.params.teamSlug), debug: req.query.debug === 'true' ? { interpretation: result.interpretation, dossier: result.dossier } : undefined });
    });
  } catch (error) {
    console.error('[generateStagingReportV4]', error);
    return res.status(error.status || 500).json({ error: 'Failed to generate V4 staging report', detail: error.message });
  }
}

async function getStagingReportV4(req, res) {
  try {
    const staged = await ReportStaging.findOne({
      match_id: Number(req.params.matchId),
      team_slug: String(req.params.teamSlug).toLowerCase()
    }).lean();
    if (!staged) return res.status(404).json({ error: 'No V4 staging report found' });
    return res.json({
      ok: true,
      staging: true,
      pipeline_version: staged.metadata?.pipeline_version || 'unknown',
      generated_at: staged.generated_at,
      report: buildStagingPreview(staged.report, req.params.matchId, req.params.teamSlug)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load V4 staging report', detail: error.message });
  }
}

async function promoteStagingReportV4(req, res) {
  try {
    return await withReportGenerationLock(req.params.matchId, req.params.teamSlug, async assertOwnership => {
      const staged = await ReportStaging.findOne({
        match_id: Number(req.params.matchId),
        team_slug: String(req.params.teamSlug).toLowerCase()
      });
      if (!staged) return res.status(404).json({ error: 'No V4 staging report found to promote' });
      await assertOwnership();
      const report = await saveReportToDatabase({ report: staged.report, matchId: req.params.matchId, teamSlug: req.params.teamSlug, metadata: staged.metadata || {} });
      return res.json({ ok: true, promoted: true, pipeline_version: '4.0', report });
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: 'Failed to promote V4 staging report', detail: error.message });
  }
}

module.exports = { generateReportV4, generateReportV4ForTeam, generateBothReportsV4, generateBothReportsV4ForMatch, generateStagingReportV4, getStagingReportV4, promoteStagingReportV4 };
