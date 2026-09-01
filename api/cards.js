// Proxies the JustTCG raw-price search. The API key lives here as a
// server environment variable (set in the Vercel dashboard, never in
// code) instead of sitting in plain text in the HTML file.

export default async function handler(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing "q" query parameter' });

  const key = process.env.JUSTTCG_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is missing the JUSTTCG_API_KEY environment variable' });

  const url = `https://api.justtcg.com/v1/cards?q=${encodeURIComponent(q)}&game=pokemon&limit=8`;

  try {
    const apiRes = await fetch(url, { headers: { 'x-api-key': key } });
    if (!apiRes.ok) return res.status(502).json({ error: 'JustTCG returned an error' });
    const data = await apiRes.json();
    // Cache for an hour — raw prices move, but not minute to minute.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach JustTCG' });
  }
}
