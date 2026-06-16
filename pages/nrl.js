import { useEffect, useState } from 'react';
import OddsTape from '../components/OddsTape';

export default function NrlPage() {
  const [data, setData]     = useState(null);   // full {rounds: {}, updated_at}
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const CACHE_KEY = 'nrl_cache_v3';  // bumped to bust old single-round cache
  const CACHE_TTL = 24 * 60 * 60 * 1000;

  function load(force = false) {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setData(cached.data);
          setLoading(false);
          return;
        }
      } catch {}
    }
    setLoading(true);
    setError(null);
    fetch('/api/nrl')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(blob => {
        setData(blob);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: blob })); } catch {}
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Derive latest and previous round from blob
  const rounds = data?.rounds || {};
  const roundKeys = Object.keys(rounds).filter(k => /^round-\d+$/.test(k))
    .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
  const latestKey = roundKeys[roundKeys.length - 1];
  const prevKey   = roundKeys[roundKeys.length - 2];
  const roundObj  = latestKey ? rounds[latestKey] : null;
  const prevObj   = prevKey   ? rounds[prevKey]   : null;

  if (loading) return <div className="page"><p className="nrl-muted">Loading NRL data…</p></div>;
  if (error)   return <div className="page"><p className="nrl-error">Error: {error}</p></div>;
  if (!roundObj?.matches?.length)
    return <div className="page"><p className="nrl-muted">No round data found.</p></div>;

  return (
    <div className="page">
      <OddsTape />
      <div className="page-header">
        <h1>NRL Ins &amp; Outs</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{roundObj.title}</span>
          <button className="btn btn-ghost" onClick={() => load(true)}>↻ Refresh</button>
        </div>
      </div>

      {roundObj.matches.map((match, i) => <MatchCard key={i} match={match} prevRound={prevObj} rounds={rounds} latestKey={latestKey} prevKey={prevKey} sourceUrl={roundObj.source_url} />)}

      {roundObj.scraped_at && (
        <p className="last-updated">Scraped: {new Date(roundObj.scraped_at).toLocaleString('en-AU')}</p>
      )}
    </div>
  );
}

function findFallbackSquad(allRounds, teamName, excludeKeys) {
  const sortedKeys = Object.keys(allRounds)
    .filter(k => /^round-\d+$/.test(k))
    .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const rk of sortedKeys) {
    if (excludeKeys.has(rk)) continue;
    for (const m of allRounds[rk]?.matches || []) {
      for (const side of ['home', 'away']) {
        if (m[side]?.trim().toLowerCase() === teamName.trim().toLowerCase())
          return { squad: m.squad?.[side], roundKey: rk };
      }
    }
  }
  return { squad: null, roundKey: null };
}

function squadToJerseyMap(squad) {
  const map = {};
  for (const section of ['Backs', 'Forwards', 'Interchange', 'Reserves']) {
    for (const p of squad?.[section] || []) {
      if (p?.number && p?.name) map[p.number] = p.name;
    }
  }
  return map;
}

function computeDiffs(currSquad, prevSquad) {
  const curr = squadToJerseyMap(currSquad);
  const prev = prevSquad ? squadToJerseyMap(prevSquad) : {};
  const jerseys = [...new Set([...Object.keys(curr), ...Object.keys(prev)])]
    .sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
  return jerseys
    .map(j => ({ jersey: j, prev: prev[j] || null, curr: curr[j] || null }))
    .filter(d => d.prev !== d.curr);
}

function JerseyDiffs({ diffs, hasPrev, hadBye, byePrevKey }) {
  if (!hasPrev) return <p className="nrl-muted" style={{ fontSize: '0.82rem', marginTop: 8 }}>No previous round to compare</p>;
  const byeLabel = hadBye ? (byePrevKey ? byePrevKey.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) : null) : null;
  return (
    <>
      {hadBye && (
        <p className="nrl-muted" style={{ fontSize: '0.75rem', margin: '4px 0' }}>
          {byeLabel ? `Bye last round — vs ${byeLabel}` : 'Bye last round'}
        </p>
      )}
      {!diffs.length
        ? <p className="nrl-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>No changes</p>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['#', 'Was', 'Now'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '3px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diffs.map(d => (
                <tr key={d.jersey}>
                  <td style={{ padding: '4px 6px', fontWeight: 700, color: 'var(--text-muted)' }}>#{d.jersey}</td>
                  <td style={{ padding: '4px 6px', color: 'var(--red)', textDecoration: d.prev ? 'line-through' : 'none' }}>{d.prev || '—'}</td>
                  <td style={{ padding: '4px 6px', color: 'var(--green)' }}>{d.curr || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </>
  );
}

function TeamPanel({ name, squad, prevSquad, hasPrev, hadByeExplicit, byePrevKey, accentColour }) {
  const diffs = computeDiffs(squad, prevSquad);
  return (
    <div className="nrl-team" style={{ borderTop: `3px solid ${accentColour}` }}>
      <div className="nrl-team-name">{name}</div>
      <JerseyDiffs diffs={diffs} hasPrev={hasPrev} hadBye={hadByeExplicit} byePrevKey={byePrevKey} />
    </div>
  );
}

function MatchCard({ match, prevRound, rounds, latestKey, prevKey, sourceUrl }) {
  // Look up each team's prev squad by team name (not fixture — fixtures change each round)
  const prevSquads = {};
  for (const m of prevRound?.matches || []) {
    for (const side of ['home', 'away']) {
      if (m[side]) prevSquads[m[side].trim().toLowerCase()] = m.squad?.[side];
    }
  }

  const href = match.url
    ? (match.url.startsWith('http') ? match.url : `https://www.nrl.com${match.url}`)
    : sourceUrl;
  return (
    <div className="nrl-match">
      <div className="nrl-match-header">
        <span className="nrl-match-title">
          {href
            ? <a href={href} target="_blank" rel="noopener noreferrer">{match.home} <span className="nrl-vs">vs</span> {match.away}</a>
            : <>{match.home} <span className="nrl-vs">vs</span> {match.away}</>
          }
        </span>
        {match.kickoff && <span className="nrl-kickoff">{match.kickoff}</span>}
      </div>
      <div className="nrl-teams-grid">
        {['home', 'away'].map((side, i) => {
          const teamName = match[side];
          let prevSquad = prevSquads[teamName?.trim().toLowerCase()];
          let byePrevKey = null;
          if (prevRound && !prevSquad) {
            const fb = findFallbackSquad(rounds, teamName, new Set([latestKey, prevKey]));
            prevSquad = fb.squad;
            byePrevKey = fb.roundKey;
          }
          return <TeamPanel key={side} name={teamName} squad={match.squad?.[side]} prevSquad={prevSquad} hasPrev={!!prevRound} hadByeExplicit={prevRound && !prevSquads[teamName?.trim().toLowerCase()]} byePrevKey={byePrevKey} accentColour={i === 0 ? '#3b82f6' : '#f97316'} />;
        })}
      </div>
    </div>
  );
}
