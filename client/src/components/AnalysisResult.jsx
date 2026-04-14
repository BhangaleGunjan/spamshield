import RiskBadge from './RiskBadge.jsx';
import ScoreBreakdown from './ScoreBreakdown.jsx';

export default function AnalysisResult({ result, cached, onReset }) {
  const { url, page, domain, threats, risk, meta } = result;

  return (
    <div style={styles.wrap}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.pagePreview}>
          {page.favicon && (
            <img
              src={page.favicon}
              alt="favicon"
              style={styles.favicon}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div>
            <div style={styles.pageTitle}>{page.title || 'No title found'}</div>
            <a
              href={url.final}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.finalUrl}
            >
              {truncate(url.final, 80)}
            </a>
          </div>
        </div>
        <div style={styles.headerRight}>
          <RiskBadge label={risk.label} score={risk.score} large />
          {cached && <div style={styles.cachedBadge}>⚡ CACHED</div>}
        </div>
      </div>

      {/* ── Explanation ────────────────────────────────────────── */}
      {risk.explanation?.length > 0 && (
        <div style={styles.section}>
          <SectionTitle>FINDINGS</SectionTitle>
          <div style={styles.findings}>
            {risk.explanation.map((exp, i) => (
              <div key={i} style={styles.finding}>
                <span style={styles.findingBullet}>→</span>
                <span>{exp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.grid}>
        {/* ── Score Breakdown ──────────────────────────────────── */}
        <div style={styles.card}>
          <ScoreBreakdown breakdown={risk.breakdown} />
        </div>

        {/* ── Domain Info ──────────────────────────────────────── */}
        <div style={styles.card}>
          <SectionTitle>DOMAIN INTELLIGENCE</SectionTitle>
          <InfoTable rows={[
            ['Registrar',    domain.registrar || '—'],
            ['Domain Age',   domain.ageInDays != null ? `${domain.ageInDays} days` : '—'],
            ['Created',      domain.createdDate ? formatDate(domain.createdDate) : '—'],
            ['Expires',      domain.expiresDate ? formatDate(domain.expiresDate) : '—'],
            ['TLD',          domain.tld || '—'],
            ['SSL Valid',    domain.ssl.valid ? '✓ Yes' : '✗ No'],
            ['SSL Issuer',   domain.ssl.issuer || '—'],
            ['SSL Expires',  domain.ssl.expiry ? formatDate(domain.ssl.expiry) : '—'],
          ]} />
        </div>

        {/* ── Threat Signals ───────────────────────────────────── */}
        <div style={styles.card}>
          <SectionTitle>THREAT SIGNALS</SectionTitle>
          <InfoTable rows={[
            ['Google SafeBrowsing', threats.googleSafeBrowsing?.isThreat ? `⚠ ${threats.googleSafeBrowsing.threatType}` : '✓ Clean'],
            ['Login Form',         threats.hasLoginForm ? '⚠ Detected' : '✓ None'],
            ['Domain Mismatch',    threats.hasMismatchedDomain ? '⚠ Yes' : '✓ No'],
            ['Phishing Indicators',threats.phishingIndicators?.length > 0 ? `⚠ ${threats.phishingIndicators.length} found` : '✓ None'],
            ['Suspicious Keywords',threats.suspiciousKeywords?.length > 0 ? `⚠ ${threats.suspiciousKeywords.length} found` : '✓ None'],
          ]} />
        </div>

        {/* ── URL Chain ─────────────────────────────────────────── */}
        <div style={styles.card}>
          <SectionTitle>URL CHAIN ({url.redirectChain?.length || 0} redirects)</SectionTitle>
          <div style={styles.chain}>
            <ChainStep url={url.original} label="ORIGINAL" isFirst />
            {url.redirectChain?.map((r, i) => (
              <ChainStep key={i} url={r.url} label={`${r.statusCode}`} />
            ))}
            {url.final !== url.original && (
              <ChainStep url={url.final} label="FINAL" isLast />
            )}
          </div>
        </div>

        {/* ── Page Metadata ─────────────────────────────────────── */}
        <div style={styles.card}>
          <SectionTitle>PAGE METADATA</SectionTitle>
          <InfoTable rows={[
            ['Status Code',   page.statusCode || '—'],
            ['Content Type',  page.contentType || '—'],
            ['Description',   page.description ? truncate(page.description, 100) : '—'],
          ]} />
        </div>

        {/* ── Analysis Meta ─────────────────────────────────────── */}
        <div style={styles.card}>
          <SectionTitle>ANALYSIS META</SectionTitle>
          <InfoTable rows={[
            ['Analysis ID',      meta.analysisId],
            ['Analyzed At',      meta.analyzedAt ? formatDate(meta.analyzedAt) : '—'],
            ['Processing Time',  meta.processingTimeMs ? `${meta.processingTimeMs}ms` : '—'],
          ]} />
        </div>
      </div>

      <button onClick={onReset} style={styles.resetBtn}>
        ← ANALYZE ANOTHER URL
      </button>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)',
      fontSize: '10px',
      letterSpacing: '2px',
      color: 'var(--text-3)',
      marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function InfoTable({ rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{
              padding: '7px 0',
              fontSize: '12px',
              color: 'var(--text-3)',
              fontFamily: 'var(--mono)',
              width: '40%',
              verticalAlign: 'top',
            }}>
              {label}
            </td>
            <td style={{
              padding: '7px 0 7px 12px',
              fontSize: '12px',
              color: value?.toString().startsWith('⚠') ? 'var(--warn)'
                   : value?.toString().startsWith('✓') ? 'var(--safe)'
                   : value?.toString().startsWith('✗') ? 'var(--danger)'
                   : 'var(--text)',
              fontFamily: 'var(--mono)',
              wordBreak: 'break-all',
            }}>
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChainStep({ url, label, isFirst, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: isLast ? 'var(--accent)' : isFirst ? 'var(--safe)' : 'var(--warn)',
          flexShrink: 0, marginTop: '3px',
        }} />
        {!isLast && <div style={{ width: '1px', height: '100%', minHeight: '16px', background: 'var(--border)' }} />}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--text-3)', letterSpacing: '1px' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)', wordBreak: 'break-all' }}>
          {truncate(url, 60)}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return String(d); }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    animation: 'fadeIn 0.4s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px',
    flexWrap: 'wrap',
  },
  pagePreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flex: 1,
    minWidth: 0,
  },
  favicon: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    flexShrink: 0,
  },
  pageTitle: {
    fontWeight: 600,
    fontSize: '15px',
    marginBottom: '4px',
  },
  finalUrl: {
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    color: 'var(--accent)',
    wordBreak: 'break-all',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
    flexShrink: 0,
  },
  cachedBadge: {
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    color: 'var(--accent)',
    letterSpacing: '1px',
  },
  section: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px',
  },
  findings: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  finding: {
    display: 'flex',
    gap: '10px',
    fontSize: '13px',
    color: 'var(--text-2)',
    alignItems: 'flex-start',
  },
  findingBullet: {
    color: 'var(--accent)',
    fontFamily: 'var(--mono)',
    flexShrink: 0,
    marginTop: '1px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '16px',
  },
  card: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px',
  },
  chain: {
    display: 'flex',
    flexDirection: 'column',
  },
  resetBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-2)',
    padding: '10px 18px',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'border-color 0.15s, color 0.15s',
  },
};
