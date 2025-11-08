// scripts/monitorCronHealth.js - Monitor node-cron health and detect blocking
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');

class CronHealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.lastEventLoopCheck = Date.now();
    this.eventLoopDelays = [];
    this.maxDelayMs = 0;
    this.missedCronExecutions = 0;
    this.cronExecutions = new Map();
    
    // Start monitoring
    this.startEventLoopMonitoring();
    this.logStats();
  }

  startEventLoopMonitoring() {
    const checkEventLoop = () => {
      const start = Date.now();
      setImmediate(() => {
        const delay = Date.now() - start;
        this.eventLoopDelays.push(delay);
        this.maxDelayMs = Math.max(this.maxDelayMs, delay);
        
        // Keep only last 100 measurements
        if (this.eventLoopDelays.length > 100) {
          this.eventLoopDelays.shift();
        }
        
        // Check if event loop is blocked (>100ms delay is concerning)
        if (delay > 100) {
          console.warn(`[CRON-HEALTH] Event loop blocked for ${delay}ms at ${new Date().toISOString()}`);
        }
        
        this.lastEventLoopCheck = Date.now();
      });
    };

    // Check event loop health every 5 seconds
    setInterval(checkEventLoop, 5000);
  }

  recordCronExecution(jobName, duration, success) {
    if (!this.cronExecutions.has(jobName)) {
      this.cronExecutions.set(jobName, {
        count: 0,
        totalDuration: 0,
        failures: 0,
        lastExecution: null,
        avgDuration: 0
      });
    }
    
    const stats = this.cronExecutions.get(jobName);
    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.lastExecution = new Date();
    
    if (!success) {
      stats.failures++;
    }
    
    // Warn if cron job is taking too long
    if (duration > 30000) { // 30 seconds
      console.warn(`[CRON-HEALTH] Job '${jobName}' took ${duration}ms - may be blocking event loop`);
    }
  }

  getHealthStats() {
    const uptime = Date.now() - this.startTime;
    const avgEventLoopDelay = this.eventLoopDelays.length > 0 
      ? this.eventLoopDelays.reduce((a, b) => a + b, 0) / this.eventLoopDelays.length 
      : 0;

    return {
      uptime: Math.floor(uptime / 1000),
      eventLoop: {
        averageDelay: Math.round(avgEventLoopDelay),
        maxDelay: this.maxDelayMs,
        currentDelay: Date.now() - this.lastEventLoopCheck,
        isHealthy: avgEventLoopDelay < 50 // Less than 50ms average is healthy
      },
      cronJobs: Array.from(this.cronExecutions.entries()).map(([name, stats]) => ({
        name,
        executions: stats.count,
        failures: stats.failures,
        avgDuration: Math.round(stats.avgDuration),
        lastExecution: stats.lastExecution,
        successRate: stats.count > 0 ? ((stats.count - stats.failures) / stats.count * 100).toFixed(1) + '%' : '0%'
      })),
      recommendations: this.generateRecommendations(avgEventLoopDelay)
    };
  }

  generateRecommendations(avgDelay) {
    const recommendations = [];
    
    if (avgDelay > 100) {
      recommendations.push('CRITICAL: Event loop severely blocked. Consider reducing cron frequency or batch sizes.');
    } else if (avgDelay > 50) {
      recommendations.push('WARNING: Event loop experiencing delays. Monitor cron job duration.');
    }
    
    if (this.maxDelayMs > 1000) {
      recommendations.push('Event loop has experienced delays >1s. Check for synchronous operations in cron jobs.');
    }
    
    // Check individual job performance
    for (const [name, stats] of this.cronExecutions.entries()) {
      if (stats.avgDuration > 60000) { // 1 minute
        recommendations.push(`Job '${name}' averaging ${Math.round(stats.avgDuration/1000)}s - consider optimization.`);
      }
      
      if (stats.failures > 0 && stats.count > 0) {
        const failureRate = (stats.failures / stats.count) * 100;
        if (failureRate > 10) {
          recommendations.push(`Job '${name}' has ${failureRate.toFixed(1)}% failure rate - investigate errors.`);
        }
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Cron system appears healthy.');
    }
    
    return recommendations;
  }

  async logStats() {
    const logHealth = () => {
      const stats = this.getHealthStats();
      console.log(`[CRON-HEALTH] ${new Date().toISOString()}`);
      console.log(`  Uptime: ${stats.uptime}s`);
      console.log(`  Event Loop: avg=${stats.eventLoop.averageDelay}ms max=${stats.eventLoop.maxDelay}ms healthy=${stats.eventLoop.isHealthy}`);
      console.log(`  Active Cron Jobs: ${stats.cronJobs.length}`);
      
      stats.cronJobs.forEach(job => {
        console.log(`    ${job.name}: ${job.executions} runs, ${job.successRate} success, avg ${job.avgDuration}ms`);
      });
      
      if (stats.recommendations.length > 0) {
        console.log('  Recommendations:');
        stats.recommendations.forEach(rec => console.log(`    - ${rec}`));
      }
      console.log('');
    };

    // Log every 5 minutes
    setInterval(logHealth, 5 * 60 * 1000);
    
    // Initial log after 30 seconds
    setTimeout(logHealth, 30000);
  }

  // Method to wrap cron jobs for monitoring
  wrapCronJob(jobName, cronFunction) {
    return async (...args) => {
      const start = Date.now();
      let success = true;
      
      try {
        await cronFunction(...args);
      } catch (error) {
        success = false;
        console.error(`[CRON-HEALTH] Job '${jobName}' failed:`, error.message);
        throw error;
      } finally {
        const duration = Date.now() - start;
        this.recordCronExecution(jobName, duration, success);
      }
    };
  }
}

// Export singleton instance
const monitor = new CronHealthMonitor();

// Enhanced cron job wrapper that includes event loop yielding
const createOptimizedCronJob = (name, schedule, jobFunction) => {
  const cron = require('node-cron');
  
  const wrappedJob = monitor.wrapCronJob(name, async () => {
    console.log(`[CRON] Starting ${name} at ${new Date().toISOString()}`);
    
    // Yield to event loop before starting
    await new Promise(resolve => setImmediate(resolve));
    
    try {
      await jobFunction();
    } finally {
      // Yield to event loop after completion
      await new Promise(resolve => setImmediate(resolve));
      console.log(`[CRON] Completed ${name} at ${new Date().toISOString()}`);
    }
  });
  
  return cron.schedule(schedule, wrappedJob);
};

module.exports = {
  monitor,
  createOptimizedCronJob,
  CronHealthMonitor
};

// If run directly, start monitoring
if (require.main === module) {
  console.log('Cron Health Monitor started...');
  console.log('Monitor will log health stats every 5 minutes.');
  console.log('Press Ctrl+C to stop.');
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nStopping Cron Health Monitor...');
    process.exit(0);
  });
}