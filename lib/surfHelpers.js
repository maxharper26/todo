// Surf formatting helpers and colour logic

export function aussieFt(v) {
  if (v == null) return '—';
  if (v < 0.3)  return 'Flat';
  if (v < 0.5)  return '1ft';
  if (v < 0.8)  return '1–2ft';
  if (v < 1.1)  return '2–3ft';
  if (v < 1.5)  return '3–4ft';
  if (v < 2.0)  return '4–6ft';
  if (v < 2.7)  return '6–8ft';
  return '8ft+';
}
export function compassDir(deg) {
  if (deg == null) return '—';
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
}
export function fmtWind(v)   { return v != null ? `${Math.round(v)}kn` : '—'; }
export function fmtPeriod(v) { return v != null ? `${Math.round(v)}s` : '—'; }

export function waveColour(h) {
  if (h == null) return 'var(--text-muted)';
  if (h < 0.3)  return 'var(--red)';
  if (h < 0.8)  return '#f59e0b';
  if (h <= 2.0) return 'var(--green)';
  return '#f59e0b';
}
export function windColour(spd, dir) {
  if (spd == null) return 'var(--text-muted)';
  if (dir != null && ['W','NW','SW'].includes(compassDir(dir))) return 'var(--green)';
  if (spd <= 10) return 'var(--green)';
  if (spd <= 20) return '#f59e0b';
  return 'var(--red)';
}
export function periodColour(p) {
  if (p == null) return 'var(--text-muted)';
  if (p < 5)  return 'var(--red)';
  if (p < 10) return '#f59e0b';
  return 'var(--green)';
}
export function shortDay(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
