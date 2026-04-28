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
  UK: ['en'], France: ['fr', 'en'], Germany: ['de', 'en'], Spain: ['es', 'en'], Italy: ['it', 'en'], Poland: ['pl', 'en'], Ukraine: ['uk', 'ru', 'en'], Turkey: ['tr', 'en'],
  Morocco: ['ar', 'fr', 'en'], Algeria: ['ar', 'fr', 'en'], Tunisia: ['ar', 'fr', 'en'], Egypt: ['ar', 'en'], Nigeria: ['en'], Kenya: ['en', 'sw'], Ghana: ['en'], 'South Africa': ['en'], Ethiopia: ['am', 'en'], Madagascar: ['fr', 'mg', 'en'],
  China: ['zh', 'en'], Japan: ['ja', 'en'], 'South Korea': ['ko', 'en'], India: ['en', 'hi'], Pakistan: ['ur', 'en'], Bangladesh: ['bn', 'en'], Vietnam: ['vi', 'en'], Thailand: ['th', 'en'], Indonesia: ['id', 'en'], Philippines: ['en', 'tl'], Malaysia: ['ms', 'en'], 'Sri Lanka': ['si', 'en'], Nepal: ['ne', 'en'],
  UAE: ['ar', 'en'], 'Saudi Arabia': ['ar', 'en'], Qatar: ['ar', 'en'], Jordan: ['ar', 'en'], Israel: ['he', 'en'],
  Australia: ['en'], 'New Zealand': ['en']
};

const COUNTRY_TLD = {
  Madagascar: 'mg', China: 'cn', Brazil: 'br', Morocco: 'ma', Vietnam: 'vn', Nepal: 'np', Ghana: 'gh', Philippines: 'ph'
};

const ENGLISH_INTENTS = ['J1 visa agency', 'work and travel USA', 'internship USA', 'hospitality placement USA'];

const LOCAL_TRANSLATIONS = {
  fr: ['agence J1 USA', 'travail et voyage USA', 'stage USA', 'placement hôtellerie USA'],
  es: ['agencia J1 USA', 'trabajo y viaje USA', 'prácticas USA', 'colocación hospitalidad USA'],
  pt: ['agência J1 EUA', 'intercâmbio trabalho EUA', 'estágio EUA', 'colocação hotelaria EUA'],
  zh: ['J1 美国 项目', '美国 实习 中介', '出国 工作 美国', '美国 交换 项目'],
  vi: ['J1 Mỹ tuyển dụng', 'thực tập Mỹ', 'việc làm Mỹ chương trình', 'placement hospitality Mỹ'],
  ar: ['وكالة J1 امريكا', 'برنامج عمل وسفر امريكا', 'تدريب امريكا', 'توظيف ضيافة امريكا'],
  de: ['J1 Agentur USA', 'Work and Travel USA', 'Praktikum USA', 'Hotelvermittlung USA'],
  it: ['agenzia J1 USA', 'work and travel USA', 'tirocinio USA', 'collocamento ospitalità USA'],
  pl: ['agencja J1 USA', 'work and travel USA', 'staż USA', 'rekrutacja hotelarska USA'],
  tr: ['J1 ajansı ABD', 'work and travel ABD', 'staj ABD', 'otelcilik yerleştirme ABD'],
  uk: ['агенція J1 США', 'робота і подорож США', 'стажування США', 'готельне працевлаштування США'],
  ru: ['агентство J1 США', 'работа и путешествие США', 'стажировка США', 'гостиничное трудоустройство США'],
  ja: ['J1 代理店 アメリカ', 'ワークアンドトラベル アメリカ', 'インターン アメリカ', 'ホスピタリティ 配置 アメリカ'],
  ko: ['J1 에이전시 미국', '워크앤트래블 미국', '인턴십 미국', '호텔 취업 미국'],
  hi: ['J1 एजेंसी USA', 'वर्क एंड ट्रैवल USA', 'इंटर्नशिप USA', 'हॉस्पिटैलिटी प्लेसमेंट USA'],
  ur: ['J1 ایجنسی USA', 'ورک اینڈ ٹریول USA', 'انٹرن شپ USA', 'ہاسپیٹیلٹی پلیسمنٹ USA'],
  bn: ['J1 এজেন্সি USA', 'ওয়ার্ক অ্যান্ড ট্রাভেল USA', 'ইন্টার্নশিপ USA', 'হসপিটালিটি প্লেসমেন্ট USA'],
  th: ['เอเจนซี่ J1 สหรัฐ', 'work and travel USA', 'ฝึกงาน USA', 'จัดหางานโรงแรม USA'],
  id: ['agensi J1 USA', 'work and travel USA', 'magang USA', 'penempatan hospitality USA'],
  tl: ['ahensya J1 USA', 'work and travel USA', 'internship USA', 'hospitality placement USA'],
  ms: ['agensi J1 USA', 'work and travel USA', 'latihan industri USA', 'penempatan hospitaliti USA'],
  si: ['J1 ආයතනය USA', 'work and travel USA', 'internship USA', 'hospitality placement USA'],
  ne: ['J1 एजेन्सी USA', 'work and travel USA', 'internship USA', 'hospitality placement USA'],
  sw: ['wakala J1 USA', 'kazi na safari USA', 'internship USA', 'hospitality placement USA'],
  am: ['J1 ኤጀንሲ USA', 'work and travel USA', 'internship USA', 'hospitality placement USA'],
  he: ['סוכנות J1 ארה"ב', 'work and travel USA', 'התמחות USA', 'השמה אירוח USA'],
  mg: ['agence J1 USA', 'asa sy dia USA', 'stage USA', 'fametrahana hospitality USA']
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

function countryTld(country) {
  return COUNTRY_TLD[country] || country.slice(0, 2).toLowerCase();
}

function buildIntentQueries({ categories, city, state, country, isFallback = false }) {
  const loc = [city, state].filter(Boolean).join(', ');
  const langs = getLanguages(country);

  // PASS 1 English
  const pass1 = ENGLISH_INTENTS.map((q) => `${country} ${q}`);

  // PASS 2 local language
  const pass2 = langs.flatMap((lang) => (LOCAL_TRANSLATIONS[lang] || []).map((q) => `${country} ${q}`));

  // PASS 3 hybrid
  const categoryHybrid = categories.flatMap((cat) => (CATEGORY_QUERIES[cat] || []).map((q) => `${country} ${q} USA hospitality recruitment`));

  // PASS 4 social fallback
  const pass4 = [`${country} facebook work abroad agency`, `${country} facebook recruitment usa`, `${country} linkedin recruitment usa`];

  const booster = [`site:.${countryTld(country)} ${country} recruitment agency usa`, `${country} work abroad agency`, `facebook page work abroad ${country}`];

  const all = [...pass1, ...pass2, ...categoryHybrid, ...pass4, ...(isFallback ? booster : [])];
  return [...new Set(all)].map((q) => (loc ? `${q}, ${loc}` : q));
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
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: c.signal, redirect: 'follow' }); } finally { clearTimeout(t); }
}

async function discoverFromNominatim(query, userAgent, limit) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('limit', String(limit));
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!res.ok) return [];
  return (await res.json()).map((p) => normalizePlace(p, query, 'Nominatim'));
}

const stripTags = (v = '') => v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function discoverFromDuckDuckGo(query, userAgent, limit) {
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
    out.push(normalizePlace({ title: stripTags(m[2]), url: decoded, address: stripTags(m[2]) }, query, 'DuckDuckGo'));
  }
  return out;
}

export async function discoverBusinesses({ categories, city, state, country, limit, mode, userAgent, debugLog = () => {} }) {
  const run = async (isFallback) => {
    const queries = buildIntentQueries({ categories, city, state, country, isFallback });
    const perQuery = mode === 'full' ? 10 : Math.max(3, Math.ceil((limit * 2) / Math.max(1, queries.length)));
    const all = [];

    for (const query of queries) {
      debugLog('query.start', { query, providers: ['Nominatim', 'DuckDuckGo'], pass: isFallback ? 'booster' : 'main' });
      try {
        const [a, b] = await Promise.all([discoverFromNominatim(query, userAgent, perQuery), discoverFromDuckDuckGo(query, userAgent, perQuery)]);
        all.push(...a, ...b);
        debugLog('query.results', { query, nominatim: a.length, duckduckgo: b.length, total: a.length + b.length });
      } catch (e) {
        debugLog('query.error', { query, error: e.message });
      }
    }

    const dedup = [];
    const seen = new Set();
    for (const item of all) {
      const key = `${item.name}-${item.website || item.address}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(item);
    }
    return dedup;
  };

  let leads = await run(false);
  if (leads.length < 5) {
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

  return mode === 'full' ? uniq : uniq.slice(0, Math.max(limit * 5, 60));
}
