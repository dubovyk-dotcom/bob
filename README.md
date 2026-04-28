# Business Contact Finder (Lead Engine Upgrade)

This project is a lead intelligence engine for J1 / internship / hospitality / placement ecosystems.

## Reliability Improvements in This Version

- Full pipeline debug logging (terminal + optional API debug payload).
- Less aggressive filtering: leads are kept when **any** contact route exists.
- Expanded contact extraction: email, phone, WhatsApp, Facebook, Instagram, LinkedIn, contact/apply/form pages.
- Broader intent matching with expanded signals (`work and travel`, `bridgeusa`, `camp counselor`, `au pair`, etc.).
- Automatic fallback expansion queries when discovery is weak.
- Multi-provider discovery (`Nominatim` + `DuckDuckGo` web results).
- Rejection reasons tracked (`no_site`, `no_contact_route`, `irrelevant_content`, etc.).
- UI now shows discovered/crawled/qualified/rejected counts, providers, retries, runtime, and debug trace.

## Inclusion Rule

A lead is kept if relevance is detected and **at least one** contact channel exists:

- website
- email
- Facebook
- Instagram
- LinkedIn
- WhatsApp
- contact/apply/form page
- phone number

## Run Locally

```bash
cp .env.example .env
npm install
npm start
```

Open: http://127.0.0.1:3005

## Debug Mode

Enable **Include debug logs in API response** in the web UI, or send `"debug": true` in `POST /api/search`.

## Commands

```bash
npm start
npm run dev
npm run check
```
