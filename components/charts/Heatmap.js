import { useState } from 'react';

export default function Heatmap({ matrix, tickers, size = 540 }) {
  const [hovered, setHovered] = useState(null);
  if (!matrix || !tickers || tickers.length === 0) return null;

  const labelSize = 78;
  const gap = 1.5;
  const cellSize = size / tickers.length;
  const totalSize = labelSize + size + 18;
  const getColor = (val) => {
    if (val == null) return '#f0f0f0';

    const normalized = (val + 1) / 2;
    const red = normalized < 0.5 ? Math.round(60 + normalized * 360) : 255;
    const green = normalized < 0.5 ? Math.round(120 + normalized * 220) : Math.round(230 - (normalized - 0.5) * 330);
    const blue = normalized < 0.5 ? 255 : Math.round(220 - (normalized - 0.5) * 360);
    return `rgb(${red}, ${green}, ${blue})`;
  };
  const active = hovered ? matrix[hovered.row]?.[hovered.col] : null;

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Correlation Matrix</h2>
        <div style={{ minHeight: 20, color: '#64748b', fontSize: 13, textAlign: 'right' }}>
          {hovered ? (
            <>
              <strong style={{ color: '#e2e8f0' }}>{hovered.row} / {hovered.col}</strong> {active == null ? '-' : `${(active * 100).toFixed(1)}%`}
            </>
          ) : 'Hover cells'}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        width="100%"
        height={Math.min(totalSize, 620)}
        style={{ display: 'block' }}
        onMouseLeave={() => setHovered(null)}
      >
        {tickers.map((ticker, i) => (
          <text key={`col-${i}`} x={labelSize + i * cellSize + cellSize / 2} y={labelSize - 16} fontSize="13" textAnchor="middle" fill="#64748b">
            {ticker}
          </text>
        ))}
        {tickers.map((t1, i1) => (
          <g key={`row-${i1}`}>
            <text x={labelSize - 12} y={labelSize + i1 * cellSize + cellSize / 2} fontSize="13" textAnchor="end" dominantBaseline="middle" fill="#64748b">
              {t1}
            </text>
            {tickers.map((t2, i2) => {
              const val = matrix[t1]?.[t2];
              const color = getColor(val);
              const isActive = hovered?.row === t1 && hovered?.col === t2;
              const isRelated = hovered && (hovered.row === t1 || hovered.col === t2);
              return (
                <g key={`cell-${i1}-${i2}`} onMouseEnter={() => setHovered({ row: t1, col: t2 })}>
                  <rect
                    x={labelSize + i2 * cellSize + gap / 2}
                    y={labelSize + i1 * cellSize + gap / 2}
                    width={cellSize - gap}
                    height={cellSize - gap}
                    rx="5"
                    fill={color}
                    opacity={!hovered || isRelated ? 1 : 0.35}
                    stroke={isActive ? '#e2e8f0' : '#111118'}
                    strokeWidth={isActive ? 3 : 1}
                  />
                  <text
                    x={labelSize + i2 * cellSize + cellSize / 2}
                    y={labelSize + i1 * cellSize + cellSize / 2}
                    fontSize={cellSize < 48 ? '10' : '12'}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#111118"
                    pointerEvents="none"
                  >
                    {val != null ? (val * 100).toFixed(0) : '-'}%
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
