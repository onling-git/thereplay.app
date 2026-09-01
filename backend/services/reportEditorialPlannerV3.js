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

function chooseEvidenceUsage({ interpretation, scoringEventsAnnotated }) {
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
    statement: obs.statement || obs.observation || String(obs),
    why_useful: obs.why_useful || null
  }));

  const marketEvidence = interpretation.market_evidence && interpretation.market_evidence.use_in_report
    ? {
      evidence_id: 'market_context_1',
      implied_probabilities: interpretation.market_evidence.implied_probabilities || null,
      concise_context: interpretation.market_evidence.concise_context || null
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

  const playerContributions = toArray(interpretation.player_context?.notable_contributions).map((entry, index) => ({
    evidence_id: `player_contribution_${index + 1}`,
    player: entry.player || entry.name || null,
    contribution: entry.contribution || entry.detail || String(entry),
    confidence: entry.confidence || null
  }));

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
    scoring_event_evidence_map: mappedScoringRefs
  };
}

function buildComponentPlan({
  evidenceLevel,
  perspectiveResult,
  scoringEventsAnnotated,
  evidenceUsage,
  angles
}) {
  const components = [];

  const addComponent = component => components.push(component);

  addComponent({
    component_id: 'opening_context',
    purpose: 'Set match framing for the focused club and establish the central storyline quickly.',
    priority: 'high',
    depth: 'medium',
    target_sentence_budget: evidenceLevel === 'high' ? 3 : 2,
    evidence_ids: [
      ...(evidenceUsage.match_progression[0] ? [evidenceUsage.match_progression[0].evidence_id] : []),
      ...(evidenceUsage.scoring_event_evidence_map[0]?.evidence_id ? [evidenceUsage.scoring_event_evidence_map[0].evidence_id] : [])
    ],
    event_ids: scoringEventsAnnotated.events.slice(0, 1).map(evt => evt.id)
  });

  if (scoringEventsAnnotated.events.length >= 2) {
    addComponent({
      component_id: 'match_ebb_and_flow',
      purpose: 'Explain the most meaningful response or state change instead of listing every scoring event.',
      priority: 'high',
      depth: 'medium',
      target_sentence_budget: 2,
      evidence_ids: evidenceUsage.match_progression.slice(0, 2).map(item => item.evidence_id),
      event_ids: scoringEventsAnnotated.treatment.mention_briefly
    });
  }

  if (evidenceUsage.pressure_observations.length > 0) {
    addComponent({
      component_id: 'pressure_phase',
      purpose: 'Use only concrete pressure-phase observations that materially clarify a later development.',
      priority: 'high',
      depth: 'medium',
      target_sentence_budget: 2,
      evidence_ids: evidenceUsage.pressure_observations.slice(0, 2).map(item => item.evidence_id),
      event_ids: scoringEventsAnnotated.treatment.expand_in_report
    });
  }

  addComponent({
    component_id: 'decisive_sequence',
    purpose: 'Detail the late or state-changing sequence that most strongly determined the focused club outcome.',
    priority: 'high',
    depth: 'high',
    target_sentence_budget: evidenceLevel === 'high' ? 3 : 2,
    evidence_ids: evidenceUsage.scoring_event_evidence_map
      .filter(item => scoringEventsAnnotated.treatment.expand_in_report.includes(item.event_id))
      .map(item => item.evidence_id)
      .filter(Boolean),
    event_ids: scoringEventsAnnotated.treatment.expand_in_report
  });

  if (evidenceUsage.market_context) {
    addComponent({
      component_id: 'market_context',
      purpose: 'Add concise expectation context only if it sharpens interpretation of the focused-club result.',
      priority: 'low',
      depth: 'brief',
      target_sentence_budget: 1,
      evidence_ids: [evidenceUsage.market_context.evidence_id],
      event_ids: []
    });
  }

  if (evidenceUsage.social_sources.length > 0) {
    addComponent({
      component_id: 'social_context',
      purpose: 'Use a specific source detail only if it adds non-duplicative factual context.',
      priority: 'low',
      depth: 'brief',
      target_sentence_budget: 1,
      evidence_ids: evidenceUsage.social_sources.slice(0, 2).map(item => item.evidence_id),
      event_ids: []
    });
  }

  const selectedOrder = components.map(component => component.component_id);

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
    selected_components: components,
    component_order: selectedOrder,
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
  const evidenceUsage = chooseEvidenceUsage({ interpretation, scoringEventsAnnotated });
  const componentPlan = buildComponentPlan({
    evidenceLevel,
    perspectiveResult,
    scoringEventsAnnotated,
    evidenceUsage,
    angles
  });
  const headlineDirection = buildHeadlineDirection({
    scoringEventsAnnotated,
    perspectiveResult,
    teamSide: focusedSide,
    finalScore: authoritativeMatchFacts?.final_score || {}
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
      selected_components: componentPlan.selected_components,
      component_order: componentPlan.component_order
    },
    event_treatment: {
      events: scoringEventsAnnotated.events,
      ...scoringEventsAnnotated.treatment
    },
    evidence_usage: {
      scoring_event_evidence_map: evidenceUsage.scoring_event_evidence_map,
      statistics_worth_using: toArray(interpretation.statistical_evidence?.key_metrics).slice(0, 4),
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
