const express = require('express');
const router = express.Router();
const { listLeagues } = require('../controllers/leagueController');

// Public endpoint to list leagues discovered in the DB
router.get('/', listLeagues);

module.exports = router;
