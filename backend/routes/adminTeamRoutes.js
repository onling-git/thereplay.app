// routes/adminTeamRoutes.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Country = require('../models/Country');
const adminAuth = require('../middleware/adminAuth');
const { generateTeamStory } = require('../services/teamStoryWriter');
const { researchTeamStory } = require('../services/teamStoryResearch');

// All admin team routes require admin authentication (API key or admin user)
router.use(adminAuth(true));

// Shape a team's story sub-document consistently for admin responses
function serializeStory(story) {
  return {
    content: story?.content || '',
    status: story?.status || 'draft',
    known_facts: story?.known_facts || '',
    generated_by: story?.generated_by || null,
    model: story?.model || null,
    editorial_hints: story?.editorial_hints || '',
    research: story?.research || '',
    research_sources: story?.research_sources || [],
    research_updated_at: story?.research_updated_at || null,
    research_model: story?.research_model || null,
    updated_at: story?.updated_at || null,
    published_at: story?.published_at || null
  };
}

// Get all teams with their Twitter data
router.get('/teams', async (req, res) => {
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
      alternative_hashtags: team.twitter?.alternative_hashtags || [],
      tweet_fetch_enabled: team.twitter?.tweet_fetch_enabled || false,
      hashtag_feed_enabled: team.twitter?.hashtag_feed_enabled || false,
      feed_hashtag: team.twitter?.feed_hashtag || '',
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
router.get('/teams/:teamId/twitter', async (req, res) => {
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
        alternative_hashtags: team.twitter?.alternative_hashtags || [],
        tweet_fetch_enabled: team.twitter?.tweet_fetch_enabled || false,
        hashtag_feed_enabled: team.twitter?.hashtag_feed_enabled || false,
        feed_hashtag: team.twitter?.feed_hashtag || '',
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
router.put('/teams/:teamId/twitter', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { hashtag, alternative_hashtags, tweet_fetch_enabled, hashtag_feed_enabled, feed_hashtag } = req.body;

    console.log('[adminTeamRoutes] PUT /teams/:teamId/twitter', {
      teamId,
      hashtag_feed_enabled,
      feed_hashtag,
      tweet_fetch_enabled
    });

    // Validate hashtag format if provided
    if (hashtag && !hashtag.startsWith('#')) {
      return res.status(400).json({
        success: false,
        error: 'Hashtag must start with #'
      });
    }

    // Validate alternative_hashtags if provided
    if (alternative_hashtags && Array.isArray(alternative_hashtags)) {
      const invalidHashtags = alternative_hashtags.filter(h => !h.startsWith('#'));
      if (invalidHashtags.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'All hashtags must start with #'
        });
      }
    }

    // Validate feed_hashtag format if provided and not empty
    if (feed_hashtag && feed_hashtag.trim() !== '' && !feed_hashtag.startsWith('#')) {
      return res.status(400).json({
        success: false,
        error: 'Feed hashtag must start with #'
      });
    }

    const updateData = {
      'twitter.tweet_fetch_enabled': tweet_fetch_enabled !== undefined ? tweet_fetch_enabled : false
    };

    // Only update hashtag fields if provided
    if (hashtag !== undefined) {
      updateData['twitter.hashtag'] = hashtag || '';
    }
    if (alternative_hashtags !== undefined) {
      updateData['twitter.alternative_hashtags'] = alternative_hashtags || [];
    }
    if (hashtag_feed_enabled !== undefined) {
      updateData['twitter.hashtag_feed_enabled'] = !!hashtag_feed_enabled;
    }
    if (feed_hashtag !== undefined) {
      updateData['twitter.feed_hashtag'] = feed_hashtag || '';
    }

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

    console.log('[adminTeamRoutes] Updated team twitter settings:', {
      name: team.name,
      hashtag_feed_enabled: team.twitter?.hashtag_feed_enabled,
      feed_hashtag: team.twitter?.feed_hashtag
    });

    res.json({
      success: true,
      message: 'Team Twitter data updated successfully',
      team: {
        id: team._id,
        name: team.name,
        slug: team.slug,
        hashtag: team.twitter?.hashtag || '',
        alternative_hashtags: team.twitter?.alternative_hashtags || [],
        tweet_fetch_enabled: team.twitter?.tweet_fetch_enabled || false,
        hashtag_feed_enabled: team.twitter?.hashtag_feed_enabled || false,
        feed_hashtag: team.twitter?.feed_hashtag || '',
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
router.post('/teams/:teamId/reporters', async (req, res) => {
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
router.put('/teams/:teamId/reporters/:reporterId', async (req, res) => {
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
router.delete('/teams/:teamId/reporters/:reporterId', async (req, res) => {
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
router.post('/teams/bulk-import-twitter', async (req, res) => {
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

// Get team story (draft + published) for admin editing
router.get('/teams/:teamId/story', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId, { name: 1, slug: 1, story: 1 });

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
        story: serializeStory(team.story)
      }
    });
  } catch (error) {
    console.error('Error fetching team story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team story',
      message: error.message
    });
  }
});

// Update team story content and/or status (manual authoring - no AI generation)
router.put('/teams/:teamId/story', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { content, status, known_facts } = req.body;

    if (status !== undefined && !['draft', 'published'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be 'draft' or 'published'"
      });
    }

    const updateData = { 'story.updated_at': new Date() };

    if (content !== undefined) {
      updateData['story.content'] = String(content);
      // A human is asserting this content now, whether it started as an AI draft or not
      updateData['story.generated_by'] = 'manual';
    }
    if (known_facts !== undefined) {
      updateData['story.known_facts'] = String(known_facts);
    }
    if (status !== undefined) {
      updateData['story.status'] = status;
      if (status === 'published') {
        updateData['story.published_at'] = new Date();
      }
    }

    const team = await Team.findByIdAndUpdate(
      teamId,
      { $set: updateData },
      { new: true, upsert: false, fields: { name: 1, slug: 1, story: 1 } }
    );

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    res.json({
      success: true,
      message: 'Team story updated successfully',
      team: {
        id: team._id,
        name: team.name,
        slug: team.slug,
        story: serializeStory(team.story)
      }
    });
  } catch (error) {
    console.error('Error updating team story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update team story',
      message: error.message
    });
  }
});

// Generate a Team Story draft using AI (admin-triggered only - never called from the public Team Hub)
router.post('/teams/:teamId/story/generate', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { known_facts } = req.body || {};

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    // Persist known_facts alongside generation if the admin updated them in the same action
    if (known_facts !== undefined) {
      team.story.known_facts = String(known_facts);
    }

    // Writing stage never researches itself - it only uses research already stored
    if (!team.story.research || !team.story.research.trim()) {
      return res.status(400).json({
        success: false,
        error: 'No research found for this team. Run POST /story/research first, then generate the story.'
      });
    }

    let countryName = null;
    if (team.country_id) {
      const country = await Country.findOne({ id: team.country_id }, { name: 1 }).lean();
      countryName = country?.name || null;
    }

    const content = await generateTeamStory({
      name: team.name,
      countryName,
      founded: team.founded,
      gender: team.gender,
      editorialHints: team.story.editorial_hints,
      knownFacts: team.story.known_facts,
      research: team.story.research
    });

    // A fresh draft replaces any previous content - the writing stage never revises in place
    team.story.content = content;
    team.story.status = 'draft'; // AI output is always a draft - never auto-published
    team.story.generated_by = 'ai';
    team.story.model = process.env.TEAM_STORY_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    team.story.updated_at = new Date();
    await team.save();

    res.json({
      success: true,
      message: 'Team story draft generated successfully',
      team: {
        id: team._id,
        name: team.name,
        slug: team.slug,
        story: serializeStory(team.story)
      }
    });
  } catch (error) {
    console.error('Error generating team story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate team story',
      message: error.message
    });
  }
});

// Research a Team Story using AI web search (admin-triggered only - never called from the public Team Hub)
// This is Stage 1 (research) only - it does not produce/overwrite the finished story content.
router.post('/teams/:teamId/story/research', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { editorial_hints, force } = req.body || {};

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    // Persist editorial_hints alongside research if the admin updated them in the same action
    if (editorial_hints !== undefined) {
      team.story.editorial_hints = String(editorial_hints);
    }

    // Don't silently clobber existing research - require an explicit "research again"
    if (team.story.research && team.story.research.trim() && !force) {
      return res.status(409).json({
        success: false,
        error: 'Research already exists for this team. Pass { "force": true } to research again.',
        team: {
          id: team._id,
          name: team.name,
          slug: team.slug,
          story: serializeStory(team.story)
        }
      });
    }

    let countryName = null;
    if (team.country_id) {
      const country = await Country.findOne({ id: team.country_id }, { name: 1 }).lean();
      countryName = country?.name || null;
    }

    const result = await researchTeamStory({
      name: team.name,
      countryName,
      founded: team.founded,
      gender: team.gender,
      editorialHints: team.story.editorial_hints
    });

    team.story.research = result.research;
    team.story.research_sources = result.sources;
    team.story.research_updated_at = new Date();
    team.story.research_model = result.model;
    await team.save();

    res.json({
      success: true,
      message: 'Team story research completed successfully',
      team: {
        id: team._id,
        name: team.name,
        slug: team.slug,
        story: serializeStory(team.story)
      }
    });
  } catch (error) {
    console.error('Error researching team story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to research team story',
      message: error.message
    });
  }
});

module.exports = router;
