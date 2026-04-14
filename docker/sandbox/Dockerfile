# ── Sandbox Container ──────────────────────────────────────────────────────────
# This container is intentionally isolated:
#  - Runs as non-root user
#  - No privileged mode
#  - Network access controlled by docker-compose
#  - Playwright browser dependencies only
# ──────────────────────────────────────────────────────────────────────────────

FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Create non-root user for running the browser
RUN groupadd -r sandbox && useradd -r -g sandbox -d /home/sandbox -m sandbox

WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install --omit=dev

# Install only Chromium (smallest footprint)
RUN npx playwright install chromium

# Copy application
COPY server.js .

# Set ownership
RUN chown -R sandbox:sandbox /app

# Drop to non-root
USER sandbox

# Expose sandbox port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
