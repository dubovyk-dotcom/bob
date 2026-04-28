const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g;

const INTENT_KEYWORDS = {
  high: ['j1', 'exchange visitor', 'ds-2019', 'bridgeusa', 'work and travel usa', 'visa sponsor', 'seasonal work usa', 'camp counselor'],
  medium: ['internship usa', 'hospitality placement', 'culinary training', 'trainee program', 'student jobs abroad', 'cultural exchange'],
  low: ['overseas recruitment', 'work abroad', 'placement agency', 'travel agency', 'au pair']
};

const FIXED_PATHS = ['/contact', '/about', '/apply', '/careers', '/jobs', '/internships'];

function normalizeWebsiteUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).toString();
  } catch {
    try {
      return new URL(`https://${url}`).toString();
    } catch {
      return null;
    }
  }
}

function extractEmails(text) {
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches.map((e) => e.toLowerCase()))].filter((e) => !e.endsWith('.png') && !e.includes('example.com'));
}

function extractPhones(text) {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches.map((p) => p.trim()))].filter((p) => p.replace(/\D/g, '').length >= 8);
}

function extractSocialLinks(text) {
  const urls = text.match(URL_REGEX) || [];
  return {
    facebook: urls.find((u) => /facebook\.com/i.test(u)) || null,
    instagram: urls.find((u) => /instagram\.com/i.test(u)) || null,
    linkedin: urls.find((u) => /linkedin\.com/i.test(u)) || null,
    whatsapp: urls.find((u) => /wa\.me|whatsapp\.com/i.test(u)) || null
  };
}

function makeAbsoluteUrl(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function extractLinks(html, baseUrl) {
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  const contactApplyPages = [];
  const formPages = [];
  const mailto = [];
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    const lower = href.toLowerCase();

    if (lower.startsWith('mailto:')) {
      mailto.push(href.replace(/^mailto:/i, '').trim());
      continue;
    }

    if (/(contact|about|apply|join|recruit|program|internship|career|job|form)/i.test(lower)) {
      const abs = makeAbsoluteUrl(href, baseUrl);
      if (abs) contactApplyPages.push(abs);
    }

    if (/(apply|contact|join|register|form)/i.test(lower)) {
      const abs = makeAbsoluteUrl(href, baseUrl);
      if (abs) formPages.push(abs);
    }
  }

  return {
    contactApplyPages: [...new Set(contactApplyPages)],
    formPages: [...new Set(formPages)],
    mailto
  };
}

async function fetchTextWithRetry(url, userAgent, debugLog, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        debugLog('crawl.http_error', { url, status: response.status, attempt });
        continue;
      }

      const type = response.headers.get('content-type') || '';
      if (!type.includes('text/html') && !type.includes('text/plain')) {
        debugLog('crawl.skipped_non_text', { url, type, attempt });
        return null;
      }

      const text = await response.text();
      debugLog('crawl.success', { url, attempt, bytes: text.length });
      return text;
    } catch (error) {
      debugLog('crawl.error', { url, attempt, error: error.message });
      if (attempt === retries + 1) return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

function keywordHits(textBlob) {
  const lowered = (textBlob || '').toLowerCase();
  const hits = { high: [], medium: [], low: [] };

  for (const tier of ['high', 'medium', 'low']) {
    for (const keyword of INTENT_KEYWORDS[tier]) {
      if (lowered.includes(keyword)) hits[tier].push(keyword);
    }
  }

  return hits;
}

function scoreRelevance(textBlob) {
  const hits = keywordHits(textBlob);

  if (hits.high.length) {
    return { detected: true, leadScore: 'High', relevanceType: 'J1-related', hits };
  }
  if (hits.medium.length) {
    return { detected: true, leadScore: 'Medium', relevanceType: 'Hospitality training', hits };
  }
  if (hits.low.length) {
    return { detected: true, leadScore: 'Low', relevanceType: 'Recruitment / placement', hits };
  }

  return { detected: false, leadScore: 'Low', relevanceType: 'Indirect travel agency', hits };
}

function collectFixedPaths(website) {
  return FIXED_PATHS.map((path) => makeAbsoluteUrl(path, website)).filter(Boolean);
}

export async function enrichLeadFromWebsite(place, userAgent, debugLog = () => {}) {
  const website = normalizeWebsiteUrl(place.website);
  const contactPages = new Set();
  const formPages = new Set();
  const emails = new Set();
  const phones = new Set();
  let facebookUrl = null;
  let instagramUrl = null;
  let linkedinUrl = null;
  let whatsappUrl = null;
  let combinedText = '';
  const visited = [];

  if (!website) {
    debugLog('lead.reject', { name: place.name, reason: 'no_site' });
    return {
      website: null,
      emails: [],
      facebookUrl: null,
      instagramUrl: null,
      linkedinUrl: null,
      whatsappUrl: null,
      phoneNumbers: [],
      contactApplyPage: null,
      formPage: null,
      visited,
      relevance: { detected: false, leadScore: 'Low', relevanceType: 'Indirect travel agency', hits: { high: [], medium: [], low: [] } }
    };
  }

  const urlsToVisit = new Set([website, ...collectFixedPaths(website)]);

  const crawlAndExtract = async (url) => {
    visited.push(url);
    debugLog('crawl.visit', { name: place.name, url });

    const html = await fetchTextWithRetry(url, userAgent, debugLog);
    if (!html) return;

    combinedText += ` ${html}`;

    extractEmails(html).forEach((email) => emails.add(email));
    extractPhones(html).forEach((phone) => phones.add(phone));

    const socials = extractSocialLinks(html);
    facebookUrl = facebookUrl || socials.facebook;
    instagramUrl = instagramUrl || socials.instagram;
    linkedinUrl = linkedinUrl || socials.linkedin;
    whatsappUrl = whatsappUrl || socials.whatsapp;

    const links = extractLinks(html, url);
    links.mailto.forEach((mail) => emails.add(mail.toLowerCase()));
    links.contactApplyPages.forEach((page) => contactPages.add(page));
    links.formPages.forEach((page) => formPages.add(page));
  };

  for (const url of urlsToVisit) {
    await crawlAndExtract(url);
  }

  for (const url of [...contactPages].slice(0, 6)) {
    if (!visited.includes(url)) {
      await crawlAndExtract(url);
    }
  }

  const relevance = scoreRelevance(combinedText);
  debugLog('lead.intent', { name: place.name, hits: relevance.hits, score: relevance.leadScore, relevanceType: relevance.relevanceType });
  debugLog('lead.contacts', {
    name: place.name,
    emails: [...emails],
    facebookUrl,
    instagramUrl,
    linkedinUrl,
    whatsappUrl,
    phoneNumbers: [...phones],
    contactApplyPages: [...contactPages],
    formPages: [...formPages]
  });

  return {
    website,
    emails: [...emails],
    facebookUrl,
    instagramUrl,
    linkedinUrl,
    whatsappUrl,
    phoneNumbers: [...phones],
    contactApplyPage: [...contactPages][0] || null,
    formPage: [...formPages][0] || null,
    visited,
    relevance
  };
}
