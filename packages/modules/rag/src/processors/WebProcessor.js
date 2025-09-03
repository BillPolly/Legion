/**
 * WebProcessor - Web content processing and extraction
 * 
 * Handles URL fetching, HTML-to-text conversion, and web content validation
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';

export default class WebProcessor {
  constructor(options = {}) {
    this.options = {
      timeout: 10000,
      maxContentSize: 1 * 1024 * 1024, // 1MB default
      userAgent: 'Legion Semantic Search Bot',
      maxRedirects: 5,
      ...options
    };

    // Configure axios instance
    this.axios = axios.create({
      timeout: this.options.timeout,
      maxRedirects: this.options.maxRedirects,
      headers: {
        'User-Agent': this.options.userAgent
      }
    });
  }

  /**
   * Validate URL format and security
   */
  isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // Block localhost and private IP ranges for security
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return false;
      }
      
      // Block private IP ranges
      const privateIpPatterns = [
        /^192\.168\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./
      ];
      
      if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Process a single URL
   */
  async processUrl(url) {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid URL format: ${url}`);
    }

    try {
      const response = await this.axios.get(url);
      
      // Check content size
      const contentLength = response.data.length;
      if (contentLength > this.options.maxContentSize) {
        throw new Error(`Content size exceeds maximum: ${contentLength} > ${this.options.maxContentSize}`);
      }

      // Extract content type
      const contentType = this.extractContentType(response.headers, url);
      
      // Process based on content type
      let processedContent;
      if (contentType === 'text/html') {
        processedContent = this.extractTextFromHtml(response.data);
      } else {
        // For non-HTML content, use raw text
        processedContent = {
          content: response.data,
          title: this.extractTitleFromUrl(url),
          headings: []
        };
      }

      return {
        url,
        content: processedContent.content,
        contentType,
        title: processedContent.title || this.extractTitleFromUrl(url),
        statusCode: response.status,
        size: contentLength,
        metadata: {
          headings: processedContent.headings || [],
          description: processedContent.description,
          author: processedContent.author,
          lastModified: response.headers['last-modified'],
          contentLength: contentLength,
          responseHeaders: this.sanitizeHeaders(response.headers)
        }
      };

    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP Error ${error.response.status}: ${error.response.statusText}`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error(`DNS resolution failed for ${url}`);
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused to ${url}`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`Request timeout for ${url}`);
      } else {
        throw new Error(`Failed to fetch URL ${url}: ${error.message}`);
      }
    }
  }

  /**
   * Extract text content from HTML
   */
  extractTextFromHtml(html) {
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style, noscript').remove();
    
    // Extract title
    const title = $('title').text().trim();
    
    // Extract meta description and author
    const description = $('meta[name="description"]').attr('content') || '';
    const author = $('meta[name="author"]').attr('content') || '';
    
    // Extract headings for structure
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const heading = $(el).text().trim();
      if (heading) {
        headings.push(heading);
      }
    });
    
    // Extract main content text
    const content = $('body').text()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    return {
      title,
      content,
      headings,
      description,
      author
    };
  }

  /**
   * Process multiple URLs in batch
   */
  async processUrls(urls, options = {}) {
    const { maxConcurrent = 3 } = options;
    const results = [];
    
    // Process URLs in batches to avoid overwhelming servers
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (url) => {
        try {
          const result = await this.processUrl(url);
          return {
            success: true,
            ...result
          };
        } catch (error) {
          return {
            success: false,
            url,
            error: error.message
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to be respectful
      if (i + maxConcurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Extract content type from response headers or URL
   */
  extractContentType(headers, url) {
    const contentTypeHeader = headers['content-type'] || '';
    
    if (contentTypeHeader.includes('text/html')) {
      return 'text/html';
    } else if (contentTypeHeader.includes('application/json')) {
      return 'application/json';
    } else if (contentTypeHeader.includes('text/plain')) {
      return 'text/plain';
    } else if (contentTypeHeader.includes('text/markdown')) {
      return 'text/markdown';
    }
    
    // Fallback to URL extension
    const extension = path.extname(new URL(url).pathname).toLowerCase();
    const typeMap = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown'
    };
    
    return typeMap[extension] || 'text/html'; // Default to HTML for web content
  }

  /**
   * Extract title from URL path
   */
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      if (pathname === '/' || pathname === '') {
        return urlObj.hostname;
      }
      
      const filename = path.basename(pathname);
      if (filename && filename !== '/') {
        return filename.replace(/\.[^/.]+$/, ''); // Remove extension
      }
      
      return urlObj.hostname;
    } catch (error) {
      return 'Unknown Page';
    }
  }

  /**
   * Sanitize response headers for metadata storage
   */
  sanitizeHeaders(headers) {
    const allowedHeaders = [
      'content-type',
      'content-length',
      'last-modified',
      'etag',
      'cache-control'
    ];
    
    const sanitized = {};
    for (const header of allowedHeaders) {
      if (headers[header]) {
        sanitized[header] = headers[header];
      }
    }
    
    return sanitized;
  }

  /**
   * Discover links on a page for crawling
   */
  async discoverLinks(url, options = {}) {
    const { sameDomain = true, maxDepth = 1 } = options;
    
    if (maxDepth <= 0) {
      return [];
    }

    try {
      const result = await this.processUrl(url);
      
      if (result.contentType !== 'text/html') {
        return [];
      }

      const $ = cheerio.load(result.content);
      const links = [];
      const baseUrl = new URL(url);

      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        
        try {
          const linkUrl = new URL(href, url).toString();
          const linkObj = new URL(linkUrl);
          
          // Filter by domain if requested
          if (sameDomain && linkObj.hostname !== baseUrl.hostname) {
            return;
          }
          
          if (this.isValidUrl(linkUrl) && !links.includes(linkUrl)) {
            links.push(linkUrl);
          }
        } catch (error) {
          // Skip invalid links
        }
      });

      return links;
    } catch (error) {
      throw new Error(`Failed to discover links from ${url}: ${error.message}`);
    }
  }

  /**
   * Validate web processor configuration
   */
  static validateConfig(config) {
    if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      throw new Error('timeout must be a positive number');
    }
    
    if (config.maxContentSize && (typeof config.maxContentSize !== 'number' || config.maxContentSize <= 0)) {
      throw new Error('maxContentSize must be a positive number');
    }
    
    return true;
  }
}