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
  USA: ['en'], Canada: ['en', 'fr'], Mexico: ['es', 'en'],
  Brazil: ['pt', 'en'], Argentina: ['es', 'en'], Chile: ['es', 'en'], Colombia: ['es', 'en'], Peru: ['es', 'en'], Ecuador: ['es', 'en'], Bolivia: ['es', 'en'], Uruguay: ['es', 'en'],
  UK: ['en'], France: ['fr', 'en'], Germany: ['de', 'en'], Spain: ['es', 'en'], Italy: ['it', 'en'], Poland: ['pl', 'en'], Ukraine: ['uk', 'en'], Turkey: ['tr', 'en'], Kazakhstan: ['ru', 'kk', 'en'],
  Morocco: ['ar', 'fr', 'en'], Algeria: ['ar', 'fr', 'en'], Tunisia: ['ar', 'fr', 'en'], Egypt: ['ar', 'en'], Nigeria: ['en'], Kenya: ['en', 'sw'], Ghana: ['en'], 'South Africa': ['en'], Ethiopia: ['am', 'en'], Madagascar: ['fr', 'mg', 'en'],
  China: ['zh', 'en'], Japan: ['ja', 'en'], 'South Korea': ['ko', 'en'], India: ['en', 'hi'], Pakistan: ['ur', 'en'], Bangladesh: ['bn', 'en'], Vietnam: ['vi', 'en'], Thailand: ['th', 'en'], Indonesia: ['id', 'en'], Philippines: ['en', 'tl'], Malaysia: ['ms', 'en'], 'Sri Lanka': ['si', 'en'], Nepal: ['ne', 'en'],
  UAE: ['ar', 'en'], 'Saudi Arabia': ['ar', 'en'], Qatar: ['ar', 'en'], Jordan: ['ar', 'en'], Israel: ['he', 'en'],
  Australia: ['en'], 'New Zealand': ['en']
};

const COUNTRY_TLD = { Philippines: 'ph', Madagascar: 'mg', Vietnam: 'vn', Brazil: 'br', Morocco: 'ma', China: 'cn', Nepal: 'np', Ghana: 'gh', Mexico: 'mx', Poland: 'pl', Kazakhstan: 'kz', Thailand: 'th' };

const COUNTRY_RECRUITMENT_ECOSYSTEM = {
  Philippines: ['POEA licensed agencies', 'overseas manpower agencies', 'deployment agencies abroad', 'work abroad recruitment Philippines', 'OFW recruitment agencies', 'direct hiring abroad Philippines'],
  Poland: ['agencja pracy USA', 'program work and travel USA'],
  Kazakhstan: ['агентство работа в сша', 'стажировка сша агентство'],
  Madagascar: ['agence de placement USA Madagascar', 'recrutement saisonnier USA Madagascar']
};

const GLOBAL_J1_INTENTS = ['Work and Travel USA', 'J1 visa agency', 'student exchange USA', 'internship USA agency', 'hotel trainee USA', 'seasonal USA jobs students'];

const LOCAL_TRANSLATIONS = {
  en: ['work abroad agency', 'overseas recruitment', 'international placement'],
  fr: ['agence recrutement international', 'programme échange USA', 'agence de placement USA'],
  es: ['agencia de empleo en el extranjero', 'intercambio USA', 'prácticas USA'],
  pt: ['agência trabalho no exterior', 'intercâmbio EUA', 'estágio EUA'],
  tl: ['ahensya trabaho abroad', 'work and travel usa', 'recruitment overseas jobs'],
  vi: ['thực tập mỹ', 'việc làm mỹ chương trình', 'tuyển dụng đi mỹ'],
  ar: ['وكالة توظيف بالخارج', 'برنامج تبادل امريكا', 'تدريب امريكا'],
  zh: ['美国 实习 中介', '美国 交换 项目', '美国 工作 项目'],
  pl: ['agencja j1 usa', 'work and travel usa', 'staż usa'],
  uk: ['агенція j1 сша', 'обмінна програма сша', 'стажування сша'],
  ru: ['агентство j1 сша', 'программа обмена сша', 'стажировка сша'],
  kk: ['j1 агенттігі ақш', 'ақш тағылымдама бағдарламасы'],
  tr: ['j1 ajansı abd', 'abd staj programı', 'work and travel abd'],
  th: ['เอเจนซี่ j1 usa', 'โครงการฝึกงาน usa', 'work and travel usa'],
  mg: ['agence de placement usa', 'asa any ivelany usa']
};

const CATEGORY_QUERIES = {
  agencies: ['recruitment agency abroad', 'overseas placement agency'],
  hotels: ['hotel employer hospitality trainees'],
  resorts: ['resort recruitment abroad'],
  restaurants: ['restaurant employer abroad'],
  hospitalityGroups: ['hospitality group recruitment'],
  seasonalEmployers: ['seasonal employer recruitment'],
  tourismOperators: ['tourism operator staffing abroad'],
  schools: ['hospitality school usa pathway', 'tourism college usa training'],
  usaOrganizations: ['exchange visitor organization usa']
};

const getLanguages = (country) => LANGUAGE_MAP[country] || ['en'];
const tldSet = (country) => [COUNTRY_TLD[country] || country.slice(0, 2).toLowerCase()];

function makeLayeredQueries({ categories, city, state, country, isFallback = false }) {
  const loc = [city, state].filter(Boolean).join(', ');
  const langs = getLanguages(country);

  const localTerms = langs.flatMap((l) => LOCAL_TRANSLATIONS[l] || LOCAL_TRANSLATIONS.en);
  const ecosystemTerms = COUNTRY_RECRUITMENT_ECOSYSTEM[country] || [];
  const layers = [];

  // Pass 1 English queries
  layers.push(...GLOBAL_J1_INTENTS.map((q) => ({ layer: 'pass1_english', query: `${country} ${q}` })));

  // Pass 2 Local-language queries
  layers.push(...localTerms.map((q) => ({ layer: 'pass2_local_language', query: `${country} ${q}` })));

  // Pass 3 Hybrid intent
  layers.push(...categories.flatMap((cat) => (CATEGORY_QUERIES[cat] || []).map((q) => ({ layer: 'pass3_hybrid', query: `${country} ${q} USA` }))));
  layers.push(...ecosystemTerms.map((q) => ({ layer: 'pass3_hybrid', query: q.includes(country) ? q : `${country} ${q}` })));

  // Pass 4 Social discovery
  layers.push({ layer: 'pass4_social', query: `facebook work abroad ${country}` });
  layers.push({ layer: 'pass4_social', query: `facebook recruitment agency ${country}` });
  layers.push({ layer: 'pass4_social', query: `facebook summer work travel ${country}` });

  // Pass 5 Directories/forums/portals
  layers.push({ layer: 'pass5_directories', query: `${country} business directory recruitment` });
  layers.push({ layer: 'pass5_directories', query: `${country} hospitality schools directory` });
  layers.push({ layer: 'pass5_directories', query: `${country} recruitment board overseas jobs` });
  layers.push({ layer: 'pass5_forums', query: `forum work abroad ${country}` });
  layers.push({ layer: 'pass5_forums', query: `reddit ${country} work and travel usa` });

  // local domain scanner booster
  for (const tld of tldSet(country)) {
    layers.push({ layer: 'local_domain_scan', query: `site:.${tld} ${country} recruitment agency usa` });
    layers.push({ layer: 'local_domain_scan', query: `site:.${tld} ${country} work abroad agency` });
  }

  if (isFallback) {
    layers.push({ layer: 'fallback', query: `${country} facebook page work abroad` });
    layers.push({ layer: 'fallback', query: `${country} agency students usa pathway` });
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

  return mode === 'full' ? uniq : uniq.slice(0, Math.max(limit * 6, 100));
}
