/**
 * Development Server for Cerebrate
 * Provides hot reload, file watching, and development utilities
 */
import { EventEmitter } from 'events';

// Track used ports across all server instances
const globalUsedPorts = new Set();

export class DevServer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: 3000,
      host: 'localhost',
      hotReload: true,
      liveReload: true,
      watchFiles: true,
      watchPatterns: ['**/*.js', '**/*.css', '**/*.html', '**/*.json'],
      watchIgnore: ['**/node_modules/**', '**/*.test.js', '**/*.spec.js'],
      debug: false,
      cors: true,
      ...config
    };
    
    this.validateConfig();
    
    this.server = null;
    this.wsConnections = new Set();
    this.fileWatcher = null;
    this.isServerRunning = false;
    
    // Event handlers
    this.fileChangeHandlers = [];
    this.reloadHandlers = [];
    this.logHandlers = [];
    
    // Debounce settings
    this.debounceTimeout = null;
    this.debounceDelay = 300;
    
    // File serving
    this.mimeTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
  }
  
  /**
   * Validate configuration
   * @private
   */
  validateConfig() {
    if (this.config.port < 1 || this.config.port > 65535) {
      throw new Error('Port must be between 1 and 65535');
    }
    
    if (!this.config.host || this.config.host === '') {
      throw new Error('Host cannot be empty');
    }
    
    if (this.config.watchPatterns && !Array.isArray(this.config.watchPatterns)) {
      throw new Error('Watch patterns must be an array');
    }
  }
  
  /**
   * Start the development server
   * @returns {Promise<Object>} - Start result
   */
  async start() {
    if (this.isServerRunning) {
      throw new Error('Server is already running');
    }
    
    try {
      const port = await this.findAvailablePort(this.config.port);
      const url = `http://${this.config.host}:${port}`;
      
      // Simulate server startup
      this.server = {
        port: port,
        url: url,
        listening: true
      };
      
      this.config.port = port;
      this.isServerRunning = true;
      
      // Setup file watching
      if (this.config.watchFiles) {
        this.setupFileWatcher();
      }
      
      this.log(`Development server started at ${url}`);
      
      return {
        success: true,
        port: port,
        url: url,
        host: this.config.host
      };
      
    } catch (error) {
      throw new Error(`Failed to start server: ${error.message}`);
    }
  }
  
  /**
   * Stop the development server
   * @returns {Promise<Object>} - Stop result
   */
  async stop() {
    if (!this.isServerRunning) {
      throw new Error('Server is not running');
    }
    
    try {
      // Close WebSocket connections
      for (const ws of this.wsConnections) {
        if (ws.readyState === 1 && typeof ws.close === 'function') { // OPEN
          ws.close();
        }
      }
      this.wsConnections.clear();
      
      // Stop file watcher
      if (this.fileWatcher) {
        this.fileWatcher.close();
        this.fileWatcher = null;
      }
      
      // Stop server
      this.server = null;
      this.isServerRunning = false;
      
      // Release allocated port
      if (this.allocatedPort) {
        globalUsedPorts.delete(this.allocatedPort);
        this.allocatedPort = null;
      }
      
      this.log('Development server stopped');
      
      return {
        success: true
      };
      
    } catch (error) {
      throw new Error(`Failed to stop server: ${error.message}`);
    }
  }
  
  /**
   * Check if server is running
   * @returns {boolean} - Is running
   */
  isRunning() {
    return this.isServerRunning;
  }
  
  /**
   * Find available port starting from given port
   * @param {number} startPort - Starting port
   * @returns {Promise<number>} - Available port
   * @private
   */
  async findAvailablePort(startPort) {
    let port = startPort;
    while (globalUsedPorts.has(port)) {
      port++;
    }
    globalUsedPorts.add(port);
    this.allocatedPort = port;
    return port;
  }
  
  /**
   * Setup file watcher
   * @private
   */
  setupFileWatcher() {
    // Mock file watcher
    this.fileWatcher = {
      watching: true,
      patterns: this.config.watchPatterns,
      ignore: this.config.watchIgnore,
      close: () => {
        this.fileWatcher = null;
      }
    };
    
    this.log('File watcher started');
  }
  
  /**
   * Check if files are being watched
   * @returns {boolean} - Is watching files
   */
  isWatchingFiles() {
    return this.fileWatcher !== null;
  }
  
  /**
   * Simulate file change (for testing)
   * @param {string} filePath - File path that changed
   */
  simulateFileChange(filePath) {
    if (!this.isWatchingFiles()) return;
    
    // Check if file should be ignored
    if (this.shouldIgnoreFile(filePath)) {
      return;
    }
    
    const changeEvent = {
      path: filePath,
      event: 'change',
      timestamp: new Date().toISOString()
    };
    
    // Emit to file change handlers
    this.fileChangeHandlers.forEach(handler => {
      try {
        handler(changeEvent);
      } catch (error) {
        this.log(`File change handler error: ${error.message}`);
      }
    });
    
    // Trigger hot reload if enabled
    if (this.config.hotReload) {
      this.triggerReload(changeEvent);
    }
  }
  
  /**
   * Check if file should be ignored
   * @param {string} filePath - File path
   * @returns {boolean} - Should ignore
   * @private
   */
  shouldIgnoreFile(filePath) {
    for (const pattern of this.config.watchIgnore) {
      if (this.matchPattern(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Match file path against pattern
   * @param {string} filePath - File path
   * @param {string} pattern - Pattern to match
   * @returns {boolean} - Matches pattern
   * @private
   */
  matchPattern(filePath, pattern) {
    // Simple pattern matching
    if (pattern.includes('**')) {
      const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
      return new RegExp(regex).test(filePath);
    }
    
    if (pattern.includes('*')) {
      const regex = pattern.replace(/\*/g, '[^/]*');
      return new RegExp(regex).test(filePath);
    }
    
    return filePath.includes(pattern.replace('**/', '').replace('*', ''));
  }
  
  /**
   * Trigger reload with debouncing
   * @param {Object} changeEvent - Change event
   * @private
   */
  triggerReload(changeEvent) {
    // Clear existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Set new timeout
    this.debounceTimeout = setTimeout(() => {
      const reloadEvent = {
        type: 'file-changed',
        file: changeEvent.path,
        timestamp: changeEvent.timestamp
      };
      
      // Emit to reload handlers
      this.reloadHandlers.forEach(handler => {
        try {
          handler(reloadEvent);
        } catch (error) {
          this.log(`Reload handler error: ${error.message}`);
        }
      });
      
      // Broadcast to WebSocket clients
      this.broadcast(reloadEvent);
      
      this.log(`Hot reload triggered for: ${changeEvent.path}`);
    }, this.debounceDelay);
  }
  
  /**
   * Handle HTTP request
   * @param {string} url - Request URL
   * @returns {Object} - Response object
   */
  handleRequest(url) {
    if (this.config.debug) {
      this.log(`GET ${url}`);
    }
    
    // Handle dev endpoints
    if (url.startsWith('/_dev/')) {
      return this.handleDevEndpoint(url);
    }
    
    // Handle file requests
    if (url === '/') {
      return this.serveDirectoryIndex();
    }
    
    // Simulate file serving
    return this.serveFile(url);
  }
  
  /**
   * Handle development endpoints
   * @param {string} url - Dev endpoint URL
   * @returns {Object} - Response object
   * @private
   */
  handleDevEndpoint(url) {
    switch (url) {
      case '/_dev/status':
        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: 'running',
            port: this.config.port,
            'hot-reload': this.config.hotReload,
            'files-watched': this.isWatchingFiles(),
            'active-connections': this.wsConnections.size
          })
        };
        
      case '/_dev/files':
        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify([
            '/manifest.json',
            '/background.js',
            '/content.js',
            '/popup.html',
            '/styles.css'
          ])
        };
        
      default:
        return {
          statusCode: 404,
          headers: { 'content-type': 'text/plain' },
          body: 'Dev endpoint not found'
        };
    }
  }
  
  /**
   * Serve directory index
   * @returns {Object} - Response object
   * @private
   */
  serveDirectoryIndex() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cerebrate Dev Server</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            ul { list-style-type: none; padding: 0; }
            li { padding: 8px; border-bottom: 1px solid #eee; }
            a { text-decoration: none; color: #007bff; }
          </style>
        </head>
        <body>
          <h1>Directory Index</h1>
          <ul>
            <li><a href="/manifest.json">manifest.json</a></li>
            <li><a href="/background.js">background.js</a></li>
            <li><a href="/content.js">content.js</a></li>
            <li><a href="/popup.html">popup.html</a></li>
            <li><a href="/styles.css">styles.css</a></li>
          </ul>
        </body>
      </html>
    `;
    
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: this.injectLiveReloadScript(html)
    };
  }
  
  /**
   * Serve file
   * @param {string} url - File URL
   * @returns {Object} - Response object
   * @private
   */
  serveFile(url) {
    // Simulate file existence check
    const knownFiles = ['/manifest.json', '/background.js', '/content.js', '/popup.html', '/styles.css'];
    
    if (url.includes('/protected/')) {
      return {
        statusCode: 403,
        headers: { 'content-type': 'text/plain' },
        body: 'Forbidden'
      };
    }
    
    if (!knownFiles.includes(url)) {
      return {
        statusCode: 404,
        headers: { 'content-type': 'text/plain' },
        body: 'File not found'
      };
    }
    
    // Get MIME type
    const ext = url.substring(url.lastIndexOf('.'));
    const mimeType = this.mimeTypes[ext] || 'text/plain';
    
    // Simulate file content
    let content = `// Content of ${url}`;
    if (url.endsWith('.json')) {
      content = JSON.stringify({ name: 'Cerebrate Extension' }, null, 2);
    } else if (url.endsWith('.html')) {
      content = `<html><head><title>Cerebrate</title></head><body>Extension content</body></html>`;
    }
    
    // Inject live reload script for HTML files
    if (url.endsWith('.html')) {
      content = this.injectLiveReloadScript(content);
    }
    
    return {
      statusCode: 200,
      headers: { 'content-type': mimeType },
      body: content
    };
  }
  
  /**
   * Inject live reload script into HTML
   * @param {string} html - HTML content
   * @returns {string} - HTML with live reload script
   */
  injectLiveReloadScript(html) {
    if (!this.config.liveReload) {
      return html;
    }
    
    const script = `
      <script>
        (function() {
          const ws = new WebSocket('ws://${this.config.host}:${this.config.port}/_ws');
          ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'file-changed') {
              console.log('Live reload: File changed -', data.file);
              window.location.reload();
            }
          };
          
          ws.onopen = function() {
            console.log('Live reload connected');
          };
          
          ws.onerror = function(error) {
            console.warn('Live reload error:', error);
          };
        })();
      </script>
    `;
    
    // Try to inject before closing head tag, otherwise before closing body tag
    if (html.includes('</head>')) {
      return html.replace('</head>', script + '</head>');
    } else if (html.includes('</body>')) {
      return html.replace('</body>', script + '</body>');
    } else {
      return html + script;
    }
  }
  
  /**
   * Handle WebSocket connection
   * @param {Object} ws - WebSocket connection
   */
  handleWebSocketConnection(ws) {
    this.wsConnections.add(ws);
    
    if (typeof ws.on === 'function') {
      ws.on('close', () => {
        this.handleWebSocketDisconnection(ws);
      });
      
      ws.on('error', (error) => {
        this.log(`WebSocket error: ${error.message}`);
        this.handleWebSocketDisconnection(ws);
      });
    }
    
    this.log('WebSocket connection established');
  }
  
  /**
   * Handle WebSocket disconnection
   * @param {Object} ws - WebSocket connection
   */
  handleWebSocketDisconnection(ws) {
    this.wsConnections.delete(ws);
    this.log('WebSocket connection closed');
  }
  
  /**
   * Broadcast message to all WebSocket clients
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    
    for (const ws of this.wsConnections) {
      try {
        if (ws.readyState === 1) { // OPEN
          ws.send(messageStr);
        }
      } catch (error) {
        this.log(`WebSocket send error: ${error.message}`);
        this.wsConnections.delete(ws);
      }
    }
  }
  
  /**
   * Get number of active WebSocket connections
   * @returns {number} - Active connections
   */
  getActiveConnections() {
    return this.wsConnections.size;
  }
  
  /**
   * Register file change handler
   * @param {Function} handler - Change handler
   */
  onFileChange(handler) {
    this.fileChangeHandlers.push(handler);
  }
  
  /**
   * Register reload handler
   * @param {Function} handler - Reload handler
   */
  onReload(handler) {
    this.reloadHandlers.push(handler);
  }
  
  /**
   * Register log handler
   * @param {Function} handler - Log handler
   */
  onLog(handler) {
    this.logHandlers.push(handler);
  }
  
  /**
   * Log message
   * @param {string} message - Log message
   * @private
   */
  log(message) {
    const logMessage = `[DevServer] ${new Date().toISOString()} ${message}`;
    
    this.logHandlers.forEach(handler => {
      try {
        handler(logMessage);
      } catch (error) {
        console.warn('Log handler error:', error);
      }
    });
    
    if (this.config.debug) {
      console.log(logMessage);
    }
  }
}