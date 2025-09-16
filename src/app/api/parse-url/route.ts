import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import http from "http";
import https from "https";
import { URL } from "url";
import robotsParser from "robots-parser"; // npm i robots-parser

/**
 * Simple in-memory robots cache (ephemeral in serverless).
 */
const ROBOTS_CACHE_TTL_MS = 60 * 1000; // tune as needed
const robotsCache = new Map<string, { text: string; fetchedAt: number }>();

const DEFAULT_PLACEHOLDER_IMAGE = "https://example.com/image-not-available.png";
const FETCHER_USER_AGENT = "Mozilla/5.0 (compatible; TurboLaunchFetcher/1.0)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";

/* ---------------------- helpers (unchanged) ---------------------- */

function extractFromHtml(html: string, baseUrl: string) {
  console.log("~~ STEP ~~ Extracting metadata from HTML");
  const $ = cheerio.load(html);

  const title =
    $("head title").text()?.trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    null;

  const excerpt =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    null;

  let favicon =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    null;

  if (!favicon) {
    try {
      const u = new URL(baseUrl);
      favicon = `${u.origin}/favicon.ico`;
    } catch {
      favicon = null;
    }
  }

  let featured =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[itemprop="image"]').attr("content") ||
    null;

  if (!featured) {
    const candidates = $("img[src]")
      .map((_, el) => $(el).attr("src"))
      .get()
      .filter(Boolean);
    if (candidates.length > 0) featured = candidates[0]!;
  }

  try {
    favicon = favicon ? new URL(favicon, baseUrl).toString() : null;
  } catch {
    favicon = null;
  }
  try {
    featured = featured ? new URL(featured, baseUrl).toString() : null;
  } catch {
    featured = null;
  }

  console.log(`~~ STEP ~~ Extracted title: ${title ? title.substring(0, 100) : "null"}`);
  console.log(`~~ STEP ~~ Extracted featured image: ${featured ? featured : "null"}`);

  return { title, excerpt, favicon, featured };
}

/* ---------- HTTP/1.1 fallback helper (http1GetFollow) ---------- */

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function http1GetFollow(
  inputUrl: string,
  opts?: { headers?: Record<string, string>; maxRedirects?: number; timeoutMs?: number }
): Promise<{ finalUrl: string; statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  const headers = opts?.headers || {};
  const maxRedirects = typeof opts?.maxRedirects === "number" ? opts!.maxRedirects : 6;
  const timeoutMs = opts?.timeoutMs ?? 12_000;

  let currentUrl = inputUrl;
  for (let redirectCount = 0; redirectCount < maxRedirects; redirectCount++) {
    console.log(`~~ STEP ~~ HTTP/1.1 request attempt for: ${currentUrl} (redirect #${redirectCount})`);

    const urlObj = new URL(currentUrl);
    const isHttps = urlObj.protocol === "https:";
    const lib = isHttps ? https : http;

    const requestOptions: any = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      method: "GET",
      path: urlObj.pathname + (urlObj.search || ""),
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Connection: "close",
        "Accept-Encoding": "identity",
        ...headers,
      },
      timeout: timeoutMs,
    };

    const { statusCode, resHeaders, body } = await new Promise<{
      statusCode: number;
      resHeaders: http.IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const req = lib.request(requestOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => {
          const bodyStr = Buffer.concat(chunks).toString("utf8");
          resolve({ statusCode: res.statusCode || 0, resHeaders: res.headers, body: bodyStr });
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy(new Error("timeout"));
      });

      req.end();
    }).catch((err) => {
      throw err;
    });

    if (statusCode >= 300 && statusCode < 400) {
      const loc = (resHeaders.location as string) || (resHeaders.Location as string);
      if (!loc) {
        return { finalUrl: currentUrl, statusCode, headers: resHeaders, body };
      }
      try {
        currentUrl = new URL(loc, currentUrl).toString();
        console.log(`~~ STEP ~~ HTTP/1.1 redirect → ${currentUrl}`);
        continue;
      } catch {
        return { finalUrl: currentUrl, statusCode, headers: resHeaders, body };
      }
    }

    return { finalUrl: currentUrl, statusCode, headers: resHeaders, body };
  }

  console.log("~~ STEP ~~ HTTP/1.1 follow redirects exceeded");
  return { finalUrl: currentUrl, statusCode: 0, headers: {}, body: "" };
}

/* ---------- resolveFinalUrl: fetch with fallback to HTTP/1.1 ---------- */

async function resolveFinalUrl(inputUrl: string) {
  console.log(`~~ STEP ~~ resolveFinalUrl starting for: ${inputUrl}`);

  // First attempt: fetch() (may use HTTP/2). On specific failures, fall back to HTTP/1.1 manual logic.
  try {
    console.log(`~~ STEP ~~ Trying fetch() to resolve: ${inputUrl}`);
    const res = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
      },
    });

    const finalUrl = res.url || inputUrl;
    console.log(`~~ STEP ~~ fetch() resolved final URL: ${finalUrl} (status ${res.status})`);

    let html: string | undefined;
    try {
      html = await res.text();
    } catch (err) {
      console.warn("~~ STEP ~~ fetch() read body failed:", err);
      html = undefined;
    }

    return { finalUrl, html };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`~~ STEP ~~ fetch() failed: ${msg}`);

    // Fall back to HTTP/1.1 GET if error looks like TLS/HTTP2/socket issue or on generic failure
    console.log("~~ STEP ~~ Falling back to HTTP/1.1 GET (http1GetFollow)");
    try {
      const resp = await http1GetFollow(inputUrl, {
        headers: { Referer: "https://www.google.com/" },
        maxRedirects: 6,
        timeoutMs: 12_000,
      });
      console.log(`~~ STEP ~~ HTTP/1.1 fallback resolved final URL: ${resp.finalUrl} (status ${resp.statusCode})`);
      return { finalUrl: resp.finalUrl, html: resp.body || undefined };
    } catch (fallbackErr: any) {
      console.error("~~ STEP ~~ HTTP/1.1 fallback also failed:", fallbackErr);
      // give up — return inputUrl as final
      return { finalUrl: inputUrl, html: undefined };
    }
  }
}

/* ---------------------- robots.txt fetch (cached) ---------------------- */

async function fetchRobotsTxt(origin: string) {
  console.log(`~~ STEP ~~ Fetching robots.txt from origin: ${origin}`);
  const cached = robotsCache.get(origin);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    console.log("~~ STEP ~~ Using cached robots.txt");
    return cached.text;
  }

  const robotsUrl = new URL("/robots.txt", origin).toString();
  try {
    console.log(`~~ STEP ~~ Requesting ${robotsUrl}`);
    const res = await fetch(robotsUrl, {
      method: "GET",
      headers: { "User-Agent": FETCHER_USER_AGENT, Accept: "text/plain,*/*" },
      redirect: "follow",
    });
    if (!res.ok) {
      console.log(`~~ STEP ~~ robots.txt returned ${res.status} → treat as missing (allow by default)`);
      robotsCache.set(origin, { text: "", fetchedAt: now });
      return "";
    }
    const txt = await res.text();
    robotsCache.set(origin, { text: txt, fetchedAt: now });
    console.log("~~ STEP ~~ robots.txt fetched and cached");
    return txt;
  } catch (err) {
    console.error("~~ STEP ~~ Error fetching robots.txt:", err);
    robotsCache.set(origin, { text: "", fetchedAt: now });
    return "";
  }
}

/* ---------------------- Main route handler (uses robots-parser library) ---------------------- */

export async function POST(req: NextRequest) {
  console.log("~~ STEP ~~ POST handler invoked");
  try {
    const { url } = await req.json();
    console.log(`~~ STEP ~~ Received payload with url: ${url}`);

    if (!url) {
      console.log("~~ STEP ~~ Missing URL in request → returning 400");
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 });
    }

    // Resolve final URL (with HTTP/1.1 fallback) and possibly get HTML body
    const { finalUrl, html: resolvedHtml } = await resolveFinalUrl(url);
    console.log(`~~ STEP ~~ Resolved finalUrl=${finalUrl}`);

    // Normalize final URL
    let origin: string;
    let pathname: string;
    try {
      const u = new URL(finalUrl);
      origin = u.origin;
      pathname = u.pathname + (u.search || "");
      console.log(`~~ STEP ~~ Normalized final URL origin=${origin}, path=${pathname}`);
    } catch {
      console.log("~~ STEP ~~ Invalid final URL after redirects → returning 400");
      return NextResponse.json({ success: false, error: "Invalid final URL after redirects" }, { status: 400 });
    }

    // Fetch robots.txt (cached)
    const robotsText = await fetchRobotsTxt(origin);
    const robotsTxtUrl = new URL("/robots.txt", origin).toString();

    // Use library to decide allow/disallow
    // robots-parser expects (robotsUrl, robotsTxtString)
    // isAllowed(url, userAgent) -> boolean | undefined
    const robots = robotsParser(robotsTxtUrl, robotsText || "");
    let allowed = robots.isAllowed(finalUrl, FETCHER_USER_AGENT);
    // robots-parser may return undefined for invalid url -> treat undefined as true (allow)
    if (typeof allowed === "undefined") allowed = true;

    console.log(`~~ STEP ~~ robots-parser decision isAllowed=${allowed}`);

    const acceptHeaderValue = "text/html";
    let html = resolvedHtml;

    if (allowed) {
      // Allowed: fetch HTML if needed, extract metadata and return
      console.log("~~ STEP ~~ robots allowed access → fetching HTML if not already available");
      if (!html) {
        try {
          const r = await fetch(finalUrl, {
            method: "GET",
            redirect: "follow",
            headers: {
              "User-Agent": BROWSER_UA,
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              Connection: "close",
              "Accept-Encoding": "identity",
            },
          });
          if (!r.ok) throw new Error(`Failed to fetch final URL: ${r.statusText}`);
          html = await r.text();
        } catch (err) {
          console.error("~~ STEP ~~ GET failed when fetching HTML:", err);
          return NextResponse.json({ success: false, error: "Failed to fetch final HTML" }, { status: 500 });
        }
      }

      const { title, excerpt, favicon, featured } = extractFromHtml(html!, finalUrl);

      console.log("~~ STEP ~~ Returning successful response (isFetchingAllowed: true)");
      return NextResponse.json({
        success: true,
        data: {
          final_url: finalUrl,
          title: title || null,
          featuredImage: featured || null,
          favicon: favicon || null,
          excerpt: excerpt || null,
          accept: acceptHeaderValue,
          isFetchingAllowed: true,
        },
      });
    } else {
      // Disallowed by robots.txt — still attempt best-effort fallback (preserve previous behavior).
      // NOTE: if you want strict behaviour, change this to return immediately with isFetchingAllowed:false
      console.log("~~ STEP ~~ robots disallow access → performing best-effort fallback (isFetchingAllowed: false)");

      try {
        if (!html) {
          console.log("~~ STEP ~~ No resolved HTML available for fallback → issuing minimal GET (may still be served)");
          try {
            const r = await fetch(finalUrl, {
              method: "GET",
              redirect: "follow",
              headers: {
                "User-Agent": FETCHER_USER_AGENT,
                Accept: "text/html",
                Connection: "close",
                "Accept-Encoding": "identity",
              },
            });
            if (r.ok) {
              html = await r.text();
            } else {
              console.log(`~~ STEP ~~ Fallback GET returned status ${r.status}`);
            }
          } catch (err) {
            console.warn("~~ STEP ~~ Fallback GET threw:", err);
          }
        }

        let title: string | null = null;
        let featuredImage: string | null = null;
        let favicon: string | null = null;

        if (html) {
          try {
            console.log("~~ STEP ~~ Fallback HTML available — extracting metadata");
            const extracted = extractFromHtml(html, finalUrl);
            title = extracted.title;
            featuredImage = extracted.featured;
            favicon = extracted.favicon;
          } catch (parseErr) {
            console.warn("~~ STEP ~~ Parsing fallback HTML failed", parseErr);
          }
        }

        if (!title && !featuredImage) {
          console.log("~~ STEP ~~ No useful metadata from fallback → returning strict fallback object");
          return NextResponse.json({
            success: true,
            data: {
              final_url: finalUrl,
              title: finalUrl,
              featuredImage: DEFAULT_PLACEHOLDER_IMAGE,
              accept: acceptHeaderValue,
              isFetchingAllowed: false,
            },
          });
        }

        console.log("~~ STEP ~~ Returning best-effort metadata with isFetchingAllowed: false");
        return NextResponse.json({
          success: true,
          data: {
            final_url: finalUrl,
            title: title || finalUrl,
            featuredImage: featuredImage || DEFAULT_PLACEHOLDER_IMAGE,
            favicon: favicon || null,
            accept: acceptHeaderValue,
            isFetchingAllowed: false,
          },
        });
      } catch (err) {
        console.error("~~ STEP ~~ Fallback fetch failed entirely:", err);
        return NextResponse.json({
          success: true,
          data: {
            final_url: finalUrl,
            title: finalUrl,
            featuredImage: DEFAULT_PLACEHOLDER_IMAGE,
            accept: acceptHeaderValue,
            isFetchingAllowed: false,
          },
        });
      }
    }
  } catch (error: any) {
    console.error("~~ STEP ~~ Error parsing URL:", error);
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
