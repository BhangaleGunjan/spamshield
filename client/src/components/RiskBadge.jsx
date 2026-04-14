export default function RiskBadge({ label, score, large = false }) {
  const config = {
    safe:       { color: 'var(--safe)',   bg: 'var(--safe-bg)',   icon: '✓', text: 'SAFE' },
    suspicious: { color: 'var(--warn)',   bg: 'var(--warn-bg)',   icon: '⚠', text: 'SUSPICIOUS' },
    dangerous:  { color: 'var(--danger)', bg: 'var(--danger-bg)', icon: '✕', text: 'DANGEROUS' },
    unknown:    { color: 'var(--text-3)', bg: 'var(--bg-3)',      icon: '?', text: 'UNKNOWN' },
  }[label] || { color: 'var(--text-3)', bg: 'var(--bg-3)', icon: '?', text: 'UNKNOWN' };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: large ? '12px' : '8px',
      background: config.bg,
      border: `1px solid ${config.color}`,
      borderRadius: 'var(--radius)',
      padding: large ? '12px 20px' : '4px 10px',
    }}>
      <span style={{
        color: config.color,
        fontFamily: 'var(--mono)',
        fontWeight: 700,
        fontSize: large ? '28px' : '14px',
      }}>
        {config.icon}
      </span>
      <div>
        <div style={{
          color: config.color,
          fontFamily: 'var(--mono)',
          fontWeight: 700,
          fontSize: large ? '18px' : '12px',
          letterSpacing: '2px',
        }}>
          {config.text}
        </div>
        {score != null && (
          <div style={{
            color: 'var(--text-2)',
            fontFamily: 'var(--mono)',
            fontSize: large ? '12px' : '10px',
          }}>
            Risk Score: {score}/100
          </div>
        )}
      </div>
    </div>
  );
}
