const Analysis = require('../models/Analysis');
const { validateAndNormalizeUrl, hashUrl } = require('../utils/urlValidator');
const { analyzeInSandbox } = require('./sandboxClient');
const { analyzeDomain } = require('./domainAnalyzer');
const { checkGoogleSafeBrowsing, detectPhishingPatterns } = require('./threatDetector');
const { calculateRiskScore } = require('./scoringEngine');
const logger = require('../utils/logger');

/**
 * Core analysis pipeline.
 * Orchestrates: URL validation → cache check → sandbox browse →
 *               domain analysis → threat detection → scoring → persist
 */
async function runAnalysis(analysisId) {
  const analysis = await Analysis.findById(analysisId);
  if (!analysis) throw new Error(`Analysis ${analysisId} not found`);

  const startTime = Date.now();

  try {
    await Analysis.findByIdAndUpdate(analysisId, { status: 'processing' });

    const { normalized, hostname, tld, protocol } = validateAndNormalizeUrl(analysis.originalUrl);

    logger.info(`Starting analysis for: ${normalized}`);

    // ── Step 1: Sandbox Browser Analysis ─────────────────────────────────────
    const pageData = await analyzeInSandbox(normalized);

    const metadata = {
      title: pageData.title || null,
      description: pageData.description || null,
      favicon: pageData.favicon || null,
      finalUrl: pageData.finalUrl || normalized,
      redirectChain: pageData.redirectChain || [],
      contentType: pageData.contentType || null,
      statusCode: pageData.statusCode || null,
    };

    // ── Step 2: Domain Analysis (parallel with threat check) ─────────────────
    const [domainInfo, safeBrowsingResult, phishingData] = await Promise.allSettled([
      analyzeDomain(hostname, tld, protocol),
      checkGoogleSafeBrowsing(metadata.finalUrl || normalized),
      Promise.resolve(detectPhishingPatterns(pageData, hostname)),
    ]);

    const domainInfoData = domainInfo.status === 'fulfilled' ? domainInfo.value : {};
    const safeBrowsing = safeBrowsingResult.status === 'fulfilled' ? safeBrowsingResult.value : {};
    const phishing = phishingData.status === 'fulfilled' ? phishingData.value : {};

    const threats = {
      googleSafeBrowsing: {
        isThreat: safeBrowsing.isThreat || false,
        threatType: safeBrowsing.threatType || null,
        checkedAt: safeBrowsing.checkedAt || new Date(),
      },
      phishingIndicators: phishing.phishingIndicators || [],
      suspiciousKeywords: phishing.suspiciousKeywords || [],
      hasLoginForm: phishing.hasLoginForm || false,
      hasMismatchedDomain: phishing.hasMismatchedDomain || false,
      ipAddress: pageData.ipAddress || null,
    };

    // ── Step 3: Risk Scoring ──────────────────────────────────────────────────
    const scoring = calculateRiskScore({
      originalUrl: normalized,
      domainInfo: domainInfoData,
      threats,
      metadata,
    });

    const processingTimeMs = Date.now() - startTime;

    // ── Step 4: Persist Results ───────────────────────────────────────────────
    const updated = await Analysis.findByIdAndUpdate(
      analysisId,
      {
        status: 'complete',
        metadata,
        domainInfo: domainInfoData,
        threats,
        scoring,
        processingTimeMs,
        analyzedAt: new Date(),
      },
      { new: true }
    );

    logger.info(`Analysis complete for ${normalized} | Score: ${scoring.total} (${scoring.label}) | ${processingTimeMs}ms`);

    return updated;
  } catch (err) {
    logger.error(`Analysis failed for ${analysisId}:`, err.message);

    await Analysis.findByIdAndUpdate(analysisId, {
      status: 'failed',
      error: err.message,
    });

    throw err;
  }
}

/**
 * Creates an Analysis record and triggers the pipeline.
 * Checks cache first to avoid redundant processing.
 */
async function submitAnalysis(rawUrl) {
  const { original, normalized } = validateAndNormalizeUrl(rawUrl);
  const urlHash = hashUrl(normalized);

  // ── Cache Check ───────────────────────────────────────────────────────────
  const cached = await Analysis.findOne({
    urlHash,
    status: 'complete',
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1 hour cache
  }).lean();

  if (cached) {
    logger.info(`Cache hit for: ${normalized}`);
    return { id: cached._id.toString(), cached: true, analysis: cached };
  }

  // ── Create Pending Record ─────────────────────────────────────────────────
  const analysis = await Analysis.create({
    originalUrl: original,
    urlHash,
    status: 'pending',
  });

  // Run analysis (in production this goes to a Bull queue worker)
  // For simplicity, run inline but non-blocking
  runAnalysis(analysis._id.toString()).catch((err) => {
    logger.error(`Background analysis error for ${analysis._id}:`, err.message);
  });

  return { id: analysis._id.toString(), cached: false };
}

module.exports = { submitAnalysis, runAnalysis };
