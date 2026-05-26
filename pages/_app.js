import Link from 'next/link';
import Head from 'next/head';
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
    <>
      <Head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0f" />
        <link rel="apple-touch-icon" href="/icon.png" />
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
