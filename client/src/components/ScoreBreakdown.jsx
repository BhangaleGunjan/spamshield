const CATEGORIES = [
  { key: 'safeBrowsing',      label: 'Safe Browsing',    max: 50,  color: 'var(--danger)' },
  { key: 'phishingPatterns',  label: 'Phishing Signals', max: 50,  color: 'var(--danger)' },
  { key: 'domainAge',         label: 'Domain Age',       max: 30,  color: 'var(--warn)' },
  { key: 'sslIssues',         label: 'SSL Issues',       max: 20,  color: 'var(--warn)' },
  { key: 'suspiciousTld',     label: 'Suspicious TLD',   max: 15,  color: 'var(--warn)' },
  { key: 'redirectCount',     label: 'Redirect Chain',   max: 15,  color: 'var(--accent)' },
];

export default function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;

  return (
    <div style={styles.wrap}>
      <h3 style={styles.title}>RISK BREAKDOWN</h3>
      {CATEGORIES.map(({ key, label, max, color }) => {
        const value = breakdown[key] || 0;
        const pct = Math.min((value / max) * 100, 100);
        return (
          <div key={key} style={styles.row}>
            <div style={styles.labelRow}>
              <span style={styles.label}>{label}</span>
              <span style={{ ...styles.value, color: value > 0 ? color : 'var(--text-3)' }}>
                {value}/{max}
              </span>
            </div>
            <div style={styles.track}>
              <div style={{
                ...styles.bar,
                width: `${pct}%`,
                background: color,
                animationName: 'barIn',
                animationDuration: '0.8s',
                animationTimingFunction: 'ease-out',
                animationFillMode: 'both',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  title: {
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    letterSpacing: '2px',
    color: 'var(--text-3)',
    marginBottom: '4px',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-2)',
    fontFamily: 'var(--sans)',
  },
  value: {
    fontSize: '11px',
    fontFamily: 'var(--mono)',
  },
  track: {
    height: '4px',
    background: 'var(--bg-3)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: '2px',
    minWidth: '2px',
    transition: 'width 0.5s ease',
  },
};
