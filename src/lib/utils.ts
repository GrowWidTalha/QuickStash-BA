/**
 * Fetches and parses external URLs into clean, offline-friendly JSON
 */

interface ParsedContent {
    title: string;
    content: string;
    excerpt: string;
    imageUrl?: string;
    url: string;
  }
  
  /**
   * Fetches content from a URL and returns basic metadata
   * Note: For full Readability parsing, you'll need to install a package like 'mozilla-readability'
   */
  export async function fetchAndParseUrl(url: string): Promise<ParsedContent> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QuickStash/1.0)',
        },
      });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }
  
      const html = await response.text();
      
      // Basic parsing (you can enhance this with Readability library)
      const title = extractTitle(html);
      const content = extractContent(html);
      const excerpt = generateExcerpt(content);
      const imageUrl = extractImageUrl(html);
  
      return {
        title,
        content,
        excerpt,
        imageUrl,
        url,
      };
    } catch (error) {
      throw new Error(`Failed to parse URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  function extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : 'Untitled';
  }
  
  function extractContent(html: string): string {
    // Remove script and style tags
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Extract text from body
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1];
    }
    
    // Remove HTML tags and decode entities
    content = content.replace(/<[^>]*>/g, ' ');
    content = content.replace(/&nbsp;/g, ' ');
    content = content.replace(/&amp;/g, '&');
    content = content.replace(/&lt;/g, '<');
    content = content.replace(/&gt;/g, '>');
    content = content.replace(/&quot;/g, '"');
    
    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();
    
    return content.substring(0, 10000); // Limit content length
  }
  
  function generateExcerpt(content: string): string {
    const words = content.split(' ').slice(0, 50);
    return words.join(' ') + (words.length >= 50 ? '...' : '');
  }
  
  function extractImageUrl(html: string): string | undefined {
    // Look for Open Graph image
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch) {
      return ogImageMatch[1];
    }
    
    // Look for Twitter image
    const twitterImageMatch = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i);
    if (twitterImageMatch) {
      return twitterImageMatch[1];
    }
    
    // Look for first img tag
    const imgMatch = html.match(/<img[^>]*src="([^"]+)"/i);
    if (imgMatch) {
      return imgMatch[1];
    }
    
    return undefined;
  }
  
  export default {
    fetchAndParseUrl,
  }; 