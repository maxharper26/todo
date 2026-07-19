import Link from 'next/link';

const PAGES = [
  { href: '/todo',   label: 'Todo',     icon: '✓',  desc: 'Tasks and priorities' },
  { href: '/stocks', label: 'Finance',  icon: '📈', desc: 'Portfolio, returns' },
  { href: '/nrl',    label: 'NRL',      icon: '🏉', desc: 'Team lists and ins & outs' },
  { href: '/surf',   label: 'Surf',     icon: '🌊', desc: 'Swell, wind and tides' },
];

export default function Home() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page" style={{ maxWidth: 640, paddingTop: 48 }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}>{greeting}, Max</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>What are we looking at today?</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {PAGES.map(({ href, label, icon, desc }) => (
          <Link key={href} href={href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '20px 22px', cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
