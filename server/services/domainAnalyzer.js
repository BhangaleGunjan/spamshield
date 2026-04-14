const tls = require('tls');
const whois = require('whois');
const { promisify } = require('util');
const logger = require('../utils/logger');
const { SUSPICIOUS_TLDS } = require('./scoringEngine');

const whoisLookup = promisify(whois.lookup);

async function getWhoisData(hostname) {
  try {
    const domain = hostname.replace(/^www\./, '');
    const raw = await Promise.race([
      whoisLookup(domain, { timeout: 7000 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WHOIS timeout')), 8000)
      ),
    ]);
    return parseWhoisOutput(raw, domain);
  } catch (err) {
    logger.warn(`WHOIS lookup failed for ${hostname}:`, err.message);
    return null;
  }
}

function parseWhoisOutput(raw, domain) {
  const result = { registrar: null, createdDate: null, expiresDate: null, ageInDays: null, isNewDomain: false };
  if (!raw || typeof raw !== 'string') return result;

  const registrarMatch = raw.match(/Registrar:\s*(.+)/i);
  if (registrarMatch) result.registrar = registrarMatch[1].trim();

  const createdPatterns = [
    /Creation Date:\s*(.+)/i,
    /Created Date:\s*(.+)/i,
    /created:\s*(.+)/i,
    /Domain Registration Date:\s*(.+)/i,
    /Registration Time:\s*(.+)/i,
  ];
  for (const pattern of createdPatterns) {
    const match = raw.match(pattern);
    if (match) {
      const d = new Date(match[1].trim());
      if (!isNaN(d.getTime())) {
        result.createdDate = d;
        result.ageInDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        result.isNewDomain = result.ageInDays < 90;
        break;
      }
    }
  }

  const expiryPatterns = [
    /Registry Expiry Date:\s*(.+)/i,
    /Expiration Date:\s*(.+)/i,
    /Expiry Date:\s*(.+)/i,
    /paid-till:\s*(.+)/i,
  ];
  for (const pattern of expiryPatterns) {
    const match = raw.match(pattern);
    if (match) {
      const d = new Date(match[1].trim());
      if (!isNaN(d.getTime())) { result.expiresDate = d; break; }
    }
  }
  return result;
}

async function checkSsl(hostname) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ sslValid: false, sslExpiry: null, sslIssuer: null });
    }, 7000);

    try {
      const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: true, timeout: 6000 }, () => {
        clearTimeout(timeout);
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (!cert || !cert.valid_to) { resolve({ sslValid: false, sslExpiry: null, sslIssuer: null }); return; }
        resolve({ sslValid: true, sslExpiry: new Date(cert.valid_to), sslIssuer: cert.issuer?.O || cert.issuer?.CN || null });
      });
      socket.on('error', (err) => { clearTimeout(timeout); resolve({ sslValid: false, sslExpiry: null, sslIssuer: null }); });
    } catch (err) {
      clearTimeout(timeout);
      resolve({ sslValid: false, sslExpiry: null, sslIssuer: null });
    }
  });
}

async function analyzeDomain(hostname, tld, protocol) {
  const isSuspiciousTld = SUSPICIOUS_TLDS.includes(tld.toLowerCase());

  const [whoisResult, sslResult] = await Promise.allSettled([
    getWhoisData(hostname),
    protocol === 'https:' ? checkSsl(hostname) : Promise.resolve({ sslValid: false }),
  ]);

  const whoisData = whoisResult.status === 'fulfilled' ? whoisResult.value : null;
  const sslData = sslResult.status === 'fulfilled' ? sslResult.value : { sslValid: false };

  return {
    tld,
    isSuspiciousTld,
    registrar: whoisData?.registrar ?? null,
    createdDate: whoisData?.createdDate ?? null,
    expiresDate: whoisData?.expiresDate ?? null,
    ageInDays: whoisData?.ageInDays ?? null,
    isNewDomain: whoisData?.isNewDomain ?? false,
    sslValid: sslData.sslValid,
    sslExpiry: sslData.sslExpiry ?? null,
    sslIssuer: sslData.sslIssuer ?? null,
  };
}

module.exports = { analyzeDomain };
