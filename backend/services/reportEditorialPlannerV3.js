// services/reportEditorialPlannerV3.js
// Run 2 in V3: editorial planner (no OpenAI call yet).

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toLower(value) {
  return String(value || '').toLowerCase();
}

function minuteLabel(minute, extraMinute) {
  if (!Number.isFinite(minute)) return 'unknown';
  return Number.isFinite(extraMinute) && extraMinute > 0
    ? `${minute}+${extraMinute}'`
    : `${minute}'`;
}

function normalizeTeamName(value) {
  return String(value || '').trim();
}

function scoreOpportunity(opportunity = {}) {
  let score = 0;

  if (opportunity.use_in_report === true) score += 2;

  if (opportunity.status === 'supported') score += 4;
  if (opportunity.status === 'permitted_with_evidence') score += 2;

  const confidence = toLower(opportunity.confidence);
  if (confidence === 'high') score += 3;
  if (confidence === 'medium') score += 1;

  const strength = toLower(opportunity.strength);
  if (strength === 'high') score += 3;
  if (strength === 'medium') score += 1;

  const evidence = toArray(opportunity.supporting_evidence);
  score += Math.min(evidence.length, 3);

  return score;
}

function chooseStoryAngles(storyOpportunities = []) {
  const scored = [...toArray(storyOpportunities)]
    .map(item => ({ ...item, _planner_score: scoreOpportunity(item) }))
    .sort((a, b) => b._planner_score - a._planner_score);

  const selected = scored.filter(item => item._planner_score > 0).slice(0, 2);
  const rejected = scored
    .filter(item => item._planner_score <= 0)
    .map(item => ({
      angle: item.angle || item.story || 'unspecified_opportunity',
      reason: 'insufficient_supported_evidence'
    }));

  const stripPlannerScore = item => {
    if (!item) return null;
    const { _planner_score, ...rest } = item;
    return rest;
  };

  const primary = stripPlannerScore(selected[0] || null);
  const secondary = stripPlannerScore(selected[1] || null);

  return {
    primary,
    secondary,
    selected: selected.map(stripPlannerScore),
    rejected
  };
}

function determineEvidenceLevel(evidenceRichness = {}, interpretation = {}) {
  const directLevel = toLower(evidenceRichness.level);
  if (['high', 'medium', 'low'].includes(directLevel)) return directLevel;

  const scoring = toArray(interpretation.scoring_evidence).length;
  const progressionFacts = toArray(interpretation.match_progression?.phases)
    .flatMap(phase => toArray(phase.facts)).length;
  const usefulPressure = toArray(interpretation.pressure_evidence?.useful_observations).length;
  const social = toArray(interpretation.social_context).filter(item => item.suitable_for_report).length;

  if (scoring >= 4 || progressionFacts >= 6 || usefulPressure >= 2 || social >= 2) return 'high';
  if (scoring >= 2 || progressionFacts >= 3 || usefulPressure >= 1 || social >= 1) return 'medium';
  return 'low';
}

function computePerspectiveResult({ finalScore = {}, teamSide }) {
  const home = Number(finalScore.home);
  const away = Number(finalScore.away);

  if (!Number.isInteger(home) || !Number.isInteger(away)) {
    return { outcome: 'unknown', focused_score: null, opponent_score: null, scoreline: null };
  }

  const focusedScore = teamSide === 'home' ? home : away;
  const opponentScore = teamSide === 'home' ? away : home;
  let outcome = 'draw';
  if (focusedScore > opponentScore) outcome = 'win';
  if (focusedScore < opponentScore) outcome = 'loss';

  return {
    outcome,
    focused_score: focusedScore,
    opponent_score: opponentScore,
    scoreline: `${focusedScore}-${opponentScore}`
  };
}

function classifyScoringEvents(scoringEvents = [], teamSide) {
  const eventRows = toArray(scoringEvents).map((event, index) => {
    const id = `score_evt_${index + 1}`;
    const isFocusedTeamEvent = event.side === teamSide;
    const minute = Number(event.minute);
    const extraMinute = Number(event.extra_minute);
    const lateGoal = Number.isFinite(minute) && (minute >= 80 || (minute >= 75 && Number.isFinite(extraMinute) && extraMinute > 0));

    return {
      id,
      minute,
      extra_minute: Number.isFinite(extraMinute) ? extraMinute : null,
      minute_label: minuteLabel(minute, Number.isFinite(extraMinute) ? extraMinute : null),
      scorer: event.scorer,
      side: event.side,
      is_focused_team_event: isFocusedTeamEvent,
      result: event.result || null,
      event_type: event.type || 'goal',
      late_goal: lateGoal
    };
  });

  const expand = [];
  const brief = [];
  const keyMomentsOnly = [];
  const omit = [];

  const focusedGoals = eventRows.filter(row => row.is_focused_team_event);
  const opponentGoals = eventRows.filter(row => !row.is_focused_team_event);

  for (const row of eventRows) {
    if (row.late_goal || row.id === eventRows[eventRows.length - 1]?.id) {
      expand.push(row.id);
      continue;
    }

    if (row.is_focused_team_event) {
      if (focusedGoals.length <= 2) expand.push(row.id);
      else brief.push(row.id);
      continue;
    }

    if (opponentGoals.length === 1) {
      brief.push(row.id);
      continue;
    }

    keyMomentsOnly.push(row.id);
  }

  return {
    events: eventRows,
    treatment: {
      expand_in_report: expand,
      mention_briefly: brief,
      key_moments_only: keyMomentsOnly,
      omit_from_body: omit,
      rationale: [
        'Prioritise late and state-changing events for expansion.',
        'Keep repeat or lower-impact scoring events concise unless needed for clarity.',
        'Use key moments for chronology when body detail would become repetitive.'
      ]
    }
  };
}

function buildVerifiedEventEvidence(match = {}, teamSide) {
  return toArray(match.events).map((event, index) => {
    const type = toLower(event.type).replace(/[\s-]/g, '_');
    const team = toLower(event.team || event.team_name || event.participant_id);
    const homeName = toLower(match.home_team || match.teams?.home?.team_name);
    const awayName = toLower(match.away_team || match.teams?.away?.team_name);
    const homeId = String(match.teams?.home?.team_id || match.home_team_id || '');
    const awayId = String(match.teams?.away?.team_id || match.away_team_id || '');
    const side = team === homeName || team === homeId || team === 'home' || team === '1'
      ? 'home'
      : team === awayName || team === awayId || team === 'away' || team === '2'
        ? 'away'
        : null;

    return {
      evidence_id: `verified_event_${index + 1}`,
      event_id: event.id || null,
      minute: Number.isFinite(Number(event.minute)) ? Number(event.minute) : null,
      extra_minute: Number.isFinite(Number(event.extra_minute)) ? Number(event.extra_minute) : null,
      type,
      side,
      is_focused_team_event: side === teamSide,
      player: event.player || event.player_name || null,
      related_player: event.related_player || event.related_player_name || null,
      info: event.info || null,
      result: event.result || null
    };
  });
}

function chooseEvidenceUsage({ interpretation, scoringEventsAnnotated, match, teamSide }) {
  const scoringEvidence = toArray(interpretation.scoring_evidence).map((item, index) => ({
    evidence_id: `scoring_evidence_${index + 1}`,
    event_id: item.event_id || null,
    minute: item.minute,
    extra_minute: item.extra_minute,
    scorer: item.scorer,
    side: item.side,
    structured_details: item.structured_details || {},
    supporting_context: item.supporting_context || []
  }));

  const progressionPhases = toArray(interpretation.match_progression?.phases).map((phase, index) => ({
    evidence_id: `phase_${index + 1}`,
    period: phase.period,
    facts: toArray(phase.facts),
    supported_changes: toArray(phase.supported_changes),
    uncertainties: toArray(phase.uncertainties)
  }));

  const pressureObservations = toArray(interpretation.pressure_evidence?.useful_observations).map((obs, index) => ({
    evidence_id: `pressure_obs_${index + 1}`,
    period: obs.period || null,
    observation: obs.observation || obs.statement || String(obs),
    relationship_to_match: obs.relationship_to_match || null,
    evidence_basis: toArray(obs.evidence_basis),
    confidence: obs.confidence || null
  }));

  const marketEvidence = interpretation.market_evidence && interpretation.market_evidence.use_in_report
    ? {
      evidence_id: 'market_context_1',
      pre_match_expectation: interpretation.market_evidence.pre_match_expectation || null,
      supported_observation: interpretation.market_evidence.supported_observation || null,
      useful_context: interpretation.market_evidence.useful_context || null,
      confidence: interpretation.market_evidence.confidence || null
    }
    : null;

  const socialEvidence = toArray(interpretation.social_context)
    .filter(item => item.suitable_for_report)
    .map(item => ({
      evidence_id: `social_${item.tweet_id}`,
      tweet_id: item.tweet_id,
      source: item.source || null,
      relevant_match_event: item.relevant_match_event || null,
      factual_context: item.factual_context || null,
      reason: item.reason || null,
      confidence: item.confidence || null
    }));

  const playerEvidence = toArray(interpretation.player_context?.evidence);
  const playerContributions = playerEvidence.map((entry, index) => ({
    evidence_id: `player_contribution_${index + 1}`,
    player: interpretation.player_context?.player || null,
    contribution: String(entry),
    confidence: interpretation.player_context?.confidence || null
  }));

  if (interpretation.player_context?.supported_reason && playerContributions.length === 0) {
    playerContributions.push({
      evidence_id: 'player_contribution_1',
      player: interpretation.player_context.player || null,
      contribution: interpretation.player_context.supported_reason,
      confidence: interpretation.player_context.confidence || null
    });
  }

  const scoringExpandedSet = new Set(scoringEventsAnnotated.treatment.expand_in_report);
  const scoringBriefSet = new Set(scoringEventsAnnotated.treatment.mention_briefly);

  const mappedScoringRefs = scoringEventsAnnotated.events.map((evt, idx) => ({
    event_id: evt.id,
    evidence_id: scoringEvidence[idx]?.evidence_id || null,
    treatment: scoringExpandedSet.has(evt.id)
      ? 'expand'
      : scoringBriefSet.has(evt.id)
        ? 'brief'
        : 'key_moments_only'
  }));

  return {
    scoring_evidence: scoringEvidence,
    match_progression: progressionPhases,
    pressure_observations: pressureObservations,
    market_context: marketEvidence,
    social_sources: socialEvidence,
    player_contributions: playerContributions,
    verified_events: buildVerifiedEventEvidence(match, teamSide),
    scoring_event_evidence_map: mappedScoringRefs
  };
}

function evidenceIdsForEventIds(eventIds, evidenceMap) {
  const eventSet = new Set(eventIds);
  return evidenceMap
    .filter(item => eventSet.has(item.event_id))
    .map(item => item.evidence_id)
    .filter(Boolean);
}

function buildCoreComponents({ evidenceLevel, scoringEventsAnnotated, evidenceUsage }) {
  const expandedEventIds = scoringEventsAnnotated.treatment.expand_in_report;
  const briefEventIds = scoringEventsAnnotated.treatment.mention_briefly;
  const firstPhase = evidenceUsage.match_progression[0];
  const allPhaseIds = evidenceUsage.match_progression.map(item => item.evidence_id);

  return [
    {
      component_id: 'opening',
      purpose: 'State the focused-club result, opponent, broad match story, and the reason this report matters.',
      priority: 'high',
      depth: 'medium',
      target_sentence_budget: evidenceLevel === 'high' ? 3 : 2,
      evidence_ids: [
        ...(firstPhase ? [firstPhase.evidence_id] : []),
        ...evidenceIdsForEventIds(briefEventIds.slice(0, 1), evidenceUsage.scoring_event_evidence_map)
      ],
      event_ids: briefEventIds.slice(0, 1)
    },
    {
      component_id: 'match_flow',
      purpose: 'Explain meaningful changes in the match rather than replaying the event sequence.',
      priority: 'high',
      depth: 'medium',
      target_sentence_budget: evidenceLevel === 'high' ? 3 : 2,
      evidence_ids: [...allPhaseIds, ...evidenceUsage.pressure_observations.map(item => item.evidence_id)],
      event_ids: [...briefEventIds, ...expandedEventIds]
    },
    {
      component_id: 'performance',
      purpose: 'Assess the focused-club performance beyond the scoreline using only evidence that clarifies how the match was played.',
      priority: 'high',
      depth: 'medium',
      target_sentence_budget: evidenceLevel === 'high' ? 3 : 2,
      evidence_ids: [
        ...evidenceUsage.match_progression.map(item => item.evidence_id),
        ...evidenceUsage.pressure_observations.map(item => item.evidence_id),
        ...toArray(evidenceUsage.market_context?.evidence_id)
      ],
      event_ids: []
    },
    {
      component_id: 'key_events',
      purpose: 'Give proportionate treatment to events that materially shaped the focused-club outcome.',
      priority: 'high',
      depth: 'high',
      target_sentence_budget: evidenceLevel === 'high' ? 3 : 2,
      evidence_ids: evidenceIdsForEventIds(expandedEventIds, evidenceUsage.scoring_event_evidence_map),
      event_ids: expandedEventIds
    },
    {
      component_id: 'closing',
      purpose: 'Conclude from the focused-club perspective using only significance established by the selected evidence.',
      priority: 'medium',
      depth: 'brief',
      target_sentence_budget: 1,
      evidence_ids: evidenceIdsForEventIds(expandedEventIds.slice(-1), evidenceUsage.scoring_event_evidence_map),
      event_ids: expandedEventIds.slice(-1)
    }
  ];
}

function buildOptionalComponentDecisions({ perspectiveResult, scoringEventsAnnotated, evidenceUsage, teamSide }) {
  const events = scoringEventsAnnotated.events;
  const verifiedEvents = evidenceUsage.verified_events;
  const expandedEventIds = scoringEventsAnnotated.treatment.expand_in_report;
  const finalEvent = events[events.length - 1];
  const materiallyChangesLateState = event => {
    const scoreAfter = String(event.result || '').split('-').map(Number);
    if (scoreAfter.length !== 2 || scoreAfter.some(score => !Number.isFinite(score))) return false;
    const scoreBefore = [...scoreAfter];
    scoreBefore[event.side === 'home' ? 0 : 1] -= 1;
    const beforeDifference = Math.abs(scoreBefore[0] - scoreBefore[1]);
    const afterDifference = Math.abs(scoreAfter[0] - scoreAfter[1]);
    return beforeDifference === 0 || afterDifference <= 1;
  };
  const hasLateExpandedEvent = events.some(event =>
    event.late_goal && expandedEventIds.includes(event.id) && materiallyChangesLateState(event)
  );
  const penaltyEvents = events.filter(event => event.event_type.includes('penalty'));
  const redCardEvents = verifiedEvents.filter(event => event.type.includes('redcard'));
  const yellowCardEvents = verifiedEvents.filter(event => event.type.includes('yellowcard'));
  const disallowedGoalEvents = verifiedEvents.filter(event => event.type.includes('disallowed'));
  const saveEvents = verifiedEvents.filter(event => event.type.includes('save'));
  const exceptionalScoringEvidence = evidenceUsage.scoring_evidence.filter(item => {
    const details = item.structured_details || {};
    return [details.shot_type, details.finish_detail, details.build_up]
      .some(value => /volley|overhead|long.range|free.kick|solo|spectacular|exceptional/i.test(String(value || '')));
  });
  const hasPenalty = penaltyEvents.length > 0;
  const hasRedCard = redCardEvents.length > 0;
  const hasDisciplinaryIncident = yellowCardEvents.length >= 4;
  const hasDisallowedGoal = disallowedGoalEvents.length > 0;
  const hasExceptionalGoal = exceptionalScoringEvidence.length > 0;
  const hasGoalkeepingHeroics = saveEvents.length >= 3;
  const hasStandoutIndividual = evidenceUsage.player_contributions.length > 0;
  const isLowEventMatch = events.length === 0 && evidenceUsage.pressure_observations.length === 0 && verifiedEvents.length <= 2;
  const focusedWasBehind = events.some(event => {
    const scores = String(event.result || '').split('-').map(Number);
    if (scores.length !== 2 || scores.some(score => !Number.isFinite(score))) return false;
    const focusedScore = teamSide === 'home' ? scores[0] : scores[1];
    const opponentScore = teamSide === 'home' ? scores[1] : scores[0];
    return focusedScore < opponentScore;
  });
  const focusedRecovered = perspectiveResult.outcome === 'win' && focusedWasBehind;
  const verifiedIds = matches => matches.map(event => event.evidence_id);
  const verifiedEventIds = matches => matches.map(event => event.event_id).filter(Boolean);

  const candidates = [
    {
      component_id: 'late_drama',
      eligible: hasLateExpandedEvent,
      selected: hasLateExpandedEvent,
      reason: hasLateExpandedEvent ? 'Late scoring event is selected for expanded treatment.' : 'No late event warrants expanded treatment.',
      evidence_ids: evidenceIdsForEventIds(expandedEventIds.filter(id => events.find(event => event.id === id)?.late_goal), evidenceUsage.scoring_event_evidence_map),
      event_ids: expandedEventIds.filter(id => events.find(event => event.id === id)?.late_goal),
      depth: hasLateExpandedEvent ? 'detailed' : 'minimal',
      target_sentence_budget: hasLateExpandedEvent ? 2 : 0,
      narrative_position: 'before_key_events',
      editorial_questions: [
        'Did the match change materially in the final 10-15 minutes?',
        'Did the late event establish a decisive advantage or only extend it?',
        'Does evidence show sustained pressure, or only temporal proximity?'
      ]
    },
    {
      component_id: 'comeback',
      eligible: focusedRecovered,
      selected: focusedRecovered && events.length >= 3,
      reason: focusedRecovered && events.length >= 3 ? 'Focused club recovered from a confirmed deficit and the scoring sequence makes that recovery materially relevant.' : focusedRecovered ? 'Focused club recovered from a short or sparsely evidenced deficit; keep it within core components.' : 'Focused club did not recover from a confirmed deficit to win.',
      evidence_ids: [],
      event_ids: [],
      depth: 'minimal',
      target_sentence_budget: 0,
      narrative_position: 'before_key_events',
      editorial_questions: [
        'Was the focused club behind, and for how long?',
        'Was the recovery gradual or sudden?',
        'Does the evidence make recovery the main story rather than a brief score change?'
      ]
    },
    {
      component_id: 'red_card',
      eligible: hasRedCard,
      selected: hasRedCard && (redCardEvents.some(event => event.minute == null || event.minute < 80)),
      reason: hasRedCard ? 'Verified dismissal is available; selected only where its timing could have affected match development.' : 'No verified red-card evidence supplied.',
      evidence_ids: verifiedIds(redCardEvents),
      event_ids: verifiedEventIds(redCardEvents),
      depth: hasRedCard ? 'standard' : 'minimal',
      target_sentence_budget: hasRedCard ? 2 : 0,
      narrative_position: 'after_match_flow',
      editorial_questions: [
        'Which club was dismissed, at what score, and in what match state?',
        'What verified evidence shows the match changed afterwards?',
        'Would omission make the report misleading?'
      ]
    },
    {
      component_id: 'disciplinary_incident',
      eligible: hasDisciplinaryIncident,
      selected: false,
      reason: hasDisciplinaryIncident ? 'Multiple verified cautions make this eligible, but cards alone do not establish editorial significance.' : 'No verified material disciplinary incident supplied.',
      evidence_ids: verifiedIds(yellowCardEvents),
      event_ids: verifiedEventIds(yellowCardEvents),
      depth: 'minimal',
      target_sentence_budget: 0,
      narrative_position: 'after_match_flow',
      editorial_questions: [
        'Did discipline change availability, risk, or match behaviour in a supported way?',
        'Is the incident more meaningful than Key Moments coverage alone?'
      ]
    },
    {
      component_id: 'penalty',
      eligible: hasPenalty,
      selected: hasPenalty && finalEvent?.event_type.includes('penalty') && expandedEventIds.includes(finalEvent.id) && materiallyChangesLateState(finalEvent),
      reason: hasPenalty && finalEvent?.event_type.includes('penalty') && expandedEventIds.includes(finalEvent.id) && materiallyChangesLateState(finalEvent)
        ? 'Final penalty materially changed a close late match state and may clarify the decisive sequence.'
        : hasPenalty ? 'Penalty is recorded but does not independently warrant a component.' : 'No verified penalty event supplied.',
      evidence_ids: evidenceIdsForEventIds(penaltyEvents.map(event => event.id), evidenceUsage.scoring_event_evidence_map),
      event_ids: penaltyEvents.map(event => event.id),
      depth: hasPenalty && finalEvent?.event_type.includes('penalty') ? 'standard' : 'minimal',
      target_sentence_budget: hasPenalty && finalEvent?.event_type.includes('penalty') ? 1 : 0,
      narrative_position: 'before_key_events',
      editorial_questions: [
        'Did the penalty equalise, put a club ahead, extend a lead, or merely set the final margin?',
        'Was it scored or missed, and was it late?',
        'Does it add more than a Key Moments entry?'
      ]
    },
    {
      component_id: 'disallowed_goal',
      eligible: hasDisallowedGoal,
      selected: false,
      reason: hasDisallowedGoal ? 'Verified disallowed-goal evidence is eligible but needs evidence that it materially altered the contest.' : 'No verified disallowed-goal evidence supplied.',
      evidence_ids: verifiedIds(disallowedGoalEvents),
      event_ids: verifiedEventIds(disallowedGoalEvents),
      depth: 'minimal',
      target_sentence_budget: 0,
      narrative_position: 'before_key_events',
      editorial_questions: [
        'Did the disallowed goal materially change the score, match state, or later narrative?',
        'Is the underlying decision verified rather than inferred?'
      ]
    },
    {
      component_id: 'exceptional_goal',
      eligible: hasExceptionalGoal,
      selected: hasExceptionalGoal && exceptionalScoringEvidence.length === 1,
      reason: hasExceptionalGoal && exceptionalScoringEvidence.length === 1 ? 'Specific goal-detail evidence identifies one genuinely noteworthy finish worth separate treatment.' : hasExceptionalGoal ? 'Goal-detail evidence exists but is too broad or repeated for separate treatment.' : 'No verified exceptional-goal evidence supplied.',
      evidence_ids: exceptionalScoringEvidence.map(item => item.evidence_id),
      event_ids: exceptionalScoringEvidence.map(item => item.event_id).filter(Boolean),
      depth: 'minimal',
      target_sentence_budget: 0,
      narrative_position: 'before_key_events',
      editorial_questions: [
        'What verified technique, distance, build-up, or finish detail makes the goal noteworthy?',
        'Can it be described factually without exaggeration?',
        'Does it add more than the key-event treatment?'
      ]
    },
    {
      component_id: 'goalkeeping_heroics',
      eligible: hasGoalkeepingHeroics,
      selected: false,
      reason: hasGoalkeepingHeroics ? 'Repeated verified saves make this eligible, but the planner needs evidence of material influence before selection.' : 'No verified goalkeeping-heroics evidence supplied.',
      evidence_ids: verifiedIds(saveEvents),
      event_ids: verifiedEventIds(saveEvents),
      depth: 'minimal',
      target_sentence_budget: 0,
      narrative_position: 'before_key_events',
      editorial_questions: [
        'Are repeated significant saves verified?',
        'Did they materially influence the result or a defining match phase?'
      ]
    },
    {
      component_id: 'standout_individual',
      eligible: hasStandoutIndividual,
      selected: hasStandoutIndividual,
      reason: hasStandoutIndividual ? 'Specific supported player contribution is available.' : 'No specific supported player contribution supplied.',
      evidence_ids: evidenceUsage.player_contributions.map(item => item.evidence_id),
      event_ids: [],
      depth: hasStandoutIndividual ? 'standard' : 'minimal',
      target_sentence_budget: hasStandoutIndividual ? 2 : 0,
      narrative_position: 'before_closing',
      editorial_questions: [
        'Did this player materially influence the focused-club result?',
        'Do multiple supported details justify more than a rating mention?',
        'Would this duplicate Player of the Match rather than add useful context?'
      ]
    },
    {
      component_id: 'low_event_match',
      eligible: isLowEventMatch,
      selected: isLowEventMatch,
      reason: isLowEventMatch ? 'Few meaningful events are available, so match texture needs explicit treatment.' : 'Match has sufficient material events for core components.',
      evidence_ids: evidenceUsage.match_progression.map(item => item.evidence_id),
      event_ids: [],
      depth: isLowEventMatch ? 'standard' : 'minimal',
      target_sentence_budget: isLowEventMatch ? 2 : 0,
      narrative_position: 'before_key_events',
      editorial_questions: [
        'Does evidence show genuinely few significant chances or sustained phases?',
        'Would describing the lack of events be more accurate than manufacturing a story?'
      ]
    }
  ];

  return {
    selected: candidates.filter(component => component.selected),
    rejected: candidates.filter(component => !component.selected),
    all: candidates
  };
}

function buildComponentPlan({ evidenceLevel, perspectiveResult, scoringEventsAnnotated, evidenceUsage, angles, teamSide }) {
  const coreComponents = buildCoreComponents({ evidenceLevel, scoringEventsAnnotated, evidenceUsage });
  const optionalComponents = buildOptionalComponentDecisions({ perspectiveResult, scoringEventsAnnotated, evidenceUsage, teamSide });
  const optionalAfterFlow = optionalComponents.selected
    .filter(component => component.narrative_position === 'after_match_flow')
    .map(component => component.component_id);
  const optionalBeforeKeyEvents = optionalComponents.selected
    .filter(component => component.narrative_position === 'before_key_events')
    .map(component => component.component_id);
  const optionalBeforeClosing = optionalComponents.selected
    .filter(component => component.narrative_position === 'before_closing')
    .map(component => component.component_id);
  const componentOrder = [
    'opening',
    'match_flow',
    ...optionalAfterFlow,
    'performance',
    ...optionalBeforeKeyEvents,
    'key_events',
    ...optionalBeforeClosing,
    'closing'
  ];

  const styleWarnings = [];
  if (perspectiveResult.outcome === 'win') {
    styleWarnings.push('Avoid generic celebratory endings; anchor the conclusion in specific evidence from the decisive sequence.');
  }
  if (perspectiveResult.outcome === 'loss') {
    styleWarnings.push('Do not force positive spin unsupported by evidence; keep focus on credible turning points.');
  }
  if (angles.primary) {
    styleWarnings.push('Primary angle is selected from supported opportunities; do not reuse rejected opportunities as fallback prose.');
  }

  return {
    core_components: coreComponents,
    optional_components: optionalComponents,
    selected_components: [...coreComponents, ...optionalComponents.selected],
    component_order: componentOrder,
    style_warnings: styleWarnings
  };
}

function buildHeadlineDirection({ scoringEventsAnnotated, perspectiveResult, teamSide, finalScore }) {
  const lastEvent = scoringEventsAnnotated.events[scoringEventsAnnotated.events.length - 1] || null;
  const winnerSide = Number(finalScore?.home) > Number(finalScore?.away)
    ? 'home'
    : Number(finalScore?.away) > Number(finalScore?.home)
      ? 'away'
      : null;

  let runningHome = 0;
  let runningAway = 0;
  let candidateDecisive = null;
  for (const event of scoringEventsAnnotated.events) {
    const beforeHome = runningHome;
    const beforeAway = runningAway;

    if (event.side === 'home') runningHome += 1;
    if (event.side === 'away') runningAway += 1;

    if (!winnerSide) continue;

    const winnerWasLeadingBefore = winnerSide === 'home'
      ? beforeHome > beforeAway
      : beforeAway > beforeHome;
    const winnerLeadsNow = winnerSide === 'home'
      ? runningHome > runningAway
      : runningAway > runningHome;

    const establishesLead = !winnerWasLeadingBefore && winnerLeadsNow;
    if (establishesLead) {
      candidateDecisive = event;
    }
  }

  const lastWinnerScoring = [...scoringEventsAnnotated.events].reverse().find(evt => evt.side === winnerSide);

  const allowedLabels = [];
  if (lastEvent) {
    allowedLabels.push({
      label: 'final_goal',
      event_id: lastEvent.id,
      when_valid: 'Only for the final recorded scoring event.'
    });
  }
  if (lastWinnerScoring) {
    allowedLabels.push({
      label: 'sealing_goal',
      event_id: lastWinnerScoring.id,
      when_valid: 'Only when the goal extends/restores a lead close to full time and evidence supports that framing.'
    });
  }
  if (candidateDecisive) {
    allowedLabels.push({
      label: 'winning_or_decisive_goal',
      event_id: candidateDecisive.id,
      when_valid: 'Editorial judgement allowed when context shows this materially shifted likely outcome; not automatic from chronology.'
    });
  }

  return {
    focused_side: teamSide,
    focused_outcome: perspectiveResult.outcome,
    suggested_headline_focus: perspectiveResult.outcome === 'win'
      ? 'How the focused club turned the key phase into a winning margin.'
      : perspectiveResult.outcome === 'loss'
        ? 'How the focused club competed and where the match decisively moved away.'
        : 'How the focused club matched the opponent and what separated phases of control.',
    allowed_event_labels: allowedLabels,
    avoid_labels: [
      'Do not call an earlier goal the final or sealing goal if a later scoring event exists.',
      'Do not apply winning/decisive language mechanically to mid-match goals without contextual support.'
    ]
  };
}

function buildPerformanceAssessment({ evidenceUsage, scoringEventsAnnotated, perspectiveResult }) {
  const evidenceIds = [
    ...evidenceUsage.match_progression.map(item => item.evidence_id),
    ...evidenceUsage.pressure_observations.map(item => item.evidence_id),
    ...evidenceUsage.social_sources.map(item => item.evidence_id)
  ];

  const hasTriangulatedEvidence = evidenceIds.length >= 2;
  const lateExpandedEvents = scoringEventsAnnotated.events.filter(event =>
    event.late_goal && scoringEventsAnnotated.treatment.expand_in_report.includes(event.id)
  );

  return {
    question: 'Did the scoreline accurately represent the balance and development of the match from the focused-club perspective?',
    judgement_status: hasTriangulatedEvidence ? 'evidence_available_for_editorial_judgement' : 'keep_restrained',
    scoreline_representation: 'do_not_infer_from_scoreline_alone',
    focused_outcome: perspectiveResult.outcome,
    relevant_evidence_ids: evidenceIds,
    contextual_factors: {
      expanded_late_events: lateExpandedEvents.map(event => event.id),
      pressure_observations_available: evidenceUsage.pressure_observations.length,
      suitable_social_sources_available: evidenceUsage.social_sources.length
    },
    editorial_questions: [
      'Do match progression, pressure, statistics, and credible reporter evidence point to the same match interpretation?',
      'Did the margin arise from a sustained pattern, a late sequence, or a major incident?',
      'What cannot safely be concluded from the available evidence?'
    ],
    restraint_rule: 'Do not call the performance dominant, comfortable, deserved, or flattering unless the combined evidence supports that precise judgement.'
  };
}

function buildEditorialPlan({
  interpretation,
  authoritativeMatchFacts,
  teamFocus,
  teamSide,
  teamSlug,
  match,
  competitionContext
}) {
  const focusedTeamName = normalizeTeamName(teamFocus);
  const homeName = normalizeTeamName(match?.home_team || match?.teams?.home?.team_name);
  const awayName = normalizeTeamName(match?.away_team || match?.teams?.away?.team_name);
  const focusedSide = teamSide === 'away' ? 'away' : 'home';
  const opponentName = focusedSide === 'home' ? awayName : homeName;
  const homeSlug = String(match?.home_team_slug || match?.teams?.home?.team_slug || '').toLowerCase();
  const awaySlug = String(match?.away_team_slug || match?.teams?.away?.team_slug || '').toLowerCase();
  const focusedSlug = String(teamSlug || '').toLowerCase();
  const opponentSlug = focusedSide === 'home' ? awaySlug : homeSlug;

  const perspectiveResult = computePerspectiveResult({
    finalScore: authoritativeMatchFacts?.final_score || {},
    teamSide: focusedSide
  });

  const evidenceLevel = determineEvidenceLevel(interpretation.evidence_richness, interpretation);
  const angles = chooseStoryAngles(toArray(interpretation.story_opportunities));
  const scoringEventsAnnotated = classifyScoringEvents(authoritativeMatchFacts?.scoring_events, focusedSide);
  const evidenceUsage = chooseEvidenceUsage({
    interpretation,
    scoringEventsAnnotated,
    match,
    teamSide: focusedSide
  });
  const componentPlan = buildComponentPlan({
    evidenceLevel,
    perspectiveResult,
    scoringEventsAnnotated,
    evidenceUsage,
    angles,
    teamSide: focusedSide
  });
  const headlineDirection = buildHeadlineDirection({
    scoringEventsAnnotated,
    perspectiveResult,
    teamSide: focusedSide,
    finalScore: authoritativeMatchFacts?.final_score || {}
  });
  const performanceAssessment = buildPerformanceAssessment({
    evidenceUsage,
    scoringEventsAnnotated,
    perspectiveResult
  });

  return {
    planner_version: 'v3-planner-2026-08-26.2',
    planner_role: 'run2_editorial_planner',
    focused_club: {
      name: focusedTeamName,
      slug: focusedSlug,
      side: focusedSide,
      is_home: focusedSide === 'home'
    },
    opponent: {
      name: opponentName,
      slug: opponentSlug,
      side: focusedSide === 'home' ? 'away' : 'home'
    },
    result_context: {
      focused_outcome: perspectiveResult.outcome,
      focused_scoreline: perspectiveResult.scoreline,
      focused_score: perspectiveResult.focused_score,
      opponent_score: perspectiveResult.opponent_score,
      authoritative_final_score: authoritativeMatchFacts?.final_score || null
    },
    competition_context: {
      name: competitionContext?.name || null,
      stage: competitionContext?.stage || null,
      is_cup: Boolean(competitionContext?.is_cup)
    },
    evidence_hierarchy: [
      'authoritative_match_facts',
      'canonical_run1_evidence',
      'story_opportunities'
    ],
    story_selection: {
      primary_angle: angles.primary,
      secondary_angle: angles.secondary,
      selected_opportunities: angles.selected,
      rejected_opportunities: angles.rejected
    },
    evidence_level: evidenceLevel,
    component_plan: {
      core_components: componentPlan.core_components,
      optional_components: componentPlan.optional_components,
      selected_components: componentPlan.selected_components,
      component_order: componentPlan.component_order
    },
    performance_assessment: performanceAssessment,
    event_treatment: {
      events: scoringEventsAnnotated.events,
      ...scoringEventsAnnotated.treatment
    },
    evidence_usage: {
      scoring_event_evidence_map: evidenceUsage.scoring_event_evidence_map,
      statistics_worth_using: toArray(interpretation.statistical_evidence)
        .filter(item => item.use_in_report === true)
        .slice(0, 4),
      pressure_worth_using: evidenceUsage.pressure_observations,
      market_worth_using: evidenceUsage.market_context,
      social_sources_worth_using: evidenceUsage.social_sources,
      player_contributions_worth_using: evidenceUsage.player_contributions
    },
    headline_direction: headlineDirection,
    language_style: {
      publication_identity: `${focusedTeamName}-focused football reporting`,
      objective: 'Most interesting supported account for the focused club; more meaning per sentence over volume.',
      avoid: [
        'chronological event dumping',
        'repetitive score descriptions',
        'generic match-tension statements',
        'unnecessary statistics',
        'forced use of every evidence type',
        'repeating the same event in multiple sections',
        'formulaic paragraph structures',
        'artificial drama',
        'generic secured-all-three-points endings'
      ],
      causation_guardrail: 'Temporal sequence is not sufficient proof of causation.',
      relationship_guardrail: 'Do not upgrade involvement to assist or proximity to causation without explicit evidence.',
      anti_padding_rule: 'Every paragraph must add interpretation, explanation, context, or meaningful new information.'
    },
    anti_robotic_checks: [
      'No sentence should restate an already-established scoring fact without adding new meaning.',
      'No component should repeat the same event detail unless it introduces materially different context.',
      'Do not include a statistic unless it explains a specific match development.',
      'Do not include social evidence unless it adds factual value beyond structured match evidence.'
    ],
    narrative_warnings: toArray(interpretation.narrative_warnings),
    writer_handoff: {
      must_cover: componentPlan.component_order.slice(0, 3),
      may_cover: componentPlan.component_order.slice(3),
      must_avoid: [
        'invented psychology or tactics without evidence',
        'unsupported cause-effect claims',
        'misattributed player-event relationships'
      ],
      style_warnings: componentPlan.style_warnings
    }
  };
}

function applyEditorialPlanToWriterInput({ interpretation, editorialPlan, authoritativeMatchFacts }) {
  const selected = toArray(editorialPlan.story_selection?.selected_opportunities);

  return {
    ...interpretation,
    story_opportunities: selected.length > 0 ? selected : toArray(interpretation.story_opportunities),
    editorial_plan: editorialPlan,
    editorial_focus: {
      evidence_level: editorialPlan.evidence_level,
      primary_angle: editorialPlan.story_selection?.primary_angle || null,
      component_order: toArray(editorialPlan.component_plan?.component_order)
    },
    authoritative_match_facts: authoritativeMatchFacts
  };
}

module.exports = {
  buildEditorialPlan,
  applyEditorialPlanToWriterInput
};
