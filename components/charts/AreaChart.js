import { useMemo, useState } from 'react';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPercent(value) {
  return value == null ? '-' : `${(value * 100).toFixed(2)}%`;
}

export default function AreaChart({ points, comparatorPoints, comparatorLabel = 'MSCI World (VGS)', height = 320, title = '', color = '#d1242f' }) {
  const [hovered, setHovered] = useState(null);
  const hasData = points && points.length >= 2;
  const hasComparator = comparatorPoints && comparatorPoints.length >= 2;

  const width = 920;
  const chartHeight = 340;
  const padding = { top: 22, right: 24, bottom: 42, left: 62 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const chart = useMemo(() => {
    if (!hasData) return { mapped: [], path: '', areaPath: '', min: 0, max: 1, zeroY: padding.top + innerHeight, compPath: '' };

    const values = points.map((point) => point.value).filter((value) => typeof value === 'number' && !Number.isNaN(value));
    let rawMin = Math.min(...values, 0);
    const rawMax = 0;

    if (hasComparator) {
      rawMin = Math.min(rawMin, ...comparatorPoints.map(p => p.value).filter(v => typeof v === 'number'));
    }

    const pad = Math.abs(rawMin || 1) * 0.08;
    const min = rawMin - pad;
    const max = rawMax;
    const range = max - min || 1;
    const zeroY = padding.top + innerHeight - ((0 - min) / range) * innerHeight;
    const mapped = points.map((point, idx) => ({
      ...point,
      x: padding.left + (idx / (points.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((point.value - min) / range) * innerHeight,
    }));
    const path = mapped.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const areaPath = `${path} L ${mapped[mapped.length - 1].x} ${zeroY} L ${mapped[0].x} ${zeroY} Z`;

    let compPath = '';
    let compMapped = [];
    if (hasComparator) {
      const dateToX = new Map(points.map((p, i) => [p.date, padding.left + (i / (points.length - 1)) * innerWidth]));
      compMapped = comparatorPoints
        .filter(p => dateToX.has(p.date))
        .map(p => ({
          x: dateToX.get(p.date),
          y: padding.top + innerHeight - ((p.value - min) / range) * innerHeight,
        }));
      compPath = compMapped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }

    return { mapped, path, areaPath, min, max, zeroY, compPath, compMapped };
  }, [points, comparatorPoints, hasData, hasComparator, innerHeight, innerWidth]);

  if (!hasData) return null;

  const active = hovered == null ? chart.mapped[chart.mapped.length - 1] : chart.mapped[hovered];
  const activeComp = chart.compMapped?.length
    ? (hovered != null ? chart.compMapped[Math.min(hovered, chart.compMapped.length - 1)] : chart.compMapped[chart.compMapped.length - 1])
    : null;
  const xTicks = [chart.mapped[0], chart.mapped[Math.floor(chart.mapped.length / 2)], chart.mapped[chart.mapped.length - 1]];

  function onMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(((x - padding.left) / innerWidth) * (points.length - 1))));
    setHovered(idx);
  }

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, flexShrink: 0 }}>{title}</h2>
      </div>
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        width="100%"
        height={height}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="drawdownFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.38" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + ratio * innerHeight;
          return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#1e1e2e" />;
        })}
        {[chart.max, (chart.max + chart.min) / 2, chart.min].map((tick, idx) => {
          const y = padding.top + innerHeight - ((tick - chart.min) / (chart.max - chart.min || 1)) * innerHeight;
          return (
            <text key={idx} x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
              {formatPercent(tick)}
            </text>
          );
        })}
        {xTicks.map((tick, idx) => (
          <text key={idx} x={tick.x} y={chartHeight - 12} textAnchor={idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle'} fontSize="12" fill="#64748b">
            {formatDate(tick.date)}
          </text>
        ))}
        <line x1={padding.left} x2={width - padding.right} y1={chart.zeroY} y2={chart.zeroY} stroke="#8c959f" strokeDasharray="4 5" />
        <path d={chart.areaPath} fill="url(#drawdownFade)" />
        <path d={chart.path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {chart.compPath && <path d={chart.compPath} fill="none" stroke="#8c959f" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />}
        {active && (
          <g>
            <line x1={active.x} x2={active.x} y1={padding.top} y2={padding.top + innerHeight} stroke="#8c959f" strokeDasharray="4 5" />
            {activeComp && <circle cx={activeComp.x} cy={activeComp.y} r="5" fill="#fff" stroke="#8c959f" strokeWidth="2" />}
            <circle cx={active.x} cy={active.y} r="6" fill="#111118" stroke={color} strokeWidth="3" />
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 }}>
        {hasComparator && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#64748b' }}>
            <svg width="20" height="3" style={{ flexShrink: 0 }}><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#64748b" strokeWidth="2" strokeDasharray="4 3" /></svg>
            <span style={{ whiteSpace: 'nowrap' }}>{comparatorLabel}</span>
            {activeComp && <strong style={{ color: '#94a3b8', marginLeft: 4, whiteSpace: 'nowrap' }}>{formatPercent(activeComp.value)}</strong>}
          </div>
        )}
        {active && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#64748b' }}>
            <svg width="20" height="3" style={{ flexShrink: 0 }}><line x1="0" y1="1.5" x2="20" y2="1.5" stroke={color} strokeWidth="3" /></svg>
            <span style={{ whiteSpace: 'nowrap' }}>Portfolio</span>
            <strong style={{ color: active.value < 0 ? '#ef4444' : '#22c55e', marginLeft: 4, whiteSpace: 'nowrap' }}>{formatPercent(active.value)}</strong>
            <span style={{ marginLeft: 4, whiteSpace: 'nowrap' }}>{formatDate(active.date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
