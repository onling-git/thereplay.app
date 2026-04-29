// routes/countriesRoutes.js
const express = require('express');
const router = express.Router();
const { getAllCountries, getCountryById, getContinents } = require('../controllers/countriesController');

// Get all countries
router.get('/', getAllCountries);

// Get continents
router.get('/continents', getContinents);

// Get specific country by ID
router.get('/:id', getCountryById);

module.exports = router;