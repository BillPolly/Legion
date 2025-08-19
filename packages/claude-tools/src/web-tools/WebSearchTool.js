/**
 * WebSearchTool - Search the web for current information
 * MVP implementation - returns mock results for testing
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

// Input schema for validation
const webSearchToolSchema = z.object({
  query: z.string().min(2),
  allowed_domains: z.array(z.string()).optional(),
  blocked_domains: z.array(z.string()).optional()
});

export class WebSearchTool extends Tool {
  constructor() {
    super({
      name: 'WebSearch',
      description: 'Search the web for current information',
      inputSchema: webSearchToolSchema,
      execute: async (input) => this.searchWeb(input),
      getMetadata: () => this.getToolMetadata()
    });
  }

  /**
   * Search the web (MVP mock implementation)
   */
  async searchWeb(input) {
    try {
      const { query, allowed_domains = [], blocked_domains = [] } = input;

      // MVP: Return mock search results
      // In production, this would integrate with a search API
      const mockResults = [
        {
          title: `Search result for: ${query}`,
          url: `https://example.com/result1`,
          snippet: `This is a mock search result for the query "${query}". In a real implementation, this would contain actual search results.`,
          domain: 'example.com',
          relevance_score: 0.95
        },
        {
          title: `Related information about ${query}`,
          url: `https://example.org/result2`,
          snippet: `Additional mock content related to your search query. This demonstrates the search result format.`,
          domain: 'example.org',
          relevance_score: 0.85
        }
      ];

      // Filter by allowed/blocked domains
      const filteredResults = mockResults.filter(result => {
        if (allowed_domains.length > 0 && !allowed_domains.includes(result.domain)) {
          return false;
        }
        if (blocked_domains.includes(result.domain)) {
          return false;
        }
        return true;
      });

      return {
        success: true,
        data: {
          query,
          results: filteredResults,
          search_metadata: {
            total_results: filteredResults.length,
            search_time_ms: 100,
            search_engine: 'mock'
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to search web: ${error.message}`,
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
      name: 'WebSearch',
      description: 'Search the web for current information',
      input: {
        query: {
          type: 'string',
          required: true,
          description: 'Search query (min 2 characters)'
        },
        allowed_domains: {
          type: 'array',
          required: false,
          description: 'Domain whitelist'
        },
        blocked_domains: {
          type: 'array',
          required: false,
          description: 'Domain blacklist'
        }
      },
      output: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        results: {
          type: 'array',
          description: 'Search results'
        },
        search_metadata: {
          type: 'object',
          description: 'Search metadata'
        }
      }
    };
  }
}