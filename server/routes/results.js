const express = require('express');
const router = express.Router();
const { getResult, getHistory } = require('../controllers/analyzeController');

/**
 * GET /api/result/:id
 * Returns stored analysis result.
 */
router.get('/result/:id', getResult);

/**
 * GET /api/history
 * Returns recent 20 analyses.
 */
router.get('/history', getHistory);

module.exports = router;
