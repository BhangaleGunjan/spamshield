const { createHash } = require('crypto');
const validator = require('validator');

// Private/reserved IP ranges for SSRF protection
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,   // link-local
  /^0\./,
  /^::1$/,          // IPv6 loopback
  /^fc00:/i,        // IPv6 private
  /^fe80:/i,        // IPv6 link-local
];

const BLOCKED_HOSTS = [
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',  // AWS/GCP metadata
  '100.100.100.200',  // Alibaba metadata
];

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validates and normalizes a URL. Throws descriptive errors for invalid input.
 * Prevents SSRF by blocking private/reserved addresses.
 */
function validateAndNormalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new ValidationError('URL is required and must be a string.');
  }

  // Trim and limit length
  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    throw new ValidationError('URL exceeds maximum length of 2048 characters.');
  }

  // Add protocol if missing
  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  // Validate URL structure
  if (!validator.isURL(normalized, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: true,
    allow_query_components: true,
  })) {
    throw new ValidationError('Invalid URL format.');
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new ValidationError('Failed to parse URL.');
  }

  // Protocol check
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new ValidationError(`Protocol "${parsed.protocol}" is not allowed. Only HTTP and HTTPS are supported.`);
  }

  // Block private/local hosts (SSRF prevention)
  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.includes(hostname)) {
    throw new ValidationError('Access to this host is not permitted.');
  }

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new ValidationError('Access to private/internal IP ranges is not permitted.');
    }
  }

  // Block numeric localhost equivalents
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    throw new ValidationError('Non-standard IP notation is not permitted.');
  }

  return {
    original: rawUrl.trim(),
    normalized: parsed.toString(),
    hostname,
    tld: extractTld(hostname),
    protocol: parsed.protocol,
  };
}

function extractTld(hostname) {
  const parts = hostname.split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
}

function hashUrl(url) {
  return createHash('sha256').update(url.toLowerCase().trim()).digest('hex');
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

module.exports = { validateAndNormalizeUrl, hashUrl, ValidationError };
