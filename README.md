# USA Partner Lead Engine (True Discovery Mode)

This build uses a **multi-source global discovery crawler** instead of single search-only logic.

## 5 Discovery Layers per country search

1. Search engine basic (English + local language intents)
2. Local domain scan (`site:.countryTLD`, plus `.fr` for Francophone markets)
3. Facebook discovery queries
4. Directory/listing discovery queries
5. Forum/community discovery queries (incl. Reddit/expat/forum patterns)

## Global multilingual behavior

- country-level language model with English fallback
- local-language query generation for each country
- hybrid recruitment + USA query pass
- booster pass when discovery is weak

## Lead acceptance

Lead is valid with any contact route (email not required):
website, Facebook, Instagram, LinkedIn, WhatsApp, phone, or contact/apply page.

## Run

```bash
cp .env.example .env
npm install
npm start
```
