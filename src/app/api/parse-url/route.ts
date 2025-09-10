import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    // Fetch the article content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const html = await response.text();

    // Parse HTML with Cheerio
    const $ = cheerio.load(html);

    const title =
      $('head title').text() ||
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content');

    const excerpt =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content');

    const faviconUrl =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href');

    let absoluteFaviconUrl: string | undefined;
    if (faviconUrl) {
      try {
        absoluteFaviconUrl = new URL(faviconUrl, url).toString();
      } catch (e) {
        console.error("Error creating absolute favicon URL:", e);
        absoluteFaviconUrl = undefined;
      }
    }

    // Get featured image URL
    let featuredImageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[itemprop="image"]').attr('content') ||
      $('img[decoding="async"][src]').first().attr('src') ||
      $('img[src]').first().attr('src');

    let absoluteFeaturedImageUrl: string | undefined = undefined;
    if (featuredImageUrl) {
      try {
        absoluteFeaturedImageUrl = new URL(featuredImageUrl, url).toString();
      } catch (e) {
        console.error("Error creating absolute featured image URL:", e);
        absoluteFeaturedImageUrl = undefined;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        title: title || null,
        excerpt: excerpt || null,
        favicon_url: absoluteFaviconUrl || null,
        featured_image_url: absoluteFeaturedImageUrl || null,
      },
    });
  } catch (error: any) {
    console.error("Error parsing URL:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
