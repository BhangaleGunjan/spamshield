const STEPS = [
  { id: 1, label: 'Validating URL structure & SSRF guards' },
  { id: 2, label: 'Opening sandbox browser container' },
  { id: 3, label: 'Navigating to target URL' },
  { id: 4, label: 'Extracting page metadata' },
  { id: 5, label: 'Running WHOIS & SSL certificate check' },
  { id: 6, label: 'Querying Google Safe Browsing' },
  { id: 7, label: 'Detecting phishing patterns' },
  { id: 8, label: 'Computing heuristic risk score' },
];

export default function ScanningLoader({ status }) {
  const activeStep = status === 'submitting' ? 1 : status === 'pending' ? 3 : 6;

  return (
    <div style={styles.wrap}>
      {/* Animated radar */}
      <div style={styles.radarWrap}>
        <div style={styles.radar}>
          <div style={styles.radarLine} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ ...styles.radarRing, width: `${(i + 1) * 60}px`, height: `${(i + 1) * 60}px` }} />
          ))}
          <div style={styles.radarDot} />
        </div>
      </div>

      <div style={styles.label}>SCANNING IN PROGRESS</div>
      <div style={styles.sublabel}>
        URL is being analyzed in an isolated sandbox container
      </div>

      <div style={styles.steps}>
        {STEPS.map((step) => {
          const done = step.id < activeStep;
          const active = step.id === activeStep;
          return (
            <div key={step.id} style={styles.step}>
              <div style={{
                ...styles.stepDot,
                background: done ? 'var(--safe)' : active ? 'var(--accent)' : 'var(--border)',
                animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                ...styles.stepText,
                color: done ? 'var(--safe)' : active ? 'var(--accent)' : 'var(--text-3)',
              }}>
                {done ? '✓ ' : active ? '▶ ' : '  '}{step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '40px 20px',
    animation: 'fadeIn 0.3s ease',
  },
  radarWrap: {
    position: 'relative',
    width: '120px',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radar: {
    position: 'relative',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radarLine: {
    position: 'absolute',
    width: '50%',
    height: '2px',
    background: 'linear-gradient(to right, transparent, var(--accent))',
    transformOrigin: 'left center',
    left: '50%',
    top: '50%',
    transform: 'translateY(-50%)',
    animation: 'spin 2s linear infinite',
    boxShadow: '0 0 8px var(--accent)',
  },
  radarRing: {
    position: 'absolute',
    borderRadius: '50%',
    border: '1px solid var(--border)',
  },
  radarDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 8px var(--accent)',
    animation: 'pulse 1.5s ease-in-out infinite',
    zIndex: 1,
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: '13px',
    letterSpacing: '3px',
    color: 'var(--accent)',
    animation: 'flicker 4s ease-in-out infinite',
  },
  sublabel: {
    fontSize: '13px',
    color: 'var(--text-3)',
    textAlign: 'center',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    maxWidth: '400px',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  stepDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.3s',
  },
  stepText: {
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    transition: 'color 0.3s',
  },
};
