// controllers/reportControllerV3.js
// V3 controller: uses Run 1 -> Editorial Planner -> Writer pipeline.

const ReportStaging = require('../models/ReportStaging');
const { generateReportPipelineV3 } = require('../services/reportPipelineV3');
const { saveReportToDatabase } = require('./reportControllerV2');

function buildStagingPreview(report, matchId, teamSlug) {
  const contentParts = [];
  if (report.headline) contentParts.push(report.headline);
  if (Array.isArray(report.summary_paragraphs) && report.summary_paragraphs.length) {
    contentParts.push(...report.summary_paragraphs);
  }
  if (Array.isArray(report.key_moments) && report.key_moments.length) {
    contentParts.push('Key Moments:', ...report.key_moments.map(item => `• ${item}`));
  }
  if (Array.isArray(report.commentary) && report.commentary.length) {
    contentParts.push('Commentary:', ...report.commentary);
  }

  return {
    match_id: Number(matchId),
    team_slug: String(teamSlug),
    headline: report.headline,
    generated: {
      headline: report.headline,
      summary_paragraphs: report.summary_paragraphs,
      key_moments: report.key_moments,
      commentary: report.commentary,
      player_of_the_match: report.player_of_the_match,
      sources: report.sources,
      embedded_tweets: report.embedded_tweets
    },
    content: contentParts.join('\n\n'),
    meta: report.meta,
    is_staging: true
  };
}

async function generateReportV3(req, res) {
  try {
    const { matchId, teamSlug } = req.params;
    const saveInterpretation = req.query.debug === 'true';

    const result = await generateReportPipelineV3({
      matchId,
      teamSlug,
      options: { saveInterpretation }
    });

    const savedReport = await saveReportToDatabase({
      report: result.report,
      matchId,
      teamSlug,
      metadata: result.metadata
    });

    return res.json({
      ok: true,
      report: savedReport,
      pipeline_version: '3.0',
      debug: saveInterpretation
        ? { interpretation: result.interpretation, editorial_plan: result.editorialPlan }
        : undefined
    });
  } catch (err) {
    console.error('[generateReportV3] Error:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to generate V3 report',
      detail: err.message || err
    });
  }
}

async function generateStagingReportV3(req, res) {
  try {
    const { matchId, teamSlug } = req.params;
    const saveInterpretation = req.query.debug === 'true';

    const result = await generateReportPipelineV3({
      matchId,
      teamSlug,
      options: { saveInterpretation }
    });

    const setObj = {
      team_name: result.report.team_name,
      report: result.report,
      metadata: result.metadata,
      generated_by: result.report.meta?.generated_by,
      generated_at: new Date()
    };
    if (saveInterpretation) {
      setObj.interpretation = result.interpretation;
      setObj.editorial_plan = result.editorialPlan;
    }

    const staged = await ReportStaging.findOneAndUpdate(
      { match_id: Number(matchId), team_slug: String(teamSlug).toLowerCase() },
      { $set: setObj },
      { upsert: true, new: true }
    );

    return res.json({
      ok: true,
      staging: true,
      pipeline_version: '3.0',
      report: buildStagingPreview(staged.report, matchId, teamSlug),
      debug: saveInterpretation
        ? { interpretation: result.interpretation, editorial_plan: result.editorialPlan }
        : undefined
    });
  } catch (err) {
    console.error('[generateStagingReportV3] Error:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to generate V3 staging report',
      detail: err.message || err
    });
  }
}

async function getStagingReportV3(req, res) {
  try {
    const { matchId, teamSlug } = req.params;
    const staged = await ReportStaging.findOne({
      match_id: Number(matchId),
      team_slug: String(teamSlug).toLowerCase()
    }).lean();

    if (!staged) {
      return res.status(404).json({ error: 'No staging report found' });
    }

    return res.json({
      ok: true,
      staging: true,
      pipeline_version: staged?.metadata?.pipeline_version || 'unknown',
      generated_at: staged.generated_at,
      report: buildStagingPreview(staged.report, matchId, teamSlug)
    });
  } catch (err) {
    console.error('[getStagingReportV3] Error:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to load V3 staging report',
      detail: err.message || err
    });
  }
}

async function promoteStagingReportV3(req, res) {
  try {
    const { matchId, teamSlug } = req.params;
    const staged = await ReportStaging.findOne({
      match_id: Number(matchId),
      team_slug: String(teamSlug).toLowerCase()
    });

    if (!staged) {
      return res.status(404).json({ error: 'No staging report found to promote' });
    }

    const saved = await saveReportToDatabase({
      report: staged.report,
      matchId,
      teamSlug,
      metadata: staged.metadata || {}
    });

    return res.json({ ok: true, promoted: true, report: saved, pipeline_version: '3.0' });
  } catch (err) {
    console.error('[promoteStagingReportV3] Error:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to promote V3 staging report',
      detail: err.message || err
    });
  }
}

module.exports = {
  generateReportV3,
  generateStagingReportV3,
  getStagingReportV3,
  promoteStagingReportV3
};
