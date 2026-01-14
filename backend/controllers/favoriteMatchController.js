// controllers/favoriteMatchController.js
const FavoriteMatch = require('../models/FavoriteMatch');
const Match = require('../models/Match');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all favorite matches for the current user
exports.getFavoriteMatches = catchAsync(async (req, res, next) => {
  const { upcoming, past, limit = 50, page = 1 } = req.query;
  const skip = (page - 1) * limit;

  let query = FavoriteMatch.findByUser(req.user.id);
  
  if (upcoming === 'true') {
    query = query.where('match_info.starting_at').gt(new Date());
  } else if (past === 'true') {
    query = query.where('match_info.starting_at').lt(new Date());
  }

  // Add pagination
  const favorites = await query
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await FavoriteMatch.countDocuments({ 
    user_id: req.user.id,
    ...(upcoming === 'true' ? { 'match_info.starting_at': { $gt: new Date() } } : {}),
    ...(past === 'true' ? { 'match_info.starting_at': { $lt: new Date() } } : {})
  });

  res.status(200).json({
    status: 'success',
    results: favorites.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: {
      favorites
    }
  });
});

// Add a match to favorites
exports.addFavoriteMatch = catchAsync(async (req, res, next) => {
  const { match_id } = req.body;

  if (!match_id) {
    return next(new AppError('Match ID is required', 400));
  }

  // Check if match exists in our database
  const match = await Match.findOne({ match_id: match_id }).lean();
  if (!match) {
    return next(new AppError('Match not found', 404));
  }

  // Check if already favorited
  const existingFavorite = await FavoriteMatch.findOne({
    user_id: req.user.id,
    match_id: match_id
  });

  if (existingFavorite) {
    return next(new AppError('Match is already in your favorites', 400));
  }

  // Create favorite match with denormalized data for performance
  const favoriteMatch = new FavoriteMatch({
    user_id: req.user.id,
    match_id: match_id,
    match_info: {
      starting_at: match.match_info?.starting_at || match.date,
      home_team: {
        team_id: match.teams?.home?.team_id || match.home_team_id,
        team_name: match.teams?.home?.team_name || match.home_team,
        team_slug: match.teams?.home?.team_slug || match.home_team_slug
      },
      away_team: {
        team_id: match.teams?.away?.team_id || match.away_team_id,
        team_name: match.teams?.away?.team_name || match.away_team,
        team_slug: match.teams?.away?.team_slug || match.away_team_slug
      },
      league: {
        id: match.match_info?.league?.id,
        name: match.match_info?.league?.name,
        short_code: match.match_info?.league?.short_code
      },
      venue: {
        name: match.match_info?.venue?.name,
        city_name: match.match_info?.venue?.city_name
      }
    },
    source: 'manual'
  });

  await favoriteMatch.save();

  res.status(201).json({
    status: 'success',
    message: 'Match added to favorites',
    data: {
      favorite: favoriteMatch
    }
  });
});

// Remove a match from favorites
exports.removeFavoriteMatch = catchAsync(async (req, res, next) => {
  const { match_id } = req.params;

  const favorite = await FavoriteMatch.findOneAndDelete({
    user_id: req.user.id,
    match_id: parseInt(match_id)
  });

  if (!favorite) {
    return next(new AppError('Favorite match not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Match removed from favorites'
  });
});

// Check if a match is favorited
exports.checkFavoriteStatus = catchAsync(async (req, res, next) => {
  const { match_id } = req.params;

  const isFavorited = await FavoriteMatch.isFavorited(req.user.id, parseInt(match_id));

  res.status(200).json({
    status: 'success',
    data: {
      is_favorited: isFavorited
    }
  });
});

// Get favorite matches count
exports.getFavoriteMatchesCount = catchAsync(async (req, res, next) => {
  const total = await FavoriteMatch.countDocuments({ user_id: req.user.id });
  const upcoming = await FavoriteMatch.countDocuments({
    user_id: req.user.id,
    'match_info.starting_at': { $gt: new Date() }
  });

  res.status(200).json({
    status: 'success',
    data: {
      total,
      upcoming,
      past: total - upcoming
    }
  });
});

// Bulk add matches from favorite/followed teams (internal method)
exports.addMatchesForTeams = catchAsync(async (userId, teamIds, matchIds) => {
  if (!teamIds || teamIds.length === 0 || !matchIds || matchIds.length === 0) {
    return;
  }

  // Find matches involving the user's teams
  const matches = await Match.find({
    match_id: { $in: matchIds },
    $or: [
      { 'teams.home.team_id': { $in: teamIds } },
      { 'teams.away.team_id': { $in: teamIds } },
      { home_team_id: { $in: teamIds } },
      { away_team_id: { $in: teamIds } }
    ]
  }).lean();

  const favoriteMatches = [];
  const user = await User.findById(userId).lean();
  
  for (const match of matches) {
    // Check if already favorited
    const existingFavorite = await FavoriteMatch.findOne({
      user_id: userId,
      match_id: match.match_id
    });

    if (!existingFavorite) {
      // Determine source based on team relationship
      let source = 'auto_followed_team';
      const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
      const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
      
      if (user.favourite_team && (homeTeamId === user.favourite_team || awayTeamId === user.favourite_team)) {
        source = 'auto_favorite_team';
      }

      favoriteMatches.push({
        user_id: userId,
        match_id: match.match_id,
        match_info: {
          starting_at: match.match_info?.starting_at || match.date,
          home_team: {
            team_id: homeTeamId,
            team_name: match.teams?.home?.team_name || match.home_team,
            team_slug: match.teams?.home?.team_slug || match.home_team_slug
          },
          away_team: {
            team_id: awayTeamId,
            team_name: match.teams?.away?.team_name || match.away_team,
            team_slug: match.teams?.away?.team_slug || match.away_team_slug
          },
          league: {
            id: match.match_info?.league?.id,
            name: match.match_info?.league?.name,
            short_code: match.match_info?.league?.short_code
          },
          venue: {
            name: match.match_info?.venue?.name,
            city_name: match.match_info?.venue?.city_name
          }
        },
        source
      });
    }
  }

  if (favoriteMatches.length > 0) {
    await FavoriteMatch.insertMany(favoriteMatches, { ordered: false });
    console.log(`✅ Added ${favoriteMatches.length} auto-favorite matches for user ${userId}`);
  }
});

// Clean up expired favorites (for cron job)
exports.cleanupExpiredFavorites = catchAsync(async () => {
  const expiredFavorites = await FavoriteMatch.findExpired();
  
  if (expiredFavorites.length > 0) {
    await FavoriteMatch.deleteMany({ _id: { $in: expiredFavorites.map(f => f._id) } });
    console.log(`🧹 Cleaned up ${expiredFavorites.length} expired favorite matches`);
  }
  
  return expiredFavorites.length;
});