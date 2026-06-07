import { useState, useEffect, useCallback } from 'react';

const ALL_TAGS = ['US Equity', 'Europe', 'Asia', 'Uranium', 'Gold', 'Commodities', 'Macro', 'AI'];

const CACHE_KEY = 'news_cache_v3';
const CACHE_TTL = 3 * 60 * 60 * 1000;

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TagPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.1s',
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-2)'}`,
        color: active ? '#fff' : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  );
}

export default function NewsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [activeTags, setActiveTags] = useState(new Set());
  const [error, setError] = useState(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!force) {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw);
            if (Date.now() - cached.ts < CACHE_TTL) {
              setItems(cached.items);
              setUpdatedAt(cached.updated_at);
              setLoading(false);
              return;
            }
          }
        } catch { /* ignore */ }
      }

      const res = await fetch('/api/news');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setUpdatedAt(data.updated_at);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ items: data.items, updated_at: data.updated_at, ts: Date.now() }));
      } catch { /* ignore */ }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleTag(tag) {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  const filtered = activeTags.size === 0
    ? items
    : items.filter(item => item.tags?.some(t => activeTags.has(t)));

  return (
    <div className="page">
      <div className="page-header">
        <h1>News</h1>
        <button
          onClick={() => load(true)}
          disabled={loading}
          style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-muted)', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Tag filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {ALL_TAGS.map(tag => (
          <TagPill key={tag} label={tag} active={activeTags.has(tag)} onClick={() => toggleTag(tag)} />
        ))}
        {activeTags.size > 0 && (
          <button
            onClick={() => setActiveTags(new Set())}
            style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            Clear
          </button>
        )}
      </div>

      {updatedAt && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Updated {relativeTime(new Date(updatedAt).getTime())}
          {activeTags.size > 0 && ` · ${filtered.length} of ${items.length} items`}
        </p>
      )}

      {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 16 }}>Failed to load: {error}</p>}

      {loading && !items.length ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading news…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No items for selected filters.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map((item, i) => (
            <a
              key={item.link}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div style={{
                padding: '13px 16px',
                background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                borderRadius: 6,
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>
                    {item.title}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relativeTime(item.ts)}</span>
                    {item.source && <span style={{ fontSize: '0.65rem', color: 'var(--border-2)', whiteSpace: 'nowrap' }}>{item.source}</span>}
                  </div>
                </div>
                {item.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {item.tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: '0.65rem', fontWeight: 600, padding: '1px 7px', borderRadius: 10,
                        background: activeTags.has(tag) ? 'rgba(99,102,241,0.2)' : 'var(--surface-2)',
                        border: `1px solid ${activeTags.has(tag) ? 'var(--accent)' : 'var(--border)'}`,
                        color: activeTags.has(tag) ? 'var(--accent)' : 'var(--text-muted)',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
