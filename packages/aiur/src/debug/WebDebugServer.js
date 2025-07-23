/**
 * WebDebugServer - Web-based debugging interface for Aiur MCP server
 * 
 * Provides a browser-based debugging environment that acts as a WebSocket-based 
 * MCP client. All tool execution happens via WebSocket messages directly to the 
 * MCP server - no separate HTTP APIs exist.
 * 
 * Architecture:
 * - HTTP server: Serves static web files only (HTML, CSS, JS)
 * - WebSocket server: Handles all MCP tool execution and real-time events
 * - Pure MCP client: Web interface communicates exclusively via WebSocket
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebDebugServer {
  constructor(contextManager, toolDefinitionProvider, monitoringSystem) {
    this.contextManager = contextManager;
    this.toolDefinitionProvider = toolDefinitionProvider;
    this.monitoringSystem = monitoringSystem;
    
    this.server = null;
    this.wss = null;
    this.port = null;
    this.isRunning = false;
    this.clients = new Set();
    this.eventBuffer = [];
    this.maxEventBuffer = 1000;
    
    // Generate unique server ID
    this.serverId = `aiur-mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<WebDebugServer>} Initialized WebDebugServer instance
   */
  static async create(resourceManager) {
    const contextManager = resourceManager.get('contextManager');
    const toolDefinitionProvider = resourceManager.get('toolDefinitionProvider');
    const monitoringSystem = resourceManager.get('monitoringSystem');
    
    const server = new WebDebugServer(contextManager, toolDefinitionProvider, monitoringSystem);
    
    // Get error broadcast service if available and set up error forwarding
    try {
      const errorBroadcastService = resourceManager.get('errorBroadcastService');
      server.errorBroadcastService = errorBroadcastService;
      
      // Subscribe to error events
      errorBroadcastService.on('error-captured', (errorEvent) => {
        server._broadcastError(errorEvent);
      });
      
      console.log('WebDebugServer: Connected to ErrorBroadcastService');
    } catch (e) {
      // ErrorBroadcastService not available yet, will be connected later
      console.log('WebDebugServer: ErrorBroadcastService not available at creation');
    }
    
    return server;
  }

  /**
   * Start the debug server
   * @param {Object} options - Server options
   * @returns {Promise<Object>} Server information
   */
  async start(options = {}) {
    if (this.isRunning) {
      return this.getServerInfo();
    }

    const preferredPort = options.port || 3001;
    const host = options.host || 'localhost';
    const openBrowser = options.openBrowser !== false;

    try {
      // Find available port
      this.port = await this._findAvailablePort(preferredPort);
      
      // Create HTTP server
      this.server = http.createServer((req, res) => {
        this._handleHttpRequest(req, res);
      });

      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        server: this.server,
        path: '/ws'
      });

      this.wss.on('connection', (ws) => {
        this._handleWebSocketConnection(ws);
      });

      // Start server
      await new Promise((resolve, reject) => {
        this.server.listen(this.port, host, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isRunning = true;
      this._setupEventBridge();

      const serverInfo = this.getServerInfo();

      // Store server info in context
      await this._storeServerInfoInContext(serverInfo);

      // Open browser if requested
      if (openBrowser) {
        await this._openBrowser(serverInfo.url);
      }

      console.log(`🐛 Web Debug Interface started at ${serverInfo.url}`);
      return serverInfo;

    } catch (error) {
      throw new Error(`Failed to start debug server: ${error.message}`);
    }
  }

  /**
   * Stop the debug server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    // Close all WebSocket connections
    for (const client of this.clients) {
      client.terminate();
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Close HTTP server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      this.server = null;
    }

    this.isRunning = false;
    this.port = null;

    console.log('🐛 Web Debug Interface stopped');
  }

  /**
   * Get server information
   * @returns {Object} Server information
   */
  getServerInfo() {
    return {
      serverId: this.serverId,
      port: this.port,
      url: this.port ? `http://localhost:${this.port}` : null,
      status: this.isRunning ? 'running' : 'stopped',
      startedAt: this.isRunning ? new Date().toISOString() : null,
      connectedClients: this.clients.size,
      version: '1.0.0'
    };
  }

  /**
   * Find available port starting from preferred port
   * @param {number} preferredPort - Preferred starting port
   * @returns {Promise<number>} Available port
   * @private
   */
  async _findAvailablePort(preferredPort) {
    const portRanges = [
      { start: preferredPort, end: preferredPort + 99 },    // 3001-3100
      { start: 8000, end: 8099 },                           // 8000-8099
      { start: 9000, end: 9099 }                            // 9000-9099
    ];

    for (const range of portRanges) {
      for (let port = range.start; port <= range.end; port++) {
        if (await this._isPortAvailable(port)) {
          return port;
        }
      }
    }

    throw new Error('No available ports found in any range');
  }

  /**
   * Check if port is available
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if port is available
   * @private
   */
  async _isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Handle HTTP requests (serve static web files ONLY)
   * 
   * IMPORTANT: This only serves static files (HTML, CSS, JS).
   * All MCP tool execution happens via WebSocket, not HTTP.
   * 
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @private
   */
  _handleHttpRequest(req, res) {
    const url = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, 'web', url);
    
    // Security check - ensure file is within web directory
    const webDir = path.join(__dirname, 'web');
    if (!filePath.startsWith(webDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Check if file exists
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Serve a basic HTML interface if files don't exist yet
        if (url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this._getBasicHTML());
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
        return;
      }

      // Set content type based on file extension
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
      };

      const contentType = contentTypes[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }

  /**
   * Handle WebSocket connection
   * @param {Object} ws - WebSocket connection
   * @private
   */
  _handleWebSocketConnection(ws) {
    this.clients.add(ws);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`🐛 Debug client connected (${this.clients.size} total)`);
    }

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      data: {
        serverId: this.serverId,
        version: '1.0.0',
        capabilities: ['tool-execution', 'context-management', 'event-streaming', 'error-tracking'],
        availableTools: this.toolDefinitionProvider.getAllToolDefinitions().map(t => t.name),
        errorTracking: {
          enabled: !!this.errorBroadcastService,
          bufferSize: this.errorBroadcastService?.getErrorBuffer().length || 0
        }
      }
    }));

    // Send buffered events
    for (const event of this.eventBuffer) {
      ws.send(JSON.stringify(event));
    }

    // Handle messages
    ws.on('message', async (data) => {
      await this._handleWebSocketMessage(ws, data);
    });

    // Handle disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
      console.log(`🐛 Debug client disconnected (${this.clients.size} total)`);
    });

    ws.on('error', (error) => {
      console.error('🐛 WebSocket error:', error);
      this.clients.delete(ws);
    });
  }

  /**
   * Handle WebSocket message
   * @param {Object} ws - WebSocket connection
   * @param {Buffer} data - Message data
   * @private
   */
  async _handleWebSocketMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'execute-tool':
          await this._handleToolExecution(ws, message);
          break;
        
        case 'subscribe':
          await this._handleSubscription(ws, message);
          break;
        
        case 'get-server-info':
          ws.send(JSON.stringify({
            type: 'server-info',
            data: this.getServerInfo()
          }));
          break;
        
        case 'get-tool-stats':
          ws.send(JSON.stringify({
            type: 'tool-stats',
            data: this.toolDefinitionProvider.getToolStatistics()
          }));
          break;
        
        case 'get-error-buffer':
          ws.send(JSON.stringify({
            type: 'error-buffer',
            data: {
              errors: this.errorBroadcastService?.getErrorBuffer() || [],
              stats: this.errorBroadcastService?.getErrorStats() || null
            }
          }));
          break;
        
        case 'clear-error-buffer':
          if (this.errorBroadcastService) {
            this.errorBroadcastService.clearErrorBuffer();
            ws.send(JSON.stringify({
              type: 'error-buffer-cleared',
              data: { success: true }
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: 'Error tracking not enabled' }
            }));
          }
          break;
        
        default:
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: `Unknown message type: ${message.type}` }
          }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: error.message }
      }));
    }
  }

  /**
   * Handle MCP tool execution request via WebSocket
   * 
   * This is the core of the web debug interface - it routes WebSocket messages
   * directly to MCP tool execution. No HTTP APIs involved.
   * 
   * @param {Object} ws - WebSocket connection
   * @param {Object} message - Tool execution message
   * @private
   */
  async _handleToolExecution(ws, message) {
    const startTime = Date.now();
    
    try {
      const { id, data } = message;
      const { name, arguments: args } = data;
      
      // Route directly to MCP tool execution
      const result = await this.toolDefinitionProvider.executeTool(name, args || {});
      
      const executionTime = Date.now() - startTime;
      
      // Send result back to client
      ws.send(JSON.stringify({
        type: 'tool-result',
        id,
        data: {
          success: !result.isError,
          result,
          executionTime
        }
      }));

      // Broadcast tool execution event
      this._broadcastEvent('tool-executed', {
        tool: name,
        arguments: args,
        success: !result.isError,
        executionTime,
        clientId: ws._clientId || 'unknown'
      });

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'tool-result',
        id: message.id,
        data: {
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime
        }
      }));
    }
  }

  /**
   * Handle subscription request
   * @param {Object} ws - WebSocket connection
   * @param {Object} message - Subscription message
   * @private
   */
  async _handleSubscription(ws, message) {
    // Store subscription preferences on the WebSocket
    ws._subscriptions = message.data || {};
    
    ws.send(JSON.stringify({
      type: 'subscription-confirmed',
      data: ws._subscriptions
    }));
  }

  /**
   * Setup event bridge with monitoring system
   * @private
   */
  _setupEventBridge() {
    if (!this.monitoringSystem) {
      return;
    }

    // Forward monitoring system events
    const forwardedEvents = [
      'metric-recorded',
      'alert-triggered',
      'anomaly-detected',
      'monitoring-stopped',
      'configuration-applied'
    ];

    for (const eventType of forwardedEvents) {
      this.monitoringSystem.on(eventType, (data) => {
        this._broadcastEvent(eventType, data);
      });
    }

    // If we have error broadcast service, send buffered errors to new clients
    if (this.errorBroadcastService) {
      const errorBuffer = this.errorBroadcastService.getErrorBuffer();
      for (const error of errorBuffer) {
        this.eventBuffer.push(error);
      }
    }
  }

  /**
   * Broadcast event to all connected clients
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  _broadcastEvent(eventType, data) {
    // Special handling for error events
    let event;
    if (eventType === 'error') {
      // Error events already have their own format
      event = {
        type: 'error',
        data: data,
        metadata: {
          serverId: this.serverId,
          version: '1.0.0'
        }
      };
    } else {
      // Regular events
      event = {
        type: 'event',
        data: {
          eventType,
          timestamp: new Date().toISOString(),
          source: 'debug-server',
          payload: data
        },
        metadata: {
          serverId: this.serverId,
          version: '1.0.0'
        }
      };
    }

    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.maxEventBuffer) {
      this.eventBuffer.shift();
    }

    // Send to clients
    const eventStr = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        // Check subscription filters
        if (this._shouldSendEventToClient(client, eventType)) {
          client.send(eventStr);
        }
      }
    }
  }

  /**
   * Check if event should be sent to client based on subscriptions
   * @param {Object} client - WebSocket client
   * @param {string} eventType - Event type
   * @returns {boolean} True if event should be sent
   * @private
   */
  _shouldSendEventToClient(client, eventType) {
    if (!client._subscriptions) {
      return true; // Send all events if no subscription preferences
    }

    const { events, filters } = client._subscriptions;
    
    // Check if client is subscribed to this event type
    if (events && !events.includes(eventType)) {
      return false;
    }

    // Apply additional filters (implementation depends on requirements)
    if (filters) {
      // Add custom filtering logic here
    }

    return true;
  }

  /**
   * Store server information in context
   * @param {Object} serverInfo - Server information
   * @private
   */
  async _storeServerInfoInContext(serverInfo) {
    try {
      await this.contextManager.executeContextTool('context_add', {
        name: 'debug_server',
        data: serverInfo,
        description: 'Web debug interface server information'
      });
    } catch (error) {
      console.warn('Failed to store debug server info in context:', error.message);
    }
  }

  /**
   * Open browser to debug interface
   * @param {string} url - URL to open
   * @private
   */
  async _openBrowser(url) {
    try {
      const platform = process.platform;
      let command;

      switch (platform) {
        case 'darwin':
          command = `open "${url}"`;
          break;
        case 'win32':
          command = `start "${url}"`;
          break;
        default:
          command = `xdg-open "${url}"`;
      }

      await execAsync(command);
    } catch (error) {
      console.warn('Failed to open browser:', error.message);
      console.log(`Please open your browser to: ${url}`);
    }
  }

  /**
   * Broadcast error event to all connected clients
   * @param {Object} errorEvent - Error event from ErrorBroadcastService
   * @private
   */
  _broadcastError(errorEvent) {
    // Error events are special - they bypass normal event filtering
    const errorMessage = JSON.stringify(errorEvent);
    
    // Add to event buffer for new clients
    this.eventBuffer.push(errorEvent);
    if (this.eventBuffer.length > this.maxEventBuffer) {
      this.eventBuffer.shift();
    }
    
    // Send to all connected clients immediately
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(errorMessage);
        } catch (e) {
          console.error('Failed to send error to client:', e);
        }
      }
    }
  }

  /**
   * Connect ErrorBroadcastService after server creation
   * @param {ErrorBroadcastService} errorBroadcastService - Error broadcast service instance
   */
  connectErrorBroadcastService(errorBroadcastService) {
    if (this.errorBroadcastService) {
      return; // Already connected
    }
    
    this.errorBroadcastService = errorBroadcastService;
    
    // Subscribe to error events
    errorBroadcastService.on('error-captured', (errorEvent) => {
      this._broadcastError(errorEvent);
    });
    
    // Add existing error buffer to event buffer
    const errorBuffer = errorBroadcastService.getErrorBuffer();
    for (const error of errorBuffer) {
      this.eventBuffer.push(error);
      if (this.eventBuffer.length > this.maxEventBuffer) {
        this.eventBuffer.shift();
      }
    }
    
    console.log('WebDebugServer: Connected to ErrorBroadcastService (post-creation)');
  }

  /**
   * Get basic HTML interface for when web files don't exist
   * @returns {string} Basic HTML content
   * @private
   */
  _getBasicHTML() {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Aiur MCP Debug Interface</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .panel { background: #2a2a2a; border: 1px solid #444; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .header { background: #333; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 5px 5px 0 0; }
        button { background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; }
        button:hover { background: #005a9e; }
        input, textarea { background: #333; color: #fff; border: 1px solid #555; padding: 8px; border-radius: 3px; width: 100%; box-sizing: border-box; }
        .log { background: #111; padding: 10px; border-radius: 3px; height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; }
        .status { padding: 5px 10px; border-radius: 3px; display: inline-block; }
        .status.running { background: #4a7c59; }
        .status.error { background: #7c4a4a; }
        #events { max-height: 300px; overflow-y: auto; }
        .event { margin: 5px 0; padding: 5px; background: #333; border-radius: 3px; font-size: 12px; }
        .error-event { background: #7c4a4a; border: 1px solid #a04040; }
        .error-panel { background: #4a2a2a; border: 2px solid #7c4a4a; margin-bottom: 20px; }
        #errorCount { color: #ff6b6b; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐛 Aiur MCP Debug Interface</h1>
        <div class="status running">Server Running on Port ${this.port}</div>
        <span id="errorCount" style="margin-left: 10px;"></span>
        
        <div id="errorPanel" class="panel error-panel" style="display: none;">
            <div class="header">
                <h3>⚠️ Recent Errors</h3>
            </div>
            <div id="errors" class="log"></div>
            <button onclick="clearErrors()">Clear Errors</button>
        </div>
        
        <div class="panel">
            <div class="header">
                <h3>Command Execution</h3>
            </div>
            <div>
                <label>Tool Name:</label>
                <input type="text" id="toolName" placeholder="e.g., context_list" />
            </div>
            <div style="margin-top: 10px;">
                <label>Arguments (JSON):</label>
                <textarea id="toolArgs" rows="3" placeholder='{"key": "value"}'></textarea>
            </div>
            <div style="margin-top: 10px;">
                <button onclick="executeTool()">Execute Tool</button>
                <button onclick="clearResult()">Clear</button>
            </div>
            <div style="margin-top: 10px;">
                <label>Result:</label>
                <div id="result" class="log"></div>
            </div>
        </div>

        <div class="panel">
            <div class="header">
                <h3>Event Stream</h3>
            </div>
            <div id="events" class="log"></div>
        </div>

        <div class="panel">
            <div class="header">
                <h3>Server Information</h3>
            </div>
            <div id="serverInfo" class="log"></div>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:${this.port}/ws');
        let errorCount = 0;
        
        ws.onopen = function() {
            log('Connected to debug server');
        };
        
        ws.onmessage = function(event) {
            const message = JSON.parse(event.data);
            handleMessage(message);
        };
        
        ws.onclose = function() {
            log('Disconnected from debug server');
        };
        
        function handleMessage(message) {
            switch(message.type) {
                case 'welcome':
                    document.getElementById('serverInfo').textContent = JSON.stringify(message.data, null, 2);
                    break;
                case 'tool-result':
                    document.getElementById('result').textContent = JSON.stringify(message.data, null, 2);
                    break;
                case 'event':
                    addEvent(message.data);
                    break;
                case 'error':
                    addError(message.data);
                    break;
            }
        }
        
        function executeTool() {
            const toolName = document.getElementById('toolName').value;
            const toolArgs = document.getElementById('toolArgs').value;
            
            if (!toolName) {
                alert('Please enter a tool name');
                return;
            }
            
            let args = {};
            if (toolArgs) {
                try {
                    args = JSON.parse(toolArgs);
                } catch (e) {
                    alert('Invalid JSON in arguments');
                    return;
                }
            }
            
            ws.send(JSON.stringify({
                type: 'execute-tool',
                id: Date.now().toString(),
                data: {
                    name: toolName,
                    arguments: args
                }
            }));
        }
        
        function clearResult() {
            document.getElementById('result').textContent = '';
        }
        
        function addEvent(eventData) {
            const eventsDiv = document.getElementById('events');
            const eventDiv = document.createElement('div');
            
            // Check if this is an error event
            if (eventData.errorType || eventData.severity) {
                // Handle as error
                addError(eventData);
                return;
            }
            
            eventDiv.className = 'event';
            eventDiv.textContent = \`[\${eventData.timestamp}] \${eventData.eventType}: \${JSON.stringify(eventData.payload)}\`;
            eventsDiv.appendChild(eventDiv);
            eventsDiv.scrollTop = eventsDiv.scrollHeight;
        }
        
        function addError(errorData) {
            errorCount++;
            updateErrorCount();
            
            // Show error panel
            const errorPanel = document.getElementById('errorPanel');
            if (errorPanel) {
                errorPanel.style.display = 'block';
                
                const errorsDiv = document.getElementById('errors');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-event';
                errorDiv.innerHTML = \`
                    <strong>[\${errorData.severity?.toUpperCase() || 'ERROR'}]</strong> 
                    \${errorData.error?.message || 'Unknown error'}<br>
                    <small>Source: \${errorData.source || 'unknown'} | Type: \${errorData.errorType || 'unknown'}</small>
                \`;
                errorsDiv.appendChild(errorDiv);
                errorsDiv.scrollTop = errorsDiv.scrollHeight;
            }
            
            // Also add to event stream
            const eventsDiv = document.getElementById('events');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'event';
            errorDiv.style.backgroundColor = '#7c4a4a';
            errorDiv.style.color = '#fff';
            errorDiv.innerHTML = \`
                <strong>[\${errorData.timestamp}] ERROR [\${errorData.severity}]</strong><br>
                <strong>Component:</strong> \${errorData.source}<br>
                <strong>Type:</strong> \${errorData.errorType}<br>
                <strong>Message:</strong> \${errorData.error?.message}<br>
                \${errorData.context?.tool ? '<strong>Tool:</strong> ' + errorData.context.tool + '<br>' : ''}
                \${errorData.context.operation ? '<strong>Operation:</strong> ' + errorData.context.operation + '<br>' : ''}
                <details>
                    <summary>Stack Trace</summary>
                    <pre style="font-size: 10px; margin: 5px 0;">\${errorData.error.stack}</pre>
                </details>
            \`;
            eventsDiv.appendChild(errorDiv);
            eventsDiv.scrollTop = eventsDiv.scrollHeight;
        }
        
        function log(message) {
            addEvent({
                timestamp: new Date().toISOString(),
                eventType: 'debug-log',
                payload: { message }
            });
        }
        
        function updateErrorCount() {
            const countEl = document.getElementById('errorCount');
            if (countEl) {
                countEl.textContent = errorCount > 0 ? \`(\${errorCount} errors)\` : '';
            }
        }
        
        function clearErrors() {
            errorCount = 0;
            updateErrorCount();
            const errorsDiv = document.getElementById('errors');
            if (errorsDiv) {
                errorsDiv.innerHTML = '';
            }
            const errorPanel = document.getElementById('errorPanel');
            if (errorPanel) {
                errorPanel.style.display = 'none';
            }
        }
    </script>
</body>
</html>`;
  }
}