## QuickStash Backend Update: Extractability, Domain Policy Cache, and Telemetry

This update improves extractability detection and exposes clearer signals for the React Native client while keeping extraction client‑side.

### What changed

- Prisma schema updates (`prisma/schema.prisma`):
  - `Save`: added extractability flags
    - `isExtractable` Boolean?
    - `extractabilityReason` String?
    - `blockedBy` String? (comma-separated)
    - `extractionMethod` String?
    - `extractabilityCheckedAt` DateTime?
  - `DomainPolicy` cache table: stores domain‑level signals with TTL
  - `ExtractionTelemetry` table: stores client extraction outcomes

- Parse URL API (`src/app/api/parse-url/route.ts`):
  - Returns a new `extractability` object with `status`, `reasons`, `blockedBy`
  - Returns `alternate.ampUrl` when discovered
  - Applies a lightweight header probe (X‑Robots‑Tag, status codes)
  - Parses meta robots, paywall hints, and AMP links from HTML
  - Caches domain policy with 24h TTL (DB) and uses in‑memory robots cache
  - Supports simple config overrides (allow/deny lists placeholder)
  - Preserves existing fields (`final_url`, `title`, `featuredImage`, `favicon`, `excerpt`, `isFetchingAllowed`)

- New Telemetry API (`src/app/api/extraction-telemetry/route.ts`):
  - `POST` endpoint to record RN client extraction outcomes using raw SQL insert

### Database migration

If you use Prisma Migrate:

```bash
npx prisma migrate dev --name extractability_and_domain_policy
npx prisma generate
```

If you prefer SQL, create the new columns/tables (adjust types for your environment):

```sql
-- Save table columns (nullable flags)
ALTER TABLE saves
  ADD COLUMN IF NOT EXISTS "isExtractable" BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS "extractabilityReason" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "blockedBy" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "extractionMethod" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "extractabilityCheckedAt" TIMESTAMPTZ NULL;

-- Domain policy cache
CREATE TABLE IF NOT EXISTS domain_policies (
  domain TEXT PRIMARY KEY,
  robots_txt TEXT NULL,
  robots_disallow_paths JSONB NULL,
  has_noai BOOLEAN NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ttl_expires_at TIMESTAMPTZ NULL
);

-- Telemetry table
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE TABLE IF NOT EXISTS extraction_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  attempted BOOLEAN NOT NULL,
  success BOOLEAN NOT NULL,
  method TEXT NULL,
  failure_reason TEXT NULL,
  status_from_api TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New/updated API contracts

Parse URL request:

```json
{ "url": "https://example.com/article" }
```

Parse URL response (new fields highlighted):

```json
{
  "success": true,
  "data": {
    "final_url": "https://example.com/article",
    "title": "...",
    "featuredImage": "https://...",
    "favicon": "https://.../favicon.ico",
    "excerpt": "...",
    "accept": "text/html",
    "isFetchingAllowed": true,
    "extractability": {
      "status": "allowed",
      "reasons": [],
      "blockedBy": []
    },
    "alternate": {
      "ampUrl": "https://amp.example.com/article"
    }
  }
}
``;

Extraction Telemetry request:

```json
{
  "url": "https://example.com/article",
  "attempted": true,
  "success": false,
  "method": "webview_readability",
  "failure_reason": "blocked_cookie_wall",
  "status_from_api": "disallowed"
}
```

Response:

```json
{ "success": true }
```

### RN client integration guide

1) Call `parse-url` before loading the offscreen WebView. Use `data.extractability.status` to branch:
   - `allowed`: proceed with normal flow (WebView + injected script + Readability). If parsing fails and `alternate.ampUrl` exists, retry with AMP URL; otherwise show preview.
   - `disallowed`: skip extraction; render preview (OG/Twitter) and show actions (Open Original, Save, Share).
   - `blocked`: treat same as disallowed (if you distinguish it), show notice + Open Original.
   - `unknown`: attempt extraction with guardrails (timeout ~4–6s, cap DOM size). Fallback to preview on failure.

2) Always include an "Open Original" action.

3) After the attempt, POST to `/api/extraction-telemetry` with outcome. Use this to refine domain policies later.

4) Optional: send the `method` you used (`webview_readability` or `amp_readability`) and a short `failure_reason`.

### Suggested RN pseudocode

```ts
const res = await api.post('/api/parse-url', { url });
const { extractability, alternate } = res.data.data;

switch (extractability.status) {
  case 'allowed':
    tryWebViewExtract(url)
      .catch(async () => alternate?.ampUrl ? tryWebViewExtract(alternate.ampUrl) : Promise.reject())
      .catch(() => showPreview(res.data.data));
    break;
  case 'unknown':
    tryWebViewExtract(url, { timeoutMs: 5000, maxDomSize: 2_000_000 })
      .catch(() => showPreview(res.data.data));
    break;
  default:
    showPreview(res.data.data);
}

// Telemetry
await api.post('/api/extraction-telemetry', {
  url,
  attempted: extractability.status !== 'disallowed',
  success: /* true/false */, 
  method: /* 'webview_readability' | 'amp_readability' | null */, 
  failure_reason: /* optional string */, 
  status_from_api: extractability.status,
});
```

### Override lists (backend)

The parse‑url route contains placeholder allow/deny sets for emergency hotfixes. Tie these to env/config as needed.

### Rollout checklist

1) Run DB migrations and `npx prisma generate`.
2) Deploy backend.
3) Update RN client to branch on `extractability.status` and add AMP retry.
4) Start sending telemetry.
5) Monitor telemetry and adjust override lists if needed.

### Notes

- All extraction remains client‑side. The backend only performs lightweight metadata and policy checks.
- We respect `robots.txt`, `meta` and `X‑Robots‑Tag` directives for extractability decisions.

