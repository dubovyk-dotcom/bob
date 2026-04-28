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

const LANGUAGE_MAP = {
  USA: ['en'], Canada: ['en', 'fr'], Mexico: ['es', 'en'], Brazil: ['pt', 'en'], France: ['fr', 'en'], Germany: ['de', 'en'], Spain: ['es', 'en'], Italy: ['it', 'en'], Poland: ['pl', 'en'], Ukraine: ['uk', 'ru', 'en'], Turkey: ['tr', 'en'],
  Morocco: ['ar', 'fr', 'en'], Algeria: ['ar', 'fr', 'en'], Tunisia: ['ar', 'fr', 'en'], Egypt: ['ar', 'en'], Nigeria: ['en'], Kenya: ['en', 'sw'], Ghana: ['en'], Ethiopia: ['am', 'en'], Madagascar: ['fr', 'mg', 'en'],
  China: ['zh', 'en'], Japan: ['ja', 'en'], 'South Korea': ['ko', 'en'], India: ['en', 'hi'], Pakistan: ['ur', 'en'], Bangladesh: ['bn', 'en'], Vietnam: ['vi', 'en'], Thailand: ['th', 'en'], Indonesia: ['id', 'en'], Philippines: ['en', 'tl'], Malaysia: ['ms', 'en'], Nepal: ['ne', 'en'],
  UAE: ['ar', 'en'], 'Saudi Arabia': ['ar', 'en'], Qatar: ['ar', 'en'], Jordan: ['ar', 'en'], Israel: ['he', 'en'], Australia: ['en'], 'New Zealand': ['en']
};

const COUNTRY_TLD = { Madagascar: 'mg', China: 'cn', Brazil: 'br', Morocco: 'ma', Vietnam: 'vn', Nepal: 'np', Ghana: 'gh', Philippines: 'ph', Mexico: 'mx' };
const FRANCOPHONE = new Set(['Madagascar', 'Morocco', 'Algeria', 'Tunisia', 'Senegal', 'Ivory Coast']);

const ENGLISH_INTENTS = ['work and travel USA', 'J1 agency', 'internship USA', 'hospitality placement USA'];

const LOCAL_TRANSLATIONS = {
  fr: ['recrutement USA', 'agence de placement USA', 'programme échange USA', 'agence voyage travail USA'],
  es: ['agencia J1 USA', 'reclutamiento USA', 'trabajo y viaje USA', 'prácticas USA'],
  pt: ['agência J1 EUA', 'recrutamento EUA', 'intercâmbio trabalho EUA', 'estágio EUA'],
  zh: ['J1 美国 项目', '美国 实习 中介', '出国 工作 美国', '美国 交换 项目'],
  vi: ['J1 Mỹ tuyển dụng', 'thực tập Mỹ', 'việc làm Mỹ chương trình', 'tuyển dụng Mỹ'],
  ar: ['وكالة J1 امريكا', 'توظيف امريكا', 'برنامج عمل وسفر امريكا', 'تدريب امريكا'],
  de: ['J1 Agentur USA', 'Rekrutierung USA', 'Work and Travel USA', 'Praktikum USA'],
  tr: ['J1 ajansı ABD', 'ABD işe alım', 'work and travel ABD', 'staj ABD'],
  tl: ['ahensya J1 USA', 'recruitment USA', 'work and travel USA', 'internship USA'],
  mg: ['agence de placement USA', 'asa any ivelany USA', 'programme USA recrutement']
};

const CATEGORY_QUERIES = {
  agencies: ['recruitment agency USA', 'exchange program agency'],
  hotels: ['hotel employer hospitality trainees'],
  resorts: ['resort employer seasonal jobs'],
  restaurants: ['restaurant employer culinary trainees'],
  hospitalityGroups: ['hospitality group recruitment'],
  seasonalEmployers: ['seasonal employer recruitment usa'],
  tourismOperators: ['tourism operator recruitment usa'],
  schools: ['hospitality school usa internship', 'tourism college usa training'],
  usaOrganizations: ['U.S. exchange visitor organization', 'DS-2019 sponsor partner']
};

function getLanguages(country) {
  return LANGUAGE_MAP[country] || ['en'];
}

function tldSet(country) {
  const set = new Set([COUNTRY_TLD[country] || country.slice(0, 2).toLowerCase()]);
  if (FRANCOPHONE.has(country)) set.add('fr');
  return [...set];
}

function makeLayeredQueries({ categories, city, state, country, isFallback = false }) {
  const loc = [city, state].filter(Boolean).join(', ');
  const langs = getLanguages(country);
  const localPhrases = langs.flatMap((l) => LOCAL_TRANSLATIONS[l] || []);

  const layers = [];

  // LAYER 1 — Search engine basic
  layers.push(...ENGLISH_INTENTS.map((q) => ({ layer: 'search_engine', query: `${country} ${q}` })));
  layers.push(...localPhrases.map((q) => ({ layer: 'search_engine', query: `${country} ${q}` })));

  // LAYER 2 — Local domain scan
  for (const tld of tldSet(country)) {
    layers.push({ layer: 'local_domain_scan', query: `site:.${tld} ${country} recrutement USA` });
    layers.push({ layer: 'local_domain_scan', query: `site:.${tld} agency ${country} USA` });
  }

  // LAYER 3 — Facebook discovery
  layers.push({ layer: 'facebook_discovery', query: `facebook work abroad ${country}` });
  layers.push({ layer: 'facebook_discovery', query: `agency USA facebook ${country}` });
  layers.push({ layer: 'facebook_discovery', query: `recruitment USA facebook page ${country}` });

  // LAYER 4 — Directories
  layers.push({ layer: 'directories', query: `${country} business directory recruitment` });
  layers.push({ layer: 'directories', query: `${country} hospitality schools directory` });
  layers.push({ layer: 'directories', query: `${country} travel agency directory` });

  // LAYER 5 — Forums/community
  layers.push({ layer: 'forums', query: `forum work abroad ${country}` });
  layers.push({ layer: 'forums', query: `reddit ${country} work USA agency` });
  layers.push({ layer: 'forums', query: `${country} expat board recruitment USA` });

  // Hybrid category pass
  layers.push(
    ...categories.flatMap((cat) =>
      (CATEGORY_QUERIES[cat] || []).map((q) => ({ layer: 'hybrid', query: `${country} ${q} USA hospitality recruitment` }))
    )
  );

  if (isFallback) {
    for (const tld of tldSet(country)) {
      layers.push({ layer: 'booster', query: `site:.${tld} ${country} work abroad agency` });
    }
    layers.push({ layer: 'booster', query: `facebook page work abroad ${country}` });
    layers.push({ layer: 'booster', query: `${country} agence de placement USA` });
  }

  const dedup = [];
  const seen = new Set();
  for (const item of layers) {
    const query = loc ? `${item.query}, ${loc}` : item.query;
    const key = `${item.layer}|${query}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push({ layer: item.layer, query });
  }

  return dedup;
}

function normalizePlace(place, query, source, layer) {
  return {
    id: `${source}-${place.id || place.osm_id || Math.random().toString(36).slice(2)}`,
    name: place.name || place.display_name?.split(',')[0] || place.title || 'Unnamed Place',
    address: place.display_name || place.address || place.snippet || '',
    website: place.website || place.url || place.extratags?.website || place.extratags?.contactwebsite || null,
    query,
    layer,
    source
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: c.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

async function discoverFromNominatim(query, userAgent, limit, layer) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('limit', String(limit));
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!res.ok) return [];
  return (await res.json()).map((p) => normalizePlace(p, query, 'Nominatim', layer));
}

const stripTags = (v = '') => v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function discoverFromDuckDuckGo(query, userAgent, limit, layer) {
  const url = new URL('https://duckduckgo.com/html/');
  url.searchParams.set('q', query);
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' } });
  if (!res.ok) return [];
  const html = await res.text();

  const out = [];
  const regex = /<a[^>]+href="([^"]*uddg=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null && out.length < limit) {
    const decoded = decodeURIComponent((m[1].split('uddg=')[1] || '').split('&')[0] || '');
    if (!decoded.startsWith('http')) continue;
    out.push(normalizePlace({ title: stripTags(m[2]), url: decoded, address: stripTags(m[2]) }, query, 'DuckDuckGo', layer));
  }
  return out;
}

export async function discoverBusinesses({ categories, city, state, country, limit, mode, userAgent, debugLog = () => {} }) {
  const run = async (isFallback) => {
    const queries = makeLayeredQueries({ categories, city, state, country, isFallback });
    const perQuery = mode === 'full' ? 10 : Math.max(3, Math.ceil((limit * 2) / Math.max(1, queries.length)));
    const all = [];

    for (const item of queries) {
      debugLog('query.start', { query: item.query, layer: item.layer, providers: ['Nominatim', 'DuckDuckGo'] });
      try {
        const [a, b] = await Promise.all([
          discoverFromNominatim(item.query, userAgent, perQuery, item.layer),
          discoverFromDuckDuckGo(item.query, userAgent, perQuery, item.layer)
        ]);
        all.push(...a, ...b);
        debugLog('query.results', { query: item.query, layer: item.layer, nominatim: a.length, duckduckgo: b.length, total: a.length + b.length });
      } catch (e) {
        debugLog('query.error', { query: item.query, layer: item.layer, error: e.message });
      }
    }

    const dedup = [];
    const seen = new Set();
    for (const x of all) {
      const key = `${x.name}-${x.website || x.address}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(x);
    }
    return dedup;
  };

  let leads = await run(false);
  if (leads.length < 8) {
    debugLog('fallback.trigger', { reason: 'weak_results' });
    leads = [...leads, ...(await run(true))];
  }

  const uniq = [];
  const seen = new Set();
  for (const x of leads) {
    const k = `${x.name}-${x.website || x.address}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(x);
  }

  return mode === 'full' ? uniq : uniq.slice(0, Math.max(limit * 5, 80));
}
