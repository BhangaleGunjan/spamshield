import { useState } from 'react';

export default function UrlInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={{ ...styles.inputWrap, ...(focused ? styles.inputWrapFocused : {}) }}>
        <span style={styles.prefix}>https://</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="paste-any-link-here.com/suspicious/path"
          disabled={isLoading}
          style={styles.input}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
      <button type="submit" disabled={isLoading || !url.trim()} style={styles.button}>
        {isLoading ? (
          <span style={styles.spinner} />
        ) : (
          <>
            <span style={styles.scanIcon}>⬡</span>
            SCAN
          </>
        )}
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    gap: '10px',
    width: '100%',
  },
  inputWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    transition: 'border-color 0.2s',
    overflow: 'hidden',
  },
  inputWrapFocused: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 3px var(--accent-dim)',
  },
  prefix: {
    padding: '0 10px 0 14px',
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    color: 'var(--text-3)',
    whiteSpace: 'nowrap',
    borderRight: '1px solid var(--border)',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: '14px 14px',
    color: 'var(--text)',
    fontFamily: 'var(--mono)',
    fontSize: '13px',
    width: '100%',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 24px',
    background: 'var(--accent)',
    color: '#000',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--mono)',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
    opacity: 1,
  },
  scanIcon: {
    fontSize: '16px',
    lineHeight: 1,
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid rgba(0,0,0,0.3)',
    borderTopColor: '#000',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
