import Link from 'next/link';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import '../styles/dashboard.css';

// In standalone PWA mode, <a target="_blank"> exits the app shell and shows
// Safari chrome. Intercept those clicks and use window.open() instead, which
// keeps the PWA session alive.
function usePwaExternalLinks() {
  useEffect(() => {
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone) return;

    function handleClick(e) {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const url = a.getAttribute('href');
      if (!url || url.startsWith('/') || url.startsWith('#')) return;
      e.preventDefault();
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
}

const NAV_LINKS = [
  { href: '/todo',   label: 'Todo' },
  { href: '/stocks', label: 'Finance' },
  { href: '/nrl',    label: 'NRL' },
  { href: '/surf',   label: 'Surf' },
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
  usePwaExternalLinks();
  return (
    <>
      <Head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0f" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <NavBar />
        <main>
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
