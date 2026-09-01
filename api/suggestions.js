// Proxies the live search-suggestions dropdown through this server instead
// of calling api.pokemontcg.io directly from the browser. This lets
// Vercel's edge network cache repeat searches (card names barely ever
// change) so they come back instantly instead of hitting the free,
// rate-limited card API again every time.

export default async function handler(req, res) {
  const term = (req.query.term || '').trim();
  if (!term) return res.status(400).json({ error: 'Missing "term" query parameter' });

  // The search term must be quoted before encoding, or the card API's
  // query parser 500s on the encoded colon in "name:term*".
  const q = `name:"${term}*"`;
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=8&orderBy=name`;

  try {
    const apiRes = await fetch(url);
    if (!apiRes.ok) return res.status(502).json({ error: 'Card service returned an error' });
    const data = await apiRes.json();
    // Cache at Vercel's edge for a week — card names/sets/images don't change.
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach the card service' });
  }
}
