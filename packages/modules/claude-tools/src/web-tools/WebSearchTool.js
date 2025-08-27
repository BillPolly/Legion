/**
 * WebSearchTool - Search the web for current information
 * MVP implementation - returns mock results for testing
 */

import { Tool } from '@legion/tools-registry';

export class WebSearchTool extends Tool {
  constructor() {
    super({
      name: 'WebSearch',
      description: 'Search the web and use the results to provide up-to-date information beyond Claude\'s knowledge cutoff',
      schema: {
        input: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              minLength: 2,
              description: 'The search query to use'
            },
            allowed_domains: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Only include search results from these domains'
            },
            blocked_domains: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Never include search results from these domains'
            }
          },
          required: ['query']
        },
        output: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query that was used'
            },
            results: {
              type: 'array',
              description: 'Search result information formatted as search result blocks',
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Title of the search result'
                  },
                  url: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL of the search result'
                  },
                  snippet: {
                    type: 'string',
                    description: 'Brief excerpt or description from the page'
                  },
                  domain: {
                    type: 'string',
                    description: 'Domain name of the result'
                  },
                  relevance_score: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'Relevance score (0-1)'
                  }
                }
              }
            },
            search_metadata: {
              type: 'object',
              description: 'Metadata about the search operation',
              properties: {
                total_results: {
                  type: 'integer',
                  description: 'Total number of results returned'
                },
                search_time_ms: {
                  type: 'number',
                  description: 'Time taken for search in milliseconds'
                },
                search_engine: {
                  type: 'string',
                  description: 'Search engine used'
                }
              }
            }
          },
          required: ['query', 'results', 'search_metadata']
        }
      }
    });
  }

  async execute(input) {
    return await this.searchWeb(input);
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

}