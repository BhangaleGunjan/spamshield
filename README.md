# ⬡ SpamShield — Production-Ready Spam Link Analyzer

SpamShield safely analyzes potentially malicious URLs by opening them inside an **isolated Docker sandbox**, extracting metadata, and returning a risk score — without ever visiting the link on your machine or main server.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Design](#security-design)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Quick Start (Docker)](#quick-start-docker)
6. [Local Development (No Docker)](#local-development-no-docker)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Risk Scoring System](#risk-scoring-system)
10. [Sample Test Requests](#sample-test-requests)
11. [How Each Component Works](#how-each-component-works)
12. [Production Checklist](#production-checklist)
13. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                   ┌─────────────────────────────────────────────────┐
                   │              Docker Compose Network              │
                   │                                                   │
  User Browser ───▶│  [React Client :5173] ──▶ [API Server :3001]    │
                   │                                │                  │
                   │                    ┌───────────┴──────────┐      │
                   │                    │                       │      │
                   │              [MongoDB :27017]        [Redis :6379]│
                   │                                                   │
                   │  [API Server] ──────────────▶ [Sandbox :3002]    │
                   │                                    │              │
                   │                           ┌────────┴────────┐    │
                   │                           │  Playwright      │    │
                   │                           │  Chromium        │    │
                   │                           │  (headless)      │    │
                   │                           └────────┬────────┘    │
                   └────────────────────────────────────│─────────────┘
                                                        │
                                                   Target URL
                                                 (external internet)
```

### Network Isolation
| Network        | Members                      | Internet Access |
|----------------|------------------------------|-----------------|
| `frontend-net` | client ↔ api                | No              |
| `backend-net`  | api ↔ mongo ↔ redis          | Yes (WHOIS/SSL) |
| `sandbox-net`  | api ↔ sandbox               | Yes (browse URLs)|

The sandbox container is **NOT** on `backend-net` — it cannot reach MongoDB or Redis directly.

---

## Security Design

### SSRF Prevention
All URLs are validated before processing:
- Blocks private IP ranges: `10.x`, `172.16-31.x`, `192.168.x`, `127.x`, `169.254.x`
- Blocks cloud metadata endpoints: `169.254.169.254`, `metadata.google.internal`
- Blocks non-HTTP(S) protocols (no `file://`, `ftp://`, `data:`, etc.)
- Blocks numeric/hex IP obfuscation tricks

### Sandbox Hardening
The Playwright browser runs in a separate container with:
- **JavaScript disabled** — prevents drive-by downloads and JS-based exploits
- **Downloads blocked** — `acceptDownloads: false`
- **No persisted cookies/storage** — fresh context per request
- **No permissions granted** — camera, mic, location all denied
- **Strict 15-second timeout** — kills hung requests
- **Non-root user** — `USER sandbox` in Dockerfile
- **Memory cap** — 1GB limit in docker-compose
- **Shared secret auth** — sandbox only accepts requests with `X-Sandbox-Secret` header
- **Resource type blocking** — media, fonts, websockets blocked at network level

### Rate Limiting
- Global API: 50 requests per 15 minutes per IP
- `/analyze` endpoint: 5 requests per minute per IP

### Caching
Results are cached in MongoDB for 1 hour. Identical URLs skip re-analysis.

---

## Project Structure

```
spam-shield/
├── docker-compose.yml          # Full orchestration
├── Dockerfile.api              # Main API container
├── .env.example                # Environment variable template
│
├── server/                     # Node.js Express API
│   ├── index.js                # Entry point, middleware setup
│   ├── config/
│   │   ├── database.js         # MongoDB connection
│   │   └── redis.js            # Redis connection
│   ├── controllers/
│   │   └── analyzeController.js  # Request handlers + response formatting
│   ├── middleware/
│   │   ├── rateLimiter.js      # express-rate-limit setup
│   │   └── errorHandler.js     # Global error handler
│   ├── models/
│   │   └── Analysis.js         # Mongoose schema (full analysis record)
│   ├── routes/
│   │   ├── analyze.js          # POST /api/analyze
│   │   └── results.js          # GET /api/result/:id, GET /api/history
│   ├── services/
│   │   ├── analyzerService.js  # Orchestration pipeline
│   │   ├── sandboxClient.js    # Calls the sandbox container
│   │   ├── domainAnalyzer.js   # WHOIS + SSL checks
│   │   ├── threatDetector.js   # Google Safe Browsing + phishing patterns
│   │   └── scoringEngine.js    # Heuristic risk scoring
│   └── utils/
│       ├── urlValidator.js     # URL normalization + SSRF protection
│       └── logger.js           # Winston logger
│
├── docker/
│   ├── mongo-init.js           # MongoDB index initialization
│   └── sandbox/
│       ├── Dockerfile          # Hardened Playwright container
│       ├── package.json
│       └── server.js           # Sandbox HTTP server (Playwright browser)
│
└── client/                     # React frontend
    ├── Dockerfile              # Nginx production build
    ├── nginx.conf
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Main app shell + history
        ├── hooks/
        │   └── useAnalysis.js  # Analysis state + polling logic
        └── components/
            ├── UrlInput.jsx        # URL input form
            ├── AnalysisResult.jsx  # Full result display
            ├── RiskBadge.jsx       # Safe/Suspicious/Dangerous badge
            ├── ScoreBreakdown.jsx  # Animated score bars
            └── ScanningLoader.jsx  # Radar animation during scan
```

---

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2
- **Node.js** 20+ (for local development only)
- Optional: Google Safe Browsing API key (free tier available)

---

## Quick Start (Docker)

### 1. Clone and Configure

```bash
git clone https://github.com/yourname/spam-shield.git
cd spam-shield

# Create your environment file
cp .env.example .env
```

Edit `.env`:
```env
SANDBOX_SECRET=your_long_random_secret_string_here
GOOGLE_SAFE_BROWSING_API_KEY=your_api_key_or_leave_blank
```

### 2. Build and Start All Services

```bash
docker compose up --build
```

First run downloads Playwright's Chromium (~200MB). Subsequent starts are fast.

### 3. Open the App

| Service       | URL                          |
|---------------|------------------------------|
| Frontend      | http://localhost:5173        |
| API           | http://localhost:3001        |
| API Health    | http://localhost:3001/health |

### 4. Stop Everything

```bash
docker compose down

# Remove all data (MongoDB + Redis volumes):
docker compose down -v
```

---

## Local Development (No Docker)

Requires MongoDB and Redis running locally.

### 1. Install Dependencies

```bash
# Server
cd server
npm install
npx playwright install chromium

# Client
cd ../client
npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/spamshield
REDIS_URL=redis://localhost:6379
SANDBOX_API_URL=http://localhost:3002
SANDBOX_SECRET=dev_secret
```

### 3. Start Services

**Terminal 1 — Sandbox browser worker:**
```bash
cd docker/sandbox
npm install
npx playwright install chromium
SANDBOX_SECRET=dev_secret node server.js
```

**Terminal 2 — API server:**
```bash
cd server
npm run dev
```

**Terminal 3 — React client:**
```bash
cd client
npm run dev
```

> **Note:** If the sandbox is not running, the API falls back to a lightweight `axios` HTTP fetch (no JS execution). This is sufficient for URL chain analysis and basic metadata but won't catch JS-rendered phishing pages.

---

## Environment Variables

| Variable                      | Required | Default                            | Description                                  |
|-------------------------------|----------|------------------------------------|----------------------------------------------|
| `PORT`                        | No       | `3001`                             | API server port                              |
| `MONGODB_URI`                 | Yes      | `mongodb://mongo:27017/spamshield` | MongoDB connection string                    |
| `REDIS_URL`                   | No       | `redis://redis:6379`               | Redis connection string                      |
| `SANDBOX_API_URL`             | Yes      | `http://sandbox:3002`              | URL of the sandbox container                 |
| `SANDBOX_SECRET`              | Yes      | —                                  | Shared secret for sandbox auth               |
| `GOOGLE_SAFE_BROWSING_API_KEY`| No       | —                                  | Google Safe Browsing v4 API key              |
| `RATE_LIMIT_WINDOW_MS`        | No       | `900000`                           | Rate limit window in milliseconds (15 min)   |
| `RATE_LIMIT_MAX_REQUESTS`     | No       | `50`                               | Max requests per window per IP               |
| `BROWSER_TIMEOUT_MS`          | No       | `15000`                            | Max time for sandbox to load a page (ms)     |
| `SUSPICIOUS_TLDS`             | No       | `.xyz,.tk,.ml,...`                 | Comma-separated list of suspicious TLDs      |

---

## API Reference

### `POST /api/analyze`

Submit a URL for analysis.

**Request:**
```json
{
  "url": "https://suspicious-example.xyz/login"
}
```

**Response (immediate, analysis pending):**
```json
{
  "id": "65a1234567890abcdef12345",
  "cached": false,
  "status": "pending",
  "message": "Analysis started. Poll GET /api/result/:id for updates.",
  "pollUrl": "/api/result/65a1234567890abcdef12345"
}
```

**Response (cache hit, instant):**
```json
{
  "id": "65a1234567890abcdef12345",
  "cached": true,
  "status": "complete",
  "result": { ... }
}
```

---

### `GET /api/result/:id`

Poll for analysis result.

**Status: `pending` or `processing`:**
```json
{
  "id": "65a1234567890abcdef12345",
  "status": "pending",
  "message": "Analysis is still in progress. Please poll again."
}
```

**Status: `complete`:**
```json
{
  "id": "65a1234567890abcdef12345",
  "status": "complete",
  "result": {
    "url": {
      "original": "http://fake-paypal-login.tk/verify",
      "final": "http://fake-paypal-login.tk/verify?ref=abc123",
      "redirectChain": [
        { "url": "http://bit.ly/abc", "statusCode": 301 },
        { "url": "http://fake-paypal-login.tk/verify", "statusCode": 302 }
      ]
    },
    "page": {
      "title": "PayPal - Verify Your Account",
      "description": "Secure your account now",
      "favicon": "http://fake-paypal-login.tk/favicon.ico",
      "statusCode": 200,
      "contentType": "text/html; charset=utf-8"
    },
    "domain": {
      "registrar": "Freenom",
      "ageInDays": 3,
      "createdDate": "2024-01-08T00:00:00.000Z",
      "expiresDate": "2025-01-08T00:00:00.000Z",
      "isNewDomain": true,
      "tld": ".tk",
      "isSuspiciousTld": true,
      "ssl": {
        "valid": false,
        "expiry": null,
        "issuer": null
      }
    },
    "threats": {
      "googleSafeBrowsing": {
        "isThreat": true,
        "threatType": "SOCIAL_ENGINEERING",
        "checkedAt": "2024-01-11T10:30:00.000Z"
      },
      "hasLoginForm": true,
      "hasMismatchedDomain": true,
      "phishingIndicators": [
        "Brand impersonation: \"paypal\" mentioned but domain does not match."
      ],
      "suspiciousKeywords": [
        "verify your account immediately"
      ]
    },
    "risk": {
      "score": 95,
      "label": "dangerous",
      "breakdown": {
        "domainAge": 30,
        "suspiciousTld": 15,
        "sslIssues": 20,
        "safeBrowsing": 50,
        "phishingPatterns": 50,
        "redirectCount": 5
      },
      "explanation": [
        "Domain is very new (3 days old) — high risk indicator.",
        "TLD \".tk\" is commonly associated with spam/phishing.",
        "SSL certificate is invalid or missing.",
        "Flagged by Google Safe Browsing as: SOCIAL_ENGINEERING.",
        "Login form detected with domain mismatch — likely phishing.",
        "Brand impersonation: \"paypal\" mentioned but domain does not match."
      ]
    },
    "meta": {
      "analysisId": "65a1234567890abcdef12345",
      "analyzedAt": "2024-01-11T10:30:05.000Z",
      "processingTimeMs": 4823
    }
  }
}
```

**Status: `failed`:**
```json
{
  "id": "65a1234567890abcdef12345",
  "status": "failed",
  "error": "Navigation timeout exceeded"
}
```

---

### `GET /api/history`

Returns the 20 most recent completed analyses.

```json
{
  "count": 3,
  "results": [
    {
      "id": "65a1234567890abcdef12345",
      "url": "http://fake-paypal-login.tk/verify",
      "riskLabel": "dangerous",
      "riskScore": 95,
      "analyzedAt": "2024-01-11T10:30:05.000Z"
    }
  ]
}
```

---

### `GET /health`

```json
{ "status": "healthy", "timestamp": "2024-01-11T10:30:00.000Z" }
```

---

## Risk Scoring System

Scores range from **0 to 100**:

| Score Range | Label        | Meaning                                           |
|-------------|--------------|---------------------------------------------------|
| 0 – 30      | ✓ SAFE       | No significant indicators detected               |
| 31 – 60     | ⚠ SUSPICIOUS  | Some risk factors; proceed with caution           |
| 61 – 100    | ✕ DANGEROUS  | High-confidence threat; do not visit              |

### Score Breakdown (Max Points)

| Category          | Max Points | Triggers                                              |
|-------------------|-----------|--------------------------------------------------------|
| Safe Browsing     | 50        | URL flagged by Google Safe Browsing                    |
| Phishing Patterns | 50        | Login form + domain mismatch, brand impersonation, urgency language |
| Domain Age        | 30        | < 30 days old (+30), < 180 days (+15)                 |
| SSL Issues        | 20        | Invalid/missing certificate                           |
| Suspicious TLD    | 15        | `.tk`, `.ml`, `.xyz`, etc.                            |
| Redirect Chain    | 15        | > 5 hops (+15), > 2 hops (+5)                         |

---

## Sample Test Requests

### Using curl

```bash
# Submit a URL
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'

# Poll for result (use ID from above response)
curl http://localhost:3001/api/result/ANALYSIS_ID_HERE

# View history
curl http://localhost:3001/api/history
```

### Block SSRF attempt (should return 400)
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "http://192.168.1.1/admin"}'

# Expected: {"error": "Access to private/internal IP ranges is not permitted."}
```

### Block metadata endpoint
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'

# Expected: {"error": "Access to this host is not permitted."}
```

### Test rate limiting
```bash
# Submit 6 requests rapidly (5 is the per-minute limit)
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com"}' &
done

# 6th request returns: HTTP 429 Too Many Requests
```

---

## How Each Component Works

### 1. URL Submission (`POST /api/analyze`)
1. Express receives `{ url }` payload
2. `urlValidator.js` normalizes and validates — adds `https://` if missing, checks for SSRF, validates format
3. SHA-256 hash of the URL is computed for cache key
4. MongoDB is checked: if a complete result exists from the last hour, it's returned instantly
5. Otherwise, a new `Analysis` document is created with `status: "pending"`
6. The analysis pipeline runs asynchronously; client receives the ID and polls

### 2. Sandbox Analysis (`sandboxClient.js` → `docker/sandbox/server.js`)
1. API sends `POST /browse { url }` to the sandbox container with shared-secret header
2. Sandbox launches a hardened Chromium instance (JS disabled, downloads blocked)
3. All redirects are tracked via Playwright's `response` event
4. Page loads with 15s timeout; metadata is extracted via `page.evaluate()`
5. Raw HTML (capped at 500KB) is returned for phishing analysis
6. Browser and context are always closed in `finally` block

### 3. Domain Analysis (`domainAnalyzer.js`)
1. **WHOIS**: System `whois` command is executed with timeout; output is parsed for creation/expiry dates
2. **SSL**: Native `tls.connect()` is used to check certificate validity, expiry, and issuer
3. **TLD Check**: Hostname TLD is compared against configurable suspicious TLD list

### 4. Threat Detection (`threatDetector.js`)
1. **Google Safe Browsing**: Sends URL to GSB API v4 `threatMatches:find`; checks against malware, social engineering, unwanted software
2. **Phishing Patterns**: HTML is analyzed for login forms, brand keywords vs. domain mismatch, urgency phrases, JS obfuscation
3. **URL Patterns**: Checks for IP-as-hostname, auth credentials in URL, dangerous file extensions

### 5. Risk Scoring (`scoringEngine.js`)
1. All collected signals are weighted and summed (capped at 100)
2. Human-readable explanations are generated for each triggered signal
3. Final label (`safe` / `suspicious` / `dangerous`) is assigned by threshold

### 6. Persistence & Caching
- Full result stored in MongoDB with 30-day TTL auto-deletion
- Results with `status: complete` cached for 1 hour per unique URL hash

---

## Production Checklist

Before deploying to production, complete this checklist:

- [ ] Set a strong random `SANDBOX_SECRET` (32+ chars)
- [ ] Set a real `GOOGLE_SAFE_BROWSING_API_KEY`
- [ ] Remove `ports` exposure for MongoDB in docker-compose
- [ ] Add a real domain and TLS termination (nginx/Caddy in front)
- [ ] Set up firewall rules to block sandbox container's outbound except port 80/443
- [ ] Configure MongoDB authentication (add user/password to `MONGODB_URI`)
- [ ] Set `NODE_ENV=production`
- [ ] Adjust `RATE_LIMIT_MAX_REQUESTS` based on expected traffic
- [ ] Set up log rotation for `/app/logs`
- [ ] Consider adding a proxy/VPN for the sandbox outbound IP
- [ ] Enable Docker resource limits in production orchestrator (Kubernetes, ECS, etc.)
- [ ] Set up MongoDB backups

---

## Troubleshooting

### "Sandbox unavailable — falling back to lightweight fetch"
The API can't reach the sandbox container. Verify:
```bash
docker compose ps          # Is sandbox running?
docker compose logs sandbox # Check for Playwright install errors
```

### MongoDB connection refused
```bash
docker compose logs mongo  # Check for startup errors
docker compose restart mongo
```

### Playwright install fails in sandbox Dockerfile
The Playwright base image needs `SYS_ADMIN` capability for Chrome sandbox. Verify your docker-compose has:
```yaml
cap_add:
  - SYS_ADMIN
shm_size: '256mb'
```

### Analysis stuck in "pending" forever
Check the API logs for errors:
```bash
docker compose logs api --tail=50
```

The background analysis might have failed silently. Query MongoDB directly:
```bash
docker exec -it spamshield-mongo mongosh spamshield --eval \
  "db.analyses.find({status:'failed'}).sort({createdAt:-1}).limit(5).pretty()"
```

### Rate limit too strict for development
Add to `server/.env`:
```env
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000
```

---

## Getting a Google Safe Browsing API Key (Free)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Navigate to **APIs & Services → Library**
4. Search for "Safe Browsing API" and enable it
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → API Key**
7. Copy the key into your `.env` as `GOOGLE_SAFE_BROWSING_API_KEY`
8. Optional: Restrict the key to only the Safe Browsing API

The free tier allows **10,000 requests/day** — sufficient for most use cases.
