// Enhanced cron job with robust report monitoring
const cron = require('node-cron');
const ReportMonitoring = require('../utils/reportMonitoring');

// Enhanced function to check for finished matches with better error handling
async function enhancedFinishedMatchCheck(matchIds, previousStates) {
  try {
    const Match = require('../models/Match');
    
    // Get current states of the updated matches
    const updatedMatches = await Match.find({
      match_id: { $in: matchIds }
    }).select('match_id match_status teams home_team_slug away_team_slug reports league match_info competition').lean();
    
    const finishedMatches = [];
    const reportGenerationPromises = [];
    
    for (const match of updatedMatches) {
      const currentState = match.match_status?.state || match.match_status?.short_name || match.match_status?.developer_name || match.match_status?.name;
      const previousState = previousStates[match.match_id];
      
      // Check if match just finished (status changed to FT, finished, or ended)
      const isNowFinished = ['ft', 'finished', 'ended', 'full-time', 'full time'].includes(String(currentState || '').toLowerCase());
      const wasNotFinished = !['ft', 'finished', 'ended', 'full-time', 'full time'].includes(String(previousState || '').toLowerCase());
      
      if (isNowFinished && wasNotFinished) {
        // Match just finished - add to list for report generation
        finishedMatches.push(match);
        console.log(`[cron] 🎯 Match ${match.match_id} just finished (${previousState} → ${currentState})`);
        
        // Log match details for debugging
        const leagueId = match.league?.id || match.match_info?.league?.id || match.competition?.id;
        const leagueName = match.league?.name || match.match_info?.league?.name || match.competition?.name;
        console.log(`[cron] 📊 Match details: ${match.teams?.home?.team_name || match.home_team} vs ${match.teams?.away?.team_name || match.away_team}`);
        console.log(`[cron] 🏆 League: ${leagueName} (ID: ${leagueId})`);
      }
    }
    
    if (finishedMatches.length > 0) {
      console.log(`[cron] 📊 Generating instant reports for ${finishedMatches.length} newly finished matches...`);
      
      // Enhanced report generation with better error handling and monitoring
      const reportWorker = async (match) => {
        const startTime = Date.now();
        try {
          // Skip if reports already exist
          if (match.reports?.home && match.reports?.away) {
            console.log(`[cron] ⏭️ Skipping reports for match ${match.match_id} (already exist)`);
            return { matchId: match.match_id, status: 'skipped', reason: 'reports_exist' };
          }
          
          const homeSlug = match.home_team_slug || 
                          match.teams?.home?.team_slug || 
                          (match.teams?.home?.team_name ? match.teams.home.team_name.toLowerCase().replace(/\s+/g,'-') : `home-${match.match_id}`);
          
          console.log(`[cron] 🔧 Generating reports for match ${match.match_id} with home slug: ${homeSlug}`);
          
          // Make the API call to generate both reports
          const axios = require('axios');
          const BASE = process.env.BASE_URL || 'http://localhost:5001';
          const ADMIN_KEY = process.env.ADMIN_API_KEY;
          
          const response = await axios.post(`${BASE}/api/reports/${homeSlug}/match/${match.match_id}/generate-both`, {}, {
            headers: { 'x-api-key': ADMIN_KEY },
            timeout: 60_000 // Increased timeout for complex matches
          });
          
          const duration = Date.now() - startTime;
          console.log(`[cron] ✅ Generated instant reports for match ${match.match_id} in ${duration}ms`);
          
          // Monitor report completion
          setTimeout(async () => {
            try {
              const result = await ReportMonitoring.monitorMatchReports(match.match_id, {
                timeout: 60000, // 1 minute timeout
                interval: 5000   // Check every 5 seconds
              });
              
              if (!result.success) {
                console.warn(`[cron] ⚠️ Report monitoring failed for match ${match.match_id}:`, result);
                // Could trigger a retry here
              }
            } catch (monitorError) {
              console.error(`[cron] ❌ Report monitoring error for match ${match.match_id}:`, monitorError.message);
            }
          }, 5000); // Start monitoring after 5 seconds
          
          return { 
            matchId: match.match_id, 
            status: 'success', 
            duration,
            response: response.data 
          };
          
        } catch (e) {
          const duration = Date.now() - startTime;
          const errorDetails = {
            matchId: match.match_id,
            status: 'failed',
            duration,
            error: e?.response?.data || e.message || e,
            statusCode: e?.response?.status,
            leagueId: match.league?.id || match.match_info?.league?.id || match.competition?.id,
            teamSlugs: {
              home: match.home_team_slug || match.teams?.home?.team_slug,
              away: match.away_team_slug || match.teams?.away?.team_slug
            }
          };
          
          console.error(`[cron] ❌ Instant report generation failed for match ${match.match_id}:`, errorDetails);
          
          // For critical leagues, try alternative approach
          const criticalLeagues = [8, 9, 24, 27]; // Premier League, Championship, FA Cup, League Cup
          if (criticalLeagues.includes(errorDetails.leagueId)) {
            console.log(`[cron] 🔄 Attempting direct report generation for critical league match ${match.match_id}...`);
            try {
              const { generateBothReports } = require('../controllers/reportController');
              const directReports = await generateBothReports(match.match_id);
              console.log(`[cron] ✅ Direct generation succeeded for match ${match.match_id}:`, directReports?.length || 0, 'reports');
              return { matchId: match.match_id, status: 'success_direct', reports: directReports };
            } catch (directError) {
              console.error(`[cron] ❌ Direct generation also failed for match ${match.match_id}:`, directError.message);
            }
          }
          
          return errorDetails;
        }
      };
      
      // Process finished matches with controlled concurrency
      const processInChunks = async (items, processor, chunkSize = 2) => {
        const results = [];
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const chunkResults = await Promise.allSettled(
            chunk.map(item => processor(item))
          );
          
          chunkResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              console.error(`[cron] ❌ Chunk processing failed for item ${i + index}:`, result.reason);
              results.push({ 
                status: 'chunk_failed', 
                error: result.reason?.message || result.reason 
              });
            }
          });
          
          // Small delay between chunks
          if (i + chunkSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        return results;
      };
      
      const results = await processInChunks(finishedMatches, reportWorker, 2);
      
      // Log summary of results
      const summary = results.reduce((acc, result) => {
        acc[result.status] = (acc[result.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`[cron] 📈 Report generation summary:`, summary);
      
      // If there were failures, schedule a retry check
      const failures = results.filter(r => r.status === 'failed' || r.status === 'chunk_failed');
      if (failures.length > 0) {
        console.log(`[cron] 🔄 Scheduling retry check for ${failures.length} failed reports in 10 minutes...`);
        setTimeout(async () => {
          try {
            const failedMatchIds = failures.map(f => f.matchId).filter(Boolean);
            if (failedMatchIds.length > 0) {
              console.log(`[cron] 🔍 Retry check for failed matches:`, failedMatchIds);
              const retryResult = await ReportMonitoring.checkMissingReports({
                hoursBack: 1, // Only check last hour
                autoFix: true
              });
              console.log(`[cron] 📊 Retry check completed:`, retryResult.stats);
            }
          } catch (retryError) {
            console.error(`[cron] ❌ Retry check failed:`, retryError.message);
          }
        }, 10 * 60 * 1000); // 10 minutes
      }
      
    } else {
      console.log('[cron] ℹ️ No newly finished matches found');
    }
    
  } catch (error) {
    console.error('[cron] ❌ Error checking for finished matches:', error.message);
    
    // Emergency fallback - check for missing reports
    console.log('[cron] 🚨 Running emergency report check due to error...');
    try {
      const emergencyResult = await ReportMonitoring.checkMissingReports({
        hoursBack: 6, // Check last 6 hours
        autoFix: true
      });
      console.log('[cron] 🆘 Emergency check completed:', emergencyResult.stats);
    } catch (emergencyError) {
      console.error('[cron] ❌ Emergency check also failed:', emergencyError.message);
    }
  }
}

// Schedule regular monitoring checks
function scheduleReportMonitoring() {
  // Check for missing reports every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('\n🔍 [Scheduled] Running regular report monitoring check...');
    try {
      const result = await ReportMonitoring.checkMissingReports({
        hoursBack: 2, // Check last 2 hours for frequent monitoring
        autoFix: true
      });
      
      if (result.success && result.missingReports.length > 0) {
        console.log(`⚠️ [Scheduled] Found ${result.missingReports.length} matches with missing reports - auto-fix attempted`);
      } else if (result.success) {
        console.log(`✅ [Scheduled] All recent matches have reports`);
      }
    } catch (error) {
      console.error('❌ [Scheduled] Report monitoring failed:', error.message);
    }
  });

  // Comprehensive daily check at 6 AM
  cron.schedule('0 6 * * *', async () => {
    console.log('\n🌅 [Daily] Running comprehensive report check...');
    try {
      const result = await ReportMonitoring.checkMissingReports({
        hoursBack: 48, // Check last 48 hours
        autoFix: true
      });
      
      console.log(`📊 [Daily] Comprehensive check completed:`, result.stats);
      
      // Send alert if too many missing reports
      if (result.success && result.missingReports.length > 10) {
        console.warn(`🚨 [Daily] ALERT: ${result.missingReports.length} matches missing reports - system may need attention`);
      }
    } catch (error) {
      console.error('❌ [Daily] Comprehensive check failed:', error.message);
    }
  });

  console.log('✅ Report monitoring scheduled: Every 30 minutes + Daily at 6 AM');
}

module.exports = {
  enhancedFinishedMatchCheck,
  scheduleReportMonitoring,
  ReportMonitoring
};