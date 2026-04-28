const CATEGORY_QUERIES = {
  hotels: ['hotel', 'resort', 'hospitality internship'],
  restaurants: ['restaurant', 'culinary training', 'food service internship'],
  schools: ['hospitality school', 'tourism training institute', 'culinary academy'],
  j1Agencies: ['exchange visitor program agency', 'work and travel agency', 'visa sponsorship services']
};

const CORE_INTENTS = [
  'work and travel',
  'J1 visa program',
  'exchange visitor',
  'DS-2019 sponsorship',
  'internship usa',
  'internship abroad placement',
  'hospitality placement',
  'culinary training',
  'student jobs abroad',
  'au pair',
  'visa sponsor',
  'camp counselor',
  'seasonal work usa',
  'trainee program',
  'overseas recruitment',
  'cultural exchange',
  'bridgeusa'
];

const NON_US_EXPANSION_INTENTS = [
  'overseas placement agency',
  'work abroad recruitment',
  'international student placement',
  'hospitality internship abroad',
  'travel agency work abroad program',
  'training abroad program'
];

const FALLBACK_EXPANSION = [
  'travel agency work abroad',
  'usa internship agency',
  'j1 visa agency',
  'hospitality recruitment usa',
  'student exchange jobs'
];

const US_HINTS = new Set(['us', 'usa', 'united states', 'united states of america']);

export const CATEGORY_LABELS = {
  hotels: 'Hotels',
  restaurants: 'Restaurants',
  schools: 'Hospitality Schools',
  j1Agencies: 'J1 Visa Agencies'
};

function isNonUS(country = '') {
  return !US_HINTS.has(country.trim().toLowerCase());
}

function buildIntentQueries({ categories, city, state, country, isFallback = false }) {
  const location = [city, state, country].filter(Boolean).join(', ');
  const categorySeeds = categories.flatMap((category) => CATEGORY_QUERIES[category] || []);
  const intents = [...CORE_INTENTS, ...categorySeeds];

  if (isNonUS(country)) intents.push(...NON_US_EXPANSION_INTENTS);
  if (isFallback) intents.push(...FALLBACK_EXPANSION);

  return [...new Set(intents)].map((intent) => `${intent}, ${location}`);
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
    return response;
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

  const response = await fetchWithTimeout(url, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' }
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.map((place) => normalizePlace(place, query, 'Nominatim'));
}

function stripTags(value = '') {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function discoverFromDuckDuckGo(query, userAgent, limit) {
  const url = new URL('https://duckduckgo.com/html/');
  url.searchParams.set('q', query);

  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) return [];
  const html = await response.text();

  const parsed = [];

  const resultRegex = /<a[^>]+href="([^"]*uddg=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = resultRegex.exec(html)) !== null && parsed.length < limit) {
    const href = match[1];
    const title = stripTags(match[2]);
    const decoded = decodeURIComponent((href.split('uddg=')[1] || '').split('&')[0] || '');
    if (!decoded.startsWith('http')) continue;
    parsed.push(normalizePlace({ title, snippet: title, url: decoded, address: title }, query, 'DuckDuckGo'));
  }

  if (!parsed.length) {
    const genericRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = genericRegex.exec(html)) !== null && parsed.length < limit) {
      const decoded = match[1];
      if (/duckduckgo\.com|javascript:/i.test(decoded)) continue;
      const title = stripTags(match[2]);
      parsed.push(normalizePlace({ title, snippet: title, url: decoded, address: title }, query, 'DuckDuckGo'));
    }
  }

  return parsed;
}

export async function discoverBusinesses({ categories, city, state, country, limit, userAgent, debugLog = () => {} }) {
  const runDiscovery = async (isFallback) => {
    const queries = buildIntentQueries({ categories, city, state, country, isFallback });
    const perQueryLimit = Math.max(3, Math.ceil((limit * 2) / Math.max(1, queries.length)));
    const all = [];

    for (const query of queries) {
      debugLog('query.start', { query, providers: ['Nominatim', 'DuckDuckGo'] });

      try {
        const [nomi, ddg] = await Promise.all([
          discoverFromNominatim(query, userAgent, perQueryLimit),
          discoverFromDuckDuckGo(query, userAgent, perQueryLimit)
        ]);

        debugLog('query.results', { query, nominatim: nomi.length, duckduckgo: ddg.length, total: nomi.length + ddg.length });
        all.push(...nomi, ...ddg);
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
  if (leads.length === 0) {
    debugLog('fallback.trigger', { reason: 'zero_discovery_primary' });
    leads = await runDiscovery(true);
  }

  return leads.slice(0, limit * 4);
}
