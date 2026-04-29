const express = require('express');
const router = express.Router();
const CupCompetition = require('../models/CupCompetition');
const { getCupForLeague } = require('../services/cupService');

/**
 * @route   GET /api/cups/league/:leagueId
 * @desc    Get cup competition data for a league
 * @access  Public
 */
router.get('/league/:leagueId', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const cup = await getCupForLeague(parseInt(leagueId));
    
    if (!cup) {
      return res.json({
        ok: false,
        message: 'No cup data found for this league',
        data: null
      });
    }
    
    res.json({
      ok: true,
      data: cup
    });
    
  } catch (error) {
    console.error('Error fetching cup data:', error);
    res.status(500).json({
      ok: false,
      message: 'Error fetching cup data',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/cups/season/:seasonId
 * @desc    Get cup competition data by season
 * @access  Public
 */
router.get('/season/:seasonId', async (req, res) => {
  try {
    const { seasonId } = req.params;
    const cup = await CupCompetition.getBySeasonId(parseInt(seasonId));
    
    if (!cup) {
      return res.json({
        ok: false,
        message: 'No cup data found for this season',
        data: null
      });
    }
    
    res.json({
      ok: true,
      data: cup
    });
    
  } catch (error) {
    console.error('Error fetching cup data:', error);
    res.status(500).json({
      ok: false,
      message: 'Error fetching cup data',
      error: error.message
    });
  }
});

module.exports = router;
