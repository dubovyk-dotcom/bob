# USA Partner Lead Engine (Global Multilingual)

This version upgrades discovery into a **global multilingual lead engine**.

## Highlights

- Region/country-based language model (English + local language fallback).
- 4-pass query engine for every search:
  1. English intent pass
  2. Local-language pass
  3. Hybrid country+recruitment+USA pass
  4. Social fallback pass (Facebook/LinkedIn focused)
- Local discovery booster when results are weak (`site:.tld`, recruitment agency boosters).
- Keeps broad contact acceptance (no email requirement).
- Local-country-first ranking and filtering.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Open: http://127.0.0.1:3005
