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


### New/updated API contracts

New response from getSavesById function 
```json
"data": {
        "blockedBy": null,
        "createdAt": "2025-10-14T13:30:09.782Z",
        "excerpt": "Discover how to create stunning and engaging applications using Python.",
        "extractabilityCheckedAt": "2025-10-14T13:30:08.805Z",
        "extractabilityReason": "allowed",
        "favicon_url": "https://www.kdnuggets.com/wp-content/themes/kdn17/images/favicon.ico",
        "featured_image_url": "https://www.kdnuggets.com/wp-content/uploads/Building-Pure-Python-Web-Apps-with-Reflex_1.jpeg",
        "id": "cmgqlncvq0001l40490elylc8",
        "isArchived": false,
        "isExtractable": true,
        "isFetchingAllowed": true,
        "isRead": false,
        "title": "Building Pure Python Web Apps with Reflex - KDnuggets",
        "updatedAt": "2025-10-14T13:30:09.782Z",
        "url": "https://www.kdnuggets.com/building-pure-python-web-apps-with-reflex"
    },
    "error": null,
    "success": true
}
```

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