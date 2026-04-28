const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g;

const EXCLUSION_SIGNALS = ['backpacking', 'travel blog', 'volunteer', 'tour package', 'embassy', 'state department', 'visa news', 'immigration law', 'affiliate', 'top 10'];

const J1_CORE_SIGNALS = [
  'j1 visa',
  'bridgeusa',
  'exchange visitor program',
  'ds-2019',
  'ds 2019',
  'ds-7002',
  'cultural exchange programs usa',
  'hospitality trainee usa',
  'intern usa program',
  'summer work travel usa'
];

const J1_HIDDEN_SIGNALS = [
  'trainee program usa',
  'hotel internship usa',
  'exchange program usa',
  'work & study usa',
  'work and study usa',
  'international hospitality training usa',
  'usa placement',
  'hospitality placement usa',
  'internship usa'
];

const GENERAL_AGENCY_SIGNALS = ['overseas recruitment', 'work abroad agency', 'manpower agency', 'deployment agency', 'international placement'];
const HOSPITALITY_SCHOOL_SIGNALS = ['hospitality school', 'culinary school', 'tourism college', 'hotel school', 'academy of hospitality'];

const COUNTRY_PHONE_HINTS = { madagascar: ['+261'], nepal: ['+977'], ghana: ['+233'], philippines: ['+63'] };
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

const makeAbsoluteUrl = (url, base) => { try { return new URL(url, base).toString(); } catch { return null; } };

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
  if (exclusions.length) {
    return { detected: false, rejected: true, rejectionReason: 'excluded_content', leadScore: 'Reject', relevanceType: 'Indirect Lead', outputBucket: 'Indirect recruiters', tags: ['Indirect Lead'] };
  }

  const j1CoreHits = hasAny(textBlob, J1_CORE_SIGNALS);
  const j1HiddenHits = hasAny(textBlob, J1_HIDDEN_SIGNALS);
  const usaPlacementHits = hasAny(textBlob, ['usa placement', 'placement in usa', 'placement america', 'work in usa', 'internship usa']);
  const trainingExchangeHits = hasAny(textBlob, ['training', 'trainee', 'exchange', 'internship', 'hospitality training']);

  const generalAgencyHits = hasAny(textBlob, GENERAL_AGENCY_SIGNALS);
  const schoolHits = hasAny(textBlob, HOSPITALITY_SCHOOL_SIGNALS);

  // Re-ranking boost: USA placement + training/exchange/intern wording => J1 bucket
  const j1Boost = usaPlacementHits.length > 0 && trainingExchangeHits.length > 0;

  if (j1CoreHits.length || j1HiddenHits.length || j1Boost) {
    return {
      detected: true,
      rejected: false,
      leadScore: 'High',
      relevanceType: 'J1 / BridgeUSA ecosystem',
      outputBucket: 'J1 / BridgeUSA ecosystem (HIGH PRIORITY)',
      tags: ['Local Agency', 'J1 Recruiter'],
      semanticHits: { j1CoreHits, j1HiddenHits, usaPlacementHits, trainingExchangeHits }
    };
  }

  if (schoolHits.length) {
    return {
      detected: true,
      rejected: false,
      leadScore: 'Medium',
      relevanceType: 'Hospitality School',
      outputBucket: 'Hospitality schools',
      tags: ['Hospitality School'],
      semanticHits: { schoolHits }
    };
  }

  if (generalAgencyHits.length) {
    return {
      detected: true,
      rejected: false,
      leadScore: 'Medium',
      relevanceType: 'General overseas employment agency',
      outputBucket: 'General overseas employment agencies',
      tags: ['Indirect Lead'],
      semanticHits: { generalAgencyHits }
    };
  }

  return {
    detected: true,
    rejected: false,
    leadScore: 'Low',
    relevanceType: 'Indirect Lead',
    outputBucket: 'Indirect recruiters',
    tags: ['Indirect Lead'],
    semanticHits: {}
  };
}

function classifyDestination(textBlob) {
  const l = lower(textBlob);
  if (/\b(usa|united states|america|u\.s\.)\b/.test(l)) return 'USA-bound';
  if (/\b(europe|uk|germany|france|italy|spain|poland)\b/.test(l)) return 'Europe-bound';
  if (/\b(middle east|uae|saudi|qatar|kuwait|oman)\b/.test(l)) return 'Middle East-bound';
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
    return { website: null, emails: [], facebookUrl: null, instagramUrl: null, linkedinUrl: null, whatsappUrl: null, phoneNumbers: [], contactApplyPage: null, formPage: null, visited, relevance: { detected: false, rejected: true, rejectionReason: 'no_site', leadScore: 'Reject', relevanceType: 'Indirect Lead', outputBucket: 'Indirect recruiters', tags: ['Indirect Lead'] }, destination: 'General abroad', locality: { localScore: 0, isLocal: false, isUSBased: false, foreignWithLocal: false, usHints: [], localitySignals: {} } };
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

  debugLog('lead.intent', { name: place.name, relevance, locality, destination });

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
