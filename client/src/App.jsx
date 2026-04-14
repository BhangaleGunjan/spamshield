import { useState, useEffect } from 'react';
import axios from 'axios';
import UrlInput from './components/UrlInput.jsx';
import AnalysisResult from './components/AnalysisResult.jsx';
import ScanningLoader from './components/ScanningLoader.jsx';
import RiskBadge from './components/RiskBadge.jsx';
import { useAnalysis } from './hooks/useAnalysis.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const { status, result, error, cached, analyze, reset } = useAnalysis();
  const [history, setHistory] = useState([]);

  const isLoading = status === 'submitting' || status === 'pending';

  // Fetch history on mount
  useEffect(() => {
    axios.get(`${API_BASE}/api/history`)
      .then(({ data }) => setHistory(data.results || []))
      .catch(() => {});
  }, [status]);

  return (
    <div style={styles.app}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⬡</span>
          <div>
            <div style={styles.logoText}>SPAM<span style={styles.logoAccent}>SHIELD</span></div>
            <div style={styles.logoSub}>Link Safety Analyzer v1.0</div>
          </div>
        </div>
        <div style={styles.statusBar}>
          <StatusDot />
          <span style={styles.statusText}>SANDBOX ACTIVE</span>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main style={styles.main}>
        {/* Input Section */}
        {status !== 'complete' && (
          <section style={styles.inputSection}>
            <h1 style={styles.headline}>
              Analyze any suspicious link safely
            </h1>
            <p style={styles.subheadline}>
              URLs are opened in an isolated Docker sandbox. No link is visited on your machine.
            </p>
            <UrlInput onSubmit={analyze} isLoading={isLoading} />

            {/* Error State */}
            {status === 'failed' && error && (
              <div style={styles.errorBox}>
                <span style={styles.errorIcon}>✕</span>
                {error}
              </div>
            )}

            {/* Example URLs */}
            {status === 'idle' && (
              <div style={styles.examples}>
                <span style={styles.examplesLabel}>Try an example:</span>
                {['https://google.com', 'https://github.com', 'http://example.com'].map((u) => (
                  <button key={u} style={styles.exampleBtn} onClick={() => analyze(u)}>
                    {u}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Scanning Loader */}
        {isLoading && <ScanningLoader status={status} />}

        {/* Result */}
        {status === 'complete' && result && (
          <AnalysisResult result={result} cached={cached} onReset={reset} />
        )}

        {/* ── History ──────────────────────────────────────────────────── */}
        {status !== 'complete' && !isLoading && history.length > 0 && (
          <section style={styles.historySection}>
            <h2 style={styles.historyTitle}>RECENT ANALYSES</h2>
            <div style={styles.historyList}>
              {history.map((item) => (
                <div key={item.id} style={styles.historyItem}
                  onClick={() => analyze(item.url)}
                  role="button"
                  tabIndex={0}
                >
                  <div style={styles.historyUrl}>{truncate(item.url, 55)}</div>
                  <div style={styles.historyMeta}>
                    <RiskBadge label={item.riskLabel} score={item.riskScore} />
                    <span style={styles.historyDate}>
                      {item.analyzedAt ? timeAgo(item.analyzedAt) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={styles.footer}>
        <span>SpamShield runs on isolated Docker containers.</span>
        <span>No links are opened on your device or the main server.</span>
      </footer>
    </div>
  );
}

function StatusDot() {
  return (
    <span style={{
      width: '7px', height: '7px', borderRadius: '50%',
      background: 'var(--safe)',
      display: 'inline-block',
      boxShadow: '0 0 6px var(--safe)',
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  );
}

function truncate(s, n) { return s?.length > n ? s.slice(0, n) + '…' : s; }

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const styles = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-2)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    fontSize: '28px',
    color: 'var(--accent)',
    lineHeight: 1,
  },
  logoText: {
    fontFamily: 'var(--mono)',
    fontWeight: 700,
    fontSize: '18px',
    letterSpacing: '2px',
    color: 'var(--text)',
  },
  logoAccent: {
    color: 'var(--accent)',
  },
  logoSub: {
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    color: 'var(--text-3)',
    letterSpacing: '1px',
    marginTop: '2px',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusText: {
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    color: 'var(--safe)',
    letterSpacing: '1px',
  },
  main: {
    flex: 1,
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
    padding: '60px 24px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
  },
  inputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  headline: {
    fontFamily: 'var(--mono)',
    fontSize: 'clamp(22px, 4vw, 36px)',
    fontWeight: 700,
    lineHeight: 1.2,
    color: 'var(--text)',
  },
  subheadline: {
    fontSize: '14px',
    color: 'var(--text-2)',
    maxWidth: '540px',
    lineHeight: 1.7,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--danger-bg)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    fontSize: '13px',
    color: 'var(--danger)',
    fontFamily: 'var(--mono)',
  },
  errorIcon: {
    fontWeight: 700,
    flexShrink: 0,
  },
  examples: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  examplesLabel: {
    fontSize: '12px',
    color: 'var(--text-3)',
    fontFamily: 'var(--mono)',
  },
  exampleBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-2)',
    padding: '5px 12px',
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  historySection: {
    borderTop: '1px solid var(--border)',
    paddingTop: '32px',
  },
  historyTitle: {
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    letterSpacing: '2px',
    color: 'var(--text-3)',
    marginBottom: '16px',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    flexWrap: 'wrap',
  },
  historyUrl: {
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    color: 'var(--text-2)',
    flex: 1,
    minWidth: 0,
  },
  historyMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  historyDate: {
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    color: 'var(--text-3)',
  },
  footer: {
    borderTop: '1px solid var(--border)',
    padding: '16px 40px',
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    color: 'var(--text-3)',
    letterSpacing: '0.5px',
  },
};
