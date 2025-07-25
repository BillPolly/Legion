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
    // These are now defaults for non-session mode
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
    
    // Log management
    this.logManager = null;
    
    // Session management
    this.sessionManager = null;
    this.sessions = new Map(); // sessionId -> session info
    this.clientSessions = new Map(); // ws -> sessionId
    
    // Generate unique server ID
    this.serverId = `aiur-mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<WebDebugServer>} Initialized WebDebugServer instance
   */
  static async create(resourceManager) {
    // Try to get session manager first (Aiur server mode)
    let sessionManager = null;
    try {
      sessionManager = resourceManager.get('sessionManager');
    } catch (e) {
      // Not in Aiur server mode - fall back to single context mode
    }
    
    // Get defaults for non-session mode
    let contextManager = null;
    let toolDefinitionProvider = null;
    let monitoringSystem = null;
    
    try {
      contextManager = resourceManager.get('contextManager');
    } catch (e) {
      // Not available in main resource manager
    }
    
    try {
      toolDefinitionProvider = resourceManager.get('toolDefinitionProvider');
    } catch (e) {
      // Not available in main resource manager
    }
    
    try {
      monitoringSystem = resourceManager.get('monitoringSystem');
    } catch (e) {
      // Not available in main resource manager
    }
    
    const server = new WebDebugServer(contextManager, toolDefinitionProvider, monitoringSystem);
    server.sessionManager = sessionManager;
    
    // Get RequestHandler if available for debug tools initialization
    try {
      server.requestHandler = resourceManager.get('requestHandler');
    } catch (e) {
      // RequestHandler not available yet
    }
    
    // Get LogManager if available and set up log streaming
    try {
      const logManager = resourceManager.get('logManager');
      server.logManager = logManager;
      
      // Subscribe to log events for real-time streaming
      logManager.on('log-entry', (logEntry) => {
        server._broadcastLog(logEntry);
      });
      
      // Log to stderr to avoid MCP interference
      process.stderr.write('WebDebugServer: Connected to LogManager\n');
    } catch (e) {
      // LogManager not available yet
      process.stderr.write('WebDebugServer: LogManager not available at creation\n');
    }
    
    // Get error broadcast service if available and set up error forwarding
    try {
      const errorBroadcastService = resourceManager.get('errorBroadcastService');
      server.errorBroadcastService = errorBroadcastService;
      
      // Subscribe to error events
      errorBroadcastService.on('error-captured', (errorEvent) => {
        server._broadcastError(errorEvent);
      });
      
      // Log to stderr to avoid MCP interference
      process.stderr.write('WebDebugServer: Connected to ErrorBroadcastService\n');
    } catch (e) {
      // ErrorBroadcastService not available yet, will be connected later
      // Log to stderr to avoid MCP interference
      process.stderr.write('WebDebugServer: ErrorBroadcastService not available at creation\n');
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

      // Log to stderr instead of console to avoid MCP interference
      process.stderr.write(`🐛 Web Debug Interface started at ${serverInfo.url}\n`);
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

    // Log to stderr to avoid MCP interference
    process.stderr.write('🐛 Web Debug Interface stopped\n');
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
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
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
      // Log to stderr to avoid MCP interference
      process.stderr.write(`🐛 Debug client connected (${this.clients.size} total)\n`);
    }

    // Prepare welcome data based on session mode
    let welcomeData = {
      serverId: this.serverId,
      version: '1.0.0',
      capabilities: ['tool-execution', 'context-management', 'event-streaming', 'error-tracking', 'log-streaming'],
      sessionMode: !!this.sessionManager,
      sessions: [],
      errorTracking: {
        enabled: !!this.errorBroadcastService,
        bufferSize: this.errorBroadcastService?.getErrorBuffer().length || 0
      },
      logStreaming: {
        enabled: !!this.logManager,
        logDirectory: this.logManager?.logDirectory || null
      }
    };
    
    // Get available tools
    let availableTools = [];
    
    if (this.sessionManager) {
      // In session mode, get tools from shared module loader
      welcomeData.sessions = this._getSessionList();
      welcomeData.capabilities.push('session-management');
      
      // Try to get tools from any existing session or shared module loader
      if (this.sessionManager.sharedModuleLoader) {
        // Get all module tools from the shared loader
        const moduleTools = this.sessionManager.sharedModuleLoader.getModuleToolDefinitions();
        
        // Also include context tools which are always available
        const contextTools = [
          { name: 'context_add', description: 'Add data to context', inputSchema: {} },
          { name: 'context_get', description: 'Get context data', inputSchema: {} },
          { name: 'context_list', description: 'List context items', inputSchema: {} },
          { name: 'context_remove', description: 'Remove context item', inputSchema: {} }
        ];
        
        availableTools = [...contextTools, ...moduleTools];
      } else {
        // Fallback: try to get from first available session
        const sessions = this.sessionManager.getActiveSessions();
        if (sessions.length > 0) {
          const firstSession = sessions[0];
          availableTools = firstSession.toolProvider.getAllToolDefinitions().map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }));
        }
      }
    } else {
      // In single context mode, send tools immediately
      availableTools = this.toolDefinitionProvider ? 
        this.toolDefinitionProvider.getAllToolDefinitions().map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        })) : [];
    }
    
    welcomeData.availableTools = availableTools;
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      data: welcomeData
    }));

    // Send initial logs if LogManager is available
    if (this.logManager) {
      this._sendInitialLogs(ws);
    }

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
      // Log to stderr to avoid MCP interference
      process.stderr.write(`🐛 Debug client disconnected (${this.clients.size} total)\n`);
    });

    ws.on('error', (error) => {
      // Log WebSocket error to stderr to avoid MCP interference
      process.stderr.write(`🐛 WebSocket error: ${error.message}\n`);
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
        case 'select-session':
          await this._handleSessionSelection(ws, message);
          break;
          
        case 'list-sessions':
          await this._handleListSessions(ws, message);
          break;
          
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
            data: this._getToolStatsForClient(ws)
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
        
        case 'get-log-history':
          if (this.logManager) {
            await this._handleLogHistoryRequest(ws, message);
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              id: message.id,
              data: { message: 'Log streaming not enabled' }
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
      
      // Get session-specific tool provider
      let toolProvider = this.toolDefinitionProvider;
      let sessionId = null;
      
      if (this.sessionManager) {
        sessionId = this.clientSessions.get(ws);
        if (!sessionId) {
          ws.send(JSON.stringify({
            type: 'tool-result',
            id,
            data: {
              success: false,
              error: 'No session selected. Please select a session first.',
              executionTime: Date.now() - startTime
            }
          }));
          return;
        }
        
        const session = this.sessionManager.getSession(sessionId);
        if (!session) {
          ws.send(JSON.stringify({
            type: 'tool-result',
            id,
            data: {
              success: false,
              error: 'Session no longer exists',
              executionTime: Date.now() - startTime
            }
          }));
          return;
        }
        
        toolProvider = session.toolProvider;
      }
      
      // Route directly to MCP tool execution
      const result = await toolProvider.executeTool(name, args || {});
      
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
      // Failed to store debug server info - not critical, no logging needed
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
      // Failed to open browser - not critical, no logging needed
      // Log to stderr to avoid MCP interference
      process.stderr.write(`Please open your browser to: ${url}\n`);
    }
  }

  /**
   * Broadcast error event to all connected clients
   * @param {Object} errorEvent - Error event from ErrorBroadcastService
   * @private
   */
  _broadcastError(errorEvent) {
    // Wrap error event in proper message format
    const errorMessage = JSON.stringify({
      type: 'error',
      data: errorEvent
    });
    
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
          // Failed to send error to client - not critical, no logging needed
        }
      }
    }
  }

  /**
   * Connect RequestHandler after server creation
   * @param {RequestHandler} requestHandler - Request handler instance
   */
  connectRequestHandler(requestHandler) {
    if (this.requestHandler) {
      return; // Already connected
    }
    
    this.requestHandler = requestHandler;
    
    // Log to stderr to avoid MCP interference
    process.stderr.write('WebDebugServer: Connected to RequestHandler (post-creation)\n');
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
    
    // Log to stderr to avoid MCP interference
    process.stderr.write('WebDebugServer: Connected to ErrorBroadcastService (post-creation)\n');
  }

  /**
   * Send initial logs to a newly connected client
   * @param {Object} ws - WebSocket connection
   * @private
   */
  async _sendInitialLogs(ws) {
    try {
      const logs = await this.logManager.getAllLogsForWebUI(200);
      
      ws.send(JSON.stringify({
        type: 'initial-logs',
        data: {
          logs: logs,
          count: logs.length,
          stats: this.logManager.getStats()
        }
      }));
    } catch (error) {
      // Failed to load initial logs - not critical
      process.stderr.write(`🐛 Failed to send initial logs: ${error.message}\n`);
    }
  }

  /**
   * Broadcast new log entry to all connected clients
   * @param {Object} logEntry - Log entry from LogManager
   * @private
   */
  _broadcastLog(logEntry) {
    const logMessage = JSON.stringify({
      type: 'log-entry',
      data: logEntry
    });
    
    // Send to all connected clients
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(logMessage);
        } catch (e) {
          // Failed to send log to client - remove client
          this.clients.delete(client);
        }
      }
    }
  }

  /**
   * Handle request for log history
   * @param {Object} ws - WebSocket connection
   * @param {Object} message - Request message
   * @private
   */
  async _handleLogHistoryRequest(ws, message) {
    try {
      const { limit = 100, level = null } = message.data || {};
      
      let logs;
      if (level) {
        logs = await this.logManager.getRecentLogs({ limit, level });
      } else {
        logs = await this.logManager.getAllLogsForWebUI(limit);
      }
      
      ws.send(JSON.stringify({
        type: 'log-history',
        id: message.id,
        data: {
          logs: logs,
          count: logs.length,
          stats: this.logManager.getStats()
        }
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        id: message.id,
        data: { message: `Failed to get log history: ${error.message}` }
      }));
    }
  }

  /**
   * Get list of available sessions
   * @returns {Array} Session list
   * @private
   */
  _getSessionList() {
    if (!this.sessionManager) {
      return [];
    }
    
    const sessions = this.sessionManager.getActiveSessions();
    
    return sessions.map(session => ({
      id: session.id,
      created: session.created,
      lastAccessed: session.lastAccessed,
      handleCount: session.handles.size(),
      metadata: session.metadata
    }));
  }
  
  /**
   * Handle session selection
   * @param {Object} ws - WebSocket connection
   * @param {Object} message - Selection message
   * @private
   */
  async _handleSessionSelection(ws, message) {
    if (!this.sessionManager) {
      ws.send(JSON.stringify({
        type: 'error',
        id: message.id,
        data: { message: 'Session management not available' }
      }));
      return;
    }
    
    const { sessionId } = message.data;
    const session = this.sessionManager.getSession(sessionId);
    
    if (!session) {
      ws.send(JSON.stringify({
        type: 'error',
        id: message.id,
        data: { message: `Session not found: ${sessionId}` }
      }));
      return;
    }
    
    // Store session association
    this.clientSessions.set(ws, sessionId);
    
    // Ensure debug tools are initialized for this session
    console.log(`[WebDebugServer._handleSessionSelection] Starting for session ${sessionId}`);
    
    // Try to get RequestHandler from resourceManager if we don't have it yet
    if (!this.requestHandler) {
      try {
        // SessionManager has the main resource manager with RequestHandler
        if (this.sessionManager && this.sessionManager.resourceManager) {
          this.requestHandler = this.sessionManager.resourceManager.get('requestHandler');
          console.log(`[WebDebugServer._handleSessionSelection] Got RequestHandler from sessionManager.resourceManager`);
        }
      } catch (e) {
        console.log('[WebDebugServer._handleSessionSelection] Could not get RequestHandler from resourceManager:', e.message);
      }
    }
    
    console.log(`[WebDebugServer._handleSessionSelection] RequestHandler available: ${!!this.requestHandler}`);
    
    if (this.requestHandler) {
      try {
        console.log(`[WebDebugServer._handleSessionSelection] Calling ensureDebugTools...`);
        await this.requestHandler.ensureDebugTools(session);
        console.log(`[WebDebugServer._handleSessionSelection] ensureDebugTools completed`);
      } catch (error) {
        console.error('[WebDebugServer._handleSessionSelection] Error initializing debug tools:', error);
      }
    } else {
      console.log('[WebDebugServer._handleSessionSelection] No RequestHandler available!');
    }
    
    // Tools are shared across sessions, not per-session
    // We already sent all tools in the welcome message
    console.log(`[WebDebugServer._handleSessionSelection] Session selected, using shared tools`);
    
    ws.send(JSON.stringify({
      type: 'session-selected',
      id: message.id,
      data: {
        sessionId,
        tools: [], // Tools are shared and already sent in welcome message
        contextCount: await this._getContextCount(session),
        sessionInfo: {
          created: session.created,
          lastAccessed: session.lastAccessed,
          metadata: session.metadata
        }
      }
    }));
    
    // Load context for this session
    await this._sendSessionContext(ws, session);
  }
  
  /**
   * Handle list sessions request
   * @param {Object} ws - WebSocket connection
   * @param {Object} message - Request message
   * @private
   */
  async _handleListSessions(ws, message) {
    const sessions = this._getSessionList();
    
    ws.send(JSON.stringify({
      type: 'sessions-list',
      id: message.id,
      data: {
        sessions,
        currentSession: this.clientSessions.get(ws) || null
      }
    }));
  }
  
  /**
   * Get tool stats for a specific client
   * @param {Object} ws - WebSocket connection
   * @returns {Object} Tool statistics
   * @private
   */
  _getToolStatsForClient(ws) {
    const sessionId = this.clientSessions.get(ws);
    
    if (!sessionId || !this.sessionManager) {
      // Fall back to default tool provider if available
      return this.toolDefinitionProvider ? 
        this.toolDefinitionProvider.getToolStatistics() : 
        { total: 0, context: 0, modules: 0, debug: 0 };
    }
    
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return { total: 0, context: 0, modules: 0, debug: 0 };
    }
    
    return session.toolProvider.getToolStatistics();
  }
  
  /**
   * Get context count for a session
   * @param {Object} session - Session object
   * @returns {Promise<number>} Context count
   * @private
   */
  async _getContextCount(session) {
    try {
      const result = await session.context.executeContextTool('context_list', {});
      return result.items ? result.items.length : 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Send session context to client
   * @param {Object} ws - WebSocket connection
   * @param {Object} session - Session object
   * @private
   */
  async _sendSessionContext(ws, session) {
    try {
      const result = await session.context.executeContextTool('context_list', {});
      
      ws.send(JSON.stringify({
        type: 'context-data',
        data: {
          sessionId: session.id,
          contexts: result.items || []
        }
      }));
    } catch (error) {
      // Failed to get context - not critical
    }
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
        <div style="display: flex; align-items: center; gap: 10px;">
            <div class="status running">Server Running on Port ${this.port}</div>
            <span id="errorCount" style="color: #ff6b6b; font-weight: bold;"></span>
            <div id="sessionSelector" style="margin-left: auto; display: none;">
                <label style="margin-right: 5px;">Session:</label>
                <select id="sessionSelect" style="background: #333; color: #fff; border: 1px solid #555; padding: 5px; border-radius: 3px;">
                    <option value="">Select a session...</option>
                </select>
                <button onclick="refreshSessions()" style="margin-left: 5px;">Refresh</button>
            </div>
        </div>
        
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
                <h3>📋 System Logs</h3>
                <div style="float: right;">
                    <select id="logLevel" onchange="filterLogs()">
                        <option value="">All Levels</option>
                        <option value="error">Errors</option>
                        <option value="warning">Warnings</option>
                        <option value="info">Info</option>
                    </select>
                    <button onclick="clearLogs()" style="margin-left: 10px;">Clear</button>
                </div>
            </div>
            <div id="logs" class="log" style="height: 300px; overflow-y: auto;"></div>
            <div style="margin-top: 10px; font-size: 12px; color: #aaa;">
                <span id="logCount">0 logs</span> | 
                <span id="logStats">0 errors, 0 warnings, 0 info</span>
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
        let logs = [];
        let logStats = { error: 0, warning: 0, info: 0 };
        let currentSession = null;
        let sessionMode = false;
        let availableTools = [];
        
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
                    sessionMode = message.data.sessionMode || false;
                    if (sessionMode) {
                        document.getElementById('sessionSelector').style.display = 'block';
                        loadSessions(message.data.sessions);
                    } else {
                        availableTools = message.data.availableTools || [];
                        updateToolSelect();
                    }
                    document.getElementById('serverInfo').textContent = JSON.stringify(message.data, null, 2);
                    break;
                case 'sessions-list':
                    loadSessions(message.data.sessions);
                    break;
                case 'session-selected':
                    currentSession = message.data.sessionId;
                    availableTools = message.data.tools || [];
                    updateToolSelect();
                    log('Session selected: ' + currentSession);
                    break;
                case 'context-data':
                    displayContexts(message.data.contexts);
                    break;
                case 'initial-logs':
                    loadInitialLogs(message.data);
                    break;
                case 'log-entry':
                    addLogEntry(message.data);
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
        
        // Log management functions
        function loadInitialLogs(data) {
            logs = data.logs || [];
            updateLogStats();
            renderLogs();
        }
        
        function addLogEntry(logEntry) {
            logs.unshift(logEntry); // Add to beginning (newest first)
            
            // Keep only last 500 logs
            if (logs.length > 500) {
                logs = logs.slice(0, 500);
            }
            
            updateLogStats();
            renderLogs();
        }
        
        function renderLogs() {
            const logsDiv = document.getElementById('logs');
            const selectedLevel = document.getElementById('logLevel').value;
            
            let filteredLogs = logs;
            if (selectedLevel) {
                filteredLogs = logs.filter(log => log.level === selectedLevel);
            }
            
            logsDiv.innerHTML = '';
            
            filteredLogs.forEach(log => {
                const logDiv = document.createElement('div');
                logDiv.style.marginBottom = '8px';
                logDiv.style.padding = '8px';
                logDiv.style.borderRadius = '3px';
                logDiv.style.fontSize = '12px';
                logDiv.style.fontFamily = 'monospace';
                
                // Color based on log level
                switch(log.level) {
                    case 'error':
                        logDiv.style.backgroundColor = '#4a2a2a';
                        logDiv.style.borderLeft = '4px solid #ff6b6b';
                        break;
                    case 'warning':
                        logDiv.style.backgroundColor = '#4a4a2a';
                        logDiv.style.borderLeft = '4px solid #ffb347';
                        break;
                    case 'info':
                        logDiv.style.backgroundColor = '#2a2a4a';
                        logDiv.style.borderLeft = '4px solid #74b9ff';
                        break;
                    default:
                        logDiv.style.backgroundColor = '#333';
                        logDiv.style.borderLeft = '4px solid #666';
                }
                
                const timestamp = new Date(log.timestamp).toLocaleTimeString();
                const source = log.context?.source || log.source || 'unknown';
                
                logDiv.innerHTML = \`
                    <div style="color: #888; font-size: 10px;">[\${timestamp}] [\${log.level.toUpperCase()}] [\${source}]</div>
                    <div style="margin-top: 2px; color: #fff;">\${log.message}</div>
                    \${log.context?.operation ? '<div style="color: #aaa; font-size: 10px;">Operation: ' + log.context.operation + '</div>' : ''}
                \`;
                
                logsDiv.appendChild(logDiv);
            });
            
            // Auto-scroll to bottom for new logs
            logsDiv.scrollTop = logsDiv.scrollHeight;
        }
        
        function updateLogStats() {
            logStats = { error: 0, warning: 0, info: 0 };
            
            logs.forEach(log => {
                if (logStats.hasOwnProperty(log.level)) {
                    logStats[log.level]++;
                }
            });
            
            document.getElementById('logCount').textContent = \`\${logs.length} logs\`;
            document.getElementById('logStats').textContent = 
                \`\${logStats.error} errors, \${logStats.warning} warnings, \${logStats.info} info\`;
        }
        
        function filterLogs() {
            renderLogs();
        }
        
        function clearLogs() {
            logs = [];
            updateLogStats();
            renderLogs();
        }
        
        // Session management functions
        function loadSessions(sessions) {
            const select = document.getElementById('sessionSelect');
            select.innerHTML = '<option value="">Select a session...</option>';
            
            sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = session.id + ' (Created: ' + new Date(session.created).toLocaleString() + ')';
                if (session.id === currentSession) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            select.onchange = function() {
                if (this.value) {
                    selectSession(this.value);
                }
            };
        }
        
        function selectSession(sessionId) {
            ws.send(JSON.stringify({
                type: 'select-session',
                id: Date.now().toString(),
                data: { sessionId }
            }));
        }
        
        function refreshSessions() {
            ws.send(JSON.stringify({
                type: 'list-sessions',
                id: Date.now().toString()
            }));
        }
        
        function updateToolSelect() {
            const select = document.getElementById('toolName');
            select.innerHTML = '<option value="">Select a tool...</option>';
            
            availableTools.forEach(tool => {
                const option = document.createElement('option');
                option.value = tool.name;
                option.textContent = tool.name + ' - ' + tool.description;
                select.appendChild(option);
            });
        }
        
        function displayContexts(contexts) {
            // This would update a context display panel if we had one
            // For now, just log it
            log('Session has ' + contexts.length + ' context items');
        }
    </script>
</body>
</html>`;
  }
}