// Full name from Odds API -> short name used in blob
const TEAM_MAP = {
  'Manly Warringah Sea Eagles':      'Sea Eagles',
  'South Sydney Rabbitohs':          'Rabbitohs',
  'Melbourne Storm':                 'Storm',
  'Newcastle Knights':               'Knights',
  'Canberra Raiders':                'Raiders',
  'Sydney Roosters':                 'Roosters',
  'North Queensland Cowboys':        'Cowboys',
  'Dolphins':                        'Dolphins',
  'Brisbane Broncos':                'Broncos',
  'Gold Coast Titans':               'Titans',
  'Wests Tigers':                    'Tigers',
  'Penrith Panthers':                'Panthers',
  'Cronulla Sutherland Sharks':      'Sharks',
  'St George Illawarra Dragons':     'Dragons',
  'Canterbury Bulldogs':             'Bulldogs',
  'Parramatta Eels':                 'Eels',
  'New Zealand Warriors':            'Warriors',
  'Huddersfield Giants':             'Giants', // future-proof
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ODDS_API_KEY not set' });

  try {
    const resp = await fetch(
      `https://api.the-odds-api.com/v4/sports/rugbyleague_nrl/odds?apiKey=${apiKey}&regions=au&markets=h2h&oddsFormat=decimal`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!resp.ok) throw new Error(`Odds API error: ${resp.status}`);
    const games = await resp.json();

    // Filter to current round: games starting before next Monday midnight Sydney time
    const now = new Date();
    const sydneyOffset = 10 * 60; // AEST (close enough for filtering)
    const sydneyNow = new Date(now.getTime() + (sydneyOffset - now.getTimezoneOffset()) * 60000);
    const dayOfWeek = sydneyNow.getDay(); // 0=Sun, 1=Mon
    const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7;
    const cutoff = new Date(sydneyNow);
    cutoff.setDate(cutoff.getDate() + daysUntilMonday);
    cutoff.setHours(0, 0, 0, 0);

    const roundGames = games.filter(g => new Date(g.commence_time) < cutoff);

    // Pick best (highest) odds per team across all bookmakers, prefer TAB
    const PREFERRED = [ 'sportsbet', 'tab', 'neds', 'ladbrokes_au'];

    const odds = roundGames.map(g => {
      const home = TEAM_MAP[g.home_team] || g.home_team;
      const away = TEAM_MAP[g.away_team] || g.away_team;

      // Try preferred bookies first, fall back to first available
      let homeOdds = null, awayOdds = null, source = null;
      const bookies = [...g.bookmakers].sort((a, b) => {
        const ai = PREFERRED.indexOf(a.key), bi = PREFERRED.indexOf(b.key);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      for (const bookie of bookies) {
        const h2h = bookie.markets?.find(m => m.key === 'h2h');
        if (!h2h) continue;
        const ho = h2h.outcomes.find(o => o.name === g.home_team)?.price;
        const ao = h2h.outcomes.find(o => o.name === g.away_team)?.price;
        if (ho && ao) { homeOdds = ho; awayOdds = ao; source = bookie.key; break; }
      }

      return { home, away, homeOdds, awayOdds, source, commence: g.commence_time };
    });

    res.status(200).json({ odds, requestsRemaining: resp.headers.get('x-requests-remaining') });
  } catch (err) {
    console.error('NRL odds error:', err);
    res.status(500).json({ error: err.message });
  }
}
