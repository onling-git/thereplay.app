const crypto = require('crypto');
const ReportGenerationTrace = require('../models/ReportGenerationTrace');
const { interpretMatch } = require('./matchInterpretation');
const { buildEditorialDossierV4 } = require('./reportEvidenceDossierV4');
const { writeMatchReportV4 } = require('./matchReportWriterV4');
const { validateAuthoritativeMatchData, prepareMatchData, determinePOTM, enrichReport, saveInterpretation, persistTrace } = require('./reportPipeline');

async function generateReportPipelineV4({ matchId, teamSlug, options = {} }) {
  console.log(`[ReportPipelineV4] Starting for match ${matchId}, team ${teamSlug}`);
  const { match, team, teamFocus, teamSide, tweets, competitionContext } = await prepareMatchData(matchId, teamSlug, {
    autoCollectTweets: options.autoCollectTweets !== false,
    minTweetsRequired: options.minTweetsRequired || 5
  });
  const trace = new ReportGenerationTrace({ generation_id: crypto.randomUUID(), match_id: match.match_id, team_slug: String(teamSlug), started_at: new Date() });
  await persistTrace(trace);

  let interpretation;
  const run1Started = Date.now();
  try {
    interpretation = await interpretMatch({ match, tweets, teamFocus, teamSide, isCup: competitionContext.is_cup, competitionName: competitionContext.name, competitionStage: competitionContext.stage, trace: trace.run1 });
  } catch (error) {
    trace.status = 'failed'; trace.error = error.message; trace.run1.error = error.message; trace.completed_at = new Date(); await persistTrace(trace); throw error;
  }
  const run1Time = Date.now() - run1Started;
  if (options.saveInterpretation) await saveInterpretation(matchId, teamSlug, interpretation);

  const authoritativeMatchFacts = validateAuthoritativeMatchData(match);
  trace.validation.warnings.push(...authoritativeMatchFacts.validation_warnings);
  const potm = determinePOTM(match, teamSide);
  const dossier = buildEditorialDossierV4({ interpretation, authoritativeMatchFacts, teamFocus, teamSide, competitionContext, potm });

  let report;
  const run2Started = Date.now();
  try {
    report = await writeMatchReportV4({ dossier, trace: trace.run2 });
  } catch (error) {
    trace.status = 'failed'; trace.error = error.message; trace.run2.error = error.message; trace.completed_at = new Date(); await persistTrace(trace); throw error;
  }
  const run2Time = Date.now() - run2Started;
  const enrichedReport = enrichReport({ report, interpretation, match, team, teamFocus, tweets, competitionContext });
  enrichedReport.meta = {
    ...enrichedReport.meta,
    pipeline: { version: '4.0', interpretation_time_ms: run1Time, editorial_writing_time_ms: run2Time, total_time_ms: run1Time + run2Time },
    generation_id: trace.generation_id,
    trace_id: trace._id,
    run1_prompt_version: trace.run1.prompt_version,
    run2_prompt_version: trace.run2.prompt_version,
    dossier_version: dossier.dossier_version
  };
  trace.run2.output = { dossier, assembled_report: enrichedReport };
  trace.status = 'completed'; trace.completed_at = new Date(); await persistTrace(trace);

  return {
    report: enrichedReport,
    interpretation,
    dossier,
    metadata: { match_id: match.match_id, team_slug: teamSlug, team_name: teamFocus, competition: competitionContext.name, stage: competitionContext.stage, is_cup: competitionContext.is_cup, generation_id: trace.generation_id, trace_id: trace._id, pipeline_version: '4.0' }
  };
}

module.exports = { generateReportPipelineV4 };
