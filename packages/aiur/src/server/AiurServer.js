/**
 * AiurServer - Backend server for Aiur MCP operations
 * 
 * Manages sessions, handles MCP requests, and coordinates all tool execution
 * in a multi-session environment.
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { SessionManager } from './SessionManager.js';
import { RequestHandler } from './RequestHandler.js';
import { ServerActorSpace } from './ServerActorSpace.js';
// ResourceManager only used internally by ModuleLoader
import { LogManager } from '../core/LogManager.js';
import { Codec } from '../../../shared/codec/src/Codec.js';

export class AiurServer {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.AIUR_SERVER_PORT || 8080,
      host: config.host || process.env.AIUR_SERVER_HOST || 'localhost',
      sessionTimeout: config.sessionTimeout || parseInt(process.env.AIUR_SESSION_TIMEOUT) || 3600000, // 1 hour
      enableFileLogging: process.env.AIUR_ENABLE_FILE_LOGGING !== 'false',
      logDirectory: process.env.AIUR_LOG_DIRECTORY || './logs',
      logRetentionDays: parseInt(process.env.AIUR_LOG_RETENTION_DAYS) || 7,
      maxLogFileSize: parseInt(process.env.AIUR_MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024
    };

    // Core components
    this.app = null;
    this.server = null;
    this.wss = null;
    this.sessionManager = null;
    this.requestHandler = null;
    this.moduleLoader = null;
    this.logManager = null;
    this.codec = null;
    
    // Server state
    this.isRunning = false;
    this.clients = new Map(); // WebSocket connection -> session mapping
  }

  /**
   * Initialize and start the server
   */
  async start() {
    try {
      // Initialize logging first
      await this._initializeLogging();
      
      // Initialize core systems
      await this._initializeSystems();
      
      // Setup HTTP server
      this._setupHttpServer();
      
      // Setup main Aiur WebSocket server (for MCP protocol)
      this._setupAiurWebSocketServer();
      
      // Start main server listening
      await this._startListening();
      
      // Web Debug Server not needed - UI connects directly to main server
      
      this.isRunning = true;
      
      await this.logManager.logInfo('AiurServer started successfully', {
        source: 'AiurServer',
        operation: 'start',
        config: {
          port: this.config.port,
          host: this.config.host,
          sessionTimeout: this.config.sessionTimeout
        }
      });
      
    } catch (error) {
      await this._handleStartupError(error);
      throw error;
    }
  }

  /**
   * Initialize logging system
   * @private
   */
  async _initializeLogging() {
    const logConfig = {
      enableFileLogging: this.config.enableFileLogging,
      logDirectory: this.config.logDirectory,
      logRetentionDays: this.config.logRetentionDays,
      maxLogFileSize: this.config.maxLogFileSize
    };
    
    this.logManager = new LogManager(logConfig);
    await this.logManager.initialize();
    
    await this.logManager.logInfo('AiurServer logging initialized', {
      source: 'AiurServer',
      operation: 'logging-init',
      config: logConfig
    });
  }

  /**
   * Initialize core systems
   * @private
   */
  async _initializeSystems() {
    // Initialize codec with schema validation
    // Temporarily disable codec due to schema compilation error
    this.codec = null; // new Codec({
    //   strictValidation: true,
    //   injectMetadata: true
    // });
    
    // Create THE singleton ModuleLoader
    const { ModuleLoader } = await import('@legion/module-loader');
    this.moduleLoader = new ModuleLoader(); // Creates its own ResourceManager internally
    await this.moduleLoader.initialize();
    
    // The moduleLoader registers itself in ResourceManager during initialize()
    // So the SystemModule will get it as a dependency
    
    // Load ONLY the system module at startup (provides module_load, module_list, etc)
    console.log('[AiurServer] Loading system module...');
    const { default: SystemModule } = await import('../../../general-tools/src/system/SystemModule.js');
    await this.moduleLoader.loadModuleByName('system', SystemModule);
    
    // Log initial state
    const allTools = await this.moduleLoader.getAllTools();
    console.log(`[AiurServer] Started with ${this.moduleLoader.getLoadedModuleNames().length} modules, ${allTools.length} tools`);
    
    // Create SessionManager with moduleLoader reference
    this.sessionManager = new SessionManager({
      moduleLoader: this.moduleLoader,  // Direct access to the singleton ModuleLoader
      sessionTimeout: this.config.sessionTimeout,
      logManager: this.logManager
    });
    await this.sessionManager.initialize();
    
    // Create RequestHandler (simple)
    this.requestHandler = new RequestHandler({
      sessionManager: this.sessionManager,
      logManager: this.logManager
    });
    await this.requestHandler.initialize();
    
    // Web Debug Server will be started separately in _startWebDebugServer()
    
    await this.logManager.logInfo('Core systems initialized', {
      source: 'AiurServer',
      operation: 'systems-init'
    });
  }

  
  /**
   * Setup HTTP server
   * @private
   */
  _setupHttpServer() {
    this.app = express();
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'AiurServer',
        version: '1.0.0',
        uptime: process.uptime(),
        sessions: this.sessionManager.getActiveSessions().length,
        connections: this.clients.size
      });
    });
    
    // Session info endpoint
    this.app.get('/sessions', (req, res) => {
      const sessions = this.sessionManager.getActiveSessions();
      res.json({
        count: sessions.length,
        sessions: sessions.map(s => ({
          id: s.id,
          created: s.created,
          lastAccessed: s.lastAccessed,
          handleCount: s.handles.size()
        }))
      });
    });
    
    // Graceful shutdown endpoint
    this.app.post('/shutdown', async (req, res) => {
      res.json({ message: 'Shutdown initiated' });
      await this.stop();
    });
    
    // Create HTTP server
    this.server = createServer(this.app);
  }

  /**
   * Setup main Aiur WebSocket server (for MCP protocol - sessions, tools, context)
   * @private
   */
  _setupAiurWebSocketServer() {
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });
    
    this.wss.on('connection', async (ws, req) => {
      await this._handleNewConnection(ws, req);
    });
    
    this.wss.on('error', async (error) => {
      await this.logManager.logError(error, {
        source: 'AiurServer',
        operation: 'websocket-server-error'
      });
    });
  }

  /**
   * Handle new WebSocket connection
   * @private
   */
  async _handleNewConnection(ws, req) {
    const clientId = this._generateClientId();
    
    await this.logManager.logInfo('New WebSocket connection', {
      source: 'AiurServer',
      operation: 'new-connection',
      clientId,
      remoteAddress: req.socket.remoteAddress
    });
    
    // Create NEW ServerActorSpace for THIS connection
    const serverActorSpace = new ServerActorSpace(`server-${clientId}`);
    
    // Handle the connection (will send first handshake)
    serverActorSpace.handleConnection(ws, clientId);
    
    // Track for cleanup
    this.clients.set(ws, { clientId, actorSpace: serverActorSpace });
    
    // Handle disconnection
    ws.on('close', async () => {
      await this._handleDisconnection(ws, clientId);
      serverActorSpace.destroy();
    });
  }

  /**
   * Start separate Web Debug Server (for browser UI with module_load tools)
   * @private
   */
  async _startWebDebugServer() {
    try {
      // Create simple WebDebugServer for browser UI
      const { WebDebugServer } = await import('../debug/WebDebugServer.js');
      
      // Create a simple tool provider that includes module management tools
      const webToolProvider = {
        async getAllToolDefinitions() {
          return [
            {
              name: 'module_list',
              description: 'List available and loaded modules',
              inputSchema: {
                type: 'object',
                properties: {
                  filter: { type: 'string', description: 'Filter modules by name' }
                }
              }
            },
            {
              name: 'module_load',
              description: 'Load a module to make its tools available',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the module to load' }
                },
                required: ['name']
              }
            },
            {
              name: 'module_unload', 
              description: 'Unload a module and remove its tools',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the module to unload' }
                },
                required: ['name']
              }
            }
          ];
        }
      };
      
      // Create with the web-specific tool provider
      this.webDebugServer = new WebDebugServer(
        null, // contextManager - not needed for UI
        webToolProvider, // toolDefinitionProvider - provides module tools
        null  // monitoringSystem - not needed
      );
      
      // Inject the components it needs
      this.webDebugServer.sessionManager = this.sessionManager;
      this.webDebugServer.logManager = this.logManager;
      this.webDebugServer.moduleLoader = this.moduleLoader; // Give it access to load modules
      
      // Start on separate port for browser UI
      const debugServerInfo = await this.webDebugServer.start({
        port: this.config.debugPort || 3001,
        host: this.config.host || 'localhost',
        openBrowser: false
      });
      
      await this.logManager.logInfo('Web Debug Server started for browser UI', {
        source: 'AiurServer',
        operation: 'web-debug-server-start',
        url: debugServerInfo.url,
        port: debugServerInfo.port,
        purpose: 'browser-ui-with-module-tools'
      });
      
    } catch (error) {
      // Log but don't fail startup if debug server fails
      await this.logManager.logError(error, {
        source: 'AiurServer',
        operation: 'web-debug-server-start-error',
        severity: 'warning'
      });
    }
  }


  /**
   * Handle client disconnection
   * @private
   */
  async _handleDisconnection(ws, clientId) {
    const client = this.clients.get(ws);
    
    await this.logManager.logInfo('WebSocket disconnection', {
      source: 'AiurServer',
      operation: 'disconnection',
      clientId,
      sessionId: client?.sessionId
    });
    
    // Clean up client tracking
    this.clients.delete(ws);
    
    // Note: Sessions persist beyond connection lifetime
    // They will timeout based on sessionTimeout config
  }

  /**
   * Start HTTP/WebSocket server
   * @private
   */
  async _startListening() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`AiurServer listening on http://${this.config.host}:${this.config.port}`);
          console.log(`WebSocket endpoint: ws://${this.config.host}:${this.config.port}/ws`);
          console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    await this.logManager.logInfo('AiurServer shutting down', {
      source: 'AiurServer',
      operation: 'shutdown-start'
    });
    
    // Close all WebSocket connections
    for (const ws of this.wss.clients) {
      ws.close(1000, 'Server shutting down');
    }
    
    // Close WebSocket server
    this.wss.close();
    
    // Stop accepting new connections
    this.server.close();
    
    // Stop Web Debug Server (browser UI)
    if (this.webDebugServer) {
      await this.webDebugServer.stop();
    }
    
    // Clean up sessions
    await this.sessionManager.shutdown();
    
    // Shutdown logging
    await this.logManager.shutdown();
    
    this.isRunning = false;
    
    console.log('AiurServer stopped');
  }

  /**
   * Handle startup errors
   * @private
   */
  async _handleStartupError(error) {
    console.error('Failed to start AiurServer:', error);
    
    if (this.logManager) {
      await this.logManager.logError(error, {
        source: 'AiurServer',
        operation: 'startup-error',
        severity: 'critical'
      });
    }
    
    // Attempt cleanup
    try {
      await this.stop();
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
  }

  /**
   * Generate unique client ID
   * @private
   */
  _generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Export for use as a module
export default AiurServer;