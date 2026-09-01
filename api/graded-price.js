// Proxies PokemonPriceTracker's graded-sales lookup. This is the one
// that actually NEEDS a server: PokemonPriceTracker blocks direct
// browser requests from any other website (confirmed by testing), but
// has no problem with one server calling another — that restriction
// only applies to browser-side JavaScript, not server code.

export default async function handler(req, res) {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Missing "name" query parameter' });

  const key = process.env.PPT_API_KEY;
  if (!key) return res.status(200).json({ status: 'no-key' });

  const url = `https://www.pokemonpricetracker.com/api/v2/cards?search=${encodeURIComponent(name)}&includeEbay=true&limit=1`;

  try {
    const apiRes = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
    if (!apiRes.ok) return res.status(200).json({ status: 'error' });
    const data = await apiRes.json();
    const card = data.data?.[0];
    // Cache for 3 hours — graded sale averages don't need to be
    // second-by-second fresh, and this keeps daily credit usage low.
    res.setHeader('Cache-Control', 'public, max-age=10800, s-maxage=10800, stale-while-revalidate=3600');
    res.status(200).json({ status: 'ok', salesByGrade: card?.ebay?.salesByGrade || null });
  } catch (err) {
    res.status(200).json({ status: 'error' });
  }
}
