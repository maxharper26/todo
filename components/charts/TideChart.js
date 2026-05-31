import { useState, useMemo } from 'react';

function fmtTideHeight(v) { return v != null ? `${v.toFixed(1)}m` : '—'; }
function fmtTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney' });
}
function fmtDayTime(isoStr) {
  const d = new Date(isoStr);
  const day  = d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'Australia/Sydney' });
  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney' });
  return { day, time };
}
function todayAEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

export default function TideChart({ tides }) {
  const [hovered, setHovered] = useState(null);

  const today = todayAEST();
  const filtered = (tides || [])
    .filter(t => new Date(t.time).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) >= today)
    .slice(0, 10);

  const points = useMemo(() => filtered.map(t => ({ time: t.time, value: t.height, type: t.type })), [tides]);

  if (points.length < 2) return <p className="surf-muted">No tide data.</p>;

  const W = 920, H = 190;
  const pad = { top: 20, right: 20, bottom: 46, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const times  = points.map(p => new Date(p.time).getTime());
  const values = points.map(p => p.value);
  const tMin = Math.min(...times), tMax = Math.max(...times);
  const vMin = Math.min(...values) - 0.3;
  const vMax = Math.max(...values) + 0.3;
  const vRange = vMax - vMin || 1;
  const tRange = tMax - tMin || 1;

  const toX = t => pad.left + ((new Date(t).getTime() - tMin) / tRange) * iW;
  const toY = v => pad.top + iH - ((v - vMin) / vRange) * iH;

  const mapped = points.map(p => ({ x: toX(p.time), y: toY(p.value), ...p }));

  let path = `M ${mapped[0].x} ${mapped[0].y}`;
  for (let i = 1; i < mapped.length; i++) {
    const prev = mapped[i - 1], curr = mapped[i];
    const cpX = (prev.x + curr.x) / 2;
    path += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }
  const areaPath = `${path} L ${mapped[mapped.length - 1].x} ${pad.top + iH} L ${mapped[0].x} ${pad.top + iH} Z`;

  const nowX = pad.left + ((Date.now() - tMin) / tRange) * iW;
  const nowInRange = nowX >= pad.left && nowX <= pad.left + iW;
  const active = hovered != null ? mapped[hovered] : null;

  function onMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0, minD = Infinity;
    mapped.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < minD) { minD = d; closest = i; } });
    setHovered(closest);
  }

  return (
    <div className="surf-tide-chart">
      <div className="surf-section-label">Tides</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={160}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="tideFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(r => (
          <line key={r} x1={pad.left} x2={W - pad.right} y1={pad.top + r * iH} y2={pad.top + r * iH} stroke="#1e1e2e" />
        ))}
        {[vMax, (vMax + vMin) / 2, vMin].map((v, i) => (
          <text key={i} x={pad.left - 8} y={toY(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">
            {v.toFixed(1)}m
          </text>
        ))}
        {mapped.map((p, i) => {
          const { day, time } = fmtDayTime(p.time);
          const prevDay = i > 0 ? fmtDayTime(mapped[i-1].time).day : null;
          const showDay = day !== prevDay;
          return (
            <g key={i}>
              {showDay && (
                <text x={p.x} y={H - 20} textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a3b8">
                  {day}
                </text>
              )}
              <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
                {time}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#tideFade)" />
        <path d={path} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {mapped.map((p, i) => (
          <text key={i} x={p.x} y={p.type === 'high' ? p.y - 10 : p.y + 18} textAnchor="middle" fontSize="11"
            fill={p.type === 'high' ? 'var(--green)' : '#64748b'}>
            {fmtTideHeight(p.value)}
          </text>
        ))}
        {nowInRange && (
          <line x1={nowX} x2={nowX} y1={pad.top} y2={pad.top + iH} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1.5" />
        )}
        {active && (
          <g>
            <line x1={active.x} x2={active.x} y1={pad.top} y2={pad.top + iH} stroke="#8c959f" strokeDasharray="4 5" />
            <circle cx={active.x} cy={active.y} r="5" fill="#111118" stroke="#6366f1" strokeWidth="2.5" />
            <text x={active.x} y={pad.top - 4} textAnchor="middle" fontSize="11" fill="#e2e8f0">
              {fmtTideHeight(active.value)} {active.type}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
