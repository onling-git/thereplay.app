// Offline test: run validateGeneratedReport against the actual bad Villa report and the good Spurs report
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'dummy-for-require';
const { validateGeneratedReport } = require('./services/matchReportWriter');

// Authoritative facts as the FIXED pipeline now produces them (with team names)
const facts = {
  final_score: { home: 2, away: 3 },
  teams: { home: 'Tottenham Hotspur', away: 'Aston Villa' },
  scoring_events: [
    { minute: 45, scorer: 'Johan Manzambi', side: 'away', team: 'Aston Villa', type: 'goal', result: '0-1', extra_minute: 4 },
    { minute: 67, scorer: 'Nicolas Jackson', side: 'away', team: 'Aston Villa', type: 'goal', result: '0-2', extra_minute: null },
    { minute: 79, scorer: 'Emiliano Buendía', side: 'away', team: 'Aston Villa', type: 'goal', result: '0-3', extra_minute: null },
    { minute: 86, scorer: 'Conor Gallagher', side: 'home', team: 'Tottenham Hotspur', type: 'goal', result: '1-3', extra_minute: null },
    { minute: 90, scorer: 'Jan Paul van Hecke', side: 'home', team: 'Tottenham Hotspur', type: 'goal', result: '2-3', extra_minute: 8 }
  ],
  goals: [],
  goal_events_reconciled: true,
  validation_warnings: []
};

// The ACTUAL bad report currently live for aston-villa
const badVillaReport = {
  headline: 'Aston Villa Falls Short Against Tottenham Hotspur',
  summary_paragraphs: [
    'Aston Villa faced Tottenham Hotspur at the Tottenham Hotspur Stadium in a competitive Premier League encounter. The match saw Tottenham take the lead just before halftime with a goal from Johan Manzambi, making it 0-1. This opener set the tone for the second half, where Tottenham would extend their advantage.',
    'In the second half, Tottenham scored two additional goals through Nicolas Jackson and Emiliano Buendía, making it 0-3. Despite facing sustained pressure from Aston Villa, Tottenham managed to capitalize on counter-attacks effectively.',
    'The market had viewed Aston Villa as underdogs going into the match, with a win probability of just 25%. However, their performance exceeded expectations, as they not only scored two late goals through Conor Gallagher and Jan Paul van Hecke, but also maintained composure despite late pressure from Tottenham.',
    'The final minutes saw a flurry of action, with Aston Villa pushing hard to equalize. Gallagher\'s goal in the 86th minute and Van Hecke\'s header in stoppage time brought the score to 2-3, but Tottenham held on to secure all three points.'
  ],
  key_moments: [
    '45\' - Johan Manzambi scores the opener for Tottenham, making it 0-1.',
    '67\' - Nicolas Jackson doubles Tottenham\'s lead, scoring to make it 0-2.',
    '79\' - Emiliano Buendía adds a third for Tottenham, extending the lead to 0-3.',
    '86\' - Conor Gallagher scores for Aston Villa, reducing the deficit to 1-3.',
    '90\' - Jan Paul van Hecke scores for Aston Villa, bringing the score to 2-3.'
  ],
  commentary: [],
  player_of_the_match: { player: 'X', reason: 'Y' }
};

// The ACTUAL good Spurs report (same match) - should produce NO attribution/winner issues
const goodSpursReport = {
  headline: 'Tottenham Hotspur Fall Short Against Aston Villa in Thrilling Encounter',
  summary_paragraphs: [
    'In a gripping Premier League clash at the Tottenham Hotspur Stadium, Spurs faced a challenging match against Aston Villa, ultimately succumbing to a 3-2 defeat. Johan Manzambi opened the scoring for Villa just before halftime, capitalizing on a moment of disarray in the Tottenham defense while they were temporarily down to ten men. This goal set the tone for a tough second half for the home side as Villa maintained their pressure.',
    'Aston Villa extended their lead in the second half with goals from Nicolas Jackson and Emiliano Buendía, showcasing their attacking prowess. Tottenham struggled to regain control, but their late surge saw Conor Gallagher and Jan Paul van Hecke score in quick succession, bringing the score to 3-2. However, it was not enough to secure a point, leaving Spurs to reflect on missed opportunities.',
    'Prior to the match, Tottenham were seen as slight favorites, with a win probability of 48.8%. This expectation was rooted in their home advantage, but the reality of the match revealed vulnerabilities in their defense, particularly during critical moments. Villa\'s goals came during periods of sustained pressure, while Tottenham\'s late goals were a result of increased attacking efforts as they sought to salvage the match.',
    'The decisive sequence of the match came when Villa scored their third goal, which put them in a commanding position. Tottenham\'s late response, although spirited, was too little too late. The home side\'s inability to equalize after their late goals highlighted their struggles throughout the match, particularly in the first half when they were unable to recover from Villa\'s early dominance.'
  ],
  key_moments: [
    '45\' - Johan Manzambi scores for Aston Villa, making it 0-1.',
    '67\' - Nicolas Jackson extends Villa\'s lead to 0-2.',
    '79\' - Emiliano Buendía adds a third for Villa, bringing the score to 0-3.',
    '86\' - Conor Gallagher scores for Tottenham, making it 1-3.',
    '90\' - Jan Paul van Hecke pulls another back for Tottenham, finalizing the score at 2-3.'
  ],
  commentary: [],
  player_of_the_match: { player: 'X', reason: 'Y' }
};

console.log('=== BAD VILLA REPORT (expect factual errors flagged) ===');
const badIssues = validateGeneratedReport(badVillaReport, facts);
badIssues.forEach(i => console.log(' -', i));
console.log(`Total: ${badIssues.length}`);

console.log('\n=== GOOD SPURS REPORT (expect NO factual attribution errors) ===');
const goodIssues = validateGeneratedReport(goodSpursReport, facts);
goodIssues.forEach(i => console.log(' -', i));
console.log(`Total: ${goodIssues.length}`);
