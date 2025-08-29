import { Tool } from '@legion/tools-registry';
import https from 'https';

export class Serper extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.apiKey = null;
    this.baseUrl = 'https://google.serper.dev/search';
  }


  /**
   * Execute the tool with the given parameters
   * This is the main entry point for single-function tools
   */
  async _execute(params) {
    // Check if initialized
    if (!this.apiKey) {
      throw new Error('Serper tool not initialized. Please provide SERPER_API_KEY in environment.');
    }

    // Validate required parameters
    if (!params.query) {
      throw new Error('Missing required parameter: query');
    }

    // Validate empty query
    if (params.query.trim() === '') {
      throw new Error('Query cannot be empty');
    }

    // Perform the search
    const result = await this.performSearch(params.query, params.num, params.dateRange);
    
    // If performSearch returned an error, throw it
    if (!result.success) {
      const error = new Error(result.error);
      error.cause = { query: params.query, statusCode: result.statusCode };
      throw error;
    }
    
    // Return just the data (not wrapped in success/data)
    return result;
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
        const errorText = await response.text();
        return {
          success: false,
          error: `Serper API error: ${errorText}`,
          query: query,
          statusCode: response.status
        };
      }

      const data = await response.json();
      
      // Format results - now include success flag and convert organic to results
      const results = {
        success: true,
        query: query,
        searchInformation: data.searchInformation,
        results: (data.organic || []).map((item, index) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          position: index + 1
        })),
        answerBox: data.answerBox || null,
        knowledgeGraph: data.knowledgeGraph || null,
        relatedSearches: data.relatedSearches || []
      };

      console.log(`Found ${results.results.length} search results`);
      
      return results;
    } catch (error) {
      if (error.message.includes('fetch is not defined')) {
        // Fallback for Node.js versions without fetch
        // https already imported at top
        return new Promise((resolve) => {
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
                  success: true,
                  query: query,
                  searchInformation: parsed.searchInformation,
                  results: (parsed.organic || []).map((item, index) => ({
                    title: item.title,
                    link: item.link,
                    snippet: item.snippet,
                    position: index + 1
                  })),
                  answerBox: parsed.answerBox || null,
                  knowledgeGraph: parsed.knowledgeGraph || null,
                  relatedSearches: parsed.relatedSearches || []
                });
              } else {
                resolve({
                  success: false,
                  error: `Serper API error: ${data}`,
                  query: query,
                  statusCode: res.statusCode
                });
              }
            });
          });

          req.on('error', (err) => {
            resolve({
              success: false,
              error: `Network error: ${err.message}`,
              query: query
            });
          });
          req.write(payload);
          req.end();
        });
      }
      return {
        success: false,
        error: `Failed to search: ${error.message}`,
        query: query
      };
    }
  }

  /**
   * Legacy search method for CLI compatibility
   */
  async search(query, num = 10, dateRange = null) {
    return await this.performSearch(query, num, dateRange);
  }
}