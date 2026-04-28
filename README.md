# Business Contact Finder (Lead Engine Upgrade)

This project is now a **lead intelligence engine** (not a strict keyword/email scraper).

It discovers and ranks real business opportunities related to:

- J1 / Exchange Visitor programs
- DS-2019 sponsorship ecosystem
- Work and Travel USA
- Internship abroad placement
- Hospitality / culinary / tourism training pipelines
- International student work programs
- Overseas recruitment and placement agencies
- Indirect but relevant travel/recruitment providers

## What Changed (Critical)

Old behavior removed:

- strict keyword matching only
- email required to keep a result
- narrow exact-name filtering

New behavior:

- intent-based detection from website content
- includes indirect providers when relevant
- multi-channel contact extraction (email, Facebook, website, contact/apply pages)
- includes leads even when email is missing
- global expansion logic for non-US markets
- relevance scoring: High / Medium / Low

## Lead Qualification Rules

A result is included when:

1. relevance intent is detected from website content (or strong indirect signal), and
2. at least one contact route exists:
   - email, or
   - Facebook URL, or
   - website URL, or
   - contact/apply/recruitment page URL

## International Expansion Logic

For non-US countries, the engine automatically expands discovery with:

- overseas placement agency
- work abroad recruitment
- international student placement
- hospitality internship abroad
- travel agency work abroad program
- training abroad program

## Output Fields

Each lead returns:

- Business name
- Website
- Email (if available)
- Facebook URL (if available)
- Instagram URL (optional)
- Contact / Apply page URL (if available)
- Location
- Relevance type
- Lead score (High / Medium / Low)

## Run Locally

### Requirements

- Node.js 20+

### Setup

```bash
cp .env.example .env
npm install
npm start
```

Then open: [http://127.0.0.1:3005](http://127.0.0.1:3005)

### Commands

```bash
npm start
npm run dev
npm run check
```

## Key Files

- `server.mjs` — HTTP server + API endpoint
- `public/` — lead-engine web UI
- `src/lib/discovery-providers.mjs` — intent-driven place discovery
- `src/lib/website-crawler.mjs` — content analysis + contacts extraction + scoring
- `src/lib/business-search.mjs` — lead qualification and output shaping
