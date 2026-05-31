import { aussieFt, compassDir, fmtWind, fmtPeriod, waveColour, windColour, periodColour, shortDay } from '../../lib/surfHelpers';

export default function SwellTable({ days }) {
  if (!days?.length) return null;
  return (
    <div className="surf-table-wrap">
      <table className="surf-table">
        <thead>
          <tr>
            <th>Day</th>
            <th></th>
            <th>Swell</th>
            <th>Avg wind</th>
            <th>Max wind</th>
            <th>Period</th>
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day.date}>
              <td className="surf-day">{shortDay(day.date)}</td>
              <td className="surf-bar-cell">
                <div className="surf-bar-track">
                  <div className="surf-bar-fill" style={{
                    width: `${Math.min(100, (day.swellHeight || 0) / 2.7 * 100)}%`,
                    background: waveColour(day.swellHeight),
                  }} />
                </div>
              </td>
              <td style={{ color: waveColour(day.swellHeight), fontWeight: 600 }}>
                {aussieFt(day.swellHeight)}
                {day.swellDirection != null && (
                  <span className="surf-wind-dir"> {compassDir(day.swellDirection)}</span>
                )}
              </td>
              <td className="surf-wind" style={{ color: windColour(day.windSpeed, day.windDirection) }}>
                {fmtWind(day.windSpeed)}
                {day.windDirection != null && (
                  <span className="surf-wind-dir">{compassDir(day.windDirection)}</span>
                )}
              </td>
              <td style={{ color: windColour(day.windSpeedMax, day.windDirectionAtMax) }}>
                {fmtWind(day.windSpeedMax)}
                {day.windDirectionAtMax != null && (
                  <span className="surf-wind-dir"> {compassDir(day.windDirectionAtMax)}</span>
                )}
              </td>
              <td style={{ color: periodColour(day.swellPeriod) }}>{fmtPeriod(day.swellPeriod)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
