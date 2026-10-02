const ReportStaging = require('../models/ReportStaging');
const Match = require('../models/Match');
const Report = require('../models/Report');
const { generateReportPipelineV4 } = require('../services/reportPipelineV4');
const { saveReportToDatabase } = require('./reportControllerV2');

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
    const result = await generateReportPipelineV4({ matchId: req.params.matchId, teamSlug: req.params.teamSlug, options: { saveInterpretation: req.query.debug === 'true' } });
    const report = await saveReportToDatabase({ report: result.report, matchId: req.params.matchId, teamSlug: req.params.teamSlug, metadata: result.metadata });
    return res.json({ ok: true, report, pipeline_version: '4.0', debug: req.query.debug === 'true' ? { interpretation: result.interpretation, dossier: result.dossier } : undefined });
  } catch (error) {
    console.error('[generateReportV4]', error);
    return res.status(500).json({ error: 'Failed to generate V4 report', detail: error.message });
  }
}

async function generateBothReportsV4(req, res) {
  try {
    const matchId = Number(req.params.matchId);
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) return res.status(404).json({ error: `Match ${matchId} not found` });

    const teamSlugs = {
      home: match.home_team_slug || match.teams?.home?.team_slug || `__home_${matchId}`,
      away: match.away_team_slug || match.teams?.away?.team_slug || `__away_${matchId}`
    };
    const reports = { home: null, away: null };

    for (const side of ['home', 'away']) {
      const teamSlug = teamSlugs[side];
      const existing = await Report.findOne({ match_id: matchId, team_slug: teamSlug }).lean();
      if (existing) {
        reports[side] = existing;
        continue;
      }

      try {
        const result = await generateReportPipelineV4({ matchId, teamSlug });
        reports[side] = await saveReportToDatabase({
          report: result.report,
          matchId,
          teamSlug,
          metadata: result.metadata
        });
      } catch (error) {
        console.error(`[generateBothReportsV4] Failed to generate ${side} report:`, error);
        reports[side] = { error: error.message };
      }
    }

    return res.json({ ok: true, reports, pipeline_version: '4.0' });
  } catch (error) {
    console.error('[generateBothReportsV4]', error);
    return res.status(500).json({ error: 'Failed to generate V4 reports', detail: error.message });
  }
}

async function generateStagingReportV4(req, res) {
  try {
    const writerProvider = req.body?.writerProvider || 'claude';
    if (!['openai', 'claude'].includes(writerProvider)) {
      return res.status(400).json({ error: 'writerProvider must be openai or claude' });
    }
    const result = await generateReportPipelineV4({ matchId: req.params.matchId, teamSlug: req.params.teamSlug, options: { saveInterpretation: req.query.debug === 'true', writerProvider } });
    const staged = await ReportStaging.findOneAndUpdate(
      { match_id: Number(req.params.matchId), team_slug: String(req.params.teamSlug).toLowerCase() },
      { $set: { team_name: result.report.team_name, report: result.report, metadata: result.metadata, generated_by: result.report.meta?.generated_by, generated_at: new Date(), ...(req.query.debug === 'true' ? { interpretation: result.interpretation, dossier: result.dossier } : {}) } },
      { upsert: true, new: true }
    );
    return res.json({ ok: true, staging: true, pipeline_version: '4.0', report: buildStagingPreview(staged.report, req.params.matchId, req.params.teamSlug), debug: req.query.debug === 'true' ? { interpretation: result.interpretation, dossier: result.dossier } : undefined });
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
    const staged = await ReportStaging.findOne({
      match_id: Number(req.params.matchId),
      team_slug: String(req.params.teamSlug).toLowerCase()
    });
    if (!staged) return res.status(404).json({ error: 'No V4 staging report found to promote' });
    const report = await saveReportToDatabase({ report: staged.report, matchId: req.params.matchId, teamSlug: req.params.teamSlug, metadata: staged.metadata || {} });
    return res.json({ ok: true, promoted: true, pipeline_version: '4.0', report });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to promote V4 staging report', detail: error.message });
  }
}

module.exports = { generateReportV4, generateBothReportsV4, generateStagingReportV4, getStagingReportV4, promoteStagingReportV4 };
