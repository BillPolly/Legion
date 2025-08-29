import { Tool, Module } from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

/**
 * Crawler tool that crawls web pages and extracts content
 * Pure logic implementation - metadata comes from module.json
 */
class CrawlerTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'crawler';
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const { url, waitForSelector, limit = 100 } = params;
    
    // Emit progress event
    this.progress(`Starting web crawl of: ${url}`, 0);
    
    // Execute the crawl
    const result = await this.crawl(url, waitForSelector, limit);
    
    // Emit completion
    this.info(`Crawl completed successfully for: ${url}`);
    
    return result;
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

/**
 * CrawlerModule - metadata-driven architecture
 * Metadata comes from module.json, tools contain pure logic only
 */
export default class CrawlerModule extends Module {
  constructor() {
    super();
    this.name = 'CrawlerModule';
    this.description = 'Web crawling tools for extracting content from web pages';
    this.version = '1.0.0';
    
    // Set metadata path for automatic loading
    this.metadataPath = './module.json';
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new CrawlerModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - metadata-driven approach only
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // Create web_crawler tool using metadata
    const crawlerTool = this.createToolFromMetadata('web_crawler', CrawlerTool);
    this.registerTool(crawlerTool.name, crawlerTool);
  }
}