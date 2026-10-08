// Server-only Vercel function. Never import this file from browser code.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const params = new URL(req.url, 'https://localhost').searchParams;
  const dates = params.getAll('date');
  const date = dates[0];
  if ([...params.keys()].some(key => key !== 'date') ||
      dates.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Provide one valid date in YYYY-MM-DD format' });
  }

  const key = process.env.highlightly_nba;
  if (!key) {
    return res.status(503).json({ error: 'NBA data is not configured' });
  }

  // Fixed host, route, league and page size: this is not a general-purpose proxy.
  const upstream = new URL('https://nba.highlightly.net/matches');
  upstream.search = new URLSearchParams({ league: 'NBA', date, limit: '20' }).toString();
  try {
    const response = await fetch(upstream, {
      headers: { 'x-rapidapi-key': key },
      redirect: 'error',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      return res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 429 ? 'NBA provider rate limit reached' : 'NBA provider request failed'
      });
    }
    const body = await response.json();
    if (!Array.isArray(body.data)) {
      return res.status(502).json({ error: 'Unexpected NBA provider response' });
    }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return res.status(200).json({ data: body.data, pagination: body.pagination });
  } catch {
    // Do not return or log upstream bodies, headers, or exception details.
    return res.status(502).json({ error: 'NBA provider is unavailable' });
  }
};
