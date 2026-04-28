# Global J1 / USA Partner Discovery Engine

## Final Master Upgrade

- Worldwide country support with country language model + English fallback.
- Multi-pass discovery (English, local language, hybrid, social, directories/forums).
- Expanded J1 semantic detection (J1, BridgeUSA, Exchange Visitor, DS-2019, DS-7002, Summer Work Travel, trainee/intern USA signals).
- Hidden J1 re-ranking boost: USA placement + training/exchange/intern wording => J1 bucket.
- Output buckets:
  - J1 / BridgeUSA ecosystem (HIGH PRIORITY)
  - General overseas employment agencies
  - Hospitality schools
  - Indirect recruiters
- Contact acceptance remains broad (email not required).

## Export (Production-grade)

Uses **exceljs** for real `.xlsx` generation with:

- bold header row
- autofilter
- auto column width
- clickable links (email/website/facebook)
- UTF-8 clean export

Also supports `.csv` export.

## UI Filters

- J1 Agencies
- Work and Travel USA
- Schools
- Hotels
- Restaurants
- Recruiters
- Facebook-only leads
- Website-only leads

## Run

```bash
cp .env.example .env
npm install
npm start
```
