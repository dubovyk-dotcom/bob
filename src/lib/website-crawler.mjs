const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;

const RELEVANCE_PATTERNS = {
  high: [
    /\bj-?1\b/i,
    /ds-?2019/i,
    /work\s*(and|&)\s*travel\s*usa/i,
    /exchange\s*visitor/i,
    /internship\s*abroad/i,
    /sponsor(ship|ed)?\s*program/i
  ],
  medium: [
    /hospitality\s*(trainee|training|internship)/i,
    /culinary\s*(internship|training)/i,
    /tourism\s*training/i,
    /international\s*student\s*(work|placement)/i,
    /overseas\s*(placement|recruitment)/i
  ],
  low: [
    /recruit(ment|ing)/i,
    /placement\s*services/i,
    /travel\s*agency/i,
    /work\s*abroad/i,
    /apply\s*now/i
  ]
};

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

function extractSocialLinks(text) {
  const urls = text.match(URL_REGEX) || [];
  const facebook = urls.find((u) => /facebook\.com/i.test(u)) || null;
  const instagram = urls.find((u) => /instagram\.com/i.test(u)) || null;
  return { facebook, instagram };
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
  const mailto = [];
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    const lower = href.toLowerCase();

    if (lower.startsWith('mailto:')) {
      mailto.push(href.replace(/^mailto:/i, '').trim());
      continue;
    }

    if (/(contact|about|apply|join|recruit|program|internship)/i.test(lower)) {
      const abs = makeAbsoluteUrl(href, baseUrl);
      if (abs) contactApplyPages.push(abs);
    }
  }

  return { contactApplyPages: [...new Set(contactApplyPages)].slice(0, 6), mailto };
}

async function fetchText(url, userAgent) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': userAgent }
    });

    if (!response.ok) return null;

    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('text/plain')) return null;

    return response.text();
  } catch {
    return null;
  }
}

function scoreRelevance(textBlob) {
  if (!textBlob) {
    return { detected: false, leadScore: 'Low', relevanceType: 'Indirect travel agency' };
  }

  const hitHigh = RELEVANCE_PATTERNS.high.some((rx) => rx.test(textBlob));
  if (hitHigh) {
    return { detected: true, leadScore: 'High', relevanceType: 'J1-related' };
  }

  const hitMedium = RELEVANCE_PATTERNS.medium.some((rx) => rx.test(textBlob));
  if (hitMedium) {
    return { detected: true, leadScore: 'Medium', relevanceType: 'Hospitality training' };
  }

  const hitLow = RELEVANCE_PATTERNS.low.some((rx) => rx.test(textBlob));
  if (hitLow) {
    return { detected: true, leadScore: 'Low', relevanceType: 'Recruitment / placement' };
  }

  return { detected: false, leadScore: 'Low', relevanceType: 'Indirect travel agency' };
}

export async function enrichLeadFromWebsite(place, userAgent) {
  const website = normalizeWebsiteUrl(place.website);
  const contactPages = [];
  const emails = new Set();
  let facebookUrl = null;
  let instagramUrl = null;
  let combinedText = '';

  if (!website) {
    return {
      website: null,
      emails: [],
      facebookUrl: null,
      instagramUrl: null,
      contactApplyPage: null,
      relevance: { detected: false, leadScore: 'Low', relevanceType: 'Indirect travel agency' }
    };
  }

  const home = await fetchText(website, userAgent);
  if (home) {
    combinedText += ` ${home}`;

    for (const email of extractEmails(home)) {
      emails.add(email);
    }

    const socials = extractSocialLinks(home);
    facebookUrl = socials.facebook || facebookUrl;
    instagramUrl = socials.instagram || instagramUrl;

    const links = extractLinks(home, website);
    links.mailto.forEach((mail) => emails.add(mail.toLowerCase()));
    contactPages.push(...links.contactApplyPages);
  }

  for (const pageUrl of [...new Set(contactPages)].slice(0, 4)) {
    const html = await fetchText(pageUrl, userAgent);
    if (!html) continue;
    combinedText += ` ${html}`;

    for (const email of extractEmails(html)) {
      emails.add(email);
    }

    const socials = extractSocialLinks(html);
    facebookUrl = facebookUrl || socials.facebook;
    instagramUrl = instagramUrl || socials.instagram;
  }

  const relevance = scoreRelevance(combinedText);
  if (!relevance.detected && /travel|recruit|placement|training/i.test(place.name || '')) {
    relevance.detected = true;
    relevance.relevanceType = 'Indirect travel agency';
  }

  return {
    website,
    emails: [...emails],
    facebookUrl,
    instagramUrl,
    contactApplyPage: contactPages[0] || null,
    relevance
  };
}
