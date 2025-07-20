/**
 * Fetches and parses external URLs into clean, offline-friendly JSON
 */
import { fetch } from 'undici';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MAX_HTML_LENGTH = 5_000_000; // 5 MB limit

interface ParsedContent {
  title: string;
  content: string;
  excerpt: string;
  imageUrl?: string;
  url: string;
}
function generateExcerpt(text: string, wordCount = 50): string {
  const words = text.split(/\s+/).slice(0, wordCount);
  return words.join(' ') + (words.length >= wordCount ? '...' : '');
}

/**
 * Normalizes relative URLs against a base URL.
 */
function normalizeUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}


function extractImageUrl(html: string, baseUrl: string): string | undefined {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return normalizeUrl(baseUrl, match[1]);
  }
  return undefined;
}

export async function fetchAndParseUrl(url: string): Promise<ParsedContent> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuickStash/1.0)' }
  });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);

  const html = await response.text();
  if (html.length > MAX_HTML_LENGTH) throw new Error('HTML content too large to parse');

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) throw new Error('Readability failed to parse content');

  const title = article?.title?.trim() || 'Untitled';
  const textContent = article?.textContent?.trim();
  const content = textContent!;
  const excerpt = generateExcerpt(textContent!);
  const imageUrl = extractImageUrl(html, url);

  return { title, content, excerpt, imageUrl, url };
}

  
  export default {
    fetchAndParseUrl,
  }; 