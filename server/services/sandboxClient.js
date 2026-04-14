const axios = require('axios');
const logger = require('../utils/logger');

const SANDBOX_URL = process.env.SANDBOX_API_URL || 'http://localhost:3002';
const SANDBOX_SECRET = process.env.SANDBOX_SECRET || 'change_this_secret';
const TIMEOUT_MS = parseInt(process.env.ANALYSIS_QUEUE_TIMEOUT_MS || '30000', 10);

/**
 * Sends a URL to the isolated sandbox container for browser analysis.
 * The sandbox runs Playwright in a hardened Docker container.
 *
 * @param {string} url - The normalized URL to analyze
 * @returns {object} - Extracted page metadata
 */
async function analyzeInSandbox(url) {
  try {
    logger.info(`Sending URL to sandbox: ${url}`);

    const response = await axios.post(
      `${SANDBOX_URL}/browse`,
      { url },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Sandbox-Secret': SANDBOX_SECRET,
        },
        timeout: TIMEOUT_MS,
      }
    );

    if (!response.data || response.data.error) {
      throw new Error(response.data?.error || 'Sandbox returned empty response');
    }

    return response.data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      logger.warn('Sandbox unavailable — falling back to lightweight fetch');
      return await fallbackFetch(url);
    }

    logger.error('Sandbox analysis failed:', err.message);
    throw new Error(`Sandbox analysis failed: ${err.message}`);
  }
}

/**
 * Lightweight fallback using axios (no JS execution).
 * Used when sandbox container is unavailable (e.g., local dev without Docker).
 */
async function fallbackFetch(url) {
  logger.warn(`Using fallback HTTP fetch for: ${url}`);

  const redirectChain = [];
  let finalUrl = url;
  let statusCode = 0;
  let html = '';
  let contentType = '';

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 10,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'SpamShield-Analyzer/1.0 (security scanner)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // Track redirects manually
      beforeRedirect: (options, { headers }) => {
        redirectChain.push({
          url: options.href,
          statusCode: options.statusCode || 301,
        });
      },
    });

    finalUrl = response.config.url || url;
    statusCode = response.status;
    html = typeof response.data === 'string' ? response.data.slice(0, 500_000) : '';
    contentType = response.headers['content-type'] || '';
  } catch (err) {
    logger.warn(`Fallback fetch failed: ${err.message}`);
  }

  // Extract metadata from HTML using regex (no DOM parsing needed)
  const title = extractMetaFromHtml(html, 'title');
  const description = extractMetaFromHtml(html, 'description');
  const favicon = extractFaviconFromHtml(html, url);

  return {
    title,
    description,
    favicon,
    finalUrl,
    redirectChain,
    statusCode,
    contentType,
    html,
    hasPasswordField: /<input[^>]+type=["']?password["']?/i.test(html),
    isFallback: true,
  };
}

function extractMetaFromHtml(html, type) {
  if (!html) return null;

  if (type === 'title') {
    const match = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
    return match ? match[1].trim() : null;
  }

  if (type === 'description') {
    const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i)
      || html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i);
    return match ? match[1].trim() : null;
  }

  return null;
}

function extractFaviconFromHtml(html, baseUrl) {
  if (!html) return null;

  // Try link[rel=icon] first
  const iconMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);

  if (iconMatch) {
    try {
      return new URL(iconMatch[1], baseUrl).toString();
    } catch {}
  }

  // Fallback to /favicon.ico
  try {
    const { origin } = new URL(baseUrl);
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

module.exports = { analyzeInSandbox };
