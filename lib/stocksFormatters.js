export function pct(n) {
  if (n == null) return '-';
  return (n * 100).toFixed(2) + '%';
}

export function fmt(n) {
  if (n == null) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function returnStyle(value, strong = false) {
  if (value == null) return { color: '#64748b' };
  return {
    color: value > 0 ? '#22c55e' : value < 0 ? '#ef4444' : '#64748b',
    fontWeight: strong ? 700 : 500,
  };
}

export function mixColor(from, to, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  const channel = (idx) => Math.round(from[idx] + (to[idx] - from[idx]) * clamped);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export function conditionalCellStyle(value, stats, strong = false) {
  const style = {
    color: value == null ? '#64748b' : '#e2e8f0',
    fontWeight: strong ? 700 : 500,
  };
  if (value == null || !stats || stats.sortedValues.length < 2) return style;

  const sorted = stats.sortedValues;
  const rank = sorted.filter(v => v <= value).length - 1;
  const ratio = rank / (sorted.length - 1);

  const red   = [50, 20, 20];
  const white = [22, 22, 31];
  const green = [20, 50, 25];

  return {
    ...style,
    backgroundColor: ratio < 0.5
      ? mixColor(red, white, ratio * 2)
      : mixColor(white, green, (ratio - 0.5) * 2),
  };
}

export function getColumnStats(rows, key) {
  const values = rows
    .map(row => row[key])
    .filter(value => typeof value === 'number' && !Number.isNaN(value));
  if (!values.length) return null;
  return { sortedValues: [...values].sort((a, b) => a - b) };
}
