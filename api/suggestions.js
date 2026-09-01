// Proxies the live search-suggestions dropdown through this server instead
// of calling api.pokemontcg.io directly from the browser. This lets
// Vercel's edge network cache repeat searches (card names barely ever
// change) so they come back instantly instead of hitting the free,
// rate-limited card API again every time.
//
// That free/anonymous card API is genuinely flaky under repeated use —
// confirmed by testing — so this retries a couple of times with a short
// backoff before giving up, the same way the image lookup already does.

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req, res) {
  const term = (req.query.term || '').trim();
  if (!term) return res.status(400).json({ error: 'Missing "term" query parameter' });

  // The search term must be quoted before encoding, or the card API's
  // query parser 500s on the encoded colon in "name:term*".
  const q = `name:"${term}*"`;
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=8&orderBy=name`;

  const delays = [0, 300, 700];
  for (let i = 0; i < delays.length; i++){
    if (delays[i]) await sleep(delays[i]);
    try {
      const apiRes = await fetch(url);
      if (!apiRes.ok) continue; // try again with more backoff
      const data = await apiRes.json();
      // Cache at Vercel's edge for a week — card names/sets/images don't change.
      res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
      return res.status(200).json(data);
    } catch (err) {
      // fall through and retry, or give up after the last attempt
    }
  }
  res.status(502).json({ error: 'Card service is temporarily unavailable — try again in a moment' });
}
