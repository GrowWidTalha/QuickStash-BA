/**
 * Enhanced Fetch & Parse Utility for QuickStash (with DOM pruning)
 */
import { fetch } from 'undici';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sanitizeHtml from 'sanitize-html';

const MAX_HTML_LENGTH = 5_000_000; // 5 MB limit

interface ParsedContent {
  title: string;
  content: string;        // sanitized HTML
  excerpt: string;
  imageUrl?: string;
  url: string;
  source: string;         // domain name
  readTime: number;       // in minutes
}

/**
 * Remove unwanted elements (e.g., promos, newsletters) before parsing
 */
function pruneDocument(doc: Document): void {
  const selectors = [
    'aside',
    'nav',
    'footer',
    '[class*=related]',
    '[class*=subscribe]',
    '[class*=newsletter]',
    '[class*=promo]',
    '[id*=related]',
    '[id*=newsletter]',
    '[role="complementary"]'
  ];
  selectors.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  });
}

/**
 * Generate plain-text excerpt from sanitized HTML or fallback
 */
function generateExcerptFromHTML(html: string, wordCount = 50): string {
  const doc = new JSDOM(html).window.document;
  const firstPara = doc.querySelector('p')?.textContent?.trim();
  if (firstPara) {
    const words = firstPara.split(/\s+/).slice(0, wordCount);
    return words.join(' ') + (words.length >= wordCount ? '...' : '');
  }
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).slice(0, wordCount);
  return words.join(' ') + (words.length >= wordCount ? '...' : '');
}

/**
 * Extract and prioritize title tags
 */
function extractTitle(document: Document): string {
  const candidates = [
    document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
    document.title,
  ].filter(Boolean) as string[];
  return (candidates[0] || 'Untitled').trim();
}

/**
 * Normalize relative URLs
 */
function normalizeUrl(base: string, relative: string): string {
  try { return new URL(relative, base).href; } catch { return relative; }
}

/**
 * Extract an image URL from metadata or article HTML
 */
function extractImageUrl(html: string, baseUrl: string, articleHtml?: string): string | undefined {
  const sources = [articleHtml, html].filter(Boolean) as string[];
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i,
  ];
  for (const src of sources) {
    for (const pat of patterns) {
      const m = src.match(pat);
      if (m) return normalizeUrl(baseUrl, m[1]);
    }
  }
  return undefined;
}

/**
 * Main fetch & parse function
 */
export async function fetchAndParseUrl(url: string): Promise<ParsedContent> {
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuickStash/1.0)' } });
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);

  const cType = resp.headers.get('content-type') || '';
  if (!cType.includes('text/html')) throw new Error(`Unsupported content-type: ${cType}`);

  const html = await resp.text();
  if (html.length > MAX_HTML_LENGTH) throw new Error('HTML content too large to parse');

  // Initialize DOM and prune
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  pruneDocument(doc);

  // Extract title
  const title = extractTitle(doc);

  // Readability parse
  const reader = new Readability(doc);
  const art = reader.parse();
  if (!art) throw new Error('Readability failed to parse content');

  // Sanitize
  const clean = sanitizeHtml(art.content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'blockquote']),
    allowedAttributes: { a: ['href','target','rel'], img: ['src','alt','title'], '*': ['title'] },
  });

  // Excerpt
  const excerpt = generateExcerptFromHTML(clean);

  // Image
  const imageUrl = extractImageUrl(html, url, art.content);

  // Source
  const source = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();

  // Read time
  const words = (art.textContent || '').split(/\s+/).filter(Boolean).length;
  const imgs = (art.content.match(/<img\s/g) || []).length;
  const readTime = Math.max(1, Math.round(words/200 + imgs*0.5));

  return { title, content: clean, excerpt, imageUrl, url, source, readTime };
}

export default { fetchAndParseUrl };
