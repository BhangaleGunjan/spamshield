const express = require('express');
const router = express.Router();
const { analyzeUrl } = require('../controllers/analyzeController');

/**
 * POST /api/analyze
 * Body: { url: string }
 */
router.post('/analyze', analyzeUrl);

module.exports = router;
