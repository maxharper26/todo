import { useState } from 'react';

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#a855f7', '#84cc16', '#ec4899'];

function buildSlices(items, valueKey, labelKey, size) {
  const total = items.reduce((sum, a) => sum + (a[valueKey] || 0), 0);
  if (!total) return { slices: [], total };

  const cx = size / 2, cy = size / 2;
  const radius = size * 0.34;
  let currentAngle = -Math.PI / 2;
  const slices = [];

  for (const [i, item] of items.entries()) {
    const sliceAngle = (item[valueKey] / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const labelAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 0.72;
    slices.push({
      ...item,
      label: item[labelKey],
      pct: (item[valueKey] / total) * 100,
      pathD: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${sliceAngle > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`,
      color: PALETTE[i % PALETTE.length],
      labelX: cx + labelRadius * Math.cos(labelAngle),
      labelY: cy + labelRadius * Math.sin(labelAngle),
    });
    currentAngle = endAngle;
  }
  return { slices, total };
}

export default function PieChart({ allocations, sectorAllocations, size = 520 }) {
  const [hovered, setHovered] = useState(null);
  const [mode, setMode] = useState('holdings'); // 'holdings' | 'sectors'

  const bySector = mode === 'sectors';
  const items = bySector ? sectorAllocations : allocations;
  const valueKey = bySector ? 'value' : 'positionValue';
  const labelKey = bySector ? 'sector' : 'ticker';

  if (!items?.length) return null;

  const { slices, total } = buildSlices(items, valueKey, labelKey, size);
  if (!total) return null;

  const active = hovered == null ? slices[0] : slices[hovered];
  const cx = size / 2, cy = size / 2, radius = size * 0.34;

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Allocation</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {active && (
            <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
              <strong style={{ display: 'block', color: '#e2e8f0', fontSize: 15 }}>{active.label} {active.pct.toFixed(1)}%</strong>
              By portfolio weight
            </div>
          )}
          {/* Toggle */}
          <div style={{ display: 'flex', background: '#16161f', border: '1px solid #2a2a3d', borderRadius: 6, overflow: 'hidden' }}>
            {['holdings', 'sectors'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setHovered(null); }}
                style={{
                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: mode === m ? '#6366f1' : 'transparent',
                  color: mode === m ? '#fff' : '#64748b',
                }}
              >{m.charAt(0).toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
        </div>
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
              <g key={slice.label} onMouseEnter={() => setHovered(i)}>
                <path
                  d={slice.pathD}
                  fill={slice.color}
                  opacity={hovered == null || isActive ? 1 : 0.4}
                  stroke="#111118"
                  strokeWidth={isActive ? 5 : 2}
                  style={{ filter: isActive ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))' : 'none' }}
                />
                {slice.pct >= (bySector ? 3 : 4) && (
                  <>
                    <text x={slice.labelX} y={slice.labelY} fontSize={bySector ? '11' : '14'} textAnchor="middle" dominantBaseline="middle" fontWeight="700" fill="#fff" pointerEvents="none">
                      {slice.label}
                    </text>
                    <text x={slice.labelX} y={slice.labelY + (bySector ? 14 : 18)} fontSize="12" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.7)" pointerEvents="none">
                      {slice.pct.toFixed(1)}%
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={radius * 0.52} fill="#111118" />
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="15" fill="#64748b">Allocation</text>
          <text x={cx} y={cy + 18} textAnchor="middle" fontSize="20" fontWeight="700" fill="#e2e8f0">100%</text>
        </svg>

        <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
          {slices.map((slice, i) => (
            <button
              key={slice.label}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              style={{
                display: 'grid',
                gridTemplateColumns: '14px 1fr auto',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #2a2a3d',
                borderRadius: 8,
                background: hovered === i ? '#16161f' : '#111118',
                padding: '8px 10px',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#e2e8f0',
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 999, background: slice.color, flexShrink: 0 }} />
              <strong style={{ fontSize: bySector ? '0.78rem' : '0.85rem' }}>{slice.label}</strong>
              <span style={{ color: '#64748b' }}>{slice.pct.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
