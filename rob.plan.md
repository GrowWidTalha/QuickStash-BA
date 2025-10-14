<!-- c5c0eabd-46f6-4763-9146-6f26cdcbfe3f d925c9da-8b8e-4151-9278-7e2f57bf12a1 -->
# Robust Article Extractability and Frontend Handling

### Goals

- Improve parsing accuracy and avoid breakage on blocked sites.
- Persist per-URL extractability flags and reasons for safe frontend decisions.
- Respect site policies (robots/meta/X-Robots) while keeping extraction client-side.

### Constraints

- Next.js app with Postgres.
- Only lightweight server fetch allowed in `src/app/api/parse-url/route.ts` to assess extractability & metadata.
- Client (React Native) continues to do extraction via WebView + injected script + Readability.

### Data Model (Postgres)

- Table `articles` (or your equivalent):
  - `is_extractable` boolean NULLABLE (null = unknown, true = allowed, false = disallowed)
  - `extractability_reason` text (enum-like: 'allowed','robots_disallow','meta_noai','xrobots_noai','paywalled','blocked_status','unknown')
  - `blocked_by` text (comma list: 'robots','meta','xrobots','status_403','status_451','rate_limit','other')
  - `extraction_method` text (planned: 'webview_readability','amp_readability','fallback_preview')
  - `extractability_checked_at` timestamptz
- Table `domain_policies` (optional cache):
  - `domain` text PK, `robots_txt` text, `robots_disallow_paths` jsonb, `has_noai` boolean, `checked_at` timestamptz, `ttl_expires_at` timestamptz

### Backend: `src/app/api/parse-url/route.ts`

- Return extended schema:
  - `extractability`: `{ status: 'allowed'|'disallowed'|'blocked'|'unknown', reasons: string[], blockedBy?: string[] }`
  - `metadata`: existing OG/Twitter/link rel data
  - `alternate`: `{ ampUrl?: string }`
- Decision algorithm (fast, lightweight):

1) Normalize URL; enforce HTTPS redirect follow (up to 5 hops).

2) Fetch `robots.txt` for host with short timeout; parse `User-agent: *` rules. If path disallowed → reason `robots_disallow`.

3) Make a HEAD or light GET (cap bytes, e.g., 128KB). Inspect headers:

     - `X-Robots-Tag` containing `noai`/`noindex`/`noarchive`/`nosnippet` → reasons.
     - HTTP status 401/403/429/451/5xx → `blocked_status`.

4) Parse first 128KB HTML for meta tags:

     - `<meta name="robots" content="noai|nosnippet|noarchive|noindex">` → reasons.
     - `<script type="application/ld+json">` NewsArticle with `isAccessibleForFree: false` → `paywalled`.
     - `<meta name="meteredPaywall" content="true">`, `<meta property="article:content_tier" content="subscription">` → `paywalled`.
     - `<link rel="amphtml" href="...">` → capture `alternate.ampUrl`.

5) Compose status:

     - If any of robots/meta/x-robots/paywall/blocked_status → `disallowed` (except paywall could be `blocked`).
     - If only soft signals (no OG body) and no blocks → `allowed`.
     - If timeouts/ambiguous → `unknown`.

6) Persist/update article flags; upsert domain cache with TTL (e.g., 24h).

- Example response shape (concise):
```json
{
  "url": "https://site.com/post",
  "extractability": {
    "status": "disallowed",
    "reasons": ["meta_noai"],
    "blockedBy": ["meta"]
  },
  "metadata": { "title": "...", "description": "...", "image": "..." },
  "alternate": { "ampUrl": "https://amp.site.com/post" }
}
```


### Frontend Handling Matrix (React Native)

- On navigate to article:
  - Call `parse-url` (or use stored flags if fresh).
  - Switch by `extractability.status`:
    - `allowed`: Load offscreen WebView with original URL; inject improved script; run Readability. If fail and `ampUrl` exists, retry with AMP URL. Fallback to preview.
    - `disallowed`: Do not extract; render preview (OG/Twitter) + actions: Open Original / Save / Share.
    - `blocked`: Skip extraction; show notice + Open Original.
    - `unknown`: Attempt extraction with short guardrails (timeout 4-6s, max DOM size). On failure → preview.
- Always provide a manual "Open Original" action.
- Telemetry to backend (new endpoint) with client-observed outcome:
  - `{ url, attempted: bool, success: bool, method: 'webview_readability'|'amp_readability'|null, failure_reason?: string }` to refine flags server-side.

### Client Extraction Script Improvements (still client-side)

- Pre-sanitize DOM: remove `script`, noisy nodes, fix lazy images (`data-src`/`srcset`), resolve relative URLs.
- Prefer article nodes: `[role=main] article`, `[itemtype*="Article"]`, `main`.
- Preserve `figure > img` and captions.
- Strip cookie walls / overlays by common selectors; run before Readability.
- Timeout and size guards to avoid hangs.

### Rollout

1) Add DB columns and optional `domain_policies` table.

2) Update `parse-url` response schema and algorithm.

3) Adjust RN client to use the matrix and handle AMP retry.

4) Add telemetry endpoint and aggregate to update `is_extractable` if client proves otherwise.

5) Create a domain allow/deny override list in config for hotfixes.

6) QA against a curated list of sites (news, blogs, paywalled, anti-bot).

### Notes & Respect for Policies

- Respect `robots.txt`, `meta` and `X-Robots-Tag` signals for extraction decisions.
- Keep server fetch light and cache domain-level signals with TTL.
- Do not attempt headless crawling on server; all content extraction stays on client.

### To-dos

- [ ] Add extractability columns and optional domain_policies table
- [ ] Implement extractability checks in parse-url and extend response schema
- [ ] Cache robots/meta signals per domain with TTL
- [ ] Update RN app to use handling matrix by status
- [ ] Add AMP retry path in client extraction
- [ ] Improve injected extraction script pre-sanitization and heuristics
- [ ] Add client telemetry endpoint and persist outcomes
- [ ] Add config-based domain allow/deny overrides
- [ ] QA against curated site list and adjust rules