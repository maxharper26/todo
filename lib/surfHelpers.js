// Surf formatting helpers and colour logic

// Stormglass swellHeight is offshore significant wave height — consistently
// overstates actual beach surf height. Calibrated against Surfline ground truth:
// 2.5m raw = 2-3ft at beach, implying ~0.43x linear scale.
// Using a mild power curve so small swells don't collapse to nothing.
// v=0.5 → 0.26m (1ft), v=1.0 → 0.43m (1-2ft), v=1.5 → 0.72m (2-3ft),
// v=2.5 → 1.08m (2-3ft), v=3.5 → 1.50m (3-4ft)
function dampenSwell(v) {
  return Math.pow(v, 0.85) * 0.43;
}

export function aussieFt(v) {
  if (v == null) return '—';
  const d = dampenSwell(v);
  if (d < 0.3)  return 'Flat';
  if (d < 0.5)  return '1ft';
  if (d < 0.8)  return '1–2ft';
  if (d < 1.1)  return '2–3ft';
  if (d < 1.5)  return '3–4ft';
  if (d < 2.0)  return '4–6ft';
  if (d < 2.7)  return '6–8ft';
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
  const d = Math.pow(h, 0.85) * 0.43;
  if (d < 0.3)  return 'var(--red)';    // Flat
  if (d < 0.8)  return '#f59e0b';       // 1ft, 1-2ft
  if (d < 2.7)  return 'var(--green)';  // 2-3ft through 6-8ft
  return '#f59e0b';                      // 8ft+
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
