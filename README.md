# USA Partner Lead Engine (Local-Country First)

## What this update fixes

- Restores employer categories: Hotels, Resorts, Restaurants, Hospitality Groups, Seasonal Employers, Tourism Operators.
- Prioritizes country-local results (example: Madagascar should show Madagascar organizations first).
- Expands local-market discovery with French/local query variants.
- Keeps broad contact acceptance (website/Facebook/Instagram/LinkedIn/WhatsApp/phone/contact form).
- Adds UI filters for Agencies/Hotels/Restaurants/Schools/USA Organizations/Facebook-only/Website-only.

## Search category modes

You can combine categories to create practical modes:

- Agencies only
- Employers only
- Agencies + Employers
- Schools only
- All categories

## Ranking behavior

For a country search (e.g., Madagascar), ranking is local-first:

1. Local agencies
2. Local hotels/restaurants/employers
3. Local schools
4. Regional/foreign with local signal
5. U.S.-based fallback organizations

## Exports and table

- Export CSV
- Export Excel
- Copy Emails / Websites / Facebook
- Sortable compact table: `Email | Website | Facebook | Name | Score`

## Run

```bash
cp .env.example .env
npm install
npm start
```
