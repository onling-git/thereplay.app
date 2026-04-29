// Manual script to check for missing reports and generate them
// Usage: node scripts/ensure_all_reports.js [--hours=48] [--leagues=8,9,24,27] [--fix] [--monitor]

require('dotenv').config();
const mongoose = require('mongoose');
const ReportMonitoring = require('../utils/reportMonitoring');

async function ensureAllReports() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {};
    let fix = false;
    let monitor = false;

    args.forEach(arg => {
      if (arg.startsWith('--hours=')) {
        options.hoursBack = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--leagues=')) {
        options.leagues = arg.split('=')[1].split(',').map(id => parseInt(id));
      } else if (arg === '--fix') {
        fix = true;
      } else if (arg === '--monitor') {
        monitor = true;
      }
    });

    // Set defaults
    if (!options.hoursBack) options.hoursBack = 48;
    if (!options.leagues) options.leagues = [8, 9, 24, 27, 390, 570, 1371];
    options.autoFix = fix;

    console.log('🚀 Ensure All Reports Tool');
    console.log('==========================');
    console.log(`⏰ Checking last ${options.hoursBack} hours`);
    console.log(`🏆 Leagues: ${options.leagues.join(', ')}`);
    console.log(`🔧 Auto-fix: ${fix ? 'YES' : 'NO'}`);
    console.log(`👀 Monitor: ${monitor ? 'YES' : 'NO'}\n`);

    // Connect to database
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    console.log('📊 Connected to database\n');

    // Run the comprehensive check
    const result = await ReportMonitoring.checkMissingReports(options);

    if (!result.success) {
      console.error('❌ Report monitoring failed:', result.error);
      process.exit(1);
    }

    // Display results
    console.log('\n📈 FINAL SUMMARY');
    console.log('================');
    console.log(`✅ Total matches checked: ${result.stats.total}`);
    console.log(`✅ Matches with reports: ${result.stats.hasReports}`);
    console.log(`❌ Missing home reports: ${result.stats.missingHome}`);
    console.log(`❌ Missing away reports: ${result.stats.missingAway}`);
    console.log(`❌ Missing both reports: ${result.stats.missingBoth}`);
    console.log(`⚠️ Errors encountered: ${result.stats.errors}`);

    if (result.missingReports.length === 0) {
      console.log('\n🎉 All matches have reports! System is working perfectly.');
    } else {
      console.log(`\n🚨 ${result.missingReports.length} matches are missing reports`);
      
      if (!fix) {
        console.log('\n💡 Run with --fix to automatically generate missing reports');
        console.log('   Example: node scripts/ensure_all_reports.js --fix');
      }
    }

    // Continuous monitoring mode
    if (monitor) {
      console.log('\n👀 Entering continuous monitoring mode...');
      console.log('   Checking every 60 seconds for new issues (Ctrl+C to exit)\n');

      const monitorInterval = setInterval(async () => {
        try {
          const quickCheck = await ReportMonitoring.checkMissingReports({
            hoursBack: 1,
            leagues: options.leagues,
            autoFix: fix
          });

          if (quickCheck.success) {
            const missing = quickCheck.missingReports.length;
            if (missing > 0) {
              console.log(`⚠️ [${new Date().toLocaleTimeString()}] Found ${missing} new matches with missing reports`);
            } else {
              console.log(`✅ [${new Date().toLocaleTimeString()}] All recent matches have reports`);
            }
          }
        } catch (monitorError) {
          console.error(`❌ [${new Date().toLocaleTimeString()}] Monitor check failed:`, monitorError.message);
        }
      }, 60000); // Check every minute

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping monitor...');
        clearInterval(monitorInterval);
        mongoose.disconnect();
        console.log('✅ Monitor stopped. Goodbye!');
        process.exit(0);
      });

      return; // Keep process alive for monitoring
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (!monitor) {
      await mongoose.disconnect();
      console.log('\n✅ Database disconnected');
    }
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🚀 Ensure All Reports Tool - Help
==================================

This tool checks for finished matches that are missing reports and optionally fixes them.

Usage:
  node scripts/ensure_all_reports.js [options]

Options:
  --hours=N        Check matches from last N hours (default: 48)
  --leagues=IDs    Comma-separated league IDs to check (default: 8,9,24,27,390,570,1371)
  --fix           Automatically generate missing reports
  --monitor       Continuous monitoring mode (checks every minute)
  --help, -h      Show this help message

Examples:
  # Check last 24 hours (read-only)
  node scripts/ensure_all_reports.js --hours=24

  # Check and fix missing reports for main leagues
  node scripts/ensure_all_reports.js --leagues=8,9,24,27 --fix

  # Continuous monitoring with auto-fix
  node scripts/ensure_all_reports.js --fix --monitor

  # Check specific league (League Cup only)
  node scripts/ensure_all_reports.js --leagues=27 --fix

League IDs:
  8   - Premier League
  9   - Championship  
  24  - FA Cup
  27  - League Cup (Carabao Cup)
  390 - Other cups
  570 - Other competitions
  1371 - Other tournaments
`);
  process.exit(0);
}

ensureAllReports();