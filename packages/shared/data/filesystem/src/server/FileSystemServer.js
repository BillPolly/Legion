/**
 * FileSystemServer - Server-side endpoint for RemoteFileSystemDataSource
 * 
 * Provides HTTP and WebSocket endpoints for remote filesystem access.
 * This server wraps a LocalFileSystemDataSource to expose it over the network,
 * allowing browser clients to access server-side files through Handle abstractions.
 * 
 * Features:
 * - REST API for query/update operations
 * - WebSocket support for real-time file watching
 * - Authentication support
 * - CORS configuration for browser access
 * - Request validation and sanitization
 * - Path sandboxing for security
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { LocalFileSystemDataSource } from '../datasources/LocalFileSystemDataSource.js';
import path from 'path';
import fs from 'fs';

export class FileSystemServer {
  constructor(options = {}) {
    this.options = {
      // Server configuration
      port: options.port || 3000,
      hostname: options.hostname || 'localhost',
      // Filesystem configuration
      rootPath: options.rootPath || process.cwd(),
      // Security
      enableAuth: options.enableAuth || false,
      authTokens: options.authTokens || new Set(),
      // CORS
      corsOrigins: options.corsOrigins || '*',
      // WebSocket
      enableWebSocket: options.enableWebSocket !== false,
      // Limits
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxQueryResults: options.maxQueryResults || 1000,
      // Logging
      verbose: options.verbose || false,
      ...options
    };
    
    // Create Express app
    this.app = express();
    this.server = null;
    this.wss = null;
    
    // Create local filesystem DataSource
    this.fsManager = new LocalFileSystemDataSource({
      rootPath: this.options.rootPath,
      enableWatching: this.options.enableWebSocket
    });
    
    // Track WebSocket clients
    this.wsClients = new Map();
    this.clientIdCounter = 1;
    
    // Setup middleware and routes
    this._setupMiddleware();
    this._setupRoutes();
  }
  
  /**
   * Start the server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.options.port, this.options.hostname, () => {
          console.log(`FileSystem server listening on http://${this.options.hostname}:${this.options.port}`);
          
          // Setup WebSocket server if enabled
          if (this.options.enableWebSocket) {
            this._setupWebSocket();
          }
          
          resolve({
            url: `http://${this.options.hostname}:${this.options.port}`,
            wsUrl: `ws://${this.options.hostname}:${this.options.port}/filesystem`
          });
        });
        
        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Stop the server
   */
  async stop() {
    // Close WebSocket connections
    if (this.wss) {
      for (const client of this.wsClients.values()) {
        if (client.ws.readyState === 1) { // OPEN
          client.ws.close();
        }
      }
      this.wss.close();
    }
    
    // Stop Express server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('FileSystem server stopped');
          resolve();
        });
      });
    }
  }
  
  _setupMiddleware() {
    // CORS
    this.app.use(cors({
      origin: this.options.corsOrigins,
      credentials: true
    }));
    
    // JSON parsing with size limit and error handling
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf, encoding) => {
        // Check if the raw body size exceeds our file size limit
        if (buf.length > this.options.maxFileSize) {
          const error = new Error('File size exceeds limit');
          error.status = 413;
          throw error;
        }
      }
    }));
    
    // Handle JSON parsing errors
    this.app.use((error, req, res, next) => {
      if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
      if (error.status === 413) {
        return res.status(413).json({ error: 'File size exceeds limit' });
      }
      next(error);
    });
    
    // Request logging
    if (this.options.verbose) {
      this.app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
      });
    }
  }
  
  _createAuthMiddleware() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
      }
      
      const token = authHeader.substring(7);
      if (!this.options.authTokens.has(token)) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      
      req.authToken = token;
      next();
    };
  }
  
  _setupRoutes() {
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        rootPath: this.options.rootPath,
        capabilities: this.fsManager.getSchema().capabilities
      });
    });
    
    // Apply authentication middleware to API routes if enabled
    const authMiddleware = this.options.enableAuth ? this._createAuthMiddleware() : (req, res, next) => next();
    
    // Query endpoint
    this.app.post('/api/filesystem/query', authMiddleware, (req, res) => {
      try {
        const { query } = req.body;
        
        if (!query || typeof query !== 'object' || Array.isArray(query) || query === null) {
          return res.status(400).json({ error: 'Invalid query specification' });
        }
        
        // Validate and sanitize paths in query
        this._validateQuery(query);
        
        // Execute query
        const results = this.fsManager.query(query);
        
        // Limit results
        const limited = Array.isArray(results) 
          ? results.slice(0, this.options.maxQueryResults)
          : results;
        
        res.json({ 
          success: true, 
          results: limited,
          truncated: Array.isArray(results) && results.length > this.options.maxQueryResults
        });
      } catch (error) {
        console.error('Query error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
    
    // Update endpoint
    this.app.post('/api/filesystem/update', authMiddleware, (req, res) => {
      try {
        const { path, ...data } = req.body;
        
        // Validate path
        if (path) {
          this._validatePath(path);
        }
        if (data.path) {
          this._validatePath(data.path);
        }
        if (data.source) {
          this._validatePath(data.source);
        }
        if (data.target) {
          this._validatePath(data.target);
        }
        
        // Handle base64 encoded content
        if (data.encoding === 'base64' && data.content) {
          data.content = Buffer.from(data.content, 'base64');
          delete data.encoding;
        }
        
        // Check file size limits
        if (data.content && data.content.length > this.options.maxFileSize) {
          return res.status(413).json({ 
            success: false, 
            error: 'File size exceeds limit' 
          });
        }
        
        // Execute update
        const result = this.fsManager.update(path, data);
        
        // Notify WebSocket clients of changes
        if (this.options.enableWebSocket && result.success) {
          this._notifyFileChange(path || data.path || data.target, data.operation || data.type);
        }
        
        res.json(result);
      } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
    
    // Stream endpoints (for large files)
    this.app.get('/api/filesystem/stream/:filePath(*)', authMiddleware, (req, res) => {
      try {
        const filePath = '/' + req.params.filePath;
        this._validatePath(filePath);
        
        const resolvedPath = path.resolve(this.options.rootPath, filePath.substring(1));
        
        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
          return res.status(404).json({ error: 'File not found' });
        }
        
        // Stream the file
        const stream = fs.createReadStream(resolvedPath);
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          res.status(500).json({ error: error.message });
        });
        
        // Set appropriate content type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
          '.txt': 'text/plain',
          '.json': 'application/json',
          '.js': 'application/javascript',
          '.html': 'text/html',
          '.css': 'text/css',
          '.jpg': 'image/jpeg',
          '.png': 'image/png',
          '.pdf': 'application/pdf'
        };
        
        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
        stream.pipe(res);
      } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }
  
  _setupWebSocket() {
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/filesystem'
    });
    
    // Store path for testing
    this.wss.path = '/filesystem';
    
    this.wss.on('connection', (ws, req) => {
      const clientId = this.clientIdCounter++;
      const client = {
        id: clientId,
        ws: ws,
        authenticated: !this.options.enableAuth,
        subscriptions: new Map()
      };
      
      this.wsClients.set(clientId, client);
      console.log(`WebSocket client ${clientId} connected`);
      
      ws.on('message', (data) => {
        this._handleWebSocketMessage(client, data.toString());
      });
      
      ws.on('close', () => {
        console.log(`WebSocket client ${clientId} disconnected`);
        this._cleanupClient(client);
        this.wsClients.delete(clientId);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket client ${clientId} error:`, error);
      });
    });
  }
  
  _handleWebSocketMessage(client, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'auth':
          this._handleAuth(client, message);
          break;
        case 'subscribe':
          this._handleSubscribe(client, message);
          break;
        case 'unsubscribe':
          this._handleUnsubscribe(client, message);
          break;
        default:
          client.ws.send(JSON.stringify({ 
            type: 'error', 
            error: 'Unknown message type' 
          }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      client.ws.send(JSON.stringify({ 
        type: 'error', 
        error: error.message 
      }));
    }
  }
  
  _handleAuth(client, message) {
    if (!this.options.enableAuth) {
      client.authenticated = true;
      return;
    }
    
    if (this.options.authTokens.has(message.token)) {
      client.authenticated = true;
      client.ws.send(JSON.stringify({ type: 'authenticated' }));
    } else {
      client.ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Invalid authentication token' 
      }));
    }
  }
  
  _handleSubscribe(client, message) {
    if (!client.authenticated) {
      client.ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Not authenticated' 
      }));
      return;
    }
    
    try {
      // Validate query
      this._validateQuery(message.query);
      
      // Create subscription
      const subscription = this.fsManager.subscribe(message.query, (changes) => {
        client.ws.send(JSON.stringify({
          type: 'fileChange',
          subscriptionId: message.id,
          changes: changes
        }));
      });
      
      client.subscriptions.set(message.id, subscription);
      
      client.ws.send(JSON.stringify({ 
        type: 'subscribed', 
        id: message.id 
      }));
    } catch (error) {
      client.ws.send(JSON.stringify({ 
        type: 'error', 
        error: error.message 
      }));
    }
  }
  
  _handleUnsubscribe(client, message) {
    const subscription = client.subscriptions.get(message.id);
    if (subscription) {
      subscription.unsubscribe();
      client.subscriptions.delete(message.id);
      
      client.ws.send(JSON.stringify({ 
        type: 'unsubscribed', 
        id: message.id 
      }));
    }
  }
  
  _cleanupClient(client) {
    // Unsubscribe all subscriptions
    for (const subscription of client.subscriptions.values()) {
      try {
        subscription.unsubscribe();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    client.subscriptions.clear();
  }
  
  _notifyFileChange(filePath, operation) {
    const changeEvent = {
      type: 'fileChange',
      path: filePath,
      event: operation,
      timestamp: new Date().toISOString()
    };
    
    // Notify all connected clients
    for (const client of this.wsClients.values()) {
      if (client.authenticated && client.ws.readyState === 1) { // OPEN
        try {
          client.ws.send(JSON.stringify(changeEvent));
        } catch (error) {
          console.error(`Failed to notify client ${client.id}:`, error);
        }
      }
    }
  }
  
  _validatePath(filePath) {
    // Prevent path traversal attacks
    
    // Check for obvious traversal patterns before normalization
    if (filePath.includes('..') || filePath.includes('/../')) {
      throw new Error('Path traversal attempt detected');
    }
    
    const normalized = path.normalize(filePath);
    
    // Ensure path starts with /
    const cleanPath = normalized.startsWith('/') ? normalized : '/' + normalized;
    
    // Double check after normalization
    if (cleanPath.includes('..')) {
      throw new Error('Path traversal attempt detected');
    }
    
    // Resolve against root and check containment
    const pathToResolve = cleanPath.substring(1); // Remove leading /
    const resolved = path.resolve(this.options.rootPath, pathToResolve);
    const rootResolved = path.resolve(this.options.rootPath);
    
    if (!resolved.startsWith(rootResolved)) {
      throw new Error('Path traversal attempt detected');
    }
    
    return cleanPath;
  }
  
  _validateQuery(query) {
    if (!query || typeof query !== 'object') {
      throw new Error('Invalid query specification');
    }
    
    // Allow empty queries with just find/where structure
    if (!query.hasOwnProperty('find') && !query.hasOwnProperty('where')) {
      throw new Error('Query must have find or where clauses');
    }
    
    if (query.where && Array.isArray(query.where)) {
      for (const clause of query.where) {
        if (Array.isArray(clause) && clause.length >= 2) {
          // Validate paths in clauses
          if (typeof clause[1] === 'string' && clause[1].startsWith('/')) {
            this._validatePath(clause[1]);
          }
          if (typeof clause[0] === 'string' && clause[0].startsWith('/')) {
            this._validatePath(clause[0]);
          }
        }
      }
    }
  }
}