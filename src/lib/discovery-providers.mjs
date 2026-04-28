const CATEGORY_QUERIES = {
  hotels: ['hotel', 'resort', 'hospitality internship'],
  restaurants: ['restaurant', 'culinary training', 'food service internship'],
  schools: ['hospitality school', 'tourism training institute', 'culinary academy'],
  j1Agencies: ['exchange visitor program agency', 'work and travel agency', 'visa sponsorship services']
};

const CORE_INTENTS = [
  'J1 visa program',
  'DS-2019 sponsorship',
  'Work and Travel USA',
  'internship abroad placement',
  'hospitality trainee program',
  'culinary hotel internship',
  'tourism training program',
  'international student work program',
  'overseas recruitment agency'
];

const NON_US_EXPANSION_INTENTS = [
  'overseas placement agency',
  'work abroad recruitment',
  'international student placement',
  'hospitality internship abroad',
  'travel agency work abroad program',
  'training abroad program'
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

function buildIntentQueries({ categories, city, state, country }) {
  const location = [city, state, country].filter(Boolean).join(', ');
  const categorySeeds = categories.flatMap((category) => CATEGORY_QUERIES[category] || []);
  const intents = [...CORE_INTENTS, ...categorySeeds];

  if (isNonUS(country)) {
    intents.push(...NON_US_EXPANSION_INTENTS);
  }

  return [...new Set(intents)].map((intent) => `${intent}, ${location}`);
}

function normalizePlace(place, query) {
  return {
    id: `${place.osm_type}-${place.osm_id}`,
    name: place.name || place.display_name?.split(',')[0] || 'Unnamed Place',
    address: place.display_name || '',
    website: place.extratags?.website || place.extratags?.contactwebsite || null,
    query,
    source: 'Nominatim'
  };
}

export async function discoverBusinesses({ categories, city, state, country, limit, userAgent }) {
  const queries = buildIntentQueries({ categories, city, state, country });
  const perQueryLimit = Math.max(4, Math.ceil((limit * 2) / Math.max(1, queries.length)));
  const all = [];

  for (const query of queries) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('namedetails', '1');
    url.searchParams.set('limit', String(perQueryLimit));

    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      continue;
    }

    const data = await response.json();
    all.push(...data.map((place) => normalizePlace(place, query)));
  }

  const deduped = [];
  const seen = new Set();
  for (const item of all) {
    const key = `${item.name}-${item.address}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.slice(0, limit * 2);
}
