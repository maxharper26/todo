import { useMemo, useState } from 'react';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatValue(value) {
  return value == null ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function LineChart({ points, comparatorPoints, comparatorLabel = 'MSCI World (VGS)', height = 360, title = '', color = '#6366f1', avgPrice = null }) {
  const [hovered, setHovered] = useState(null);
  const hasData = points && points.length >= 2;
  const hasComparator = comparatorPoints && comparatorPoints.length >= 2;

  const width = 920;
  const chartHeight = 340;
  const padding = { top: 26, right: 24, bottom: 42, left: 62 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const chart = useMemo(() => {
    if (!hasData) return { mapped: [], path: '', min: 0, max: 1, yTicks: [], compMapped: [], compPath: '' };

    const values = points.map((point) => point.value).filter((value) => typeof value === 'number' && !Number.isNaN(value));
    let rawMin = Math.min(...values);
    let rawMax = Math.max(...values);
    if (avgPrice != null) { rawMin = Math.min(rawMin, avgPrice); rawMax = Math.max(rawMax, avgPrice); }

    // Rebase comparator to same start value as portfolio
    let compMapped = [];
    let compPath = '';
    if (hasComparator) {
      const portfolioStart = points[0]?.value ?? 100;
      const compStart = comparatorPoints[0]?.value ?? 100;
      const scale = portfolioStart / compStart;
      const dateToX = new Map(points.map((p, i) => [p.date, padding.left + (i / (points.length - 1)) * innerWidth]));
      const rebased = comparatorPoints.map(p => ({ ...p, value: p.value * scale }));
      rawMin = Math.min(rawMin, ...rebased.map(p => p.value));
      rawMax = Math.max(rawMax, ...rebased.map(p => p.value));
      const pad2 = (rawMax - rawMin || 1) * 0.08;
      const min2 = rawMin - pad2;
      const max2 = rawMax + pad2;
      const range2 = max2 - min2 || 1;
      compMapped = rebased
        .filter(p => dateToX.has(p.date))
        .map(p => ({
          ...p,
          x: dateToX.get(p.date),
          y: padding.top + innerHeight - ((p.value - min2) / range2) * innerHeight,
        }));
      compPath = compMapped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }

    const pad = (rawMax - rawMin || 1) * 0.08;
    const min = rawMin - pad;
    const max = rawMax + pad;
    const range = max - min || 1;
    const mapped = points.map((point, idx) => ({
      ...point,
      x: padding.left + (idx / (points.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((point.value - min) / range) * innerHeight,
    }));

    // Recompute compMapped y with final min/max
    if (hasComparator && compMapped.length) {
      compMapped = compMapped.map(p => ({
        ...p,
        y: padding.top + innerHeight - ((p.value - min) / range) * innerHeight,
      }));
      compPath = compMapped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }

    const path = mapped.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const yTicks = [max, min + range * 0.5, min];

    return { mapped, path, min, max, yTicks, compMapped, compPath };
  }, [points, comparatorPoints, hasData, hasComparator, innerHeight, innerWidth, avgPrice]);

  if (!hasData) return null;

  const active = hovered == null ? chart.mapped[chart.mapped.length - 1] : chart.mapped[hovered];
  const activeComp = hovered != null && chart.compMapped.length ? chart.compMapped[Math.min(hovered, chart.compMapped.length - 1)] : chart.compMapped[chart.compMapped.length - 1];
  const xTicks = [chart.mapped[0], chart.mapped[Math.floor(chart.mapped.length / 2)], chart.mapped[chart.mapped.length - 1]];

  function onMouseMove(event) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(((x - padding.left) / innerWidth) * (points.length - 1))));
    setHovered(idx);
  }

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {hasComparator && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#64748b' }}>
              <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#64748b" strokeWidth="2" strokeDasharray="4 3" /></svg>
              {comparatorLabel}
              {activeComp && <strong style={{ color: '#94a3b8', marginLeft: 4 }}>{formatValue(activeComp.value)}</strong>}
            </div>
          )}
          {active && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#64748b' }}>
              <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke={color} strokeWidth="3" /></svg>
              Portfolio
              <strong style={{ color, marginLeft: 4 }}>{formatValue(active.value)}</strong>
              <span style={{ marginLeft: 4 }}>{formatDate(active.date)}</span>
            </div>
          )}
        </div>
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
          <linearGradient id="lineFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + ratio * innerHeight;
          return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#1e1e2e" />;
        })}
        {chart.yTicks.map((tick, idx) => {
          const y = padding.top + innerHeight - ((tick - chart.min) / (chart.max - chart.min || 1)) * innerHeight;
          return (
            <text key={idx} x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
              {formatValue(tick)}
            </text>
          );
        })}
        {xTicks.map((tick, idx) => (
          <text key={idx} x={tick.x} y={chartHeight - 12} textAnchor={idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle'} fontSize="12" fill="#64748b">
            {formatDate(tick.date)}
          </text>
        ))}
        <path d={`${chart.path} L ${chart.mapped[chart.mapped.length - 1].x} ${padding.top + innerHeight} L ${chart.mapped[0].x} ${padding.top + innerHeight} Z`} fill="url(#lineFade)" />
        {avgPrice != null && (() => {
          const y = padding.top + innerHeight - ((avgPrice - chart.min) / (chart.max - chart.min || 1)) * innerHeight;
          return (
            <g>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
              <text x={width - padding.right + 4} y={y + 4} fontSize="11" fill="#f59e0b" opacity="0.9">avg</text>
            </g>
          );
        })()}
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
    </div>
  );
}
