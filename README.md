# USA Partner Lead Engine (J1 Detection Fix)

This patch improves J1/BridgeUSA detection and bucketed output ranking.

## J1 semantic expansion

Engine now treats all of these as J1 ecosystem signals:

- J1 visa
- BridgeUSA
- Exchange Visitor Program
- DS-2019 sponsors
- DS-7002 traineeship
- cultural exchange programs USA
- hospitality trainee USA
- intern USA program
- summer work travel USA

## Hidden J1 signals

Also boosts J1 relevance for indirect phrasing:

- trainee program USA
- hotel internship USA
- exchange program USA
- work & study USA
- international hospitality training USA

## Re-ranking boost

If a lead has **USA placement + training/exchange/internship wording**, it is boosted into J1 / BridgeUSA bucket.

## Output buckets

Results now include bucket separation:

- J1 / BridgeUSA ecosystem (HIGH PRIORITY)
- General overseas employment agencies
- Hospitality schools
- Indirect recruiters

## Run

```bash
cp .env.example .env
npm install
npm start
```
