/**
 * WebFetchTool - Ported from Gemini CLI web-fetch.ts to Legion patterns
 * Fetches and processes web content with HTML to text conversion
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for fetching web content (ported from Gemini CLI's web-fetch.ts)
 */
class WebFetchTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.timeout = config.timeout || 10000;
      this.maxLength = config.maxLength || 100000;
      this.shortName = 'fetch';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { timeout = 10000, maxLength = 100000 } = moduleOrConfig || {};
      
      super({
        name: 'web_fetch',
        shortName: 'fetch',
        description: 'Fetches and processes web content with HTML to text conversion (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to fetch content from'
              },
              prompt: {
                type: 'string',
                description: 'Optional prompt to process the content with'
              }
            },
            required: ['url']
          },
          output: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The fetched and processed content'
              },
              url: {
                type: 'string',
                description: 'The URL that was fetched'
              },
              title: {
                type: 'string',
                description: 'Page title if available'
              }
            },
            required: ['content', 'url']
          }
        }
      });

      this.timeout = timeout;
      this.maxLength = maxLength;
    }
  }

  /**
   * Execute web fetch (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for web fetching
   * @returns {Promise<Object>} The fetched content
   */
  async _execute(args) {
    try {
      const { url, prompt } = args;

      // Validate input
      if (typeof url !== 'string') {
        throw new Error('URL must be a string');
      }

      if (url.trim() === '') {
        throw new Error('URL cannot be empty');
      }

      // Validate URL format (ported from Gemini CLI validation)
      let validUrl;
      try {
        validUrl = new URL(url);
      } catch (error) {
        throw new Error('Invalid URL format');
      }

      // Security check - only allow http/https (ported from Gemini CLI)
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported');
      }

      // Fetch content with timeout (ported logic from Gemini CLI)
      const response = await this._fetchWithTimeout(validUrl.toString());

      // Process content (ported from Gemini CLI)
      const processedContent = await this._processContent(response);

      return {
        content: processedContent.content,
        url: validUrl.toString(),
        title: processedContent.title || 'No title'
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to fetch web content');
    }
  }

  /**
   * Fetch URL with timeout (ported from Gemini CLI)
   * @param {string} url - URL to fetch
   * @returns {Promise<Object>} Response object
   */
  async _fetchWithTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Gemini-Compatible-Agent/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      
      return {
        content,
        headers: response.headers,
        status: response.status,
        url: response.url
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Process fetched content (ported from Gemini CLI HTML processing)
   * @param {Object} response - Fetch response
   * @returns {Object} Processed content
   */
  async _processContent(response) {
    try {
      const { content, headers } = response;
      
      // Check content type
      const contentType = headers.get('content-type') || '';
      
      let processedContent = content;
      let title = null;

      if (contentType.includes('text/html')) {
        // Convert HTML to text (simplified version of Gemini CLI's html-to-text)
        processedContent = this._htmlToText(content);
        
        // Extract title
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = titleMatch ? titleMatch[1].trim() : null;
      }

      // Truncate if too long (ported from Gemini CLI length limits)
      if (processedContent.length > this.maxLength) {
        processedContent = processedContent.substring(0, this.maxLength) + 
                          `\n\n[Content truncated - original length: ${content.length} characters]`;
      }

      return {
        content: processedContent,
        title
      };

    } catch (error) {
      throw new Error(`Content processing failed: ${error.message}`);
    }
  }

  /**
   * Simple HTML to text conversion (ported concept from Gemini CLI)
   * @param {string} html - HTML content
   * @returns {string} Text content
   */
  _htmlToText(html) {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
      .replace(/<style[^>]*>.*?<\/style>/gis, '')   // Remove styles
      .replace(/<[^>]+>/g, ' ')                      // Remove HTML tags
      .replace(/\s+/g, ' ')                          // Normalize whitespace
      .trim();
  }
}

export default WebFetchTool;