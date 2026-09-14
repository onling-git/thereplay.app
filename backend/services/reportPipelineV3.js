// services/reportPipelineV3.js
// V3 orchestrator: Run 1 (research) -> Run 2 (editorial plan) -> Run 3 (writer).

const crypto = require('crypto');
const ReportGenerationTrace = require('../models/ReportGenerationTrace');
const { interpretMatch } = require('./matchInterpretation');
const { buildClaimLedgerV36 } = require('./reportEditorialPlannerV36');
const { writeMatchReportV36 } = require('./matchReportWriterV36');
const {
  validateAuthoritativeMatchData,
  prepareMatchData,
  determinePOTM,
  enrichReport,
  saveInterpretation,
  persistTrace
} = require('./reportPipeline');
const {
  buildEditorialPlan
} = require('./reportEditorialPlannerV3');

async function generateReportPipelineV3({ matchId, teamSlug, options = {} }) {
  console.log(`[ReportPipelineV3] Starting for match ${matchId}, team ${teamSlug}`);

  const autoCollectTweets = options.autoCollectTweets !== false;
  const minTweetsRequired = options.minTweetsRequired || 5;

  const { match, team, teamFocus, teamSide, tweets, competitionContext } = await prepareMatchData(
    matchId,
    teamSlug,
    { autoCollectTweets, minTweetsRequired }
  );

  const generationId = crypto.randomUUID();
  const trace = new ReportGenerationTrace({
    generation_id: generationId,
    match_id: match.match_id,
    team_slug: String(teamSlug),
    started_at: new Date()
  });
  await persistTrace(trace);

  let interpretation;
  const startRun1 = Date.now();
  try {
    interpretation = await interpretMatch({
      match,
      tweets,
      teamFocus,
      teamSide,
      isCup: competitionContext.is_cup,
      competitionName: competitionContext.name,
      competitionStage: competitionContext.stage,
      trace: trace.run1
    });
  } catch (error) {
    trace.run1.error = error.message;
    trace.status = 'failed';
    trace.error = error.message;
    trace.completed_at = new Date();
    await persistTrace(trace);
    throw error;
  }
  const run1Time = Date.now() - startRun1;
  await persistTrace(trace);

  if (options.saveInterpretation) {
    await saveInterpretation(matchId, teamSlug, interpretation);
  }

  let authoritativeMatchFacts;
  try {
    authoritativeMatchFacts = validateAuthoritativeMatchData(match);
  } catch (error) {
    trace.validation.errors.push(error.message);
    trace.status = 'failed';
    trace.error = error.message;
    trace.completed_at = new Date();
    await persistTrace(trace);
    throw error;
  }
  trace.validation.warnings.push(...authoritativeMatchFacts.validation_warnings);
  await persistTrace(trace);

  const potm = determinePOTM(match, teamSide);

  // V3.6 Run 2 produces a component-exclusive editorial claim ledger.
  const startRun2 = Date.now();
  let editorialPlan;
  try {
    editorialPlan = await buildClaimLedgerV36({
    interpretation,
    authoritativeMatchFacts,
    teamFocus,
    teamSide,
    teamSlug,
    match,
      competitionContext,
    potm,
      trace: trace.run2
    });
  } catch (error) {
    trace.run2.error = error.message;
    trace.status = 'failed';
    trace.error = error.message;
    trace.completed_at = new Date();
    await persistTrace(trace);
    throw error;
  }
  const run2Time = Date.now() - startRun2;
  await persistTrace(trace);

  let report;
  let writerResult;
  const startRun3 = Date.now();
  try {
    writerResult = await writeMatchReportV36({
      editorialPlan,
      authoritativeMatchFacts,
      trace: null
    });
    report = writerResult.report;
  } catch (error) {
    trace.run2.error = error.message;
    trace.status = 'failed';
    trace.error = error.message;
    trace.completed_at = new Date();
    await persistTrace(trace);
    throw error;
  }
  const run3Time = Date.now() - startRun3;

  const enrichedReport = enrichReport({
    report,
    interpretation,
    match,
    team,
    teamFocus,
    tweets,
    competitionContext
  });

  trace.run2.output = {
    editorial_plan: editorialPlan,
    used_claim_ids: writerResult.used_claim_ids,
    assembled_report: enrichedReport
  };

  enrichedReport.meta = {
    ...enrichedReport.meta,
    pipeline: {
      version: '3.6',
      interpretation_time_ms: run1Time,
      editorial_planning_time_ms: run2Time,
      writing_time_ms: run3Time,
      total_time_ms: run1Time + run2Time + run3Time
    },
    generation_id: generationId,
    trace_id: trace._id,
    run1_prompt_version: trace.run1.prompt_version,
    run2_prompt_version: editorialPlan.planner_version,
    run3_prompt_version: 'v3.6-claim-ledger-writer-2026-09-01.1',
    v3_editorial_planner_version: editorialPlan.planner_version
  };

  trace.status = 'completed';
  trace.completed_at = new Date();
  await persistTrace(trace);

  return {
    report: enrichedReport,
    interpretation,
    editorialPlan,
    metadata: {
      match_id: match.match_id,
      team_slug: teamSlug,
      team_name: teamFocus,
      competition: competitionContext.name,
      stage: competitionContext.stage,
      is_cup: competitionContext.is_cup,
      generation_id: generationId,
      trace_id: trace._id,
      pipeline_version: '3.6'
    }
  };
}

async function generateEditorialPlanV3({ matchId, teamSlug, options = {} }) {
  console.log(`[ReportPipelineV3] Run1+Run2 only for match ${matchId}, team ${teamSlug}`);

  const autoCollectTweets = options.autoCollectTweets !== false;
  const minTweetsRequired = options.minTweetsRequired || 5;

  const { match, teamFocus, teamSide, tweets, competitionContext } = await prepareMatchData(
    matchId,
    teamSlug,
    { autoCollectTweets, minTweetsRequired }
  );

  const interpretation = await interpretMatch({
    match,
    tweets,
    teamFocus,
    teamSide,
    isCup: competitionContext.is_cup,
    competitionName: competitionContext.name,
    competitionStage: competitionContext.stage
  });

  const authoritativeMatchFacts = validateAuthoritativeMatchData(match);
  const editorialPlan = buildEditorialPlan({
    interpretation,
    authoritativeMatchFacts,
    teamFocus,
    teamSide,
    teamSlug,
    match,
    competitionContext
  });

  return {
    matchId: Number(matchId),
    teamSlug: String(teamSlug),
    teamFocus,
    teamSide,
    competitionContext,
    authoritativeMatchFacts,
    interpretation,
    editorialPlan
  };
}

module.exports = {
  generateReportPipelineV3,
  generateEditorialPlanV3
};
