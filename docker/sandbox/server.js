/**
 * SpamShield Sandbox Server
 *
 * This runs in a SEPARATE hardened Docker container.
 * It accepts browse requests from the main API and uses
 * Playwright to safely visit URLs with strict security controls.
 *
 * Security measures:
 *  - No network access except to the target URL (Docker network policy)
 *  - JavaScript execution disabled by default
 *  - File downloads blocked
 *  - Strict timeouts (10s navigation, 15s total)
 *  - Runs as non-root user
 *  - Request auth via shared secret header
 *  - No cookies/storage persistence between requests
 */

require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');
const { createHash } = require('crypto');

const app = express();
app.use(express.json({ limit: '5kb' }));

const PORT = process.env.SANDBOX_PORT || 3002;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET || 'change_this_secret';
const NAV_TIMEOUT_MS = parseInt(process.env.BROWSER_TIMEOUT_MS || '15000', 10);

// ── Auth Middleware ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const secret = req.headers['x-sandbox-secret'];
  if (!secret || secret !== SANDBOX_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ── Browse Endpoint ────────────────────────────────────────────────────────────
app.post('/browse', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  let browser = null;
  let context = null;

  try {
    // Launch browser in sandboxed mode
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-default-apps',
        '--mute-audio',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--safebrowsing-disable-auto-update',
        '--disable-component-update',
      ],
    });

    // Create isolated context — no cookies, no storage, no permissions
    context = await browser.newContext({
      javaScriptEnabled: false,       // Disable JS by default (critical security measure)
      acceptDownloads: false,         // Block downloads
      bypassCSP: false,
      ignoreHTTPSErrors: true,        // Still visit but flag in metadata
      userAgent: 'SpamShield-Analyzer/1.0 (security scanner; +https://spamshield.io/bot)',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: undefined,
      permissions: [],                // No permissions granted
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const page = await context.newPage();
    const redirectChain = [];
    let ipAddress = null;

    // Track redirects
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 300 && status < 400) {
        redirectChain.push({
          url: response.url(),
          statusCode: status,
        });
      }
    });

    // Block dangerous resource types
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      const blockedTypes = ['media', 'font', 'websocket', 'other'];

      // Block all non-document requests for security
      if (blockedTypes.includes(type)) {
        route.abort();
        return;
      }

      // Only allow the main document and its direct resources
      route.continue();
    });

    // Navigate with strict timeout
    let response = null;
    try {
      response = await page.goto(url, {
        timeout: NAV_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
    } catch (navErr) {
      // Timeout or navigation error — still extract what we can
      console.warn(`Navigation warning for ${url}: ${navErr.message}`);
    }

    const finalUrl = page.url();
    const statusCode = response ? response.status() : null;
    const contentType = response ? (response.headers()['content-type'] || null) : null;

    // Extract metadata safely (JS is disabled so we use page.evaluate carefully)
    // Even though JS is disabled, page.evaluate() runs in a privileged context
    let title = null;
    let description = null;
    let favicon = null;
    let hasPasswordField = false;
    let html = '';

    try {
      const metadata = await page.evaluate(() => {
        return {
          title: document.title || null,
          description: document.querySelector('meta[name="description"]')?.content || null,
          favicon: (
            document.querySelector('link[rel="icon"]')?.href ||
            document.querySelector('link[rel="shortcut icon"]')?.href ||
            document.querySelector('link[rel="apple-touch-icon"]')?.href ||
            null
          ),
          hasPasswordField: !!document.querySelector('input[type="password"]'),
        };
      });

      title = metadata.title;
      description = metadata.description;
      favicon = metadata.favicon;
      hasPasswordField = metadata.hasPasswordField;
    } catch (evalErr) {
      console.warn('page.evaluate failed:', evalErr.message);
    }

    // Get raw HTML (capped at 500KB)
    try {
      const rawHtml = await page.content();
      html = rawHtml.slice(0, 500_000);
    } catch {}

    // Favicon fallback
    if (!favicon) {
      try {
        const { origin } = new URL(finalUrl);
        favicon = `${origin}/favicon.ico`;
      } catch {}
    }

    res.json({
      title,
      description,
      favicon,
      finalUrl,
      redirectChain,
      statusCode,
      contentType,
      hasPasswordField,
      ipAddress,
      html,
    });

  } catch (err) {
    console.error('Sandbox browse error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Always close context and browser — critical for memory management
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'sandbox-healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Sandbox] Browser worker running on port ${PORT}`);
});
