import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fetch, Request } from 'undici';

const INPUT_PATH = resolve(process.cwd(), 'urls.json');
const OUTPUT_DIR = resolve(process.cwd(), 'scripts');
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'output.json');
const API_ENDPOINT = process.env.PARSE_URL_ENDPOINT || 'http://localhost:3000/api/parse-url';
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const PER_REQUEST_TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000);

function nowIso() {
  return new Date().toISOString();
}

async function postParseUrl(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  let httpStatus = null;
  try {
    const req = new Request(API_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
      signal: controller.signal,
    });
    const res = await fetch(req);
    httpStatus = res.status;
    const json = await res.json().catch(() => ({ success: false, error: 'Invalid JSON response' }));
    const endedAt = Date.now();
    return {
      url: targetUrl,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - startedAt,
      httpStatus,
      success: Boolean(json?.success),
      error: json?.success ? null : (json?.error || null),
      data: json?.data || null,
      extractability: json?.data?.extractability || null,
      isFetchingAllowed: json?.data?.isFetchingAllowed ?? null,
      alternate: json?.data?.alternate || null,
    };
  } catch (err) {
    const endedAt = Date.now();
    return {
      url: targetUrl,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - startedAt,
      httpStatus,
      success: false,
      error: err?.name === 'AbortError' ? `Timeout after ${PER_REQUEST_TIMEOUT_MS}ms` : (err?.message || String(err)),
      data: null,
      extractability: null,
      isFetchingAllowed: null,
      alternate: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const startAll = Date.now();
  const summary = {
    startedAt: nowIso(),
    endpoint: API_ENDPOINT,
    concurrency: CONCURRENCY,
    timeoutMs: PER_REQUEST_TIMEOUT_MS,
    totals: { count: 0, success: 0, failed: 0 },
  };

  const buf = await readFile(INPUT_PATH, 'utf8');
  const list = JSON.parse(buf);
  const urls = list.map(x => x.url).filter(Boolean);
  summary.totals.count = urls.length;

  console.log(`[runner] Loaded ${urls.length} URLs from urls.json`);

  const results = [];

  let inFlight = 0;
  let idx = 0;
  const queue = [];

  async function scheduleNext() {
    if (idx >= urls.length) return;
    const currentIndex = idx++;
    const targetUrl = urls[currentIndex];
    inFlight++;
    console.log(`[runner] → (${currentIndex + 1}/${urls.length}) POST ${targetUrl}`);
    const res = await postParseUrl(targetUrl);
    if (res.success) {
      summary.totals.success++;
      const status = res.extractability?.status || 'n/a';
      console.log(`[runner] ✓ (${currentIndex + 1}) ${targetUrl} | http=${res.httpStatus} | status=${status} | ${res.durationMs}ms`);
    } else {
      summary.totals.failed++;
      console.warn(`[runner] ✗ (${currentIndex + 1}) ${targetUrl} | http=${res.httpStatus} | error=${res.error}`);
    }
    results.push(res);
    inFlight--;
    await delay(100); // small pacing
    await scheduleNext();
  }

  // Prime initial concurrency
  const starters = Math.min(CONCURRENCY, urls.length);
  for (let i = 0; i < starters; i++) queue.push(scheduleNext());
  await Promise.all(queue);

  const endAll = Date.now();
  summary.endedAt = nowIso();
  summary.durationMs = endAll - startAll;

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify({ summary, results }, null, 2), 'utf8');

  console.log(`[runner] Done. Success=${summary.totals.success} Failed=${summary.totals.failed} | Output: ${OUTPUT_PATH}`);
}

run().catch((err) => {
  console.error('[runner] Fatal error:', err);
  process.exitCode = 1;
});


