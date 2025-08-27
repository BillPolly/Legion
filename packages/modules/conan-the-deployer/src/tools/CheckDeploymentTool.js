import { Tool } from '@legion/tools-registry';

/**
 * CheckDeploymentTool - Verifies deployment status and tests endpoints
 */
class CheckDeploymentTool extends Tool {
  constructor(config = {}) {
    super();
    this.name = 'check_deployment';
    this.description = 'Check deployment status and test application endpoints';
    this.config = config;
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The deployment URL to check'
            },
            endpoints: {
              type: 'array',
              description: 'List of endpoints to test (default: ["/", "/status", "/health"])',
              items: {
                type: 'string'
              }
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds for each request (default: 10000)'
            },
            retries: {
              type: 'number',
              description: 'Number of retries if app is not ready (default: 5)'
            },
            retryDelay: {
              type: 'number',
              description: 'Delay between retries in milliseconds (default: 30000)'
            },
            expectedStatus: {
              type: 'number',
              description: 'Expected HTTP status code (default: 200)'
            }
          },
          required: ['url']
        }
      }
    };
  }

  async execute(params) {
    const {
      url,
      endpoints = ['/', '/status', '/health'],
      timeout = 10000,
      retries = 5,
      retryDelay = 30000,
      expectedStatus = 200
    } = params;

    // this.emitInfo(`🔍 Checking deployment at ${url}`);

    const results = {
      url,
      isLive: false,
      endpoints: {},
      attempts: 0,
      finalStatus: null,
      timestamp: new Date().toISOString()
    };

    // Try to connect with retries
    for (let attempt = 1; attempt <= retries; attempt++) {
      results.attempts = attempt;
      // this.emitProgress(`Attempt ${attempt}/${retries}...`);

      try {
        // Test main URL first
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Conan-Deployment-Checker/1.0'
          }
        });
        
        clearTimeout(timeoutId);

        if (response.ok || response.status === expectedStatus) {
          results.isLive = true;
          results.finalStatus = response.status;
          
          this.emitInfo(`✅ Deployment is live! (Status: ${response.status})`);
          
          // Test all endpoints
          for (const endpoint of endpoints) {
            await this.testEndpoint(url, endpoint, results.endpoints, timeout);
          }
          
          break;
        } else if (response.status === 404 && attempt < retries) {
          this.emitWarning(`Application not ready yet (404). Waiting ${retryDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          results.finalStatus = response.status;
          // this.emitWarning(`Unexpected status: ${response.status}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          // this.emitWarning(`Request timed out after ${timeout}ms`);
        } else {
          // this.emitWarning(`Connection error: ${error.message}`);
        }
        
        if (attempt < retries) {
          // this.emitProgress(`Waiting ${retryDelay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // Final summary
    if (results.isLive) {
      // this.emitInfo('\n📊 Deployment Check Summary:');
      // this.emitInfo(`   URL: ${url}`);
      // this.emitInfo(`   Status: Live ✅`);
      // this.emitInfo(`   Attempts: ${results.attempts}`);
      
      if (Object.keys(results.endpoints).length > 0) {
        // this.emitInfo('\n   Endpoint Results:');
        for (const [endpoint, data] of Object.entries(results.endpoints)) {
          const status = data.success ? '✅' : '❌';
          // this.emitInfo(`   ${status} ${endpoint} - Status: ${data.status}`);
          if (data.contentType) {
            // this.emitInfo(`      Content-Type: ${data.contentType}`);
          }
          if (data.sample) {
            // this.emitInfo(`      Response: ${data.sample}`);
          }
        }
      }
    } else {
      // this.emitError(`\n❌ Deployment not accessible after ${results.attempts} attempts`);
      // this.emitError(`   Last status: ${results.finalStatus || 'No response'}`);
      // this.emitError(`   The deployment may still be building or there may be an issue.`);
    }

    return {
      success: results.isLive,
      data: results
    };
  }

  async testEndpoint(baseUrl, endpoint, results, timeout) {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Conan-Deployment-Checker/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get('content-type') || '';
      let sample = '';
      
      if (contentType.includes('application/json')) {
        const json = await response.json();
        sample = JSON.stringify(json, null, 2).substring(0, 200);
      } else if (contentType.includes('text/')) {
        const text = await response.text();
        sample = text.substring(0, 200);
      }
      
      results[endpoint] = {
        success: response.ok,
        status: response.status,
        contentType,
        sample: sample.length > 0 ? sample : undefined
      };
    } catch (error) {
      results[endpoint] = {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }
}

export default CheckDeploymentTool;