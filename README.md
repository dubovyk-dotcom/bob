# USA Partner Lead Engine (Discovery Fix Patch)

This patch upgrades discovery for low-result countries (e.g., Philippines) with a country ecosystem layer and non-USA-biased outbound recruiting discovery.

## Key Fixes

- Adds country-specific recruitment ecosystem terms (e.g., POEA/OFW/manpower/deployment for Philippines).
- Removes USA-first bias during discovery (find outbound recruitment entities first, classify destination later).
- Enforces Facebook-first discovery queries for markets where agencies are social-first.
- Keeps multi-source layers active: search + facebook + local domain + directories + forums.
- Never returns empty when contactable partial leads exist.

## Destination classification

Leads are classified as:

- USA-bound
- Europe-bound
- Middle East-bound
- General abroad

## Run

```bash
cp .env.example .env
npm install
npm start
```
