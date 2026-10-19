// Enhanced match report monitoring and failsafe system
const Match = require('../models/Match');
const Report = require('../models/Report');
const { generateBothReports } = require('../controllers/reportController');
const { getEnabledLeagueIds } = require('./leagueHelper');

// Fallback list used when League Management hasn't been configured yet
const DEFAULT_REPORT_LEAGUES = [8, 9, 24, 27, 390, 570, 1371];

// Comprehensive report monitoring utilities
class ReportMonitoring {
  
  /**
   * Check for finished matches that are missing reports
   * @param {Object} options - Monitoring options
   * @param {number} options.hoursBack - How many hours back to check (default: 48)
   * @param {Array} options.leagues - League IDs to monitor (default: all supported)
   * @param {boolean} options.autoFix - Automatically generate missing reports
   */
  static async checkMissingReports(options = {}) {
    const {
      hoursBack = 48,
      autoFix = false
    } = options;

    // League Management: use enabled leagues from DB when configured,
    // otherwise fall back to the default supported-leagues list.
    const enabledIds = await getEnabledLeagueIds();
    const leagues = options.leagues || enabledIds || DEFAULT_REPORT_LEAGUES;

    const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
    
    
    try {
      // Find finished matches that should have reports
      const finishedMatches = await Match.find({
        $and: [
          { updatedAt: { $gte: cutoffTime } },
          {
            $or: [
              { 'match_status.name': { $in: ['Full Time', 'FT', 'finished'] } },
              { 'match_status.state': { $in: ['FT', 'finished', 'ended'] } },
              { match_status: { $in: ['FT', 'finished', 'ended', 'full-time', 'Full Time'] } }
            ]
          },
          {
            $or: [
              { 'league.id': { $in: leagues } },
              { 'match_info.league.id': { $in: leagues } },
              { 'competition.id': { $in: leagues } }
            ]
          }
        ]
      }).lean();


      const missingReports = [];
      const reportStats = {
        total: finishedMatches.length,
        hasReports: 0,
        missingHome: 0,
        missingAway: 0,
        missingBoth: 0,
        errors: 0
      };

      for (const match of finishedMatches) {
        try {
          const hasHomeReport = match.reports?.home || false;
          const hasAwayReport = match.reports?.away || false;

          if (!hasHomeReport || !hasAwayReport) {
            // Double-check with Report collection
            const existingReports = await Report.find({ match_id: match.match_id }).lean();
            const reportsByTeam = {};
            existingReports.forEach(report => {
              reportsByTeam[report.team_slug] = report;
            });

            const issue = {
              matchId: match.match_id,
              league: match.league?.name || match.match_info?.league?.name || match.competition?.name,
              leagueId: match.league?.id || match.match_info?.league?.id || match.competition?.id,
              teams: {
                home: match.home_team || match.teams?.home?.team_name,
                away: match.away_team || match.teams?.away?.team_name
              },
              date: match.date || match.match_info?.starting_at,
              status: match.match_status?.name || match.match_status?.state || match.match_status,
              missingHome: !hasHomeReport && !this.hasTeamReport(reportsByTeam, match, 'home'),
              missingAway: !hasAwayReport && !this.hasTeamReport(reportsByTeam, match, 'away'),
              existingReports: existingReports.length,
              teamSlugs: {
                home: match.home_team_slug || match.teams?.home?.team_slug,
                away: match.away_team_slug || match.teams?.away?.team_slug
              }
            };

            if (issue.missingHome && issue.missingAway) {
              reportStats.missingBoth++;
            } else if (issue.missingHome) {
              reportStats.missingHome++;
            } else if (issue.missingAway) {
              reportStats.missingAway++;
            }

            if (issue.missingHome || issue.missingAway) {
              missingReports.push(issue);
            }
          } else {
            reportStats.hasReports++;
          }
        } catch (error) {
          console.error(`❌ [ReportMonitor] Error checking match ${match.match_id}:`, error.message);
          reportStats.errors++;
        }
      }

      // Log summary

      if (missingReports.length > 0) {
        
        for (const issue of missingReports.slice(0, 10)) { // Show first 10
          
          if (!issue.teamSlugs.home || !issue.teamSlugs.away) {
            console.warn(`     ⚠️ Missing team slugs - this prevents report generation`);
          }
        }

        

        // Auto-fix if requested
        if (autoFix) {
          await this.fixMissingReports(missingReports);
        }
      }

      return {
        stats: reportStats,
        missingReports,
        success: true
      };

    } catch (error) {
      console.error('❌ [ReportMonitor] Error during report monitoring:', error.message);
      return {
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Check if a team has a report in the existing reports
   */
  static hasTeamReport(reportsByTeam, match, side) {
    const teamName = side === 'home' 
      ? (match.home_team || match.teams?.home?.team_name)
      : (match.away_team || match.teams?.away?.team_name);
    
    const teamSlug = side === 'home'
      ? (match.home_team_slug || match.teams?.home?.team_slug)
      : (match.away_team_slug || match.teams?.away?.team_slug);

    // Check by team slug first
    if (teamSlug && reportsByTeam[teamSlug]) {
      return true;
    }

    // Check by team name pattern
    if (teamName) {
      const slugPattern = teamName.toLowerCase().replace(/\s+/g, '-');
      if (reportsByTeam[slugPattern]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Attempt to fix missing reports by generating them
   */
  static async fixMissingReports(missingReports) {
    const results = {
      attempted: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const issue of missingReports) {
      try {
        // Skip if missing team slugs (can't generate without them)
        if (!issue.teamSlugs.home || !issue.teamSlugs.away) {
          console.warn(`⏭️ [ReportMonitor] Skipping match ${issue.matchId} - missing team slugs`);
          continue;
        }

        results.attempted++;

        const reports = await generateBothReports(issue.matchId, { trigger: 'missing-report-monitor' });
        
        if (reports && reports.length > 0) {
          results.successful++;
        } else {
          results.failed++;
          console.warn(`❌ [ReportMonitor] Failed to generate reports for match ${issue.matchId} - no reports returned`);
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        results.failed++;
        results.errors.push({
          matchId: issue.matchId,
          error: error.message
        });
        console.error(`❌ [ReportMonitor] Error generating reports for match ${issue.matchId}:`, error.message);
      }
    }


    return results;
  }

  /**
   * Monitor a specific match for report completion
   */
  static async monitorMatchReports(matchId, options = {}) {
    const { timeout = 300000, interval = 10000 } = options; // 5 min timeout, 10s interval
    const startTime = Date.now();


    return new Promise((resolve, reject) => {
      const checkReports = async () => {
        try {
          const match = await Match.findOne({ match_id: matchId }).lean();
          if (!match) {
            reject(new Error(`Match ${matchId} not found`));
            return;
          }

          const hasHome = !!match.reports?.home;
          const hasAway = !!match.reports?.away;

          if (hasHome && hasAway) {
            resolve({ success: true, reports: { home: hasHome, away: hasAway } });
            return;
          }

          if (Date.now() - startTime > timeout) {
            resolve({ 
              success: false, 
              timeout: true, 
              reports: { home: hasHome, away: hasAway }
            });
            return;
          }

          // Continue monitoring
          setTimeout(checkReports, interval);

        } catch (error) {
          reject(error);
        }
      };

      checkReports();
    });
  }
}

module.exports = ReportMonitoring;