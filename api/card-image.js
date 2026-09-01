// Proxies the per-result thumbnail lookup through this server. Same
// caching idea as suggestions.js — once this server has looked up
// "Charizard" once, ever, it never has to ask again.

export default async function handler(req, res) {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Missing "name" query parameter' });

  const q = `name:"${name}"`;
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`;

  try {
    const apiRes = await fetch(url);
    if (!apiRes.ok) return res.status(502).json({ error: 'Card service returned an error' });
    const data = await apiRes.json();
    const image = data.data?.[0]?.images?.small || null;
    // Cache at the edge for 30 days — card art is permanent.
    res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400');
    res.status(200).json({ image });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach the card image service' });
  }
}
