// routes/adminTeamRoutes.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const apiKey = require('../middleware/apiKey');

// Get all teams with their Twitter data
router.get('/teams', apiKey(true), async (req, res) => {
  try {
    const teams = await Team.find({}, {
      name: 1,
      slug: 1,
      twitter: 1,
      _id: 1
    }).sort({ name: 1 });

    const teamData = teams.map(team => ({
      id: team._id,
      name: team.name,
      slug: team.slug,
      hashtag: team.twitter?.hashtag || '',
      tweet_fetch_enabled: team.twitter?.tweet_fetch_enabled || false,
      reporters: team.twitter?.reporters || []
    }));

    res.json({
      success: true,
      teams: teamData,
      count: teamData.length
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teams',
      message: error.message
    });
  }
});

// Get specific team Twitter data
router.get('/teams/:teamId/twitter', apiKey(true), async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId, {
      name: 1,
      slug: 1,
      twitter: 1
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    res.json({
      success: true,
      team: {
        id: team._id,
        name: team.name,
        slug: team.slug,
        hashtag: team.twitter?.hashtag || '',
        tweet_fetch_enabled: team.twitter?.tweet_fetch_enabled || false,
        reporters: team.twitter?.reporters || []
      }
    });
  } catch (error) {
    console.error('Error fetching team Twitter data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team Twitter data',
      message: error.message
    });
  }
});

// Update team Twitter data (hashtag and tweet settings)
router.put('/teams/:teamId/twitter', apiKey(true), async (req, res) => {
  try {
    const { teamId } = req.params;
    const { hashtag, tweet_fetch_enabled } = req.body;

    // Validate hashtag format if provided
    if (hashtag && !hashtag.startsWith('#')) {
      return res.status(400).json({
        success: false,
        error: 'Hashtag must start with #'
      });
    }

    const updateData = {
      'twitter.hashtag': hashtag || '',
      'twitter.tweet_fetch_enabled': tweet_fetch_enabled || false
    };

    const team = await Team.findByIdAndUpdate(
      teamId,
      { $set: updateData },
      { new: true, upsert: false }
    );

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    res.json({
      success: true,
      message: 'Team Twitter data updated successfully',
      team: {
        id: team._id,
        name: team.name,
        slug: team.slug,
        hashtag: team.twitter?.hashtag || '',
        tweet_fetch_enabled: team.twitter?.tweet_fetch_enabled || false,
        reporters: team.twitter?.reporters || []
      }
    });
  } catch (error) {
    console.error('Error updating team Twitter data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update team Twitter data',
      message: error.message
    });
  }
});

// Add reporter to team
router.post('/teams/:teamId/reporters', apiKey(true), async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, handle, verified, follower_count } = req.body;

    if (!name || !handle) {
      return res.status(400).json({
        success: false,
        error: 'Reporter name and handle are required'
      });
    }

    // Ensure handle starts with @
    const formattedHandle = handle.startsWith('@') ? handle : `@${handle}`;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    // Initialize twitter object if it doesn't exist
    if (!team.twitter) {
      team.twitter = { reporters: [] };
    }
    if (!team.twitter.reporters) {
      team.twitter.reporters = [];
    }

    // Check if reporter already exists
    const existingReporter = team.twitter.reporters.find(r => r.handle === formattedHandle);
    if (existingReporter) {
      return res.status(400).json({
        success: false,
        error: 'Reporter with this handle already exists'
      });
    }

    const newReporter = {
      name: name.trim(),
      handle: formattedHandle,
      verified: verified || false,
      follower_count: follower_count || 0,
      last_checked: new Date()
    };

    team.twitter.reporters.push(newReporter);
    await team.save();

    res.json({
      success: true,
      message: 'Reporter added successfully',
      reporter: newReporter,
      team: {
        id: team._id,
        name: team.name,
        reporters: team.twitter.reporters
      }
    });
  } catch (error) {
    console.error('Error adding reporter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add reporter',
      message: error.message
    });
  }
});

// Update reporter
router.put('/teams/:teamId/reporters/:reporterId', apiKey(true), async (req, res) => {
  try {
    const { teamId, reporterId } = req.params;
    const { name, handle, verified, follower_count } = req.body;

    if (!name || !handle) {
      return res.status(400).json({
        success: false,
        error: 'Reporter name and handle are required'
      });
    }

    const formattedHandle = handle.startsWith('@') ? handle : `@${handle}`;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    if (!team.twitter?.reporters) {
      return res.status(404).json({
        success: false,
        error: 'No reporters found for this team'
      });
    }

    const reporterIndex = team.twitter.reporters.findIndex(r => r._id.toString() === reporterId);
    if (reporterIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Reporter not found'
      });
    }

    // Check if handle is taken by another reporter
    const handleExists = team.twitter.reporters.some((r, index) => 
      r.handle === formattedHandle && index !== reporterIndex
    );
    if (handleExists) {
      return res.status(400).json({
        success: false,
        error: 'Another reporter with this handle already exists'
      });
    }

    team.twitter.reporters[reporterIndex] = {
      ...team.twitter.reporters[reporterIndex].toObject(),
      name: name.trim(),
      handle: formattedHandle,
      verified: verified || false,
      follower_count: follower_count || 0,
      last_checked: new Date()
    };

    await team.save();

    res.json({
      success: true,
      message: 'Reporter updated successfully',
      reporter: team.twitter.reporters[reporterIndex],
      team: {
        id: team._id,
        name: team.name,
        reporters: team.twitter.reporters
      }
    });
  } catch (error) {
    console.error('Error updating reporter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update reporter',
      message: error.message
    });
  }
});

// Delete reporter
router.delete('/teams/:teamId/reporters/:reporterId', apiKey(true), async (req, res) => {
  try {
    const { teamId, reporterId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    if (!team.twitter?.reporters) {
      return res.status(404).json({
        success: false,
        error: 'No reporters found for this team'
      });
    }

    const reporterIndex = team.twitter.reporters.findIndex(r => r._id.toString() === reporterId);
    if (reporterIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Reporter not found'
      });
    }

    const removedReporter = team.twitter.reporters[reporterIndex];
    team.twitter.reporters.splice(reporterIndex, 1);
    await team.save();

    res.json({
      success: true,
      message: 'Reporter deleted successfully',
      removedReporter: {
        name: removedReporter.name,
        handle: removedReporter.handle
      },
      team: {
        id: team._id,
        name: team.name,
        reporters: team.twitter.reporters
      }
    });
  } catch (error) {
    console.error('Error deleting reporter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete reporter',
      message: error.message
    });
  }
});

// Bulk import team Twitter data (useful for seeding)
router.post('/teams/bulk-import-twitter', apiKey(true), async (req, res) => {
  try {
    const { teams } = req.body;

    if (!Array.isArray(teams)) {
      return res.status(400).json({
        success: false,
        error: 'Teams data must be an array'
      });
    }

    let updated = 0;
    let errors = [];

    for (const teamData of teams) {
      try {
        const { name, slug, hashtag, reporters = [], tweet_fetch_enabled = false } = teamData;

        if (!name && !slug) {
          errors.push(`Team data missing name and slug`);
          continue;
        }

        // Find team by name or slug
        const query = slug ? { slug } : { name: new RegExp(`^${name}$`, 'i') };
        const team = await Team.findOne(query);

        if (!team) {
          errors.push(`Team not found: ${name || slug}`);
          continue;
        }

        // Prepare update data
        const updateData = {
          'twitter.hashtag': hashtag || '',
          'twitter.tweet_fetch_enabled': tweet_fetch_enabled
        };

        if (reporters && Array.isArray(reporters)) {
          const formattedReporters = reporters.map(r => ({
            name: r.name,
            handle: r.handle.startsWith('@') ? r.handle : `@${r.handle}`,
            verified: r.verified || false,
            follower_count: r.follower_count || 0,
            last_checked: new Date()
          }));
          updateData['twitter.reporters'] = formattedReporters;
        }

        await Team.findByIdAndUpdate(team._id, { $set: updateData });
        updated++;
      } catch (error) {
        errors.push(`Error processing ${teamData.name || teamData.slug}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed. Updated ${updated} teams.`,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk import',
      message: error.message
    });
  }
});

module.exports = router;