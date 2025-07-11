const { Tool } = require('@jsenvoy/modules');

class SerperOpenAI extends Tool {
  constructor() {
    super();
    this.name = 'google_search';
    this.description = 'Performs Google searches using the Serper API';
    this.apiKey = null;
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
   * Returns the tool description in OpenAI function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'google_search_search',
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
        throw new Error('Serper tool not initialized. Please call initialize() with your API key first.');
      }
      
      // Perform the search
      const results = await this.search(args.query, args.num, args.dateRange);
      
      // Return success response
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        results
      );
    } catch (error) {
      // Return error response
      return this.createErrorResponse(
        toolCall.id,
        toolCall.function.name,
        error
      );
    }
  }

  /**
   * Performs a Google search using Serper API
   */
  async search(query, num = 10, dateRange = null) {
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
        throw new Error(`Serper API error (${response.status}): ${error}`);
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
      
      return results;
    } catch (error) {
      if (error.message.includes('fetch is not defined')) {
        // Fallback for Node.js versions without fetch
        const https = require('https');
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
                resolve({
                  query: query,
                  searchInformation: parsed.searchInformation,
                  organic: parsed.organic || [],
                  answerBox: parsed.answerBox || null,
                  knowledgeGraph: parsed.knowledgeGraph || null,
                  relatedSearches: parsed.relatedSearches || []
                });
              } else {
                reject(new Error(`Serper API error (${res.statusCode}): ${data}`));
              }
            });
          });

          req.on('error', reject);
          req.write(payload);
          req.end();
        });
      }
      throw new Error(`Failed to search: ${error.message}`);
    }
  }
}

module.exports = SerperOpenAI;