const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g;

const USA_SIGNALS = ['usa', 'united states', 'america', 'work and travel usa', 'internship usa', 'j1', 'bridgeusa', 'ds-2019', 'u.s. hospitality', 'u.s. seasonal', 'placement in america'];
const HIGH_SIGNALS = ['work and travel usa', 'j1', 'ds-2019', 'bridgeusa', 'usa internship placement', 'seasonal work usa recruiter'];
const MEDIUM_SIGNALS = ['hospitality school usa internship', 'culinary school usa training', 'exchange visitor partner', 'usa training program'];
const LOW_SIGNALS = ['student exchange', 'overseas recruitment usa', 'study and work usa'];

const EXCLUSION_SIGNALS = [
  'backpacking',
  'travel blog',
  'volunteer',
  'tour package',
  'embassy',
  'state department',
  'visa news',
  'immigration law',
  'affiliate',
  'top 10',
  'best places to travel'
];

const FIXED_PATHS = ['/contact', '/about', '/apply', '/careers', '/jobs', '/internships'];

function normalizeWebsiteUrl(url) {
  if (!url) return null;
  try { return new URL(url).toString(); } catch {
    try { return new URL(`https://${url}`).toString(); } catch { return null; }
  }
}

const unique = (arr) => [...new Set(arr)];
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

function makeAbsoluteUrl(url, base) { try { return new URL(url, base).toString(); } catch { return null; } }

function extractLinks(html, baseUrl) {
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  const contactApplyPages = []; const formPages = []; const mailto = [];
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    const lower = href.toLowerCase();
    if (lower.startsWith('mailto:')) { mailto.push(href.replace(/^mailto:/i, '').trim()); continue; }
    if (/(contact|about|apply|join|recruit|program|internship|career|job|form)/i.test(lower)) {
      const abs = makeAbsoluteUrl(href, baseUrl); if (abs) contactApplyPages.push(abs);
    }
    if (/(apply|contact|join|register|form)/i.test(lower)) {
      const abs = makeAbsoluteUrl(href, baseUrl); if (abs) formPages.push(abs);
    }
  }
  return { contactApplyPages: unique(contactApplyPages), formPages: unique(formPages), mailto };
}

async function fetchTextWithRetry(url, userAgent, debugLog, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
        signal: controller.signal
      });
      if (!response.ok) { debugLog('crawl.http_error', { url, status: response.status, attempt }); continue; }
      const type = response.headers.get('content-type') || '';
      if (!type.includes('text/html') && !type.includes('text/plain')) return null;
      const text = await response.text();
      debugLog('crawl.success', { url, attempt, bytes: text.length });
      return text;
    } catch (error) {
      debugLog('crawl.error', { url, attempt, error: error.message });
      if (attempt === retries + 1) return null;
    } finally { clearTimeout(timer); }
  }
  return null;
}

function hasAny(text, words) {
  const lower = (text || '').toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase()));
}

function scoreRelevance(textBlob) {
  const exclusionHits = hasAny(textBlob, EXCLUSION_SIGNALS);
  if (exclusionHits.length) return { detected: false, rejected: true, rejectionReason: 'excluded_content', leadScore: 'Reject', relevanceType: 'Irrelevant', hits: { exclusionHits } };

  const usaHits = hasAny(textBlob, USA_SIGNALS);
  if (!usaHits.length) return { detected: false, rejected: true, rejectionReason: 'no_usa_signal', leadScore: 'Reject', relevanceType: 'No USA pipeline', hits: { usaHits } };

  const highHits = hasAny(textBlob, HIGH_SIGNALS);
  const mediumHits = hasAny(textBlob, MEDIUM_SIGNALS);
  const lowHits = hasAny(textBlob, LOW_SIGNALS);

  if (highHits.length) return { detected: true, rejected: false, leadScore: 'High', relevanceType: 'Direct USA recruitment / placement', hits: { usaHits, highHits, mediumHits, lowHits } };
  if (mediumHits.length) return { detected: true, rejected: false, leadScore: 'Medium', relevanceType: 'School/agency with USA pathway', hits: { usaHits, highHits, mediumHits, lowHits } };
  if (lowHits.length || usaHits.length) return { detected: true, rejected: false, leadScore: 'Low', relevanceType: 'Indirect USA partner', hits: { usaHits, highHits, mediumHits, lowHits } };

  return { detected: false, rejected: true, rejectionReason: 'insufficient_intent', leadScore: 'Reject', relevanceType: 'Irrelevant', hits: { usaHits, highHits, mediumHits, lowHits } };
}

const collectFixedPaths = (website) => FIXED_PATHS.map((path) => makeAbsoluteUrl(path, website)).filter(Boolean);

export async function enrichLeadFromWebsite(place, userAgent, debugLog = () => {}) {
  const website = normalizeWebsiteUrl(place.website);
  const contactPages = new Set(); const formPages = new Set();
  const emails = new Set(); const phones = new Set();
  let facebookUrl = null; let instagramUrl = null; let linkedinUrl = null; let whatsappUrl = null;
  let combinedText = ''; const visited = [];

  if (!website) {
    debugLog('lead.reject', { name: place.name, reason: 'no_site' });
    return { website: null, emails: [], facebookUrl: null, instagramUrl: null, linkedinUrl: null, whatsappUrl: null, phoneNumbers: [], contactApplyPage: null, formPage: null, visited, relevance: { detected: false, rejected: true, rejectionReason: 'no_site', leadScore: 'Reject', relevanceType: 'Irrelevant', hits: {} } };
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

  for (const url of urlsToVisit) await crawlAndExtract(url);
  for (const url of [...contactPages].slice(0, 6)) if (!visited.includes(url)) await crawlAndExtract(url);

  const relevance = scoreRelevance(combinedText);
  debugLog('lead.intent', { name: place.name, score: relevance.leadScore, relevanceType: relevance.relevanceType, hits: relevance.hits, rejectionReason: relevance.rejectionReason || null });

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
