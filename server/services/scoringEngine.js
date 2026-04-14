/**
 * SpamShield Heuristic Scoring Engine
 *
 * Scores URLs 0–100:
 *   0–30  → safe
 *   31–60 → suspicious
 *   61+   → dangerous
 */

const SUSPICIOUS_TLDS = (process.env.SUSPICIOUS_TLDS || '.xyz,.tk,.ml,.ga,.cf,.gq,.top,.club,.work,.online')
  .split(',')
  .map((t) => t.trim().toLowerCase());

const PHISHING_KEYWORDS = [
  'verify-account', 'confirm-identity', 'suspended-account', 'update-billing',
  'secure-login', 'account-recovery', 'unusual-activity', 'click-here-now',
  'free-prize', 'you-won', 'claim-reward', 'urgent-action', 'limited-time',
  'paypal-secure', 'apple-id', 'microsoft-login', 'google-verify',
];

const SUSPICIOUS_URL_PATTERNS = [
  /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/,  // IP address as hostname
  /@/,                                                    // URL contains @ (common trick)
  /\/\/.*@/,                                              // auth credentials in URL
  /-{3,}/,                                                // excessive hyphens
  /\.(exe|bat|cmd|scr|pif|com|vbs|js|jar|zip|rar)$/i,  // dangerous file extensions
];

/**
 * @param {object} data - Collected analysis data
 * @returns {{ total: number, label: string, breakdown: object, explanation: string[] }}
 */
function calculateRiskScore(data) {
  const breakdown = {
    domainAge: 0,
    suspiciousTld: 0,
    sslIssues: 0,
    safeBrowsing: 0,
    phishingPatterns: 0,
    redirectCount: 0,
  };
  const explanation = [];

  // ── Domain Age ──────────────────────────────────────────────────────────────
  if (data.domainInfo) {
    const age = data.domainInfo.ageInDays;
    if (age !== null && age !== undefined) {
      if (age < 30) {
        breakdown.domainAge = 30;
        explanation.push(`Domain is very new (${age} days old) — high risk indicator.`);
      } else if (age < 180) {
        breakdown.domainAge = 15;
        explanation.push(`Domain is relatively new (${age} days old).`);
      }
    }

    // ── Suspicious TLD ───────────────────────────────────────────────────────
    if (data.domainInfo.isSuspiciousTld) {
      breakdown.suspiciousTld = 15;
      explanation.push(`TLD "${data.domainInfo.tld}" is commonly associated with spam/phishing.`);
    }

    // ── SSL Issues ───────────────────────────────────────────────────────────
    if (data.domainInfo.sslValid === false) {
      breakdown.sslIssues = 20;
      explanation.push('SSL certificate is invalid or missing — unencrypted connection.');
    } else if (data.domainInfo.sslExpiry) {
      const daysToExpiry = Math.floor(
        (new Date(data.domainInfo.sslExpiry) - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysToExpiry < 7) {
        breakdown.sslIssues = 10;
        explanation.push(`SSL certificate expires in ${daysToExpiry} days.`);
      }
    }
  }

  // ── Google Safe Browsing ────────────────────────────────────────────────────
  if (data.threats?.googleSafeBrowsing?.isThreat) {
    breakdown.safeBrowsing = 50;
    explanation.push(
      `Flagged by Google Safe Browsing as: ${data.threats.googleSafeBrowsing.threatType}.`
    );
  }

  // ── Phishing Patterns ───────────────────────────────────────────────────────
  let phishingScore = 0;

  if (data.threats?.hasLoginForm && data.threats?.hasMismatchedDomain) {
    phishingScore += 25;
    explanation.push('Login form detected with domain mismatch — likely phishing.');
  } else if (data.threats?.hasLoginForm) {
    phishingScore += 5;
    explanation.push('Login form detected on page.');
  }

  if (data.threats?.phishingIndicators?.length) {
    const count = data.threats.phishingIndicators.length;
    phishingScore += Math.min(count * 5, 20);
    explanation.push(`Detected ${count} phishing indicator(s): ${data.threats.phishingIndicators.slice(0, 3).join(', ')}.`);
  }

  if (data.threats?.suspiciousKeywords?.length) {
    const count = data.threats.suspiciousKeywords.length;
    phishingScore += Math.min(count * 3, 10);
    explanation.push(`Found ${count} suspicious keyword(s) in page content.`);
  }

  // ── URL Pattern Checks ──────────────────────────────────────────────────────
  if (data.originalUrl) {
    for (const pattern of SUSPICIOUS_URL_PATTERNS) {
      if (pattern.test(data.originalUrl)) {
        phishingScore += 15;
        explanation.push('URL contains suspicious pattern (IP address, credentials, or dangerous extension).');
        break;
      }
    }
    // Check for phishing keywords in URL
    const lowerUrl = data.originalUrl.toLowerCase();
    const foundKeywords = PHISHING_KEYWORDS.filter((kw) => lowerUrl.includes(kw));
    if (foundKeywords.length > 0) {
      phishingScore += Math.min(foundKeywords.length * 5, 15);
      explanation.push(`Suspicious keywords in URL: ${foundKeywords.slice(0, 3).join(', ')}.`);
    }
  }

  breakdown.phishingPatterns = Math.min(phishingScore, 50);

  // ── Redirect Chain ──────────────────────────────────────────────────────────
  const redirectCount = data.metadata?.redirectChain?.length || 0;
  if (redirectCount > 5) {
    breakdown.redirectCount = 15;
    explanation.push(`Excessive redirect chain (${redirectCount} hops) — possible cloaking.`);
  } else if (redirectCount > 2) {
    breakdown.redirectCount = 5;
    explanation.push(`Multiple redirects detected (${redirectCount} hops).`);
  }

  // ── Total Score ──────────────────────────────────────────────────────────────
  const total = Math.min(
    breakdown.domainAge +
    breakdown.suspiciousTld +
    breakdown.sslIssues +
    breakdown.safeBrowsing +
    breakdown.phishingPatterns +
    breakdown.redirectCount,
    100
  );

  let label;
  if (total <= 30) {
    label = 'safe';
    if (explanation.length === 0) explanation.push('No significant risk indicators detected.');
  } else if (total <= 60) {
    label = 'suspicious';
  } else {
    label = 'dangerous';
  }

  return { total, label, breakdown, explanation };
}

module.exports = { calculateRiskScore, SUSPICIOUS_TLDS };
