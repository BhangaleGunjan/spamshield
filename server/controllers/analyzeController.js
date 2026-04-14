const { submitAnalysis } = require('../services/analyzerService');
const Analysis = require('../models/Analysis');
const { ValidationError } = require('../utils/urlValidator');
const logger = require('../utils/logger');

/**
 * POST /api/analyze
 * Accepts { url } and kicks off the analysis pipeline.
 */
async function analyzeUrl(req, res, next) {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url field is required.' });
    }

    const result = await submitAnalysis(url);

    if (result.cached) {
      return res.status(200).json({
        id: result.id,
        cached: true,
        status: 'complete',
        result: formatAnalysis(result.analysis),
      });
    }

    return res.status(202).json({
      id: result.id,
      cached: false,
      status: 'pending',
      message: 'Analysis started. Poll GET /api/result/:id for updates.',
      pollUrl: `/api/result/${result.id}`,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * GET /api/result/:id
 * Returns stored analysis result by ID.
 */
async function getResult(req, res, next) {
  try {
    const { id } = req.params;

    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid analysis ID format.' });
    }

    const analysis = await Analysis.findById(id).lean();

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    const response = {
      id: analysis._id.toString(),
      status: analysis.status,
      cached: false,
    };

    if (analysis.status === 'complete') {
      response.result = formatAnalysis(analysis);
    } else if (analysis.status === 'failed') {
      response.error = analysis.error || 'Analysis failed.';
    } else {
      response.message = 'Analysis is still in progress. Please poll again.';
    }

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/history
 * Returns recent analyses (last 20).
 */
async function getHistory(req, res, next) {
  try {
    const analyses = await Analysis.find({ status: 'complete' })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('originalUrl scoring.label scoring.total analyzedAt createdAt')
      .lean();

    return res.status(200).json({
      count: analyses.length,
      results: analyses.map((a) => ({
        id: a._id.toString(),
        url: a.originalUrl,
        riskLabel: a.scoring?.label || 'unknown',
        riskScore: a.scoring?.total ?? null,
        analyzedAt: a.analyzedAt || a.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Formats the raw DB document into a clean API response.
 */
function formatAnalysis(a) {
  return {
    url: {
      original: a.originalUrl,
      final: a.metadata?.finalUrl || a.originalUrl,
      redirectChain: a.metadata?.redirectChain || [],
    },
    page: {
      title: a.metadata?.title || null,
      description: a.metadata?.description || null,
      favicon: a.metadata?.favicon || null,
      statusCode: a.metadata?.statusCode || null,
      contentType: a.metadata?.contentType || null,
    },
    domain: {
      registrar: a.domainInfo?.registrar || null,
      ageInDays: a.domainInfo?.ageInDays ?? null,
      createdDate: a.domainInfo?.createdDate || null,
      expiresDate: a.domainInfo?.expiresDate || null,
      isNewDomain: a.domainInfo?.isNewDomain || false,
      tld: a.domainInfo?.tld || null,
      isSuspiciousTld: a.domainInfo?.isSuspiciousTld || false,
      ssl: {
        valid: a.domainInfo?.sslValid || false,
        expiry: a.domainInfo?.sslExpiry || null,
        issuer: a.domainInfo?.sslIssuer || null,
      },
    },
    threats: {
      googleSafeBrowsing: a.threats?.googleSafeBrowsing || null,
      hasLoginForm: a.threats?.hasLoginForm || false,
      hasMismatchedDomain: a.threats?.hasMismatchedDomain || false,
      phishingIndicators: a.threats?.phishingIndicators || [],
      suspiciousKeywords: a.threats?.suspiciousKeywords || [],
    },
    risk: {
      score: a.scoring?.total ?? null,
      label: a.scoring?.label || 'unknown',
      breakdown: a.scoring?.breakdown || {},
      explanation: a.scoring?.explanation || [],
    },
    meta: {
      analysisId: a._id.toString(),
      analyzedAt: a.analyzedAt || a.createdAt,
      processingTimeMs: a.processingTimeMs || null,
    },
  };
}

module.exports = { analyzeUrl, getResult, getHistory };
