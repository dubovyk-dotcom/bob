# USA Partner Lead Engine

This build is optimized for **U.S.-focused partner lead generation**.

## Target Leads (only)

- J1 agencies
- Work and Travel USA recruiters
- USA internship placement agencies
- DS-2019 / BridgeUSA ecosystem partners
- hospitality/culinary/tourism schools with USA pathways
- seasonal USA worker recruiters

## Strict Exclusions

Automatically rejected:

- backpacking/travel blogs
- volunteer programs
- generic tours agencies
- embassy/state department pages
- visa news blogs / immigration law blogs
- local internships without USA pipeline
- affiliate/listicle content

## USA Intent Requirement

Leads are strongly filtered by USA signals like:

`USA`, `United States`, `America`, `Work and Travel USA`, `Internship USA`, `J1`, `BridgeUSA`, `DS-2019`.

## Search Modes

- **Fast Mode**: prioritize top results and return quickly.
- **Full Harvest Mode**: crawl all discovered candidates, no early stop.

## Exports

One-click exports in UI:

- CSV
- Excel (`.xlsx` spreadsheet XML output)

Export columns:

1. Email
2. Website
3. Facebook
4. Business Name
5. Country
6. Contact Page
7. Instagram
8. Lead Score
9. Relevance Type
10. Notes

## UI Utilities

- Export CSV
- Export Excel
- Copy Emails Only
- Copy Websites Only
- Copy Facebook Only
- Sortable compact table view (`Email | Website | Facebook | Name | Score`)

## Run

```bash
cp .env.example .env
npm install
npm start
```

Open: http://127.0.0.1:3005
