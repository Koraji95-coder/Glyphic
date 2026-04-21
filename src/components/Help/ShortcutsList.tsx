import { shortcutsByCategory } from '../../lib/shortcuts';

/** Reusable keyboard-shortcut reference list (used in both Settings and Help). */
export function ShortcutsList() {
  const groups = shortcutsByCategory();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {(Object.keys(groups) as Array<keyof typeof groups>).map((cat) => {
        const entries = groups[cat];
        if (entries.length === 0) return null;
        return (
          <section key={cat}>
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-ghost)',
              }}
            >
              {cat}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '4px' }}>
              {entries.map((s) => (
                <li
                  key={s.combo}
                  className="flex items-center"
                  style={{
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card)',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.description}</span>
                  <kbd
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                    }}
                  >
                    {s.combo}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
