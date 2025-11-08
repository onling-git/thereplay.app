// models/Match.js
const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    // raw provider fields (keep names close to provider for ease of debugging)
    id: { type: Number },
    fixture_id: { type: Number },
    period_id: { type: Number },
    detailed_period_id: { type: Number },
    participant_id: { type: Number },

    // canonical fields
    minute: { type: Number, default: null },
    extra_minute: { type: Number, default: null },
    type_id: { type: Number, default: null },
    // store the canonical uppercase provider code (e.g., SUBSTITUTION, GOAL)
    type: { type: String, default: "" },
    sub_type_id: { type: Number, default: null },
    sub_type: { type: String, default: "" },

    // participants
    player_id: { type: mongoose.Schema.Types.Mixed, default: null },
    player_name: { type: String, default: "" },
    related_player_id: { type: mongoose.Schema.Types.Mixed, default: null },
    related_player_name: { type: String, default: "" },

    // team / participant
    participant_id: { type: Number, default: null },
    section: { type: String, default: "" },

    // flags and additional info
    // tri-state: true | false | null (null = unknown/not provided)
    injured: { type: Boolean, default: null },
    on_bench: { type: Boolean, default: false },
    coach_id: { type: Number, default: null },
    rescinded: { type: Boolean, default: false },
    sort_order: { type: Number, default: null },

    // textual fields
    player: { type: String, default: "" }, // backward compat
    related_player: { type: String, default: "" },
    player_name: { type: String, default: "" },
    related_player_name: { type: String, default: "" },
    team: { type: String, default: "" },
    result: { type: String, default: null },
    info: { type: String, default: "" },
    addition: { type: String, default: "" },
  },
  { _id: false }
);

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const MatchSchema = new mongoose.Schema(
  {
    match_id: { type: Number, required: true, index: true },

    match_info: {
      starting_at: { type: Date, required: true }, // ISO date
      starting_at_timestamp: { type: Number, default: null }, // unix timestamp
      venue: {
        id: { type: Number, default: null },
        name: { type: String, default: "" },
        address: { type: String, default: "" },
        capacity: { type: Number, default: null },
        image_path: { type: String, default: "" },
        city_name: { type: String, default: "" },
      },
      referee: {
        id: { type: Number, default: null },
        name: { type: String, default: "" },
        common_name: { type: String, default: "" },
        firstname: { type: String, default: "" },
        lastname: { type: String, default: "" },
        image_path: { type: String, default: "" },
      },
      season: {
        id: { type: Number, default: null },
        name: { type: String, default: "" },
        is_current: { type: Boolean, default: false },
        starting_at: { type: Date, default: null },
        ending_at: { type: Date, default: null },
      },
      league: {
        id: { type: Number, default: null },
        name: { type: String, default: "" },
        short_code: { type: String, default: "" },
        image_path: { type: String, default: "" },
        country_id: { type: Number, default: null },
      },
      // Deprecated: `status` and `status_code` removed in favor of `match_status` object
      minute: { type: Number, default: null }, // current minute if live
      time_added: {
        first_half: { type: Number, default: null }, // e.g., +2
        second_half: { type: Number, default: null },
      }, // e.g., +4
    },

    // Backwards-compatible top-level date (kept in sync with match_info.starting_at)
    date: { type: Date },

    teams: {
      home: {
        team_name: { type: String, default: "" },
        team_id: { type: mongoose.Schema.Types.Mixed, default: null },
        team_slug: { type: String, default: "" },
      },
      away: {
        team_name: { type: String, default: "" },
        team_id: { type: mongoose.Schema.Types.Mixed, default: null },
        team_slug: { type: String, default: "" },
      },
    },

    score: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 },
    },

    events: [EventSchema],
    comments: [
      {
        comment_id: Number,
        fixture_id: Number,
        comment: String,
        minute: Number,
        extra_minute: Number,
        is_goal: Boolean,
        is_important: Boolean,
        order: Number,
      },
    ],

    // lineups: arrays of player entries for each side when available
    lineups: [
      {
        player_id: mongoose.Schema.Types.Mixed,
        team_id: mongoose.Schema.Types.Mixed,
        player_name: String,
        position_id: Number,
        formation_field: String,
        formation_position: Number,
        jersey_number: Number,
        type_id: Number,
        rating: { type: Number, default: null, required: false },
      },
    ],
    
    // normalized lineup structure with ratings integrated (derived from lineups array)
    lineup: {
      home: [{
        player_id: { type: mongoose.Schema.Types.Mixed },
        player_name: { type: String },
        jersey_number: { type: Number },
        position_id: { type: Number },
        rating: { type: Number, default: null }
      }],
      away: [{
        player_id: { type: mongoose.Schema.Types.Mixed },
        player_name: { type: String },
        jersey_number: { type: Number },
        position_id: { type: Number },
        rating: { type: Number, default: null }
      }]
    },
    
    // provider player ratings (kept verbatim when available)
    player_ratings: { type: [mongoose.Schema.Types.Mixed], default: [] },
 

    // canonical provider state object (from SportMonks states endpoint) - preferred
    // keeps the full provider payload so we can render user-friendly names/codes
    match_status: {
      id: { type: Number, default: null },
      state: { type: String, default: "" },
      name: { type: String, default: "" },
      short_name: { type: String, default: "" },
      developer_name: { type: String, default: "" },
    },
    // Per-team POTM: potm.home and potm.away. This replaces player_of_the_match_home/_away
    potm: {
      home: {
        player: { type: String, default: "" },
        rating: { type: Number, default: null },
        reason: { type: String, default: "" },
        source: { type: String, default: "" },
      },
      away: {
        player: { type: String, default: "" },
        rating: { type: Number, default: null },
        reason: { type: String, default: "" },
        source: { type: String, default: "" },
      },
    },
    // Generic reference to a most-recently-created Report document (optional)
  
    reports: {
      // per-team report references (store Report _id for home and away)
      home: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
      away: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
      generated_at: {
        type: Date,
        default: null,
      },
      model: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// Helpful indexes for queries we do
MatchSchema.index({ home_team: 1, date: -1 });
MatchSchema.index({ away_team: 1, date: -1 });
MatchSchema.index({ home_team_slug: 1, date: -1 });
MatchSchema.index({ away_team_slug: 1, date: -1 });
// index the new canonical nested starting_at for performance on new-style documents
MatchSchema.index({ "match_info.starting_at": 1 });

// Ensure slugs are present on save
MatchSchema.pre("save", async function (next) {
  // keep nested teams in sync for backward/forward compatibility
  try {
    if (this.home_team && !this.home_team_slug) this.home_team_slug = slugify(this.home_team);
    if (this.away_team && !this.away_team_slug) this.away_team_slug = slugify(this.away_team);

    if (!this.teams) this.teams = {};
    if (!this.teams.home) this.teams.home = {};
    if (!this.teams.away) this.teams.away = {};

    this.teams.home.team_name = this.home_team || this.teams.home.team_name || "";
    this.teams.home.team_id = this.home_team_id ?? this.teams.home.team_id ?? null;
    this.teams.home.team_slug = this.home_team_slug || this.teams.home.team_slug || "";

    this.teams.away.team_name = this.away_team || this.teams.away.team_name || "";
    this.teams.away.team_id = this.away_team_id ?? this.teams.away.team_id ?? null;
    this.teams.away.team_slug = this.away_team_slug || this.teams.away.team_slug || "";
  } catch (e) {
    // non-fatal
  }

  // Keep top-level date in sync with nested match_info.starting_at for compatibility
  try {
    if (this.match_info && this.match_info.starting_at) {
      this.date = this.match_info.starting_at;
    } else if (this.date && (!this.match_info || !this.match_info.starting_at)) {
      if (!this.match_info) this.match_info = {};
      this.match_info.starting_at = this.date;
    }
  } catch (e) {
    // non-fatal
  }

  // Capture previous match state so post hook can detect transition into 'finished'
  try {
    if (!this.isNew && this._id) {
      const prev = await this.constructor.findById(this._id).lean();
      this._previousMatchState = prev && (prev.match_status?.state || prev.match_status?.name || prev.status);
    } else {
      this._previousMatchState = null;
    }
  } catch (e) {
    this._previousMatchState = null;
  }

  next();
});

// Ensure slugs are present on findOneAndUpdate
MatchSchema.pre("findOneAndUpdate", async function (next) {
  // capture the previous doc so the post hook can detect transitions
  try {
    const prevDoc = await this.model.findOne(this.getQuery()).lean();
    this._previousMatchDoc = prevDoc;
  } catch (e) {
    this._previousMatchDoc = null;
  }

  const u = this.getUpdate() || {};
  const set = u.$set || u;

  if (set.home_team && !set.home_team_slug)
    set.home_team_slug = slugify(set.home_team);
  if (set.away_team && !set.away_team_slug)
    set.away_team_slug = slugify(set.away_team);

  if (u.$set) this.setUpdate({ ...u, $set: set });
  // Also ensure teams.* are set when updating via findOneAndUpdate
  try {
    const teams = set.teams || {};
    const homeName =
      set.home_team ||
      set.home_team_slug ||
      (teams.home && teams.home.team_name) ||
      null;
    const awayName =
      set.away_team ||
      set.away_team_slug ||
      (teams.away && teams.away.team_name) ||
      null;

    // Only create/update nested teams when there is actual team info to write.
    // Creating empty `teams.home` / `teams.away` objects here when the update
    // payload doesn't contain any team fields causes unintended overwrites of
    // the stored team data (it sets the nested object to {}). Guard against that
    // by checking for explicit values or incoming nested team payload.
    const shouldSetHome = Boolean(
      homeName ||
        set.home_team_id != null ||
        set.home_team_slug ||
        (teams.home && Object.keys(teams.home).length)
    );
    const shouldSetAway = Boolean(
      awayName ||
        set.away_team_id != null ||
        set.away_team_slug ||
        (teams.away && Object.keys(teams.away).length)
    );

    if (shouldSetHome) {
      set["teams.home"] = set["teams.home"] || {};
      if (homeName) set["teams.home"].team_name = homeName;
      if (set.home_team_id != null)
        set["teams.home"].team_id = set.home_team_id;
      if (set.home_team_slug) set["teams.home"].team_slug = set.home_team_slug;
    }

    if (shouldSetAway) {
      set["teams.away"] = set["teams.away"] || {};
      if (awayName) set["teams.away"].team_name = awayName;
      if (set.away_team_id != null)
        set["teams.away"].team_id = set.away_team_id;
      if (set.away_team_slug) set["teams.away"].team_slug = set.away_team_slug;
    }

    if (u.$set) this.setUpdate({ ...u, $set: set });
  } catch (e) {
    // non-fatal
  }
  // Keep date and match_info.starting_at in sync when updating via findOneAndUpdate
  try {
    const newSet = this.getUpdate().$set || this.getUpdate();
    const ms = newSet.match_info && newSet.match_info.starting_at;
    if (ms) {
      // if nested starting_at provided, mirror to top-level date
      set.date = new Date(ms);
    } else if (
      newSet.date &&
      (!newSet.match_info || !newSet.match_info.starting_at)
    ) {
      // if top-level date provided, mirror into nested match_info
      set.match_info = set.match_info || {};
      set.match_info.starting_at = newSet.date;
    }
    if (u.$set) this.setUpdate({ ...u, $set: set });
  } catch (e) {
    // non-fatal
  }
  next();
});

// When a match becomes finished, update the corresponding Team documents
// with `last_match_info` and recompute `next_match_info` for each team.
const Team = require('./Team');

async function updateTeamsForFinishedMatch(matchDoc) {
  try {
    if (!matchDoc) return;
    const state = matchDoc.match_status && (matchDoc.match_status.state || matchDoc.match_status.name || matchDoc.status);
    const s = String(state || '').toLowerCase();
    if (!s.includes('finished')) return; // only act when finished

    const matchDate = matchDoc.match_info?.starting_at || matchDoc.date || new Date();
    const matchId = matchDoc.match_id;

    const sides = [
      { side: 'home', team: matchDoc.teams?.home },
      { side: 'away', team: matchDoc.teams?.away }
    ];

    for (const t of sides) {
      const teamRawId = t.team?.team_id ?? null;
      if (!teamRawId) continue;
      const teamIdNum = Number(teamRawId);
      if (!Number.isFinite(teamIdNum)) continue;

      const isHome = t.side === 'home';
      const opponent = isHome ? (matchDoc.teams?.away?.team_name || matchDoc.away_team) : (matchDoc.teams?.home?.team_name || matchDoc.home_team);
      const goals_for = isHome ? (matchDoc.score?.home ?? 0) : (matchDoc.score?.away ?? 0);
      const goals_against = isHome ? (matchDoc.score?.away ?? 0) : (matchDoc.score?.home ?? 0);
      const win = goals_for > goals_against ? true : (goals_for === goals_against ? null : false);

      const lastMatchSnapshot = {
        opponent_name: opponent || '',
        goals_for: goals_for,
        goals_against: goals_against,
        win: win,
        date: matchDate,
        match_id: Number(matchId),
        match_oid: matchDoc._id,
        home_game: isHome,
      };

      // Update with new reference-based approach - much simpler!
      await Team.findOneAndUpdate(
        { id: teamIdNum },
        { 
          $set: { 
            last_match: Number(matchId),
            last_played_at: matchDate,
            // Keep legacy data during transition
            last_match_info: lastMatchSnapshot
          } 
        }
      );

      // Find next upcoming match for this team
      const nextMatch = await mongoose.model('Match').findOne({
        $or: [
          { 'teams.home.team_id': teamIdNum },
          { 'teams.away.team_id': teamIdNum }
        ],
        'match_status.state': { $ne: 'finished' },
        $or: [
          { 'match_info.starting_at': { $gt: matchDate } },
          { date: { $gt: matchDate } }
        ]
      })
      .sort({ 
        'match_info.starting_at': 1,
        date: 1 
      })
      .lean();

      if (nextMatch) {
        const homeTeamIdNext = nextMatch.teams?.home?.team_id ?? nextMatch.home_team_id;
        const isHomeNext = String(homeTeamIdNext) === String(teamRawId);
        const opponentNext = isHomeNext ? (nextMatch.teams?.away?.team_name || nextMatch.away_team) : (nextMatch.teams?.home?.team_name || nextMatch.home_team);
        const nextSnapshot = {
          opponent_name: opponentNext || '',
          date: nextMatch.match_info?.starting_at || nextMatch.date,
          match_id: Number(nextMatch.match_id),
          match_oid: nextMatch._id,
          home_game: isHomeNext,
        };
        await Team.findOneAndUpdate(
          { id: teamIdNum }, 
          { 
            $set: { 
              next_match: Number(nextMatch.match_id),
              next_game_at: nextMatch.match_info?.starting_at || nextMatch.date,
              // Keep legacy data during transition
              next_match_info: nextSnapshot
            } 
          }
        );
      } else {
        await Team.findOneAndUpdate(
          { id: teamIdNum }, 
          { 
            $set: { 
              next_match: null, 
              next_game_at: null,
              // Keep legacy data during transition
              next_match_info: null
            } 
          }
        );
      }
    }
  } catch (e) {
    console.warn('updateTeamsForFinishedMatch error', e?.message || e);
  }
}

// Trigger on save and on findOneAndUpdate (when the query returns the new doc)
MatchSchema.post('save', function (doc) {
  if (!doc) return;
  // detect transition into finished: only run update when previous state was not finished
  const prevState = this._previousMatchState || null;
  const prevIsFinished = prevState && String(prevState).toLowerCase().includes('finished');
  const currState = doc.match_status && (doc.match_status.state || doc.match_status.name || doc.status);
  const currIsFinished = String(currState || '').toLowerCase().includes('finished');
  if (!prevIsFinished && currIsFinished) {
    // schedule async work without blocking caller
    setImmediate(() => updateTeamsForFinishedMatch(doc));
  }
  
  // Cache invalidation for any match save
  setImmediate(() => invalidateTeamCache(doc));
});

MatchSchema.post('findOneAndUpdate', function (doc) {
  if (!doc) return;
  // Detect transition by using previous doc captured in pre hook (this._previousMatchDoc)
  const prevDoc = this._previousMatchDoc || null;
  const prevState = prevDoc && (prevDoc.match_status?.state || prevDoc.match_status?.name || prevDoc.status);
  const prevIsFinished = prevState && String(prevState).toLowerCase().includes('finished');
  const currState = doc.match_status && (doc.match_status.state || doc.match_status.name || doc.status);
  const currIsFinished = String(currState || '').toLowerCase().includes('finished');
  if (!prevIsFinished && currIsFinished) {
    setImmediate(() => updateTeamsForFinishedMatch(doc));
  }
  
  // Cache invalidation for any match update
  setImmediate(() => invalidateTeamCache(doc));
});

// Cache invalidation function - mark affected teams' cache as stale when matches are modified
async function invalidateTeamCache(matchDoc) {
  if (!matchDoc) return;
  
  try {
    const Team = require('./Team');
    const teamsToInvalidate = [];
    
    // Collect team slugs from match data
    if (matchDoc.home_team_slug) teamsToInvalidate.push(matchDoc.home_team_slug);
    if (matchDoc.away_team_slug) teamsToInvalidate.push(matchDoc.away_team_slug);
    if (matchDoc.home_team) teamsToInvalidate.push(slugify(matchDoc.home_team));
    if (matchDoc.away_team) teamsToInvalidate.push(slugify(matchDoc.away_team));
    
    // Remove duplicates
    const uniqueTeamSlugs = [...new Set(teamsToInvalidate.filter(Boolean))];
    
    if (uniqueTeamSlugs.length > 0) {
      // Mark cache as stale by setting cached_at to null
      await Team.updateMany(
        { slug: { $in: uniqueTeamSlugs } },
        {
          $set: {
            'cache_metadata.cached_at': null,
            'cache_metadata.last_computed_by': 'invalidated'
          },
          $inc: {
            'cache_metadata.cache_version': 1
          }
        }
      );
      
      console.log(`[cache-invalidation] Invalidated cache for teams: ${uniqueTeamSlugs.join(', ')}`);
    }
  } catch (err) {
    console.error('[cache-invalidation] Failed to invalidate team cache:', err?.message || err);
  }
}

module.exports = mongoose.model("Match", MatchSchema);
