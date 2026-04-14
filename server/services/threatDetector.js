const axios = require('axios');
const logger = require('../utils/logger');

const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
  'THREAT_TYPE_UNSPECIFIED',
];

/**
 * Checks URL against Google Safe Browsing API v4.
 * Returns { isThreat, threatType, checkedAt }
 */
async function checkGoogleSafeBrowsing(url) {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    logger.warn('Google Safe Browsing API key not configured — skipping check.');
    return { isThreat: false, threatType: null, checkedAt: new Date(), skipped: true };
  }

  const payload = {
    client: {
      clientId: 'spamshield',
      clientVersion: '1.0.0',
    },
    threatInfo: {
      threatTypes: THREAT_TYPES,
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }],
    },
  };

  try {
    const response = await axios.post(`${SAFE_BROWSING_URL}?key=${apiKey}`, payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });

    const matches = response.data?.matches;

    if (matches && matches.length > 0) {
      return {
        isThreat: true,
        threatType: matches[0].threatType,
        checkedAt: new Date(),
      };
    }

    return { isThreat: false, threatType: null, checkedAt: new Date() };
  } catch (err) {
    logger.warn('Google Safe Browsing check failed:', err.message);
    return { isThreat: false, threatType: null, checkedAt: new Date(), error: err.message };
  }
}

/**
 * Analyzes page content for phishing indicators.
 * Called after the sandboxed browser returns HTML content.
 */
function detectPhishingPatterns(pageData, originalHostname) {
  const indicators = [];
  const suspiciousKeywords = [];

  const content = (pageData.html || '').toLowerCase();
  const title = (pageData.title || '').toLowerCase();
  const finalUrl = pageData.finalUrl || '';

  // ── Login Form Detection ───────────────────────────────────────────────────
  const hasLoginForm = pageData.hasPasswordField === true
    || /type=["']password["']/i.test(pageData.html || '')
    || /<input[^>]+password/i.test(pageData.html || '');

  // ── Domain Mismatch ────────────────────────────────────────────────────────
  let finalHostname = '';
  try {
    finalHostname = new URL(finalUrl).hostname;
  } catch {}

  const hasMismatchedDomain = hasLoginForm
    && finalHostname
    && originalHostname
    && finalHostname !== originalHostname
    && !finalHostname.endsWith('.' + originalHostname);

  // ── Brand Impersonation ────────────────────────────────────────────────────
  const BRAND_KEYWORDS = ['paypal', 'apple', 'google', 'microsoft', 'amazon', 'netflix',
    'facebook', 'instagram', 'twitter', 'bank', 'chase', 'wellsfargo', 'citi'];

  for (const brand of BRAND_KEYWORDS) {
    if ((title.includes(brand) || content.includes(brand)) && !originalHostname.includes(brand)) {
      indicators.push(`Brand impersonation: "${brand}" mentioned but domain does not match.`);
    }
  }

  // ── Urgency/Scam Language ──────────────────────────────────────────────────
  const URGENCY_PHRASES = [
    'your account has been suspended',
    'verify your account immediately',
    'click here to unlock',
    'unusual sign-in activity',
    'confirm your identity',
    'your account will be closed',
    'you have been selected',
    'congratulations you won',
    'act now before it expires',
  ];

  for (const phrase of URGENCY_PHRASES) {
    if (content.includes(phrase)) {
      suspiciousKeywords.push(phrase);
    }
  }

  // ── Obfuscation Indicators ─────────────────────────────────────────────────
  if (/eval\s*\(/i.test(pageData.html || '')) {
    indicators.push('JavaScript eval() usage detected — possible obfuscation.');
  }

  if (/document\.write\s*\(/i.test(pageData.html || '')) {
    indicators.push('document.write() usage detected — potential injection vector.');
  }

  // ── IP Address as Hostname ─────────────────────────────────────────────────
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(originalHostname)) {
    indicators.push('Site hosted on raw IP address — no domain name registered.');
  }

  return {
    hasLoginForm,
    hasMismatchedDomain,
    phishingIndicators: indicators,
    suspiciousKeywords,
  };
}

module.exports = { checkGoogleSafeBrowsing, detectPhishingPatterns };
