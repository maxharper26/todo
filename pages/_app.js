import Link from 'next/link';
import '../styles/globals.css';
import '../styles/dashboard.css';

export default function App({ Component, pageProps }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <main>
        <Component {...pageProps} />
      </main>
    </div>
  );
}
