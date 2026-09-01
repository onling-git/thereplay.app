const DOSSIER_VERSION = 'v4-evidence-dossier-2026-09-01.1';

function toArray(value) { return Array.isArray(value) ? value : []; }

function scoreLabel(event, focusedSide) {
  const before = String(event.score_before || '').split('-').map(Number);
  const after = String(event.score_after || event.result || '').split('-').map(Number);
  if (after.length !== 2 || after.some(value => !Number.isFinite(value))) return [];
  const focusedIndex = focusedSide === 'home' ? 0 : 1;
  const otherIndex = focusedIndex === 0 ? 1 : 0;
  const beforeFocused = before[focusedIndex];
  const beforeOpponent = before[otherIndex];
  const afterFocused = after[focusedIndex];
  const afterOpponent = after[otherIndex];
  const labels = [];
  if (Number.isFinite(beforeFocused) && beforeFocused === beforeOpponent && afterFocused > afterOpponent) labels.push('established_or_restored_lead');
  if (Number.isFinite(beforeFocused) && beforeFocused < beforeOpponent && afterFocused === afterOpponent) labels.push('equalised');
  if (Number.isFinite(beforeFocused) && beforeFocused > beforeOpponent && afterFocused > afterOpponent) labels.push('extended_lead');
  if (event.minute >= 80) labels.push('late_event');
  return labels;
}

function buildScoringFacts(interpretation, facts, focusedSide) {
  const ledger = toArray(facts.scoring_events);
  return ledger.map((event, offset) => {
    const detail = toArray(interpretation.scoring_evidence).find(item =>
      String(item.event_id || '') === String(event.event_id || '') ||
      (Number(item.minute) === Number(event.minute) && String(item.scorer || '') === String(event.scorer || ''))
    ) || {};
    const structured = detail.structured_details || {};
    const socialContext = toArray(detail.supporting_context);
    const scoreAfter = detail.score_after || event.result || null;
    const scoreBefore = detail.score_before || null;
    const derived = { ...event, score_before: scoreBefore, score_after: scoreAfter };
    return {
      fact_id: `scoring_fact_${offset + 1}`,
      event_id: detail.event_id || event.event_id || null,
      minute: event.minute,
      extra_minute: event.extra_minute || detail.added_minute || null,
      scorer: event.scorer,
      side: event.side,
      event_type: event.type,
      score_before: scoreBefore,
      score_after: scoreAfter,
      focused_team_event: event.side === focusedSide,
      score_state_labels: scoreLabel(derived, focusedSide),
      player_roles: {
        scorer: event.scorer,
        assist_provider: structured.assist || null,
        build_up_contributors: structured.build_up ? [structured.build_up] : [],
        shot_type: structured.shot_type || null,
        finish_detail: structured.finish_detail || null
      },
      supporting_context: socialContext,
      evidence_status: detail.evidence_status || 'confirmed'
    };
  });
}

function buildReporterFacts(interpretation) {
  return toArray(interpretation.social_context)
    .filter(source => source.suitable_for_report && source.factual_context)
    .map(source => ({
      source_id: String(source.tweet_id),
      relevant_match_event: source.relevant_match_event || null,
      factual_context: source.factual_context,
      allowed_use: 'May be used only when its factual context is explicitly incorporated without quotation.',
      forbidden_upgrades: ['Do not convert build-up involvement into an assist.', 'Do not use this source to override authoritative score or event data.']
    }));
}

function buildEditorialDossierV4({ interpretation, authoritativeMatchFacts, teamFocus, teamSide, competitionContext, potm }) {
  const focusedSide = teamSide === 'away' ? 'away' : 'home';
  const finalScore = authoritativeMatchFacts.final_score;
  const focusedScore = finalScore[focusedSide];
  const opponentScore = finalScore[focusedSide === 'home' ? 'away' : 'home'];
  const scoringFacts = buildScoringFacts(interpretation, authoritativeMatchFacts, focusedSide);
  const reporterFacts = buildReporterFacts(interpretation);
  const prohibited = toArray(interpretation.narrative_warnings)
    .filter(item => item.status === 'prohibited' || item.status === 'unsupported')
    .map(item => item.claim);

  return {
    dossier_version: DOSSIER_VERSION,
    focused_club: {
      name: teamFocus,
      side: focusedSide,
      result: focusedScore > opponentScore ? 'won' : focusedScore < opponentScore ? 'lost' : 'drew',
      scoreline: `${focusedScore}-${opponentScore}`
    },
    competition: competitionContext,
    authoritative_facts: {
      final_score: finalScore,
      scoring_events: scoringFacts,
      data_warnings: authoritativeMatchFacts.validation_warnings || []
    },
    supported_observations: {
      factual_summary: interpretation.match_facts?.factual_summary || null,
      match_progression: interpretation.match_progression || {},
      statistics: toArray(interpretation.statistical_evidence).filter(item => item.use_in_report),
      pressure: toArray(interpretation.pressure_evidence?.useful_observations),
      market: interpretation.market_evidence?.use_in_report ? interpretation.market_evidence : null,
      reporter_facts: reporterFacts,
      potm: { player: potm.player || null, rating: potm.rating || null, supplied_reason: potm.reason || null, player_context: interpretation.player_context || {} }
    },
    permitted_interpretations: toArray(interpretation.story_opportunities).filter(item => item.use_in_report),
    prohibited_or_unsupported_claims: [...new Set(prohibited)],
    writing_constraints: {
      player_relationship_rule: 'Only player_roles.assist_provider may be described as assisting. build_up_contributors are not assisters.',
      causation_rule: 'A sequence or pressure observation does not establish causation unless the observation explicitly states a supported relationship.',
      performance_rule: 'Do not infer dominance, comfort, deservedness, or a flattering margin from scoreline or one statistic alone.',
      social_rule: 'Reporter source IDs are used only when their factual_context is materially incorporated.'
    }
  };
}

module.exports = { buildEditorialDossierV4, DOSSIER_VERSION };
