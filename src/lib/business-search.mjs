import { discoverBusinesses, CATEGORY_LABELS } from './discovery-providers.mjs';
import { enrichLeadFromWebsite } from './website-crawler.mjs';

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));
const VALID_MODES = new Set(['fast', 'full']);
const VALID_EXPORT = new Set(['csv', 'xlsx']);

export function validateInput(payload) {
  const categories = Array.isArray(payload.categories) ? payload.categories.filter((c) => VALID_CATEGORIES.has(c)) : [];
  if (!categories.length) throw new Error('Choose at least one subject block.');
  if (!payload.country || !payload.country.trim()) throw new Error('Country is required.');

  const limit = Number(payload.limit) || 25;
  if (limit < 1 || limit > 500) throw new Error('Limit must be between 1 and 500.');

  return {
    categories,
    city: (payload.city || '').trim(),
    state: (payload.state || '').trim(),
    country: payload.country.trim(),
    limit,
    mode: VALID_MODES.has(payload.mode) ? payload.mode : 'fast',
    debug: Boolean(payload.debug),
    export: VALID_EXPORT.has(payload.export) ? payload.export : 'csv'
  };
}

const rankOrder = (score) => (score === 'High' ? 3 : score === 'Medium' ? 2 : score === 'Low' ? 1 : 0);
const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
};

const hasContactChannel = (lead) => Boolean(lead.website || lead.facebookUrl || lead.instagramUrl || lead.contactApplyPage || lead.emails?.length);

function exportRows(results) {
  return results.map((lead) => ({
    Email: lead.email || '',
    Website: lead.website || '',
    Facebook: lead.facebookUrl || '',
    'Business Name': lead.businessName || '',
    Country: lead.country || '',
    'Contact Page': lead.contactApplyPage || '',
    Instagram: lead.instagramUrl || '',
    'Lead Score': lead.leadScore || '',
    'Relevance Type': lead.relevanceType || '',
    Notes: lead.notes || ''
  }));
}

function toCsv(results) {
  const rows = exportRows(results);
  const headers = Object.keys(rows[0] || {
    Email: '', Website: '', Facebook: '', 'Business Name': '', Country: '', 'Contact Page': '', Instagram: '', 'Lead Score': '', 'Relevance Type': '', Notes: ''
  });
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

function toExcelXml(results) {
  const rows = exportRows(results);
  const headers = Object.keys(rows[0] || {
    Email: '', Website: '', Facebook: '', 'Business Name': '', Country: '', 'Contact Page': '', Instagram: '', 'Lead Score': '', 'Relevance Type': '', Notes: ''
  });

  const cell = (value) => `<Cell><Data ss:Type="String">${String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</Data></Cell>`;
  const headerRow = `<Row>${headers.map(cell).join('')}</Row>`;
  const bodyRows = rows.map((row) => `<Row>${headers.map((h) => cell(row[h])).join('')}</Row>`).join('');

  return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Leads"><Table>${headerRow}${bodyRows}</Table></Worksheet></Workbook>`;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await mapper(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runBusinessContactSearch(input, userAgent) {
  const debugEvents = [];
  const debugLog = (event, detail) => {
    const entry = { ts: new Date().toISOString(), event, ...detail };
    debugEvents.push(entry);
    console.log(`[lead-engine] ${event}`, detail);
  };

  const startedAt = Date.now();
  const discovered = await discoverBusinesses({ ...input, userAgent, debugLog });

  const deduped = [];
  const seenDomains = new Set();
  const seenNames = new Set();
  const rejected = [];

  for (const place of discovered) {
    const domain = domainOf(place.website);
    const nameKey = (place.name || '').trim().toLowerCase();
    if (domain && seenDomains.has(domain)) {
      rejected.push({ name: place.name, reason: 'duplicate_domain' });
      continue;
    }
    if (nameKey && seenNames.has(nameKey)) {
      rejected.push({ name: place.name, reason: 'duplicate_organization' });
      continue;
    }
    if (domain) seenDomains.add(domain);
    if (nameKey) seenNames.add(nameKey);
    deduped.push(place);
  }

  const crawlQueue = input.mode === 'fast' ? deduped.slice(0, Math.max(input.limit * 3, 40)) : deduped;
  const concurrency = input.mode === 'fast' ? 6 : 12;
  let domainsCrawled = 0;
  let leadsQualified = 0;

  const enriched = await mapWithConcurrency(crawlQueue, concurrency, async (place, idx) => {
    debugLog('progress.tick', {
      sourcesScanned: debugEvents.filter((e) => e.event === 'query.start').length,
      domainsFound: crawlQueue.length,
      domainsCrawled,
      leadsQualified,
      leadsRemaining: Math.max(crawlQueue.length - idx - 1, 0)
    });

    const mined = await enrichLeadFromWebsite(place, userAgent, debugLog);
    domainsCrawled += mined.visited.length ? 1 : 0;

    if (!hasContactChannel(mined)) {
      rejected.push({ name: place.name, reason: 'no_contact_route' });
      return null;
    }

    if (!mined.relevance.detected || mined.relevance.rejected) {
      rejected.push({ name: place.name, reason: mined.relevance.rejectionReason || 'irrelevant_content' });
      return null;
    }

    leadsQualified += 1;

    return {
      email: mined.emails[0] || null,
      website: mined.website,
      facebookUrl: mined.facebookUrl,
      businessName: place.name,
      country: input.country,
      contactApplyPage: mined.contactApplyPage,
      instagramUrl: mined.instagramUrl,
      leadScore: mined.relevance.leadScore,
      relevanceType: mined.relevance.relevanceType,
      notes: `Source: ${place.source}; Query: ${place.query}`,
      discoveryIntent: place.query
    };
  });

  const ranked = enriched.filter(Boolean).sort((a, b) => rankOrder(b.leadScore) - rankOrder(a.leadScore));
  const results = input.mode === 'full' ? ranked : ranked.slice(0, input.limit);

  const response = {
    requested: {
      ...input,
      categories: input.categories.map((category) => CATEGORY_LABELS[category])
    },
    providerUsed: ['Nominatim', 'DuckDuckGo'],
    mode: input.mode,
    scannedBusinesses: discovered.length,
    domainsFound: crawlQueue.length,
    crawledBusinesses: domainsCrawled,
    matchedBusinesses: results.length,
    rejectedBusinesses: rejected.length,
    retriesUsed: debugEvents.filter((event) => event.event === 'fallback.trigger').length,
    elapsedMs: Date.now() - startedAt,
    progress: {
      sourcesScanned: debugEvents.filter((e) => e.event === 'query.start').length,
      domainsFound: crawlQueue.length,
      domainsCrawled,
      leadsQualified: results.length,
      leadsRemaining: Math.max(crawlQueue.length - domainsCrawled, 0)
    },
    results
  };

  const stamp = Date.now();
  if (input.export === 'xlsx') {
    response.export = {
      format: 'xlsx',
      filename: `lead-engine-${input.country.toLowerCase()}-${stamp}.xlsx`,
      content: toExcelXml(results)
    };
  } else {
    response.export = {
      format: 'csv',
      filename: `lead-engine-${input.country.toLowerCase()}-${stamp}.csv`,
      content: toCsv(results)
    };
  }

  if (input.debug) {
    response.debug = { events: debugEvents, rejected };
  }

  return response;
}
