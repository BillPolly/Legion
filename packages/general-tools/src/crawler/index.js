import { Tool, ToolResult } from '../../../tools/src/index.js';
import puppeteer from 'puppeteer';

class Crawler extends Tool {
  constructor() {
    super();
    this.name = 'web_crawler';
    this.description = 'Crawls web pages and extracts content';
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'web_crawler_crawl',
        description: 'Crawl a webpage and extract its content including text, links, and metadata',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the webpage to crawl'
            },
            waitForSelector: {
              type: 'string',
              description: 'Optional CSS selector to wait for before extracting content'
            },
            limit: {
              type: 'number',
              description: 'Optional limit for number of links to extract (default: 100)'
            }
          },
          required: ['url']
        }
      }
    };
  }

  /**
   * Invokes the crawler with the given tool call
   */
  async invoke(toolCall) {
    let args;
    try {
      // Parse the arguments
      args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['url']);
      
      // Crawl the webpage
      const result = await this.crawl(args.url, args.waitForSelector, args.limit);
      
      // Return success response
      return ToolResult.success(result);
    } catch (error) {
      // Return error response
      return ToolResult.failure(
        error.message || 'Failed to crawl webpage',
        {
          url: args?.url || 'unknown',
          errorType: 'crawl_error'
        }
      );
    }
  }

  /**
   * Crawls a webpage and extracts content
   */
  async crawl(url, waitForSelector = null, limit = 100) {
    let browser = null;
    
    try {
      console.log(`Crawling webpage: ${url}`);
      
      // Launch browser
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      if (!response.ok()) {
        throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
      }
      
      // Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      // Extract content from the page
      const content = await page.evaluate((maxLinks) => {
        // Extract text content
        const getText = () => {
          // Remove script and style elements
          const scripts = document.querySelectorAll('script, style');
          scripts.forEach(el => el.remove());
          
          return document.body.innerText.trim();
        };
        
        // Extract links
        const getLinks = () => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          return links.slice(0, maxLinks).map(link => ({
            text: link.innerText.trim(),
            href: link.href,
            title: link.title || ''
          })).filter(link => link.href && link.href.startsWith('http'));
        };
        
        // Extract metadata
        const getMetadata = () => {
          const getMeta = (name) => {
            const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            return element ? element.getAttribute('content') : '';
          };
          
          return {
            title: document.title,
            description: getMeta('description') || getMeta('og:description'),
            keywords: getMeta('keywords'),
            author: getMeta('author'),
            ogTitle: getMeta('og:title'),
            ogImage: getMeta('og:image'),
            ogType: getMeta('og:type')
          };
        };
        
        // Extract images
        const getImages = () => {
          const images = Array.from(document.querySelectorAll('img[src]'));
          return images.slice(0, 50).map(img => ({
            src: img.src,
            alt: img.alt || '',
            title: img.title || ''
          })).filter(img => img.src && img.src.startsWith('http'));
        };
        
        return {
          text: getText(),
          links: getLinks(),
          metadata: getMetadata(),
          images: getImages()
        };
      }, limit);
      
      console.log(`Successfully crawled ${url}`);
      console.log(`Extracted ${content.links.length} links and ${content.images.length} images`);
      
      return {
        url: url,
        success: true,
        content: content.text.substring(0, 5000), // Limit text content
        links: content.links,
        images: content.images,
        metadata: content.metadata
      };
      
    } catch (error) {
      throw new Error(`Failed to crawl webpage: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export default Crawler;