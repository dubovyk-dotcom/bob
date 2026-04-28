import { discoverBusinesses, CATEGORY_LABELS } from './discovery-providers.mjs';
import { enrichLeadFromWebsite } from './website-crawler.mjs';

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));

export function validateInput(payload) {
  const categories = Array.isArray(payload.categories) ? payload.categories.filter((c) => VALID_CATEGORIES.has(c)) : [];

  if (categories.length === 0) {
    throw new Error('Choose at least one subject block.');
  }

  if (!payload.country || !payload.country.trim()) {
    throw new Error('Country is required.');
  }

  const limit = Number(payload.limit) || 25;
  if (limit < 1 || limit > 200) {
    throw new Error('Limit must be between 1 and 200.');
  }

  return {
    categories,
    city: (payload.city || '').trim(),
    state: (payload.state || '').trim(),
    country: payload.country.trim(),
    limit,
    debug: Boolean(payload.debug)
  };
}

function hasContactChannel(lead) {
  return Boolean(
    lead.website ||
      lead.facebookUrl ||
      lead.instagramUrl ||
      lead.linkedinUrl ||
      lead.whatsappUrl ||
      lead.contactApplyPage ||
      lead.formPage ||
      lead.phoneNumbers?.length ||
      lead.emails?.length
  );
}

function rankOrder(score) {
  if (score === 'High') return 3;
  if (score === 'Medium') return 2;
  return 1;
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
  debugLog('discovery.summary', { discovered: discovered.length });

  const leads = [];
  const rejected = [];
  let crawled = 0;

  for (const place of discovered) {
    const enriched = await enrichLeadFromWebsite(place, userAgent, debugLog);
    crawled += enriched.visited.length ? 1 : 0;

    if (!hasContactChannel(enriched)) {
      rejected.push({ name: place.name, reason: 'no_contact_route', source: place.source });
      debugLog('lead.reject', { name: place.name, reason: 'no_contact_route' });
      continue;
    }

    if (!enriched.relevance.detected) {
      rejected.push({ name: place.name, reason: 'irrelevant_content', source: place.source });
      debugLog('lead.reject', { name: place.name, reason: 'irrelevant_content' });
      continue;
    }

    leads.push({
      businessName: place.name,
      location: place.address,
      website: enriched.website,
      email: enriched.emails[0] || null,
      facebookUrl: enriched.facebookUrl,
      instagramUrl: enriched.instagramUrl,
      linkedinUrl: enriched.linkedinUrl,
      whatsappUrl: enriched.whatsappUrl,
      phoneNumbers: enriched.phoneNumbers,
      contactApplyPage: enriched.contactApplyPage,
      formPage: enriched.formPage,
      relevanceType: enriched.relevance.relevanceType,
      leadScore: enriched.relevance.leadScore,
      intentHits: enriched.relevance.hits,
      source: place.source,
      discoveryIntent: place.query
    });
  }

  const ranked = leads.sort((a, b) => rankOrder(b.leadScore) - rankOrder(a.leadScore));
  const highCount = ranked.filter((lead) => lead.leadScore === 'High').length;
  const finalResults = highCount ? ranked : ranked;

  const response = {
    requested: {
      ...input,
      categories: input.categories.map((category) => CATEGORY_LABELS[category])
    },
    providerUsed: ['Nominatim', 'DuckDuckGo'],
    scannedBusinesses: discovered.length,
    crawledBusinesses: crawled,
    matchedBusinesses: finalResults.length,
    rejectedBusinesses: rejected.length,
    retriesUsed: debugEvents.filter((event) => event.event === 'fallback.trigger').length,
    elapsedMs: Date.now() - startedAt,
    results: finalResults.slice(0, input.limit)
  };

  if (input.debug) {
    response.debug = {
      events: debugEvents,
      rejected
    };
  }

  if (response.results.length === 0) {
    debugLog('result.empty', { reason: 'no_discovered_or_qualified_leads' });
  }

  return response;
}
