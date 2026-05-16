import Link from 'next/link';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <div style={{minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f6f8fa', color: '#111'}}>
      <header style={{padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12}}>
        <nav style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
          <Link href="/todo" style={{padding: '10px 14px', borderRadius: 10, background: '#1f883d', color: '#fff', textDecoration: 'none'}}>Todo</Link>
          <Link href="/stocks" style={{padding: '10px 14px', borderRadius: 10, background: '#0969da', color: '#fff', textDecoration: 'none'}}>Stocks</Link>
        </nav>
      </header>
      <main style={{padding: '24px'}}>
        <Component {...pageProps} />
      </main>
    </div>
  );
}
