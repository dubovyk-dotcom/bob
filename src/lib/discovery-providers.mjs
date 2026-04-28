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
  Philippines: ['en', 'tl'], Madagascar: ['fr', 'mg', 'en'], Vietnam: ['vi', 'en'], Brazil: ['pt', 'en'], Morocco: ['ar', 'fr', 'en'], China: ['zh', 'en'], Nepal: ['ne', 'en'], Ghana: ['en']
};

const COUNTRY_TLD = { Philippines: 'ph', Madagascar: 'mg', Vietnam: 'vn', Brazil: 'br', Morocco: 'ma', China: 'cn', Nepal: 'np', Ghana: 'gh' };

const COUNTRY_RECRUITMENT_ECOSYSTEM = {
  Philippines: [
    'POEA licensed agencies',
    'overseas manpower agencies',
    'deployment agencies abroad',
    'work abroad recruitment Philippines',
    'OFW recruitment agencies',
    'direct hiring abroad Philippines',
    'abroad employment agency',
    'overseas jobs recruitment',
    'deployment agency',
    'manpower agency',
    'work overseas'
  ]
};

const GLOBAL_OUTBOUND_INTENTS = ['work abroad agency', 'overseas recruitment', 'abroad employment', 'deployment agency', 'manpower agency', 'international placement agency'];
const CATEGORY_QUERIES = {
  agencies: ['recruitment agency abroad', 'overseas placement agency'],
  hotels: ['hotel overseas hiring', 'hospitality employer abroad'],
  resorts: ['resort recruitment abroad', 'seasonal resort hiring'],
  restaurants: ['restaurant employer abroad', 'culinary staffing agency'],
  hospitalityGroups: ['hospitality group recruitment'],
  seasonalEmployers: ['seasonal employer recruitment'],
  tourismOperators: ['tourism operator staffing abroad'],
  schools: ['hospitality school international placement', 'tourism college overseas internship'],
  usaOrganizations: ['international exchange visitor organization']
};

const LOCAL_TRANSLATIONS = {
  fr: ['agence recrutement international', 'emploi à l étranger', 'agence de placement'],
  es: ['agencia de empleo en el extranjero', 'reclutamiento internacional', 'trabajo en el extranjero'],
  pt: ['agência de emprego no exterior', 'recrutamento internacional', 'trabalho no exterior'],
  tl: ['ahensya trabaho abroad', 'recruitment overseas jobs', 'deployment agency'],
  vi: ['công ty xuất khẩu lao động', 'việc làm nước ngoài', 'đơn vị tuyển dụng quốc tế'],
  ar: ['وكالة توظيف بالخارج', 'توظيف دولي', 'وظائف خارج البلد'],
  zh: ['海外招聘中介', '出国工作中介', '国际劳务公司'],
  mg: ['asa any ivelany', 'agence de placement', 'recrutement international'],
  ne: ['विदेश रोजगार एजेन्सी', 'विदेशी रोजगारी भर्ती'],
  en: ['work abroad agency', 'overseas jobs recruitment', 'international placement']
};

function getLanguages(country) {
  return LANGUAGE_MAP[country] || ['en'];
}

function tldSet(country) {
  return [COUNTRY_TLD[country] || country.slice(0, 2).toLowerCase()];
}

function makeLayeredQueries({ categories, city, state, country, isFallback = false }) {
  const loc = [city, state].filter(Boolean).join(', ');
  const langs = getLanguages(country);

  const localLanguageTerms = langs.flatMap((l) => LOCAL_TRANSLATIONS[l] || []);
  const ecosystemTerms = COUNTRY_RECRUITMENT_ECOSYSTEM[country] || [];

  const layers = [];

  // Layer 1: search engine (generic outbound first)
  layers.push(...GLOBAL_OUTBOUND_INTENTS.map((q) => ({ layer: 'search_engine', query: `${country} ${q}` })));
  layers.push(...localLanguageTerms.map((q) => ({ layer: 'search_engine', query: `${country} ${q}` })));

  // Layer 2: country ecosystem terms
  layers.push(...ecosystemTerms.map((q) => ({ layer: 'country_ecosystem', query: q.includes(country) ? q : `${country} ${q}` })));

  // Layer 3: facebook-first, especially PH
  layers.push({ layer: 'facebook_discovery', query: `facebook work abroad ${country}` });
  layers.push({ layer: 'facebook_discovery', query: `facebook recruitment agency ${country}` });
  layers.push({ layer: 'facebook_discovery', query: `messenger recruitment ${country}` });

  // Layer 4: local domain scan
  for (const tld of tldSet(country)) {
    layers.push({ layer: 'local_domain_scan', query: `site:.${tld} ${country} recruitment agency abroad` });
    layers.push({ layer: 'local_domain_scan', query: `site:.${tld} ${country} manpower agency` });
  }

  // Layer 5: directories + forums
  layers.push({ layer: 'directories', query: `${country} business directory recruitment` });
  layers.push({ layer: 'directories', query: `${country} yellow pages recruitment agency` });
  layers.push({ layer: 'forums', query: `forum work abroad ${country}` });
  layers.push({ layer: 'forums', query: `reddit ${country} work abroad agency` });

  // category hybrid
  layers.push(...categories.flatMap((cat) => (CATEGORY_QUERIES[cat] || []).map((q) => ({ layer: 'hybrid', query: `${country} ${q}` }))));

  if (isFallback) {
    layers.push({ layer: 'booster', query: `${country} overseas jobs facebook page` });
    layers.push({ layer: 'booster', query: `${country} deployment agency directory` });
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
  try { return await fetch(url, { ...options, signal: c.signal, redirect: 'follow' }); } finally { clearTimeout(t); }
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

    return all;
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

  return mode === 'full' ? uniq : uniq.slice(0, Math.max(limit * 6, 90));
}
