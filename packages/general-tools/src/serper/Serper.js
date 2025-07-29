import { Tool, ToolResult } from '@legion/module-loader';
import https from 'https';

export class Serper extends Tool {
  constructor(config = {}) {
    super();
    this.name = 'google_search';
    this.description = 'Performs Google searches using the Serper API';
    this.apiKey = config.apiKey || null;
    this.baseUrl = 'https://google.serper.dev/search';
  }

  /**
   * Initialize the tool with API key
   */
  async initialize(config) {
    if (!config || !config.apiKey) {
      throw new Error('Serper API key is required. Please provide it in the config object.');
    }
    this.apiKey = config.apiKey;
    return true;
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'google_search',
        description: 'Search Google and get results',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to send to Google'
            },
            num: {
              type: 'number',
              description: 'Number of results to return (default: 10, max: 100)'
            },
            dateRange: {
              type: 'string',
              description: 'Filter results by date range',
              enum: ['day', 'week', 'month', 'year']
            }
          },
          required: ['query']
        },
        output: {
          success: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query that was used'
              },
              searchInformation: {
                type: 'object',
                description: 'Information about the search results'
              },
              organic: {
                type: 'array',
                description: 'Organic search results',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    link: { type: 'string' },
                    snippet: { type: 'string' }
                  }
                }
              },
              answerBox: {
                type: 'object',
                description: 'Featured snippet or answer box if available'
              },
              knowledgeGraph: {
                type: 'object',
                description: 'Knowledge graph data if available'
              },
              relatedSearches: {
                type: 'array',
                description: 'Related search suggestions',
                items: { type: 'string' }
              }
            },
            required: ['query', 'organic']
          },
          failure: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query that failed'
              },
              errorType: {
                type: 'string',
                enum: ['not_initialized', 'api_error', 'network_error', 'validation_error'],
                description: 'Type of error that occurred'
              },
              statusCode: {
                type: 'number',
                description: 'HTTP status code if API error'
              }
            },
            required: ['errorType']
          }
        }
      }
    };
  }

  /**
   * Invokes the Google search with the given tool call
   */
  async invoke(toolCall) {
    try {
      // Parse the arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['query']);
      
      // Check if initialized
      if (!this.apiKey) {
        return ToolResult.failure(
          'Serper tool not initialized. Please call initialize() with your API key first.',
          {
            query: args.query,
            errorType: 'not_initialized'
          }
        );
      }
      
      // Perform the search
      return await this.performSearch(args.query, args.num, args.dateRange);
    } catch (error) {
      // Handle parameter validation errors
      return ToolResult.failure(
        error.message,
        {
          query: this.safeParseQuery(toolCall.function.arguments),
          errorType: 'validation_error'
        }
      );
    }
  }

  /**
   * Safely parses query from JSON arguments
   */
  safeParseQuery(argumentsJson) {
    try {
      if (argumentsJson) {
        const parsed = JSON.parse(argumentsJson);
        return parsed.query || 'unknown';
      }
      return 'unknown';
    } catch (error) {
      return 'invalid_json';
    }
  }

  /**
   * Performs a Google search using Serper API
   */
  async performSearch(query, num = 10, dateRange = null) {
    try {
      console.log(`Searching Google for: ${query}`);
      
      // Build request payload
      const payload = {
        q: query,
        num: Math.min(num, 100)
      };

      if (dateRange && ['day', 'week', 'month', 'year'].includes(dateRange)) {
        payload.tbs = `qdr:${dateRange.charAt(0)}`;
      }

      // Make API request
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.text();
        return ToolResult.failure(
          `Serper API error: ${error}`,
          {
            query: query,
            errorType: 'api_error',
            statusCode: response.status
          }
        );
      }

      const data = await response.json();
      
      // Format results
      const results = {
        query: query,
        searchInformation: data.searchInformation,
        organic: data.organic || [],
        answerBox: data.answerBox || null,
        knowledgeGraph: data.knowledgeGraph || null,
        relatedSearches: data.relatedSearches || []
      };

      console.log(`Found ${results.organic.length} search results`);
      
      return ToolResult.success(results);
    } catch (error) {
      if (error.message.includes('fetch is not defined')) {
        // Fallback for Node.js versions without fetch
        // https already imported at top
        return new Promise((resolve, reject) => {
          const payload = JSON.stringify({
            q: query,
            num: Math.min(num || 10, 100),
            ...(dateRange && { tbs: `qdr:${dateRange.charAt(0)}` })
          });

          const options = {
            hostname: 'google.serper.dev',
            path: '/search',
            method: 'POST',
            headers: {
              'X-API-KEY': this.apiKey,
              'Content-Type': 'application/json',
              'Content-Length': payload.length
            }
          };

          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(data);
                resolve(ToolResult.success({
                  query: query,
                  searchInformation: parsed.searchInformation,
                  organic: parsed.organic || [],
                  answerBox: parsed.answerBox || null,
                  knowledgeGraph: parsed.knowledgeGraph || null,
                  relatedSearches: parsed.relatedSearches || []
                }));
              } else {
                resolve(ToolResult.failure(
                  `Serper API error: ${data}`,
                  {
                    query: query,
                    errorType: 'api_error',
                    statusCode: res.statusCode
                  }
                ));
              }
            });
          });

          req.on('error', reject);
          req.write(payload);
          req.end();
        });
      }
      return ToolResult.failure(
        `Failed to search: ${error.message}`,
        {
          query: query,
          errorType: error.message.includes('API error') ? 'api_error' : 'network_error'
        }
      );
    }
  }

  /**
   * Legacy search method for CLI compatibility
   */
  async search(query, num = 10, dateRange = null) {
    const result = await this.performSearch(query, num, dateRange);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }
}