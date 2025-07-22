/**
 * Test Server for Cerebrate Chrome Extension Development
 * Provides HTTP server with test scenarios, mock data, and WebSocket support
 */
import http from 'http';
import ws, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestServer {
  constructor(options = {}) {
    this.config = this.validateAndNormalizeConfig(options);
    this.server = null;
    this.wss = null;
    this.running = false;
    this.port = null;
    this.startTime = null;
    
    // Request tracking
    this.requestCount = 0;
    this.requestLogs = [];
    
    // Custom routes and middleware
    this.customRoutes = new Map();
    this.middleware = [];
    
    // Mock data generators
    this.mockData = this.initializeMockData();
    
    // Test scenarios
    this.testScenarios = this.initializeTestScenarios();
  }

  /**
   * Validate and normalize configuration
   * @private
   */
  validateAndNormalizeConfig(options) {
    const defaults = {
      port: 0, // Use random available port
      enableMockData: true,
      enableTestScenarios: true,
      cors: true,
      staticDir: path.join(__dirname, '../static'),
      apiDelay: 0,
      maxRequestLogs: 100
    };

    const config = { ...defaults, ...options };

    // Validation
    if (typeof config.port !== 'number' || config.port < 0) {
      throw new Error('Invalid configuration: port must be >= 0');
    }
    
    if (typeof config.apiDelay !== 'number' || config.apiDelay < 0) {
      throw new Error('Invalid configuration: apiDelay must be >= 0');
    }

    return config;
  }

  /**
   * Start the test server
   * @returns {Promise<http.Server>} - Server instance
   */
  async start() {
    if (this.running) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', reject);
      
      this.server.listen(this.config.port, () => {
        this.port = this.server.address().port;
        this.running = true;
        this.startTime = Date.now();
        
        // Setup WebSocket server
        this.setupWebSocket();
        
        resolve(this.server);
      });
    });
  }

  /**
   * Stop the test server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.running) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      // Close HTTP server
      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.running = false;
          this.port = null;
          this.startTime = null;
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Setup WebSocket server
   * @private
   */
  setupWebSocket() {
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, message);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON message'
          }));
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  /**
   * Handle WebSocket messages
   * @private
   */
  handleWebSocketMessage(ws, message) {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }));
        break;
      
      default:
        ws.send(JSON.stringify({
          type: 'echo',
          data: message
        }));
    }
  }

  /**
   * Handle HTTP requests
   * @private
   */
  async handleRequest(req, res) {
    let requestStatus = 200;
    
    try {
      this.requestCount++;
      
      // Apply CORS headers
      if (this.config.cors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
      
      // Handle OPTIONS requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        this.logRequest(req, 200);
        return;
      }

      // Handle malformed JSON in POST requests
      if (req.method === 'POST' && req.headers['content-type'] === 'application/json') {
        const body = await this.readRequestBody(req);
        try {
          if (body) {
            JSON.parse(body);
          }
        } catch (jsonError) {
          requestStatus = 400;
          this.logRequest(req, requestStatus);
          this.sendError(res, 400, 'Bad Request', 'Invalid JSON in request body');
          return;
        }
      }

      // Apply middleware
      await this.applyMiddleware(req, res);

      // Route the request
      await this.routeRequest(req, res);
      
      // Log successful request
      this.logRequest(req, requestStatus);

    } catch (error) {
      requestStatus = 500;
      this.logRequest(req, requestStatus);
      this.handleServerError(res, error);
    }
  }

  /**
   * Apply middleware
   * @private
   */
  async applyMiddleware(req, res) {
    for (const middleware of this.middleware) {
      await new Promise((resolve, reject) => {
        middleware(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }

  /**
   * Route HTTP requests
   * @private
   */
  async routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Check custom routes first
    const routeKey = `${req.method}:${pathname}`;
    if (this.customRoutes.has(routeKey)) {
      const handler = this.customRoutes.get(routeKey);
      await handler(req, res);
      return;
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      await this.handleApiRequest(req, res, pathname, url);
      return;
    }

    // Scenario routes
    if (pathname.startsWith('/scenarios/')) {
      await this.handleScenarioRequest(req, res, pathname);
      return;
    }

    // Static file serving
    await this.handleStaticRequest(req, res, pathname);
  }

  /**
   * Handle API requests
   * @private
   */
  async handleApiRequest(req, res, pathname, url) {
    // Add artificial delay if configured
    if (this.config.apiDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.apiDelay));
    }

    switch (pathname) {
      case '/api/status':
        this.sendJson(res, this.getServerStatus());
        break;
      
      case '/api/config':
        this.sendJson(res, { config: this.getPublicConfig() });
        break;
      
      case '/api/logs':
        this.sendJson(res, { logs: this.requestLogs });
        break;
      
      case '/api/reset':
        if (req.method === 'POST') {
          this.resetServerState();
          this.sendJson(res, { reset: true, message: 'Server state reset successfully' });
        } else {
          this.sendError(res, 405, 'Method Not Allowed');
        }
        break;
      
      case '/api/websocket':
        this.sendJson(res, {
          websocket: {
            url: `ws://localhost:${this.port}/ws`,
            protocols: [],
            ready: true
          }
        });
        break;
      
      case '/api/scenarios':
        this.sendJson(res, { scenarios: this.getScenarioList() });
        break;

      default:
        // Mock data API
        if (pathname.startsWith('/api/mock/')) {
          await this.handleMockDataRequest(req, res, pathname, url);
        } else {
          this.sendError(res, 404, 'API endpoint not found');
        }
    }
  }

  /**
   * Handle mock data requests
   * @private
   */
  async handleMockDataRequest(req, res, pathname, url) {
    if (!this.config.enableMockData) {
      this.sendError(res, 404, 'Mock data disabled');
      return;
    }

    const dataType = pathname.replace('/api/mock/', '');
    const params = Object.fromEntries(url.searchParams.entries());

    switch (dataType) {
      case 'users':
        this.sendJson(res, { users: this.mockData.generateUsers(params) });
        break;
      
      case 'products':
        this.sendJson(res, { products: this.mockData.generateProducts(params) });
        break;
      
      case 'slow':
        await new Promise(resolve => setTimeout(resolve, 200));
        this.sendJson(res, { message: 'Slow response', delay: 200 });
        break;
      
      case 'error':
        this.sendError(res, 500, 'Mock server error', 'This is a simulated server error');
        break;

      default:
        this.sendError(res, 404, 'Mock data type not found');
    }
  }

  /**
   * Handle scenario requests
   * @private
   */
  async handleScenarioRequest(req, res, pathname) {
    if (!this.config.enableTestScenarios) {
      this.sendError(res, 404, 'Test scenarios disabled');
      return;
    }

    const scenarioId = pathname.replace('/scenarios/', '');
    const scenario = this.testScenarios[scenarioId];

    if (!scenario) {
      this.sendError(res, 404, 'Scenario not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(scenario.html);
  }

  /**
   * Handle static file requests
   * @private
   */
  async handleStaticRequest(req, res, pathname) {
    // Default to index.html for root requests
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Generate static content if file doesn't exist
    const content = this.generateStaticContent(pathname);
    
    if (!content) {
      this.sendError(res, 404, 'File not found');
      return;
    }

    const { mimeType, data } = content;
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  }

  /**
   * Generate static content for testing
   * @private
   */
  generateStaticContent(pathname) {
    const ext = path.extname(pathname).toLowerCase();
    
    // Only generate content for known test files
    const testFiles = [
      '/test-page.html', '/index.html',
      '/styles/test.css', '/scripts/test.js'
    ];
    
    if (!testFiles.includes(pathname)) {
      return null;
    }
    
    switch (ext) {
      case '.html':
        return {
          mimeType: 'text/html',
          data: this.generateTestHtml(pathname)
        };
      
      case '.css':
        return {
          mimeType: 'text/css',
          data: this.generateTestCss(pathname)
        };
      
      case '.js':
        return {
          mimeType: 'application/javascript',
          data: this.generateTestJs(pathname)
        };
      
      default:
        return null;
    }
  }

  /**
   * Generate test HTML content
   * @private
   */
  generateTestHtml(pathname) {
    const fileName = path.basename(pathname, '.html');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page - ${fileName}</title>
    <link rel="stylesheet" href="/styles/test.css">
</head>
<body>
    <div id="app">
        <header>
            <h1>Test Page: ${fileName}</h1>
            <nav>
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/scenarios/dom-testing">DOM Testing</a></li>
                    <li><a href="/scenarios/accessibility">Accessibility</a></li>
                </ul>
            </nav>
        </header>
        <main>
            <div id="test-element" class="test-class">
                <p>This is a test element for debugging and inspection.</p>
            </div>
        </main>
    </div>
    <script src="/scripts/test.js"></script>
</body>
</html>`;
  }

  /**
   * Generate test CSS content
   * @private
   */
  generateTestCss(pathname) {
    return `.test-class {
    background-color: #f0f0f0;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 5px;
}

.performance-heavy {
    box-shadow: 0 0 50px rgba(0,0,0,0.8);
    filter: blur(10px);
    animation: spin 2s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.accessibility-test {
    color: #333;
    background: #fff;
    font-size: 16px;
}`;
  }

  /**
   * Generate test JavaScript content
   * @private
   */
  generateTestJs(pathname) {
    return `// Test JavaScript file
function testFunction() {
    console.log('Test function called');
    return 'test result';
}

// Add some test functionality
document.addEventListener('DOMContentLoaded', function() {
    const testElement = document.getElementById('test-element');
    if (testElement) {
        testElement.addEventListener('click', function() {
            console.log('Test element clicked');
        });
    }
});

// Export for testing
window.testFunction = testFunction;`;
  }

  /**
   * Initialize mock data generators
   * @private
   */
  initializeMockData() {
    return {
      generateUsers(params = {}) {
        const limit = parseInt(params.limit) || 10;
        const users = [];
        
        for (let i = 1; i <= limit; i++) {
          users.push({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            age: 20 + (i % 50)
          });
        }
        
        return users;
      },

      generateProducts(params = {}) {
        const limit = parseInt(params.limit) || 10;
        const products = [];
        
        for (let i = 1; i <= limit; i++) {
          products.push({
            id: i,
            name: `Product ${i}`,
            price: 10 + (i * 5),
            category: i % 2 === 0 ? 'Electronics' : 'Books'
          });
        }
        
        return products;
      }
    };
  }

  /**
   * Initialize test scenarios
   * @private
   */
  initializeTestScenarios() {
    return {
      'dom-testing': {
        id: 'dom-testing',
        name: 'DOM Testing Scenario',
        description: 'Various DOM elements for testing inspection and analysis',
        url: '/scenarios/dom-testing',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>DOM Testing Scenario</title>
</head>
<body>
    <h1>DOM Testing Scenario</h1>
    <div id="test-element" class="test-class" data-test="value">
        <p>Test content</p>
        <button onclick="alert('clicked')">Test Button</button>
    </div>
</body>
</html>`
      },

      'accessibility': {
        id: 'accessibility',
        name: 'Accessibility Testing',
        description: 'Page with accessibility features and issues',
        url: '/scenarios/accessibility',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>Accessibility Testing</title>
</head>
<body>
    <h1>Accessibility Testing</h1>
    <main role="main">
        <button aria-label="Close dialog">×</button>
        <input type="text" aria-describedby="help-text" />
        <div id="help-text">Help text</div>
    </main>
</body>
</html>`
      },

      'performance': {
        id: 'performance',
        name: 'Performance Testing',
        description: 'Page with performance issues for testing',
        url: '/scenarios/performance',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>Performance Testing</title>
    <style>.performance-heavy { filter: blur(5px); }</style>
</head>
<body>
    <h1>Performance Testing</h1>
    <div class="performance-heavy">
        <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="test">
    </div>
</body>
</html>`
      },

      'errors': {
        id: 'errors',
        name: 'Error Testing',
        description: 'Page that generates various types of errors',
        url: '/scenarios/errors',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>Error Testing</title>
</head>
<body>
    <h1>Error Testing</h1>
    <button onclick="throw new Error('Test error')">Trigger Error</button>
    <script>
        window.addEventListener('error', function(e) {
            console.error('Caught error:', e.error);
        });
    </script>
</body>
</html>`
      }
    };
  }

  /**
   * Get list of available scenarios
   * @private
   */
  getScenarioList() {
    return Object.values(this.testScenarios).map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      url: scenario.url
    }));
  }

  /**
   * Get server status
   * @private
   */
  getServerStatus() {
    const process = global.process || {};
    const memoryUsage = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, heapTotal: 0 };
    
    return {
      status: 'running',
      port: this.port,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      requests: this.requestCount,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal
      }
    };
  }

  /**
   * Get public configuration
   * @private
   */
  getPublicConfig() {
    return {
      port: this.port,
      cors: this.config.cors,
      mockData: this.config.enableMockData,
      testScenarios: this.config.enableTestScenarios
    };
  }

  /**
   * Reset server state
   * @private
   */
  resetServerState() {
    this.requestCount = 0;
    this.requestLogs.length = 0;
  }

  /**
   * Read request body
   * @private
   */
  async readRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  /**
   * Log request
   * @private
   */
  logRequest(req, status = 200) {
    const log = {
      method: req.method,
      url: req.url,
      status: status,
      timestamp: Date.now()
    };

    this.requestLogs.unshift(log);
    
    // Keep only the most recent logs
    if (this.requestLogs.length > this.config.maxRequestLogs) {
      this.requestLogs = this.requestLogs.slice(0, this.config.maxRequestLogs);
    }
  }

  /**
   * Handle server errors
   * @private
   */
  handleServerError(res, error) {
    console.error('Server error:', error);
    
    if (!res.headersSent) {
      this.sendError(res, 500, 'Internal Server Error', error.message);
    }
  }

  /**
   * Send JSON response
   * @private
   */
  sendJson(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   * @private
   */
  sendError(res, status, error, message = null) {
    const errorData = {
      error,
      message: message || error
    };
    
    this.sendJson(res, errorData, status);
  }

  /**
   * Add custom route
   * @param {string} path - Route path
   * @param {string} method - HTTP method
   * @param {Function} handler - Route handler
   */
  addRoute(path, method, handler) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    this.customRoutes.set(routeKey, handler);
  }

  /**
   * Add middleware
   * @param {Function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Get server URL
   * @returns {string} - Server URL
   */
  getUrl() {
    return `http://localhost:${this.port}`;
  }

  /**
   * Get server port
   * @returns {number} - Server port
   */
  getPort() {
    return this.port;
  }

  /**
   * Check if server is running
   * @returns {boolean} - Running status
   */
  isRunning() {
    return this.running;
  }
}