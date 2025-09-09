/**
 * WebSearchTool - Ported from Gemini CLI web-search.ts to Legion patterns
 * Performs web searches with grounding support
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for web searching (ported from Gemini CLI's web-search.ts)
 */
class WebSearchTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.shortName = 'search';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      super({
        name: 'web_search',
        shortName: 'search',
        description: 'Performs web searches with grounding support (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              }
            },
            required: ['query']
          },
          output: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Search results content'
              },
              sources: {
                type: 'array',
                description: 'Source information',
                items: { type: 'object' }
              },
              query: {
                type: 'string',
                description: 'The search query that was executed'
              }
            },
            required: ['content', 'query']
          }
        }
      });
    }
  }

  /**
   * Execute web search (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for web search
   * @returns {Promise<Object>} The search results
   */
  async _execute(args) {
    try {
      const { query } = args;

      // Validate input
      if (typeof query !== 'string') {
        throw new Error('Query must be a string');
      }

      if (query.trim() === '') {
        throw new Error('Query cannot be empty');
      }

      // For MVP implementation: return indication that web search would be performed
      // In full implementation, this would integrate with real search APIs
      const searchContent = `Web search functionality is available but requires search API integration.
Query: "${query}"

This tool would typically:
1. Perform web search using Google Search API or similar
2. Return relevant search results with grounding metadata
3. Provide source citations and links

To fully implement this tool, integrate with:
- Google Custom Search API
- Bing Search API  
- Or other search service providers

The framework is ready for integration.`;

      return {
        content: searchContent,
        sources: [],
        query: query.trim()
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to perform web search');
    }
  }
}

export default WebSearchTool;