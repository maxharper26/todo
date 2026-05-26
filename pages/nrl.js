import { useEffect, useState } from 'react';

export default function NrlPage() {
  const [roundObj, setRoundObj] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    fetch('/api/nrl')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setRoundObj)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="nrl-page"><p className="nrl-muted">Loading NRL data…</p></div>;
  if (error)   return <div className="nrl-page"><p className="nrl-error">Error: {error}</p></div>;
  if (!roundObj?.matches?.length)
    return <div className="nrl-page"><p className="nrl-muted">No round data found.</p></div>;

  return (
    <div className="nrl-page">
      <div className="page-header">
        <h1>NRL Ins &amp; Outs</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{roundObj.title}</span>
      </div>

      {roundObj.matches.map((match, i) => <MatchCard key={i} match={match} />)}

      {roundObj.scraped_at && (
        <p className="last-updated">Scraped: {new Date(roundObj.scraped_at).toLocaleString('en-AU')}</p>
      )}
    </div>
  );
}

function PlayerList({ players, type }) {
  if (!players?.filter(Boolean).length) return null;
  const isIns  = type === 'ins';
  const colour = isIns ? '#22c55e' : '#ef4444';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colour, marginBottom: 4 }}>
        {isIns ? '✅ Ins' : '❌ Outs'}
      </div>
      <ul className="nrl-player-list">
        {players.filter(Boolean).map((p, i) => (
          <li key={i} style={{ borderLeft: `3px solid ${colour}` }}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function TeamPanel({ name, squad, accentColour }) {
  const ins  = squad?.ins  || [];
  const outs = squad?.outs || [];
  const hasChanges = ins.filter(Boolean).length || outs.filter(Boolean).length;
  return (
    <div className="nrl-team" style={{ borderTop: `3px solid ${accentColour}` }}>
      <div className="nrl-team-name">{name}</div>
      {!hasChanges
        ? <p className="nrl-muted" style={{ fontSize: '0.82rem', marginTop: 8 }}>No changes listed</p>
        : <>
            <PlayerList players={ins}  type="ins" />
            <PlayerList players={outs} type="outs" />
          </>
      }
    </div>
  );
}

function MatchCard({ match }) {
  return (
    <div className="nrl-match">
      <div className="nrl-match-header">
        <span className="nrl-match-title">
          {match.home} <span className="nrl-vs">vs</span> {match.away}
        </span>
        {match.kickoff && <span className="nrl-kickoff">{match.kickoff}</span>}
      </div>
      <div className="nrl-teams-grid">
        <TeamPanel name={match.home} squad={match.squad?.home} accentColour="#3b82f6" />
        <TeamPanel name={match.away} squad={match.squad?.away} accentColour="#f97316" />
      </div>
    </div>
  );
}
