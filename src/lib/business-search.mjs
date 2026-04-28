import { discoverBusinesses, CATEGORY_LABELS } from './discovery-providers.mjs';
import { enrichLeadFromWebsite } from './website-crawler.mjs';

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));
const VALID_MODES = new Set(['fast', 'full']);
const VALID_EXPORT = new Set(['csv', 'xlsx']);

export function validateInput(payload) {
  const categories = Array.isArray(payload.categories) ? payload.categories.filter((c) => VALID_CATEGORIES.has(c)) : [];
  if (!categories.length) throw new Error('Choose at least one category.');
  if (!payload.country || !payload.country.trim()) throw new Error('Country is required.');

  return {
    categories,
    city: (payload.city || '').trim(),
    state: (payload.state || '').trim(),
    country: payload.country.trim(),
    limit: Math.min(Math.max(Number(payload.limit) || 25, 1), 500),
    mode: VALID_MODES.has(payload.mode) ? payload.mode : 'fast',
    debug: Boolean(payload.debug),
    export: VALID_EXPORT.has(payload.export) ? payload.export : 'csv'
  };
}

const scoreRank = (score) => (score === 'High' ? 3 : score === 'Medium' ? 2 : score === 'Low' ? 1 : 0);
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

const hasContactChannel = (lead) => Boolean(lead.website || lead.facebookUrl || lead.instagramUrl || lead.linkedinUrl || lead.whatsappUrl || lead.contactApplyPage || lead.formPage || lead.phoneNumbers?.length || lead.emails?.length);

function exportRows(results) {
  return results.map((lead) => ({
    Email: lead.email || '',
    Website: lead.website || '',
    Facebook: lead.facebookUrl || '',
    'Business Name': lead.businessName || '',
    Country: lead.country || '',
    'Contact Page': lead.contactApplyPage || '',
    Instagram: lead.instagramUrl || '',
    Category: lead.outputBucket || lead.relevanceType || '',
    'Lead Score': lead.leadScore || '',
    Notes: lead.notes || ''
  }));
}

function toCsv(results) {
  const rows = exportRows(results);
  const headers = Object.keys(rows[0] || { Email: '', Website: '', Facebook: '', 'Business Name': '', Country: '', 'Contact Page': '', Instagram: '', Category: '', 'Lead Score': '', Notes: '' });
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

async function toExcelWorkbookBase64(results) {
  const rows = exportRows(results);
  const headers = Object.keys(rows[0] || { Email: '', Website: '', Facebook: '', 'Business Name': '', Country: '', 'Contact Page': '', Instagram: '', Category: '', 'Lead Score': '', Notes: '' });

  let ExcelJS;
  try {
    ({ default: ExcelJS } = await import('exceljs'));
  } catch {
    const csvLike = toCsv(results);
    return Buffer.from(csvLike, 'utf8').toString('base64');
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leads');
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + headers.length) + '1' };

  for (const row of rows) {
    const values = headers.map((h) => row[h] ?? '');
    const added = sheet.addRow(values);
    const websiteIdx = headers.indexOf('Website') + 1;
    const fbIdx = headers.indexOf('Facebook') + 1;
    const emailIdx = headers.indexOf('Email') + 1;
    if (websiteIdx && row.Website) added.getCell(websiteIdx).value = { text: row.Website, hyperlink: row.Website };
    if (fbIdx && row.Facebook) added.getCell(fbIdx).value = { text: row.Facebook, hyperlink: row.Facebook };
    if (emailIdx && row.Email) added.getCell(emailIdx).value = { text: row.Email, hyperlink: `mailto:${row.Email}` };
  }

  headers.forEach((h, i) => {
    const max = Math.max(h.length, ...rows.map((r) => String(r[h] || '').length).slice(0, 200));
    sheet.getColumn(i + 1).width = Math.min(60, Math.max(14, max + 2));
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf).toString('base64');
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await mapper(items[idx], idx);
      }
    })
  );
  return out;
}

function localRankBoost(lead) {
  if (lead.locality?.isLocal) return 300;
  if (lead.locality?.foreignWithLocal) return 180;
  if (lead.locality?.isUSBased) return 10;
  return 50;
}

function categoryPriority(lead) {
  const rt = (lead.relevanceType || '').toLowerCase();
  if (rt.includes('j1') || rt.includes('agency') || rt.includes('recruiter')) return 5;
  if (rt.includes('hotel') || rt.includes('restaurant')) return 4;
  if (rt.includes('school') || rt.includes('college')) return 3;
  if (rt.includes('u.s.-based')) return 1;
  return 2;
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

  const crawlQueue = input.mode === 'fast' ? deduped.slice(0, Math.max(input.limit * 4, 50)) : deduped;
  const concurrency = input.mode === 'fast' ? 6 : 12;
  let domainsCrawled = 0;

  const mined = await mapWithConcurrency(crawlQueue, concurrency, async (place, idx) => {
    debugLog('progress.tick', {
      sourcesScanned: debugEvents.filter((e) => e.event === 'query.start').length,
      domainsFound: crawlQueue.length,
      domainsCrawled,
      leadsQualified: 0,
      leadsRemaining: Math.max(crawlQueue.length - idx - 1, 0)
    });

    const enriched = await enrichLeadFromWebsite(place, userAgent, debugLog, input.country);
    domainsCrawled += enriched.visited.length ? 1 : 0;

    if (!hasContactChannel(enriched)) {
      rejected.push({ name: place.name, reason: 'no_contact_route' });
      return null;
    }

    if (!enriched.relevance.detected || enriched.relevance.rejected) {
      if (!hasContactChannel(enriched)) {
        rejected.push({ name: place.name, reason: enriched.relevance.rejectionReason || 'irrelevant' });
        return null;
      }
    }

    return {
      email: enriched.emails[0] || null,
      website: enriched.website,
      facebookUrl: enriched.facebookUrl,
      businessName: place.name,
      country: input.country,
      contactApplyPage: enriched.contactApplyPage,
      instagramUrl: enriched.instagramUrl,
      linkedinUrl: enriched.linkedinUrl,
      whatsappUrl: enriched.whatsappUrl,
      phoneNumbers: enriched.phoneNumbers,
      leadScore: enriched.relevance.detected ? enriched.relevance.leadScore : 'Low',
      relevanceType: enriched.relevance.detected ? enriched.relevance.relevanceType : 'Indirect Lead',
      outputBucket: enriched.relevance.outputBucket || 'Indirect recruiters',
      destination: enriched.destination || 'General abroad',
      tags: enriched.relevance.tags || ['Indirect Lead'],
      locality: enriched.locality,
      notes: `Source: ${place.source}; Layer: ${place.layer || 'unknown'}; Query: ${place.query}; Local:${enriched.locality?.isLocal ? 'yes' : 'no'}`
    };
  });

  const ranked = mined
    .filter(Boolean)
    .sort((a, b) => (localRankBoost(b) + categoryPriority(b) * 10 + scoreRank(b.leadScore)) - (localRankBoost(a) + categoryPriority(a) * 10 + scoreRank(a.leadScore)));

  let results = input.mode === 'full' ? ranked : ranked.slice(0, input.limit);

  if (!results.length) {
    const partial = deduped
      .filter((p) => p.website)
      .slice(0, Math.max(5, input.limit))
      .map((p) => ({
        email: null,
        website: p.website,
        facebookUrl: p.website.includes("facebook.com") ? p.website : null,
        businessName: p.name,
        country: input.country,
        contactApplyPage: null,
        instagramUrl: null,
        linkedinUrl: null,
        whatsappUrl: null,
        phoneNumbers: [],
        leadScore: "Low",
        relevanceType: "Indirect Lead",
        outputBucket: "Indirect recruiters",
        destination: "General abroad",
        tags: ["Indirect Lead"],
        locality: { isLocal: true },
        notes: `Fallback discovery lead; Source: ${p.source}; Layer: ${p.layer || "unknown"}; Query: ${p.query}`
      }));
    if (partial.length) results = partial;
  }

  const bucketCounts = results.reduce((acc, lead) => {
    const key = lead.outputBucket || 'Indirect recruiters';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const response = {
    requested: { ...input, categories: input.categories.map((c) => CATEGORY_LABELS[c]) },
    providerUsed: ['Nominatim', 'DuckDuckGo'],
    mode: input.mode,
    scannedBusinesses: discovered.length,
    domainsFound: crawlQueue.length,
    crawledBusinesses: domainsCrawled,
    matchedBusinesses: results.length,
    rejectedBusinesses: rejected.length,
    retriesUsed: debugEvents.filter((e) => e.event === 'fallback.trigger').length,
    elapsedMs: Date.now() - startedAt,
    bucketCounts,
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
      encoding: 'base64',
      content: await toExcelWorkbookBase64(results)
    };
  } else {
    response.export = {
      format: 'csv',
      filename: `lead-engine-${input.country.toLowerCase()}-${stamp}.csv`,
      content: toCsv(results)
    };
  }

  if (input.debug) response.debug = { events: debugEvents, rejected };
  return response;
}
