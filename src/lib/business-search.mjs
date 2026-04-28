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
    limit
  };
}

function hasContactChannel(lead) {
  return Boolean(lead.website || lead.facebookUrl || lead.contactApplyPage || lead.emails.length);
}

export async function runBusinessContactSearch(input, userAgent) {
  const discovered = await discoverBusinesses({ ...input, userAgent });
  const leads = [];

  for (const place of discovered) {
    const enriched = await enrichLeadFromWebsite(place, userAgent);

    if (!hasContactChannel(enriched)) continue;
    if (!enriched.relevance.detected) continue;

    leads.push({
      businessName: place.name,
      location: place.address,
      website: enriched.website,
      email: enriched.emails[0] || null,
      facebookUrl: enriched.facebookUrl,
      instagramUrl: enriched.instagramUrl,
      contactApplyPage: enriched.contactApplyPage,
      relevanceType: enriched.relevance.relevanceType,
      leadScore: enriched.relevance.leadScore,
      source: place.source,
      discoveryIntent: place.query
    });

    if (leads.length >= input.limit) {
      break;
    }
  }

  return {
    requested: {
      ...input,
      categories: input.categories.map((category) => CATEGORY_LABELS[category])
    },
    scannedBusinesses: discovered.length,
    matchedBusinesses: leads.length,
    results: leads
  };
}
