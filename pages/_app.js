import Link from 'next/link';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import '../styles/dashboard.css';

const NAV_LINKS = [
    { href: '/todo',   label: 'Todo' },
  { href: '/stocks', label: 'Finance' },
  { href: '/nrl',    label: 'NRL' },
];

function NavBar() {
  const { pathname } = useRouter();
  return (
    <nav className="app-nav">
      {NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`nav-link${pathname === href ? ' nav-link-active' : ''}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <NavBar />
      <main>
        <Component {...pageProps} />
      </main>
    </div>
  );
}
