/**
 * Generic MCP Server Service for ResourceManager
 * 
 * Provides a configurable MCP (Model Context Protocol) server that can handle
 * tool execution, session management, and WebSocket communication. Eliminates
 * MCP server boilerplate across the polyrepo by centralizing server setup.
 */

import { WebSocketServer } from 'ws';
import { createServer as createHttpServer } from 'http';

/**
 * MCPServer service class following Async Resource Manager Pattern
 */
export class MCPServer {
  /**
   * Private constructor - use MCPServer.create() instead
   */
  constructor(config, logger, resourceManager) {
    this.config = config;
    this.logger = logger;
    this.resourceManager = resourceManager;
    this.httpServer = null;
    this.wss = null;
    this.isRunning = false;
    this.clients = new Map(); // WebSocket connection -> session mapping
    this.sessionManager = null;
    this.requestHandler = null;
    this.wsHandler = null;
  }

  /**
   * Async factory method for creating MCPServer instances
   * @param {Object} config - Server configuration
   * @param {ResourceManager} resourceManager - Resource manager instance
   * @returns {Promise<MCPServer>} Configured server instance
   */
  static async create(config, resourceManager) {
    // Validate required configuration
    const serverConfig = MCPServer.validateConfig(config);
    
    // Get logger from ResourceManager or create default
    let logger;
    try {
      logger = resourceManager.get('logger');
    } catch (error) {
      // Create simple console logger if none available
      logger = {
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.log
      };
    }

    // Create instance
    const server = new MCPServer(serverConfig, logger, resourceManager);
    
    // Initialize core components
    await server.initializeComponents();
    
    return server;
  }

  /**
   * Validate and normalize configuration
   * @param {Object} config - Raw configuration object
   * @returns {Object} Validated configuration
   */
  static validateConfig(config = {}) {
    return {
      server: {
        port: config.server?.port || config.port || 8080,
        host: config.server?.host || config.host || 'localhost',
        timeout: config.server?.timeout || 30000,
        ...config.server
      },
      session: {
        timeout: config.session?.timeout || config.sessionTimeout || 3600000, // 1 hour
        enableSessionMode: config.session?.enableSessionMode !== false,
        maxSessions: config.session?.maxSessions || 100,
        ...config.session
      },
      tools: {
        enableContext: config.tools?.enableContext !== false,
        enablePlanning: config.tools?.enablePlanning !== false,
        enableFile: config.tools?.enableFile !== false,
        customTools: config.tools?.customTools || [],
        ...config.tools
      },
      logging: {
        level: config.logging?.level || 'info',
        enableFile: config.logging?.enableFile || false,
        directory: config.logging?.directory || './logs',
        retentionDays: config.logging?.retentionDays || 7,
        maxFileSize: config.logging?.maxFileSize || 10 * 1024 * 1024,
        ...config.logging
      },
      websocket: {
        path: config.websocket?.path || '/ws',
        maxConnections: config.websocket?.maxConnections || 1000,
        heartbeatInterval: config.websocket?.heartbeatInterval || 30000,
        ...config.websocket
      }
    };
  }

  /**
   * Initialize core MCP server components
   */
  async initializeComponents() {
    try {
      // Create HTTP server
      this.httpServer = createHttpServer();

      // Initialize session manager if enabled
      if (this.config.session.enableSessionMode) {
        await this.initializeSessionManager();
      }

      // Initialize request handler
      await this.initializeRequestHandler();

      // Initialize WebSocket handler
      await this.initializeWebSocketHandler();

      this.logger.debug('MCPServer components initialized', {
        port: this.config.server.port,
        sessionMode: this.config.session.enableSessionMode,
        tools: Object.keys(this.config.tools).filter(key => this.config.tools[key] === true)
      });

    } catch (error) {
      this.logger.error('Failed to initialize MCP server components:', error);
      throw error;
    }
  }

  /**
   * Initialize session manager
   */
  async initializeSessionManager() {
    try {
      // Try to get SessionManager from ResourceManager or import it
      let SessionManagerClass;
      
      if (this.resourceManager.has('SessionManagerClass')) {
        SessionManagerClass = this.resourceManager.get('SessionManagerClass');
      } else {
        // Try to import from Aiur package
        try {
          const { SessionManager } = await import('@legion/aiur/src/server.js');
          SessionManagerClass = SessionManager;
        } catch (importError) {
          this.logger.warn('SessionManager not available, using simple session manager');
          SessionManagerClass = SimpleSessionManager;
        }
      }

      // Create session manager instance with proper parameters
      if (SessionManagerClass === SimpleSessionManager) {
        this.sessionManager = new SessionManagerClass(this.config, this.resourceManager);
      } else {
        // For Aiur SessionManager, provide expected parameters
        this.sessionManager = new SessionManagerClass({
          sessionTimeout: this.config.session.timeout,
          resourceManager: this.resourceManager,
          logManager: this.resourceManager.has('logManager') ? this.resourceManager.get('logManager') : null
        });
      }
      
      if (typeof this.sessionManager.initialize === 'function') {
        await this.sessionManager.initialize();
      }

      this.logger.debug('Session manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize session manager:', error);
      // Fall back to simple session manager on error
      this.logger.warn('Falling back to simple session manager');
      this.sessionManager = new SimpleSessionManager(this.config, this.resourceManager);
      await this.sessionManager.initialize();
    }
  }

  /**
   * Initialize request handler
   */
  async initializeRequestHandler() {
    try {
      // Try to get RequestHandler from ResourceManager or import it
      let RequestHandlerClass;
      
      if (this.resourceManager.has('RequestHandlerClass')) {
        RequestHandlerClass = this.resourceManager.get('RequestHandlerClass');
      } else {
        // Try to import from Aiur package
        try {
          const { RequestHandler } = await import('@legion/aiur/src/server.js');
          RequestHandlerClass = RequestHandler;
        } catch (importError) {
          this.logger.warn('RequestHandler not available, using simple request handler');
          RequestHandlerClass = SimpleRequestHandler;
        }
      }

      this.requestHandler = new RequestHandlerClass(this.config, this.resourceManager);
      
      if (typeof this.requestHandler.initialize === 'function') {
        await this.requestHandler.initialize();
      }

      this.logger.debug('Request handler initialized');
    } catch (error) {
      this.logger.error('Failed to initialize request handler:', error);
      throw error;
    }
  }

  /**
   * Initialize WebSocket handler
   */
  async initializeWebSocketHandler() {
    try {
      // Try to get WebSocketHandler from ResourceManager or import it
      let WebSocketHandlerClass;
      
      if (this.resourceManager.has('WebSocketHandlerClass')) {
        WebSocketHandlerClass = this.resourceManager.get('WebSocketHandlerClass');
      } else {
        // Try to import from Aiur package
        try {
          const { WebSocketHandler } = await import('@legion/aiur/src/server.js');
          WebSocketHandlerClass = WebSocketHandler;
        } catch (importError) {
          this.logger.warn('WebSocketHandler not available, using simple WebSocket handler');
          WebSocketHandlerClass = SimpleWebSocketHandler;
        }
      }

      this.wsHandler = new WebSocketHandlerClass(
        this.httpServer, 
        this.sessionManager,
        this.requestHandler,
        this.config,
        this.logger
      );
      
      if (typeof this.wsHandler.initialize === 'function') {
        await this.wsHandler.initialize();
      }

      this.logger.debug('WebSocket handler initialized');
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket handler:', error);
      throw error;
    }
  }

  /**
   * Start the MCP server
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('MCP server is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.server.port, this.config.server.host, (error) => {
        if (error) {
          this.logger.error('Failed to start MCP server:', error);
          reject(error);
          return;
        }

        this.isRunning = true;
        const address = this.httpServer.address();
        
        this.logger.info(`MCP Server started on ${address.address}:${address.port}`, {
          sessionMode: this.config.session.enableSessionMode,
          websocketPath: this.config.websocket.path,
          tools: Object.keys(this.config.tools).filter(key => this.config.tools[key] === true)
        });

        resolve();
      });

      // Set server timeout
      this.httpServer.timeout = this.config.server.timeout;
    });
  }

  /**
   * Stop the MCP server gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      // Stop WebSocket handler
      if (this.wsHandler && typeof this.wsHandler.stop === 'function') {
        this.wsHandler.stop();
      }

      // Close all WebSocket connections
      if (this.wss) {
        this.wss.close();
      }

      // Stop session manager
      if (this.sessionManager && typeof this.sessionManager.stop === 'function') {
        this.sessionManager.stop();
      }

      // Close HTTP server
      this.httpServer.close(() => {
        this.isRunning = false;
        this.logger.info('MCP Server stopped');
        resolve();
      });
    });
  }

  /**
   * Get server status information
   * @returns {Object} Server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: this.config.server.port,
      host: this.config.server.host,
      sessionMode: this.config.session.enableSessionMode,
      activeSessions: this.sessionManager ? this.sessionManager.getActiveSessionCount() : 0,
      activeConnections: this.clients.size,
      address: this.httpServer?.address() || null
    };
  }

  /**
   * Add custom tool dynamically
   * @param {Object} tool - Tool definition
   */
  addTool(tool) {
    if (this.requestHandler && typeof this.requestHandler.addTool === 'function') {
      this.requestHandler.addTool(tool);
      this.logger.debug(`Added custom tool: ${tool.name}`);
    } else {
      this.logger.warn('Cannot add tool: RequestHandler not available or does not support addTool');
    }
  }

  /**
   * Get available tools
   * @returns {Array} List of available tools
   */
  getTools() {
    if (this.requestHandler && typeof this.requestHandler.getTools === 'function') {
      return this.requestHandler.getTools();
    }
    return [];
  }

  /**
   * Get session manager instance
   * @returns {Object} Session manager
   */
  getSessionManager() {
    return this.sessionManager;
  }

  /**
   * Get request handler instance
   * @returns {Object} Request handler
   */
  getRequestHandler() {
    return this.requestHandler;
  }

  /**
   * Get HTTP server instance
   * @returns {http.Server} HTTP server
   */
  getHttpServer() {
    return this.httpServer;
  }
}

/**
 * Simple Session Manager fallback implementation
 */
class SimpleSessionManager {
  constructor(config, resourceManager) {
    this.config = config;
    this.resourceManager = resourceManager;
    this.sessions = new Map();
  }

  async initialize() {
    // Simple initialization
  }

  createSession(sessionId) {
    const session = {
      id: sessionId,
      created: new Date(),
      lastActivity: new Date(),
      context: new Map()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getActiveSessionCount() {
    return this.sessions.size;
  }

  stop() {
    this.sessions.clear();
  }
}

/**
 * Simple Request Handler fallback implementation
 */
class SimpleRequestHandler {
  constructor(config, resourceManager) {
    this.config = config;
    this.resourceManager = resourceManager;
    this.tools = new Map();
  }

  async initialize() {
    // Add basic context tools
    if (this.config.tools.enableContext) {
      this.addTool({
        name: 'context_add',
        description: 'Add data to context',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            data: {}
          },
          required: ['name', 'data']
        }
      });
    }
  }

  addTool(tool) {
    this.tools.set(tool.name, tool);
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  async handleRequest(request, session) {
    // Simple request handling
    return {
      success: true,
      message: 'Request handled by simple handler',
      data: request
    };
  }
}

/**
 * Simple WebSocket Handler fallback implementation
 */
class SimpleWebSocketHandler {
  constructor(httpServer, sessionManager, requestHandler, config, logger) {
    this.httpServer = httpServer;
    this.sessionManager = sessionManager;
    this.requestHandler = requestHandler;
    this.config = config;
    this.logger = logger;
    this.wss = null;
  }

  async initialize() {
    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: this.config.websocket.path
    });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    this.logger.debug(`WebSocket server listening on path: ${this.config.websocket.path}`);
  }

  handleConnection(ws) {
    const sessionId = this.generateSessionId();
    
    if (this.sessionManager) {
      this.sessionManager.createSession(sessionId);
    }

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const response = await this.requestHandler.handleRequest(message, { id: sessionId });
        ws.send(JSON.stringify(response));
      } catch (error) {
        this.logger.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      this.logger.debug(`WebSocket connection closed for session: ${sessionId}`);
    });
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
  }
}

export default MCPServer;