/**
 * WebFetchTool - Fetch and process content from URLs
 * MVP implementation - fetches and converts HTML to text
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Input schema for validation
const webFetchToolSchema = z.object({
  url: z.string().url(),
  prompt: z.string().min(1),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().max(30000).optional().default(10000)
});

export class WebFetchTool extends Tool {
  constructor() {
    super({
      name: 'WebFetch',
      description: 'Fetch content from a URL and process it with a prompt',
      inputSchema: webFetchToolSchema,
      execute: async (input) => this.fetchAndProcess(input),
      getMetadata: () => this.getToolMetadata()
    });
  }

  /**
   * Fetch content from URL and process with prompt
   */
  async fetchAndProcess(input) {
    try {
      const {
        url,
        prompt,
        headers = {},
        timeout = 10000
      } = input;

      // Fetch the content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LegionWebFetch/1.0)',
          ...headers
        },
        timeout,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: {
            code: 'HTTP_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
            url: url,
            status: response.status
          }
        };
      }

      // Process based on content type
      const contentType = response.headers['content-type'] || '';
      let extractedContent = '';

      if (contentType.includes('text/html')) {
        // Parse HTML and extract text
        const $ = cheerio.load(response.data);
        
        // Remove script and style elements
        $('script').remove();
        $('style').remove();
        
        // Extract text content
        extractedContent = $('body').text().trim();
        
        // Also extract title and meta description if available
        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') || '';
        
        if (title) {
          extractedContent = `Title: ${title}\n\n${extractedContent}`;
        }
        if (description) {
          extractedContent = `Description: ${description}\n\n${extractedContent}`;
        }
      } else if (contentType.includes('text/')) {
        // Plain text content
        extractedContent = response.data;
      } else if (contentType.includes('application/json')) {
        // JSON content
        extractedContent = JSON.stringify(response.data, null, 2);
      } else {
        // Other content types
        extractedContent = `[Binary content of type: ${contentType}]`;
      }

      // Truncate if too long
      if (extractedContent.length > 50000) {
        extractedContent = extractedContent.substring(0, 50000) + '\n... [content truncated]';
      }

      // MVP: Simple processing - combine prompt with content
      // In production, this would use an AI model to process the content
      const processedResult = {
        prompt: prompt,
        content_summary: extractedContent.substring(0, 500) + (extractedContent.length > 500 ? '...' : ''),
        analysis: `Content fetched from ${url}. This is an MVP implementation. In production, the content would be processed with the prompt: "${prompt}"`,
        metadata: {
          url: url,
          content_type: contentType,
          content_length: extractedContent.length,
          status_code: response.status
        }
      };

      return {
        success: true,
        data: processedResult
      };

    } catch (error) {
      // Handle specific error types
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: {
            code: 'OPERATION_TIMEOUT',
            message: `Request timeout after ${input.timeout}ms`,
            url: input.url
          }
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: `Domain not found: ${input.url}`,
            url: input.url
          }
        };
      } else if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: `Connection refused: ${input.url}`,
            url: input.url
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to fetch content: ${error.message}`,
          url: input.url,
          details: error.stack
        }
      };
    }
  }

  /**
   * Get tool metadata
   */
  getToolMetadata() {
    return {
      name: 'WebFetch',
      description: 'Fetch content from a URL and process it with a prompt',
      input: {
        url: {
          type: 'string',
          required: true,
          description: 'The URL to fetch content from'
        },
        prompt: {
          type: 'string',
          required: true,
          description: 'The prompt to process the content with'
        },
        headers: {
          type: 'object',
          required: false,
          description: 'Additional HTTP headers'
        },
        timeout: {
          type: 'number',
          required: false,
          description: 'Request timeout in milliseconds (max 30000)'
        }
      },
      output: {
        prompt: {
          type: 'string',
          description: 'The processing prompt'
        },
        content_summary: {
          type: 'string',
          description: 'Summary of fetched content'
        },
        analysis: {
          type: 'string',
          description: 'Analysis result'
        },
        metadata: {
          type: 'object',
          description: 'Fetch metadata'
        }
      }
    };
  }
}