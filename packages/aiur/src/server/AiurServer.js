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
import { WebSocketHandler } from './WebSocketHandler.js';
import { ResourceManager } from '@legion/module-loader';
import { LogManager } from '../core/LogManager.js';
import { ErrorBroadcastService } from '../core/ErrorBroadcastService.js';

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
    this.wsHandler = null;
    this.resourceManager = null;
    this.logManager = null;
    this.errorBroadcastService = null;
    
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
      
      // Setup WebSocket server
      this._setupWebSocketServer();
      
      // Start listening
      await this._startListening();
      
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
    // Create ResourceManager for dependency injection
    this.resourceManager = new ResourceManager();
    await this.resourceManager.initialize();
    
    // Register shared resources
    this.resourceManager.register('config', this.config);
    this.resourceManager.register('logManager', this.logManager);
    
    // Create ErrorBroadcastService
    this.errorBroadcastService = await ErrorBroadcastService.create(this.resourceManager);
    this.errorBroadcastService.setLogManager(this.logManager);
    this.resourceManager.register('errorBroadcastService', this.errorBroadcastService);
    
    // Create SessionManager
    this.sessionManager = new SessionManager({
      sessionTimeout: this.config.sessionTimeout,
      resourceManager: this.resourceManager,
      logManager: this.logManager
    });
    await this.sessionManager.initialize();
    
    // Create RequestHandler
    this.requestHandler = new RequestHandler({
      sessionManager: this.sessionManager,
      resourceManager: this.resourceManager,
      logManager: this.logManager
    });
    await this.requestHandler.initialize();
    
    // Create WebSocketHandler
    this.wsHandler = new WebSocketHandler({
      sessionManager: this.sessionManager,
      requestHandler: this.requestHandler,
      logManager: this.logManager
    });
    
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
   * Setup WebSocket server
   * @private
   */
  _setupWebSocketServer() {
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
    
    // Set up connection handling
    this.wsHandler.handleConnection(ws, clientId);
    
    // Track client
    this.clients.set(ws, { clientId, sessionId: null });
    
    // Handle disconnection
    ws.on('close', async () => {
      await this._handleDisconnection(ws, clientId);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId,
      serverVersion: '1.0.0',
      capabilities: ['sessions', 'tools', 'context', 'handles']
    }));
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
    
    // Clean up sessions
    await this.sessionManager.shutdown();
    
    // Clean up error broadcast service
    if (this.errorBroadcastService) {
      this.errorBroadcastService.destroy();
    }
    
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