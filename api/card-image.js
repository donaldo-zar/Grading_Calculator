// Proxies the per-result thumbnail lookup through this server. Same
// caching idea as suggestions.js — once this server has looked up
// "Charizard" once, ever, it never has to ask again. Also retries a
// couple of times on failure, since the underlying free card API is
// genuinely flaky under repeated use.

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req, res) {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Missing "name" query parameter' });

  const q = `name:"${name}"`;
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`;

  const delays = [0, 300, 700];
  for (let i = 0; i < delays.length; i++){
    if (delays[i]) await sleep(delays[i]);
    try {
      const apiRes = await fetch(url);
      if (!apiRes.ok) continue;
      const data = await apiRes.json();
      const image = data.data?.[0]?.images?.small || null;
      // Cache at the edge for 30 days — card art is permanent.
      res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400');
      return res.status(200).json({ image });
    } catch (err) {
      // fall through and retry, or give up after the last attempt
    }
  }
  res.status(502).json({ error: 'Card image service is temporarily unavailable' });
}
