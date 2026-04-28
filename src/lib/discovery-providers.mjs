export const CATEGORY_LABELS = {
  agencies: 'Agencies',
  hotels: 'Hotels',
  resorts: 'Resorts',
  restaurants: 'Restaurants',
  hospitalityGroups: 'Hospitality Groups',
  seasonalEmployers: 'Seasonal Employers',
  tourismOperators: 'Tourism Operators',
  schools: 'Schools',
  usaOrganizations: 'USA Organizations'
};

const CATEGORY_QUERIES = {
  agencies: ['Work and Travel USA agency', 'J1 visa agency', 'exchange program agency', 'student placement USA'],
  hotels: ['hotel recruitment USA', 'hotel employer hospitality trainees'],
  resorts: ['resort employer hospitality trainees', 'seasonal resort jobs USA'],
  restaurants: ['restaurant employer hospitality trainees', 'culinary placement USA'],
  hospitalityGroups: ['hospitality group recruitment USA', 'hospitality management trainees USA'],
  seasonalEmployers: ['seasonal employer USA recruitment', 'saisonnier USA recrutement'],
  tourismOperators: ['tourism operator recruitment USA', 'agence voyage travail USA'],
  schools: ['hospitality school USA internship', 'tourism college USA training'],
  usaOrganizations: ['U.S. exchange visitor organization', 'DS-2019 sponsor partner']
};

const COUNTRY_LOCAL_EXPANSIONS = ({ country }) => [
  `${country} Work and Travel USA agency`,
  `${country} J1 visa agency`,
  `${country} hospitality recruitment USA`,
  `${country} student placement USA`,
  `${country} exchange program agency`,
  `${country} recrutement USA`,
  `${country} agence voyage travail USA`,
  `${country} recrutement saisonnier USA`
];

const FALLBACK_EXPANSION = ({ country }) => [
  `${country} facebook work and travel agency`,
  `${country} facebook recrutement usa`,
  `${country} local hospitality employer`
];

function buildIntentQueries({ categories, city, state, country, isFallback = false }) {
  const location = [city, state].filter(Boolean).join(', ');
  const base = COUNTRY_LOCAL_EXPANSIONS({ country });
  const categorySeeds = categories.flatMap((category) => (CATEGORY_QUERIES[category] || []).map((seed) => `${country} ${seed}`));
  const all = [...base, ...categorySeeds];
  if (isFallback) all.push(...FALLBACK_EXPANSION({ country }));
  return [...new Set(all)].map((q) => (location ? `${q}, ${location}` : q));
}

function normalizePlace(place, query, source) {
  return {
    id: `${source}-${place.id || place.osm_id || Math.random().toString(36).slice(2)}`,
    name: place.name || place.display_name?.split(',')[0] || place.title || 'Unnamed Place',
    address: place.display_name || place.address || place.snippet || '',
    website: place.website || place.url || place.extratags?.website || place.extratags?.contactwebsite || null,
    query,
    source
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

async function discoverFromNominatim(query, userAgent, limit) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('limit', String(limit));
  const response = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!response.ok) return [];
  return (await response.json()).map((place) => normalizePlace(place, query, 'Nominatim'));
}

const stripTags = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function discoverFromDuckDuckGo(query, userAgent, limit) {
  const url = new URL('https://duckduckgo.com/html/');
  url.searchParams.set('q', query);
  const response = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' } });
  if (!response.ok) return [];
  const html = await response.text();

  const parsed = [];
  const regex = /<a[^>]+href="([^"]*uddg=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && parsed.length < limit) {
    const decoded = decodeURIComponent((match[1].split('uddg=')[1] || '').split('&')[0] || '');
    if (!decoded.startsWith('http')) continue;
    const title = stripTags(match[2]);
    parsed.push(normalizePlace({ title, snippet: title, url: decoded, address: title }, query, 'DuckDuckGo'));
  }

  const fbQuery = `${query} site:facebook.com`;
  if (parsed.length < Math.ceil(limit / 2)) {
    const fbUrl = new URL('https://duckduckgo.com/html/');
    fbUrl.searchParams.set('q', fbQuery);
    const fbRes = await fetchWithTimeout(fbUrl, { headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' } });
    if (fbRes.ok) {
      const fbHtml = await fbRes.text();
      regex.lastIndex = 0;
      while ((match = regex.exec(fbHtml)) !== null && parsed.length < limit) {
        const decoded = decodeURIComponent((match[1].split('uddg=')[1] || '').split('&')[0] || '');
        if (!decoded.startsWith('http')) continue;
        const title = stripTags(match[2]);
        parsed.push(normalizePlace({ title, snippet: title, url: decoded, address: title }, `${query} (facebook)`, 'DuckDuckGo'));
      }
    }
  }

  return parsed;
}

export async function discoverBusinesses({ categories, city, state, country, limit, mode, userAgent, debugLog = () => {} }) {
  const runDiscovery = async (isFallback) => {
    const queries = buildIntentQueries({ categories, city, state, country, isFallback });
    const perQueryLimit = mode === 'full' ? 12 : Math.max(4, Math.ceil((limit * 2) / Math.max(1, queries.length)));
    const all = [];

    for (const query of queries) {
      debugLog('query.start', { query, providers: ['Nominatim', 'DuckDuckGo'] });
      try {
        const [nomi, ddg] = await Promise.all([discoverFromNominatim(query, userAgent, perQueryLimit), discoverFromDuckDuckGo(query, userAgent, perQueryLimit)]);
        all.push(...nomi, ...ddg);
        debugLog('query.results', { query, nominatim: nomi.length, duckduckgo: ddg.length, total: nomi.length + ddg.length });
      } catch (error) {
        debugLog('query.error', { query, error: error.message });
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const item of all) {
      const key = `${item.name}-${item.website || item.address}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  };

  let leads = await runDiscovery(false);
  if (!leads.length) {
    debugLog('fallback.trigger', { reason: 'zero_discovery_primary' });
    leads = await runDiscovery(true);
  }

  return mode === 'full' ? leads : leads.slice(0, Math.max(limit * 5, 50));
}
