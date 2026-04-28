# Global J1 / USA Partner Discovery Engine

## Export System Emergency Fix

### Primary reliable workflow

- **Copy Table** (pipe-separated plain text):
  - `EMAIL | WEBSITE | FACEBOOK | NAME | COUNTRY`
  - instant clipboard output
  - ready for Excel paste

### Safe file export

- **CSV export** (UTF-8, escaped fields, spreadsheet-safe)

### Excel export

- Uses `exceljs` when available for real `.xlsx` generation
- Includes bold headers, autofilter, auto-width columns, clickable links
- If XLSX generation is unavailable/invalid, export auto-falls back to **Copy Table** mode (never returns corrupted XLSX)

## Discovery

- Global multilingual multi-pass discovery
- J1/BridgeUSA semantic detection + hidden signal boosts
- Category and recruiter filters in UI

## Run

```bash
cp .env.example .env
npm install
npm start
```
