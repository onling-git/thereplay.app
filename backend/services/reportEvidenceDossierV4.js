const DOSSIER_VERSION = 'v4-evidence-dossier-2026-09-01.1';
const { buildCommentEvidence } = require('../utils/commentEvidence');

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
  const runningScore = { home: 0, away: 0 };
  return ledger.map((event, offset) => {
    const detail = toArray(interpretation.scoring_evidence).find(item =>
      String(item.event_id || '') === String(event.event_id || '') ||
      (Number(item.minute) === Number(event.minute) && String(item.scorer || '') === String(event.scorer || ''))
    ) || {};
    const structured = detail.structured_details || {};
    const socialContext = toArray(detail.supporting_context);
    const scoreBefore = detail.score_before || `${runningScore.home}-${runningScore.away}`;
    if (event.side === 'home' || event.side === 'away') runningScore[event.side] += 1;
    const scoreAfter = detail.score_after || event.result || `${runningScore.home}-${runningScore.away}`;
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

function eventSide(event, match) {
  const team = String(event.team || event.team_name || event.participant_id || '').toLowerCase();
  const homeId = String(match.teams?.home?.team_id || match.home_team_id || '');
  const awayId = String(match.teams?.away?.team_id || match.away_team_id || '');
  if (team === 'home' || team === homeId || team === String(match.home_team || '').toLowerCase()) return 'home';
  if (team === 'away' || team === awayId || team === String(match.away_team || '').toLowerCase()) return 'away';
  return null;
}

function eventMinute(event) {
  const minute = Number(event.minute);
  const extraMinute = Number(event.extra_minute);
  return {
    minute: Number.isFinite(minute) ? minute : null,
    extra_minute: Number.isFinite(extraMinute) ? extraMinute : null
  };
}

function buildNonScoringContext(match) {
  const events = toArray(match.events).filter(event => event.rescinded !== true);
  const substitutions = [];
  const yellowCards = [];
  const dismissals = [];

  for (const event of events) {
    const type = String(event.type || '').toLowerCase().replace(/[\s-]/g, '_');
    const side = eventSide(event, match);
    const timing = eventMinute(event);
    const base = {
      event_id: event.id || null,
      side,
      player: event.player_name || event.player || null,
      ...timing
    };

    if (type === 'substitution') {
      substitutions.push({
        ...base,
        player_on: event.player_name || event.player || null,
        player_off: event.related_player_name || event.related_player || null,
        injured: event.injured === true
      });
    } else if (type === 'yellowcard') {
      yellowCards.push({ ...base, reason: event.info || null });
    } else if (type === 'redcard' || type === 'yellowredcard' || type === 'yellow_red_card') {
      dismissals.push({ ...base, dismissal_type: type, reason: event.info || null });
    }
  }

  return {
    substitutions,
    yellow_cards: yellowCards,
    dismissals,
    use_rules: {
      substitutions: 'Use only when a substitution is relevant to a later verified event or clearly adds match context. Do not infer it caused that event.',
      discipline: 'Use a dismissal or card only when its timing or direct match consequence is factual and materially helps explain the match. Do not claim it changed the game without supporting evidence.',
      comments: 'Raw provider comments are excluded because they may be duplicated, mistimed, or contradictory.'
    }
  };
}

function buildLineupContext(match, focusedSide) {
  const focusedLineup = toArray(match.lineup?.[focusedSide]);
  const fallbackLineup = toArray(match.lineups).filter(entry => String(entry.team_id) === String(match.teams?.[focusedSide]?.team_id));
  const lineup = focusedLineup.length > 0 ? focusedLineup : fallbackLineup;
  return {
    focused_team_players_available: lineup.length,
    starter_status_available: false
  };
}

function eventTimeValue(event) {
  const minute = Number(event.minute);
  const extraMinute = Number(event.extra_minute) || 0;
  return Number.isFinite(minute) ? (minute * 100) + extraMinute : null;
}

function buildEventRelationships(scoringFacts, nonScoringContext) {
  const substitution_contributions = nonScoringContext.substitutions.flatMap(substitution => {
    const substitutionTime = eventTimeValue(substitution);
    if (substitutionTime == null) return [];

    return scoringFacts
      .filter(scoringEvent => eventTimeValue(scoringEvent) > substitutionTime)
      .flatMap(scoringEvent => {
        const playerOn = String(substitution.player_on || '').trim().toLowerCase();
        const scorer = String(scoringEvent.player_roles.scorer || '').trim().toLowerCase();
        const assister = String(scoringEvent.player_roles.assist_provider || '').trim().toLowerCase();
        if (playerOn && playerOn === scorer) {
          return [{
            relationship: 'substitute_later_scored',
            substitution_event_id: substitution.event_id,
            scoring_fact_id: scoringEvent.fact_id,
            player: substitution.player_on,
            introduced_at: { minute: substitution.minute, extra_minute: substitution.extra_minute },
            contribution_at: { minute: scoringEvent.minute, extra_minute: scoringEvent.extra_minute },
            use_in_report: true,
            causation_limit: 'This establishes only that the player was introduced before scoring; do not infer the substitution caused the goal.'
          }];
        }
        if (playerOn && playerOn === assister) {
          return [{
            relationship: 'substitute_later_assisted',
            substitution_event_id: substitution.event_id,
            scoring_fact_id: scoringEvent.fact_id,
            player: substitution.player_on,
            introduced_at: { minute: substitution.minute, extra_minute: substitution.extra_minute },
            contribution_at: { minute: scoringEvent.minute, extra_minute: scoringEvent.extra_minute },
            use_in_report: true,
            causation_limit: 'This establishes only that the player was introduced before assisting; do not infer the substitution caused the goal.'
          }];
        }
        return [];
      });
  });

  const dismissal_penalty_chronology = nonScoringContext.dismissals.flatMap(dismissal => {
    const dismissalTime = eventTimeValue(dismissal);
    if (dismissalTime == null) return [];
    return scoringFacts
      .filter(scoringEvent => scoringEvent.event_type === 'penalty' && eventTimeValue(scoringEvent) > dismissalTime)
      .map(penalty => ({
        relationship: 'dismissal_preceded_penalty',
        dismissal_event_id: dismissal.event_id,
        dismissal_player: dismissal.player,
        dismissal_side: dismissal.side,
        dismissal_at: { minute: dismissal.minute, extra_minute: dismissal.extra_minute },
        penalty_fact_id: penalty.fact_id,
        penalty_player: penalty.scorer,
        penalty_side: penalty.side,
        penalty_at: { minute: penalty.minute, extra_minute: penalty.extra_minute },
        use_in_report: true,
        causation_limit: 'This establishes sequence only. Do not state that the dismissal caused, won, or conceded the penalty unless separate verified evidence explicitly establishes it.'
      }));
  });

  return {
    substitution_contributions,
    dismissal_penalty_chronology,
    score_state_guide: scoringFacts.map(event => ({
      fact_id: event.fact_id,
      score_before: event.score_before,
      score_after: event.score_after,
      labels: event.score_state_labels
    })),
    use_rules: [
      'Relationships identify chronology and explicit scorer/assist roles only.',
      'They do not establish tactical intent, causation, or whether an event changed the game.',
      'Use them only where they add factual context beyond the scoring ledger.'
    ]
  };
}

function buildEditorialBeats({ scoringFacts, interpretation, focusedSide, reporterFacts }) {
  const focusedScoring = scoringFacts.filter(event => event.focused_team_event);
  const oppositionScoring = scoringFacts.filter(event => !event.focused_team_event);
  const lateLeadGoal = focusedScoring.find(event =>
    event.score_state_labels.includes('late_event') &&
    event.score_state_labels.includes('established_or_restored_lead')
  );
  const finalMarginEvent = focusedScoring[focusedScoring.length - 1];
  const pressureObservations = toArray(interpretation.pressure_evidence?.useful_observations);
  const meaningfulPressure = pressureObservations.filter(item => /\d+\s*(to|-)\s*\d+|sustained|period/i.test(`${item.period || ''} ${item.observation || ''}`));

  const beats = [
    {
      beat_id: 'result_and_story',
      priority: 'primary',
      purpose: 'Orient the reader to the focused-club result and the match-defining story.',
      evidence_fact_ids: lateLeadGoal ? [lateLeadGoal.fact_id] : focusedScoring.slice(-1).map(event => event.fact_id),
      detail_level: 'standard'
    },
    {
      beat_id: 'early_phase_and_response',
      priority: 'supporting',
      purpose: 'Explain the opening phase and the opposition response only where those events clarify why the match remained live.',
      evidence_fact_ids: [...focusedScoring.slice(0, 1), ...oppositionScoring.slice(0, 1)].map(event => event.fact_id),
      detail_level: reporterFacts.length > 0 ? 'standard' : 'minimal'
    },
    {
      beat_id: 'level_match_phase',
      priority: 'primary',
      purpose: 'Explain any substantial level or balanced period before the decisive change, using pressure/progression as context rather than proof of causation.',
      evidence_fact_ids: lateLeadGoal ? [lateLeadGoal.fact_id] : [],
      pressure_observations: meaningfulPressure,
      detail_level: meaningfulPressure.length > 0 ? 'standard' : 'minimal'
    },
    {
      beat_id: 'decisive_sequence',
      priority: 'primary',
      purpose: 'Explain the event that established or restored the decisive advantage, then distinguish any later final-margin event.',
      evidence_fact_ids: [lateLeadGoal?.fact_id, finalMarginEvent?.fact_id].filter(Boolean),
      detail_level: lateLeadGoal ? 'detailed' : 'standard'
    },
    {
      beat_id: 'performance_reading',
      priority: 'supporting',
      purpose: 'Give a restrained reading of whether the scoreline reflected the match development; omit a stronger verdict when evidence is inconclusive.',
      evidence_fact_ids: scoringFacts.map(event => event.fact_id),
      pressure_observations: meaningfulPressure,
      detail_level: meaningfulPressure.length > 0 || reporterFacts.length > 0 ? 'standard' : 'minimal'
    },
    {
      beat_id: 'closing',
      priority: 'supporting',
      purpose: 'Close on what defined the focused-club result without repeating the full scoreline or inventing wider implications.',
      evidence_fact_ids: lateLeadGoal ? [lateLeadGoal.fact_id] : finalMarginEvent ? [finalMarginEvent.fact_id] : [],
      detail_level: 'minimal'
    }
  ];

  const substantiveBeats = beats.filter(beat => beat.detail_level !== 'minimal').length;
  return {
    report_depth: substantiveBeats >= 4 ? 'full' : substantiveBeats >= 2 ? 'standard' : 'concise',
    editorial_beats: beats,
    evidence_priority: {
      primary_fact_ids: [lateLeadGoal?.fact_id, finalMarginEvent?.fact_id].filter(Boolean),
      supporting_fact_ids: beats.flatMap(beat => beat.evidence_fact_ids).filter((id, index, ids) => ids.indexOf(id) === index),
      optional_context: interpretation.market_evidence?.use_in_report ? ['market_evidence'] : []
    }
  };
}

function buildEditorialDossierV4({ interpretation, authoritativeMatchFacts, teamFocus, teamSide, competitionContext, potm, match = {} }) {
  const focusedSide = teamSide === 'away' ? 'away' : 'home';
  const finalScore = authoritativeMatchFacts.final_score;
  const focusedScore = finalScore[focusedSide];
  const opponentScore = finalScore[focusedSide === 'home' ? 'away' : 'home'];
  const scoringFacts = buildScoringFacts(interpretation, authoritativeMatchFacts, focusedSide);
  const reporterFacts = buildReporterFacts(interpretation);
  const nonScoringContext = buildNonScoringContext(match);
  const eventRelationships = buildEventRelationships(scoringFacts, nonScoringContext);
  const commentEvidence = buildCommentEvidence(match).filter(item => item.use_in_report);
  const editorialGuidance = buildEditorialBeats({ scoringFacts, interpretation, focusedSide, reporterFacts });
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
    report_guidance: editorialGuidance,
    authoritative_facts: {
      final_score: finalScore,
      scoring_events: scoringFacts,
      data_warnings: authoritativeMatchFacts.validation_warnings || []
    },
    verified_match_context: {
      non_scoring_events: nonScoringContext,
      event_relationships: eventRelationships,
      lineup: buildLineupContext(match, focusedSide),
      comment_evidence: commentEvidence
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
