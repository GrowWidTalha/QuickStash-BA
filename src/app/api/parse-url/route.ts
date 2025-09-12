import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    // Always normalize + follow redirects
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/118.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    // Resolve the *final* URL after shorteners/redirects
    const finalUrl = response.url;
    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $("head title").text()?.trim() ||
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content");

    const excerpt =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content");

    // --- Favicon handling ---
    let faviconUrl =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href");

    if (!faviconUrl) {
      // fallback to /favicon.ico
      try {
        const u = new URL(finalUrl);
        faviconUrl = `${u.origin}/favicon.ico`;
      } catch {
        faviconUrl = undefined;
      }
    }

    let absoluteFaviconUrl: string | undefined;
    if (faviconUrl) {
      try {
        absoluteFaviconUrl = new URL(faviconUrl, finalUrl).toString();
      } catch {
        absoluteFaviconUrl = undefined;
      }
    }

    // --- Featured image handling ---
    let featuredImageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[itemprop="image"]').attr("content");

    if (!featuredImageUrl) {
      // Fallback: find first *non-tiny* image on page
      const candidates = $("img[src]")
        .map((_, el) => $(el).attr("src"))
        .get()
        .filter(Boolean);

      if (candidates.length > 0) {
        featuredImageUrl = candidates[0]; // (could enhance by picking largest image)
      }
    }

    let absoluteFeaturedImageUrl: string | undefined;
    if (featuredImageUrl) {
      try {
        absoluteFeaturedImageUrl = new URL(featuredImageUrl, finalUrl).toString();
      } catch {
        absoluteFeaturedImageUrl = undefined;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        final_url: finalUrl,
        title: title || null,
        excerpt: excerpt || null,
        favicon_url: absoluteFaviconUrl || null,
        featured_image_url: absoluteFeaturedImageUrl || null,
      },
    });
  } catch (error: any) {
    console.error("Error parsing URL:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
