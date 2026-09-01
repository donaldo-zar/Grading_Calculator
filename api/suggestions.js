// Proxies the live search-suggestions dropdown. English uses
// api.pokemontcg.io (free, has real prefix search). Japanese has no
// coverage there at all, so it uses JustTCG instead — the same source
// already powering search results — normalized to the same shape the
// page expects either way: { data: [{ name, set:{name}, number,
// images:{small} }] }.
//
// api.pokemontcg.io is genuinely flaky under repeated use — confirmed
// by testing — so the English path retries a couple of times with a
// short backoff before giving up.

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function tcgplayerImageUrl(tcgplayerId){
  return tcgplayerId ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcgplayerId}_in_200x200.jpg` : null;
}

async function fetchEnglishSuggestions(term, res){
  // The term must be quoted before encoding, or the card API's query
  // parser 500s on the encoded colon in "name:term*".
  const q = `name:"${term}*"`;
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=8&orderBy=name`;

  const delays = [0, 300, 700];
  for (let i = 0; i < delays.length; i++){
    if (delays[i]) await sleep(delays[i]);
    try {
      const apiRes = await fetch(url);
      if (!apiRes.ok) continue; // try again with more backoff
      const data = await apiRes.json();
      res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
      return res.status(200).json(data);
    } catch (err) {
      // fall through and retry, or give up after the last attempt
    }
  }
  res.status(502).json({ error: 'Card service is temporarily unavailable — try again in a moment' });
}

async function fetchJapaneseSuggestions(term, res){
  const key = process.env.JUSTTCG_API_KEY;
  if (!key) return res.status(200).json({ data: [] });

  // JustTCG does loose substring matching, not prefix matching (e.g.
  // "Char" also matches "Chimchar"), so this over-fetches and re-ranks
  // client-side-of-the-proxy to put actual prefix matches first, which
  // is what a typeahead dropdown needs to feel right.
  const url = `https://api.justtcg.com/v1/cards?q=${encodeURIComponent(term)}&game=pokemon-japan&limit=20`;
  try {
    const apiRes = await fetch(url, { headers: { 'x-api-key': key } });
    if (!apiRes.ok) return res.status(200).json({ data: [] });
    const data = await apiRes.json();
    const lowerTerm = term.toLowerCase();
    const cards = (data.data || [])
      .sort((a, b) => {
        const aStarts = (a.name || '').toLowerCase().startsWith(lowerTerm) ? 0 : 1;
        const bStarts = (b.name || '').toLowerCase().startsWith(lowerTerm) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 8)
      .map(c => ({
        name: c.name,
        set: { name: c.set_name },
        number: c.number,
        images: { small: tcgplayerImageUrl(c.tcgplayerId) },
      }));
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
    res.status(200).json({ data: cards });
  } catch (err) {
    res.status(200).json({ data: [] });
  }
}

export default async function handler(req, res) {
  const term = (req.query.term || '').trim();
  if (!term) return res.status(400).json({ error: 'Missing "term" query parameter' });

  if (req.query.language === 'japanese'){
    return fetchJapaneseSuggestions(term, res);
  }
  return fetchEnglishSuggestions(term, res);
}
