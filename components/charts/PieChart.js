import { useState } from 'react';

function formatCurrency(value) {
  return value == null ? '-' : value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function PieChart({ allocations, size = 520 }) {
  const [hovered, setHovered] = useState(null);
  if (!allocations || allocations.length === 0) return null;

  const total = allocations.reduce((sum, allocation) => sum + (allocation.positionValue || 0), 0);
  if (!total) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  let currentAngle = -Math.PI / 2;
  const slices = [];
  const palette = ['#0969da', '#1a7f37', '#bf8700', '#8250df', '#cf222e', '#0a7ea4', '#9a6700', '#6639ba'];

  for (const [index, allocation] of allocations.entries()) {
    const sliceAngle = (allocation.positionValue / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const labelAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 0.72;

    slices.push({
      ...allocation,
      pathD,
      color: palette[index % palette.length],
      labelX: cx + labelRadius * Math.cos(labelAngle),
      labelY: cy + labelRadius * Math.sin(labelAngle),
      pct: (allocation.positionValue / total) * 100,
    });
    currentAngle = endAngle;
  }
  const active = hovered == null ? slices[0] : slices[hovered];

  return (
    <div style={{ marginBottom: 24, background: '#fff', border: '1px solid #d8dee4', borderRadius: 8, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Current Allocation</h2>
        {active && (
          <div style={{ textAlign: 'right', fontSize: 13, color: '#57606a' }}>
            <strong style={{ display: 'block', color: '#24292f', fontSize: 16 }}>{active.ticker} {active.pct.toFixed(1)}%</strong>
            {formatCurrency(active.positionValue)}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(180px, 0.7fr)', gap: 18, alignItems: 'center' }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height={Math.min(size, 540)}
          style={{ display: 'block' }}
          onMouseLeave={() => setHovered(null)}
        >
          {slices.map((slice, i) => {
            const isActive = hovered === i;
            return (
              <g key={slice.ticker} onMouseEnter={() => setHovered(i)}>
                <path
                  d={slice.pathD}
                  fill={slice.color}
                  opacity={hovered == null || isActive ? 1 : 0.48}
                  stroke="#fff"
                  strokeWidth={isActive ? 5 : 2}
                  style={{ filter: isActive ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.18))' : 'none' }}
                />
                {slice.pct >= 4 && (
                  <>
                    <text x={slice.labelX} y={slice.labelY} fontSize="14" textAnchor="middle" dominantBaseline="middle" fontWeight="700" fill="#24292f" pointerEvents="none">
                      {slice.ticker}
                    </text>
                    <text x={slice.labelX} y={slice.labelY + 18} fontSize="12" textAnchor="middle" dominantBaseline="middle" fill="#57606a" pointerEvents="none">
                      {slice.pct.toFixed(1)}%
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={radius * 0.52} fill="#fff" />
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="15" fill="#57606a">Total</text>
          <text x={cx} y={cy + 18} textAnchor="middle" fontSize="20" fontWeight="700" fill="#24292f">{formatCurrency(total)}</text>
        </svg>
        <div style={{ display: 'grid', gap: 8 }}>
          {slices.map((slice, i) => (
            <button
              key={slice.ticker}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              style={{
                display: 'grid',
                gridTemplateColumns: '14px 1fr auto',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #d8dee4',
                borderRadius: 8,
                background: hovered === i ? '#f6f8fa' : '#fff',
                padding: '8px 10px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 999, background: slice.color }} />
              <strong>{slice.ticker}</strong>
              <span style={{ color: '#57606a' }}>{slice.pct.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
