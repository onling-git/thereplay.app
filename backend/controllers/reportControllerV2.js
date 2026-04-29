// controllers/reportControllerV2.js
// UPDATED CONTROLLER using the 2-step pipeline
// This file shows how to integrate the new pipeline into your existing controller

const Match = require('../models/Match');
const Report = require('../models/Report');
const { generateReportPipeline } = require('../services/reportPipeline');
const { generateMatchReportJsonLd, extractMatchEventsForJsonLd, generateKeywords } = require('../utils/jsonLdSchema');

/**
 * Generate a match report using the new 2-step pipeline
 * Route: POST /api/reports/generate/:matchId/:teamSlug
 */
async function generateReportV2(req, res) {
  try {
    const { matchId, teamSlug } = req.params;
    const saveInterpretation = req.query.debug === 'true'; // Optional: save intermediate step
    
    console.log(`[generateReportV2] Starting for match ${matchId}, team ${teamSlug}`);
    
    // Execute the 2-step pipeline
    const result = await generateReportPipeline({
      matchId,
      teamSlug,
      options: { saveInterpretation }
    });
    
    const { report, interpretation, metadata } = result;
    
    // Save to database (similar to existing logic)
    const savedReport = await saveReportToDatabase({
      report,
      matchId,
      teamSlug,
      metadata
    });
    
    // Return response
    return res.json({
      ok: true,
      report: savedReport,
      debug: saveInterpretation ? { interpretation } : undefined
    });
    
  } catch (err) {
    console.error('[generateReportV2] Error:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to generate report',
      detail: err.message || err
    });
  }
}

/**
 * Save the generated report to database
 * (Adapts your existing save logic)
 */
async function saveReportToDatabase({ report, matchId, teamSlug, metadata }) {
  // Fetch match to get additional context
  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) throw new Error('Match not found for save');
  
  // Determine normalized team slug
  const normalizedSlug = String(teamSlug).toLowerCase();
  const homeSlug = String(match.teams?.home?.team_slug || match.home_team_slug || '').toLowerCase();
  const awaySlug = String(match.teams?.away?.team_slug || match.away_team_slug || '').toLowerCase();
  
  const isHome = normalizedSlug === homeSlug || normalizedSlug.startsWith('__home_');
  const isAway = normalizedSlug === awaySlug || normalizedSlug.startsWith('__away_');
  
  // Extract team_id from match data
  const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
  const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
  const teamId = isHome ? homeTeamId : isAway ? awayTeamId : null;
  
  if (!teamId) {
    throw new Error(`Unable to determine team_id for slug ${teamSlug} in match ${matchId}. HomeSlug: ${homeSlug}, AwaySlug: ${awaySlug}, NormalizedSlug: ${normalizedSlug}`);
  }
  
  // Check for existing report (idempotency)
  let existingReport = await Report.findOne({
    match_id: match.match_id,
    team_slug: report.team_slug
  });
  
  if (existingReport) {
    console.log(`[saveReportToDatabase] Report exists, updating...`);
    console.log(`[saveReportToDatabase] Incoming embedded_tweets: ${report.embedded_tweets?.length || 0}`);
    
    // Update top-level fields (v2 format)
    existingReport.team_id = teamId; // Ensure team_id is set
    existingReport.headline = report.headline;
    existingReport.summary_paragraphs = report.summary_paragraphs;
    existingReport.key_moments = report.key_moments;
    existingReport.commentary = report.commentary;
    existingReport.player_of_the_match = report.player_of_the_match;
    existingReport.sources = report.sources;
    existingReport.embedded_tweets = report.embedded_tweets;
    existingReport.team_name = report.team_name;
    existingReport.competition = report.competition;
    existingReport.meta = report.meta;
    existingReport.updated_at = new Date();
    
    // ALSO update generated.* fields for frontend backward compatibility
    existingReport.generated = existingReport.generated || {};
    existingReport.generated.headline = report.headline;
    existingReport.generated.summary_paragraphs = report.summary_paragraphs;
    existingReport.generated.key_moments = report.key_moments;
    existingReport.generated.commentary = report.commentary;
    existingReport.generated.player_of_the_match = report.player_of_the_match;
    existingReport.generated.sources = report.sources;
    existingReport.generated.embedded_tweets = report.embedded_tweets;
    
    console.log(`[saveReportToDatabase] After assignment embedded_tweets: ${existingReport.embedded_tweets?.length || 0}`);
    
    // Mark as modified (important for nested objects/arrays in Mongoose)
    existingReport.markModified('embedded_tweets');
    existingReport.markModified('sources');
    existingReport.markModified('meta');
    existingReport.markModified('generated');
    
    await existingReport.save();
    
    // Re-fetch to verify
    const saved = await Report.findById(existingReport._id).lean();
    console.log(`[saveReportToDatabase] After save embedded_tweets: ${saved.embedded_tweets?.length || 0}`);
    
    return existingReport.toObject();
  }
  
  // Generate JSON-LD schema
  const jsonLd = generateMatchReportJsonLd({
    headline: report.headline,
    summary: report.summary_paragraphs.join('\n\n'),
    datePublished: new Date().toISOString(),
    matchId: match.match_id,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    homeScore: match.score?.home,
    awayScore: match.score?.away,
    events: extractMatchEventsForJsonLd(match.events || [])
  });
  
  // Generate keywords
  const keywords = generateKeywords({
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    competition: metadata.competition,
    stage: metadata.stage
  });
  
  // Create new report document with both top-level AND generated.* fields for backwards compatibility
  const reportDoc = await Report.create({
    match_id: match.match_id,
    team_id: teamId, // Required field
    team_slug: report.team_slug,
    team_name: report.team_name,
    headline: report.headline,
    
    // Top-level fields (v2 format)
    summary_paragraphs: report.summary_paragraphs,
    key_moments: report.key_moments,
    commentary: report.commentary,
    player_of_the_match: report.player_of_the_match,
    sources: report.sources,
    embedded_tweets: report.embedded_tweets,
    competition: report.competition,
    
    // generated.* fields (for frontend backward compatibility)
    generated: {
      headline: report.headline,
      summary_paragraphs: report.summary_paragraphs,
      key_moments: report.key_moments,
      commentary: report.commentary,
      player_of_the_match: report.player_of_the_match,
      sources: report.sources,
      embedded_tweets: report.embedded_tweets
    },
    
    meta: report.meta,
    json_ld: jsonLd,
    keywords: keywords,
    created_at: new Date(),
    updated_at: new Date()
  });
  
  // Update match document with report reference
  const updateField = isHome ? 'reports.home' : isAway ? 'reports.away' : null;
  if (updateField) {
    await Match.updateOne(
      { match_id: match.match_id },
      {
        $set: {
          [updateField]: reportDoc._id,
          'reports.generated_at': new Date(),
          'reports.model': report.meta?.generated_by || 'unknown'
        }
      }
    );
  }
  
  console.log(`[saveReportToDatabase] Created report ${reportDoc._id}`);
  
  return reportDoc.toObject();
}

/**
 * Batch generate reports for multiple matches
 * Useful for post-match webhook processing
 */
async function batchGenerateReports(req, res) {
  try {
    const { matchIds } = req.body; // Array of match IDs
    
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return res.status(400).json({ error: 'matchIds array required' });
    }
    
    const results = [];
    const errors = [];
    
    for (const matchId of matchIds) {
      try {
        // Fetch match to determine teams
        const match = await Match.findOne({ match_id: Number(matchId) }).lean();
        if (!match) {
          errors.push({ matchId, error: 'Match not found' });
          continue;
        }
        
        // Generate for both home and away teams
        const homeSlug = match.home_team_slug || `__home_${matchId}`;
        const awaySlug = match.away_team_slug || `__away_${matchId}`;
        
        const homeReport = await generateReportPipeline({
          matchId,
          teamSlug: homeSlug,
          options: {}
        });
        
        const awayReport = await generateReportPipeline({
          matchId,
          teamSlug: awaySlug,
          options: {}
        });
        
        // Save both
        await saveReportToDatabase({
          report: homeReport.report,
          matchId,
          teamSlug: homeSlug,
          metadata: homeReport.metadata
        });
        
        await saveReportToDatabase({
          report: awayReport.report,
          matchId,
          teamSlug: awaySlug,
          metadata: awayReport.metadata
        });
        
        results.push({
          matchId,
          home: homeSlug,
          away: awaySlug,
          success: true
        });
        
      } catch (err) {
        console.error(`[batchGenerateReports] Error for match ${matchId}:`, err);
        errors.push({
          matchId,
          error: err.message || err
        });
      }
    }
    
    return res.json({
      ok: true,
      results,
      errors,
      summary: {
        total: matchIds.length,
        successful: results.length,
        failed: errors.length
      }
    });
    
  } catch (err) {
    console.error('[batchGenerateReports] Error:', err);
    return res.status(500).json({
      error: 'Batch generation failed',
      detail: err.message || err
    });
  }
}

/**
 * Generate both home and away reports for a single match
 * This is the v2 equivalent of generateBothReports from the old controller
 * Used by cron jobs and the generate-both endpoint
 */
async function generateBothReportsV2(matchId) {
  try {
    matchId = Number(matchId);
    console.log(`[generateBothReportsV2] Starting for match ${matchId}`);
    
    // Fetch match to determine teams
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }
    
    const homeSlug = match.home_team_slug || `__home_${matchId}`;
    const awaySlug = match.away_team_slug || `__away_${matchId}`;
    
    const results = { home: null, away: null };
    
    // Check if reports already exist
    const existingHomeReport = await Report.findOne({ match_id: matchId, team_slug: homeSlug });
    const existingAwayReport = await Report.findOne({ match_id: matchId, team_slug: awaySlug });
    
    // Generate home report if it doesn't exist
    if (!existingHomeReport) {
      try {
        const homeReport = await generateReportPipeline({
          matchId,
          teamSlug: homeSlug,
          options: {}
        });
        
        const savedHome = await saveReportToDatabase({
          report: homeReport.report,
          matchId,
          teamSlug: homeSlug,
          metadata: homeReport.metadata
        });
        
        results.home = savedHome;
        console.log(`[generateBothReportsV2] Generated home report for ${homeSlug}`);
      } catch (err) {
        console.error(`[generateBothReportsV2] Failed to generate home report:`, err);
        results.home = { error: err.message };
      }
    } else {
      console.log(`[generateBothReportsV2] Skipped home for ${matchId} (already exists)`);
      results.home = existingHomeReport.toObject();
    }
    
    // Generate away report if it doesn't exist
    if (!existingAwayReport) {
      try {
        const awayReport = await generateReportPipeline({
          matchId,
          teamSlug: awaySlug,
          options: {}
        });
        
        const savedAway = await saveReportToDatabase({
          report: awayReport.report,
          matchId,
          teamSlug: awaySlug,
          metadata: awayReport.metadata
        });
        
        results.away = savedAway;
        console.log(`[generateBothReportsV2] Generated away report for ${awaySlug}`);
      } catch (err) {
        console.error(`[generateBothReportsV2] Failed to generate away report:`, err);
        results.away = { error: err.message };
      }
    } else {
      console.log(`[generateBothReportsV2] Skipped away for ${matchId} (already exists)`);
      results.away = existingAwayReport.toObject();
    }
    
    return results;
    
  } catch (err) {
    console.error('[generateBothReportsV2] Error:', err);
    throw err;
  }
}

module.exports = {
  generateReportV2,
  batchGenerateReports,
  saveReportToDatabase,
  generateBothReportsV2
};
