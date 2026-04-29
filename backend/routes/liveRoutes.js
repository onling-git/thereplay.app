// routes/liveRoutes.js
const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey');
const { liveStart, liveStop, liveStatus, liveAdd, liveRemove } = require('../controllers/liveController');

// Get cron status for diagnostics
router.get('/cron-status', apiKey(true), (req, res) => {
  try {
    const { getCronStatus } = require('../cron/index');
    const status = getCronStatus();
    res.json({
      ok: true,
      cron: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
      hint: 'Cron module may not be loaded or getCronStatus not available'
    });
  }
});

// Manually restart cron jobs
router.post('/cron-restart', apiKey(true), async (req, res) => {
  try {
    const cronModule = require('../cron/index');
    
    // Stop existing crons
    if (typeof cronModule.stopCrons === 'function') {
      await cronModule.stopCrons();
      console.log('[live] Crons stopped for restart');
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start crons again
    if (typeof cronModule.startCrons === 'function') {
      cronModule.startCrons();
      console.log('[live] Crons restarted');
      
      const status = cronModule.getCronStatus ? cronModule.getCronStatus() : {};
      res.json({
        ok: true,
        message: 'Cron jobs restarted successfully',
        status,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        ok: false,
        error: 'startCrons function not available'
      });
    }
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// all live controls require admin key
router.post('/start', apiKey(true), liveStart);
router.post('/stop', apiKey(true), liveStop);
router.get('/status', apiKey(true), liveStatus);
router.post('/add/:fixtureId', apiKey(true), liveAdd);
router.post('/remove/:fixtureId', apiKey(true), liveRemove);

module.exports = router;
