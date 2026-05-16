import { useMemo, useState } from 'react';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatValue(value) {
  return value == null ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function LineChart({ points, height = 360, title = '', color = '#0969da' }) {
  const [hovered, setHovered] = useState(null);
  const hasData = points && points.length >= 2;

  const width = 920;
  const chartHeight = 340;
  const padding = { top: 26, right: 24, bottom: 42, left: 62 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const chart = useMemo(() => {
    if (!hasData) return { mapped: [], path: '', min: 0, max: 1, yTicks: [] };

    const values = points.map((point) => point.value).filter((value) => typeof value === 'number' && !Number.isNaN(value));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = (rawMax - rawMin || 1) * 0.08;
    const min = rawMin - pad;
    const max = rawMax + pad;
    const range = max - min || 1;
    const mapped = points.map((point, idx) => ({
      ...point,
      x: padding.left + (idx / (points.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((point.value - min) / range) * innerHeight,
    }));
    const path = mapped.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const yTicks = [max, min + range * 0.5, min];

    return { mapped, path, min, max, yTicks };
  }, [points, hasData, innerHeight, innerWidth]);

  if (!hasData) return null;

  const active = hovered == null ? chart.mapped[chart.mapped.length - 1] : chart.mapped[hovered];
  const xTicks = [chart.mapped[0], chart.mapped[Math.floor(chart.mapped.length / 2)], chart.mapped[chart.mapped.length - 1]];

  function onMouseMove(event) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(((x - padding.left) / innerWidth) * (points.length - 1))));
    setHovered(idx);
  }

  return (
    <div style={{ marginBottom: 24, background: '#fff', border: '1px solid #d8dee4', borderRadius: 8, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        {active && (
          <div style={{ textAlign: 'right', fontSize: 13, color: '#57606a' }}>
            <strong style={{ display: 'block', color: '#24292f', fontSize: 16 }}>{formatValue(active.value)}</strong>
            {formatDate(active.date)}
          </div>
        )}
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
          return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#eaeef2" />;
        })}
        {chart.yTicks.map((tick, idx) => {
          const y = padding.top + innerHeight - ((tick - chart.min) / (chart.max - chart.min || 1)) * innerHeight;
          return (
            <text key={idx} x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#57606a">
              {formatValue(tick)}
            </text>
          );
        })}
        {xTicks.map((tick, idx) => (
          <text key={idx} x={tick.x} y={chartHeight - 12} textAnchor={idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle'} fontSize="12" fill="#57606a">
            {formatDate(tick.date)}
          </text>
        ))}
        <path d={`${chart.path} L ${chart.mapped[chart.mapped.length - 1].x} ${padding.top + innerHeight} L ${chart.mapped[0].x} ${padding.top + innerHeight} Z`} fill="url(#lineFade)" />
        <path d={chart.path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {active && (
          <g>
            <line x1={active.x} x2={active.x} y1={padding.top} y2={padding.top + innerHeight} stroke="#8c959f" strokeDasharray="4 5" />
            <circle cx={active.x} cy={active.y} r="6" fill="#fff" stroke={color} strokeWidth="3" />
          </g>
        )}
      </svg>
    </div>
  );
}
