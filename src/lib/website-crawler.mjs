const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g;

const EXCLUSION_SIGNALS = ['backpacking', 'travel blog', 'volunteer', 'tour package', 'embassy', 'state department', 'visa news', 'immigration law', 'affiliate', 'top 10'];

const RELEVANCE_SIGNALS = {
  agencies: ['work and travel usa', 'j1', 'ds-2019', 'bridgeusa', 'exchange visitor'],
  employers: ['hotel', 'resort', 'restaurant', 'hospitality group', 'seasonal employer', 'tourism operator'],
  schools: ['hospitality school', 'culinary school', 'tourism college', 'university']
};

const COUNTRY_PHONE_HINTS = {
  madagascar: ['+261'],
  nepal: ['+977'],
  ghana: ['+233']
};

const FIXED_PATHS = ['/contact', '/about', '/apply', '/careers', '/jobs', '/internships'];

const unique = (arr) => [...new Set(arr)];
const lower = (v = '') => v.toLowerCase();

function normalizeWebsiteUrl(url) {
  if (!url) return null;
  try { return new URL(url).toString(); } catch {
    try { return new URL(`https://${url}`).toString(); } catch { return null; }
  }
}

const extractEmails = (text) => unique((text.match(EMAIL_REGEX) || []).map((e) => e.toLowerCase())).filter((e) => !e.includes('example.com'));
const extractPhones = (text) => unique((text.match(PHONE_REGEX) || []).map((p) => p.trim())).filter((p) => p.replace(/\D/g, '').length >= 8);

function extractSocialLinks(text) {
  const urls = text.match(URL_REGEX) || [];
  return {
    facebook: urls.find((u) => /facebook\.com/i.test(u)) || null,
    instagram: urls.find((u) => /instagram\.com/i.test(u)) || null,
    linkedin: urls.find((u) => /linkedin\.com/i.test(u)) || null,
    whatsapp: urls.find((u) => /wa\.me|whatsapp\.com/i.test(u)) || null
  };
}

const makeAbsoluteUrl = (url, base) => {
  try { return new URL(url, base).toString(); } catch { return null; }
};

function extractLinks(html, baseUrl) {
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  const contactApplyPages = []; const formPages = []; const mailto = [];
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    const l = lower(href);
    if (l.startsWith('mailto:')) { mailto.push(href.replace(/^mailto:/i, '').trim()); continue; }
    if (/(contact|about|apply|join|recruit|program|internship|career|job|form|facebook)/i.test(l)) {
      const abs = makeAbsoluteUrl(href, baseUrl); if (abs) contactApplyPages.push(abs);
    }
    if (/(apply|contact|join|register|form)/i.test(l)) {
      const abs = makeAbsoluteUrl(href, baseUrl); if (abs) formPages.push(abs);
    }
  }
  return { contactApplyPages: unique(contactApplyPages), formPages: unique(formPages), mailto };
}

async function fetchTextWithRetry(url, userAgent, debugLog, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11000);
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' }, signal: controller.signal });
      if (!res.ok) { debugLog('crawl.http_error', { url, status: res.status, attempt }); continue; }
      const type = res.headers.get('content-type') || '';
      if (!type.includes('text/html') && !type.includes('text/plain')) return null;
      const text = await res.text();
      debugLog('crawl.success', { url, bytes: text.length, attempt });
      return text;
    } catch (error) {
      debugLog('crawl.error', { url, attempt, error: error.message });
      if (attempt === retries + 1) return null;
    } finally { clearTimeout(timer); }
  }
  return null;
}

function hasAny(text, terms) {
  const l = lower(text);
  return terms.filter((t) => l.includes(lower(t)));
}

function inferLocality({ textBlob, website, phones, country }) {
  const l = lower(textBlob);
  const c = lower(country);
  const phoneHints = COUNTRY_PHONE_HINTS[c] || [];
  const phoneMatch = phones.some((p) => phoneHints.some((hint) => p.includes(hint)));
  const textMatch = l.includes(c);
  const domainMatch = website ? lower(website).includes(`.${c.slice(0, 2)}`) || lower(website).includes(c) : false;
  const localScore = [textMatch, domainMatch, phoneMatch].filter(Boolean).length;

  const usHints = hasAny(l, ['usa', 'united states', 'u.s.', 'america']);
  const isUSBased = usHints.length > 0 && !textMatch;
  const foreignWithLocal = usHints.length > 0 && textMatch;

  return { localScore, isLocal: localScore > 0, isUSBased, foreignWithLocal, usHints, localitySignals: { textMatch, domainMatch, phoneMatch } };
}

function classifyLead(textBlob) {
  const exclusions = hasAny(textBlob, EXCLUSION_SIGNALS);
  if (exclusions.length) return { detected: false, rejected: true, rejectionReason: 'excluded_content', leadScore: 'Reject', relevanceType: 'Indirect Lead', tags: ['Indirect Lead'] };

  const agencyHits = hasAny(textBlob, RELEVANCE_SIGNALS.agencies);
  const employerHits = hasAny(textBlob, RELEVANCE_SIGNALS.employers);
  const schoolHits = hasAny(textBlob, RELEVANCE_SIGNALS.schools);

  let leadScore = 'Low';
  let relevanceType = 'Indirect Lead';
  const tags = [];

  if (agencyHits.length) {
    leadScore = 'High';
    relevanceType = 'J1 Recruiter';
    tags.push('Local Agency', 'J1 Recruiter');
  } else if (employerHits.length) {
    leadScore = 'Medium';
    relevanceType = employerHits.some((h) => h.includes('restaurant')) ? 'Restaurant Employer' : 'Hotel Employer';
    tags.push(relevanceType);
  } else if (schoolHits.length) {
    leadScore = 'Medium';
    relevanceType = schoolHits.some((h) => h.includes('tourism')) ? 'Tourism College' : 'Hospitality School';
    tags.push(relevanceType);
  }

  return { detected: agencyHits.length + employerHits.length + schoolHits.length > 0, rejected: false, leadScore, relevanceType, tags };
}


function classifyDestination(textBlob) {
  const l = lower(textBlob);
  const usa = /(usa|united states|america|u\.s\.)/.test(l);
  const europe = /(europe|uk|germany|france|italy|spain|poland)/.test(l);
  const me = /(middle east|uae|saudi|qatar|kuwait|oman)/.test(l);
  if (usa) return 'USA-bound';
  if (europe) return 'Europe-bound';
  if (me) return 'Middle East-bound';
  return 'General abroad';
}

export async function enrichLeadFromWebsite(place, userAgent, debugLog = () => {}, country = '') {
  const website = normalizeWebsiteUrl(place.website);
  const contactPages = new Set(); const formPages = new Set();
  const emails = new Set(); const phones = new Set();
  let facebookUrl = null; let instagramUrl = null; let linkedinUrl = null; let whatsappUrl = null;
  let combinedText = `${place.address || ''} ${place.name || ''}`;
  const visited = [];

  if (!website) {
    return { website: null, emails: [], facebookUrl: null, instagramUrl: null, linkedinUrl: null, whatsappUrl: null, phoneNumbers: [], contactApplyPage: null, formPage: null, visited, relevance: { detected: false, rejected: true, rejectionReason: 'no_site', leadScore: 'Reject', relevanceType: 'Indirect Lead', tags: ['Indirect Lead'] }, locality: { localScore: 0, isLocal: false, isUSBased: false, foreignWithLocal: false, usHints: [], localitySignals: {} } };
  }

  const urlsToVisit = new Set([website, ...FIXED_PATHS.map((p) => makeAbsoluteUrl(p, website)).filter(Boolean)]);

  const crawlAndExtract = async (url) => {
    visited.push(url);
    const html = await fetchTextWithRetry(url, userAgent, debugLog);
    if (!html) return;
    combinedText += ` ${html}`;
    extractEmails(html).forEach((x) => emails.add(x));
    extractPhones(html).forEach((x) => phones.add(x));
    const social = extractSocialLinks(html);
    facebookUrl = facebookUrl || social.facebook;
    instagramUrl = instagramUrl || social.instagram;
    linkedinUrl = linkedinUrl || social.linkedin;
    whatsappUrl = whatsappUrl || social.whatsapp;
    const links = extractLinks(html, url);
    links.mailto.forEach((x) => emails.add(x.toLowerCase()));
    links.contactApplyPages.forEach((x) => contactPages.add(x));
    links.formPages.forEach((x) => formPages.add(x));
  };

  for (const url of urlsToVisit) await crawlAndExtract(url);
  for (const url of [...contactPages].slice(0, 6)) if (!visited.includes(url)) await crawlAndExtract(url);

  const relevance = classifyLead(combinedText);
  const destination = classifyDestination(combinedText);
  const locality = inferLocality({ textBlob: combinedText, website, phones: [...phones], country });
  if (locality.isUSBased) relevance.tags = [...new Set([...(relevance.tags || []), 'U.S.-Based Organization'])];
  if (locality.foreignWithLocal) relevance.tags = [...new Set([...(relevance.tags || []), 'Local Agency'])];

  debugLog('lead.intent', { name: place.name, relevance, locality });

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
    relevance,
    destination,
    locality
  };
}
