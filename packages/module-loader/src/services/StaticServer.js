/**
 * Generic Static Server Service for ResourceManager
 * 
 * Provides a configurable Express server that can serve static files,
 * handle API endpoints, and integrate WebSocket servers. Eliminates
 * code duplication across the polyrepo by centralizing server setup.
 */

import express from 'express';
import { createServer as createHttpServer } from 'http';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * StaticServer service class following Async Resource Manager Pattern
 */
export class StaticServer {
  /**
   * Private constructor - use StaticServer.create() instead
   */
  constructor(config, logger, resourceManager) {
    this.config = config;
    this.logger = logger;
    this.resourceManager = resourceManager;
    this.app = null;
    this.httpServer = null;
    this.wsServer = null;
    this.isRunning = false;
  }

  /**
   * Async factory method for creating StaticServer instances
   * @param {Object} config - Server configuration
   * @param {ResourceManager} resourceManager - Resource manager instance
   * @returns {Promise<StaticServer>} Configured server instance
   */
  static async create(config, resourceManager) {
    // Validate required configuration
    const serverConfig = StaticServer.validateConfig(config);
    
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
    const server = new StaticServer(serverConfig, logger, resourceManager);
    
    // Initialize Express app
    await server.initializeApp();
    
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
        port: config.server?.port || config.port || 3000,
        host: config.server?.host || config.host || 'localhost',
        timeout: config.server?.timeout || 30000,
        ...config.server
      },
      static: {
        publicDir: config.static?.publicDir || config.publicDir || './public',
        caching: config.static?.caching !== false,
        compression: config.static?.compression !== false,
        index: config.static?.index || 'index.html',
        ...config.static
      },
      security: {
        csp: config.security?.csp !== false,
        cors: config.security?.cors || config.cors || { enabled: false },
        headers: config.security?.headers !== false,
        ...config.security
      },
      api: {
        endpoints: config.api?.endpoints || config.apiEndpoints || {},
        middleware: config.api?.middleware || [],
        prefix: config.api?.prefix || '/api',
        ...config.api
      },
      websocket: {
        enabled: config.websocket?.enabled || false,
        path: config.websocket?.path || '/ws',
        handler: config.websocket?.handler || null,
        options: config.websocket?.options || {},
        ...config.websocket
      },
      logging: {
        level: config.logging?.level || 'info',
        requests: config.logging?.requests !== false,
        format: config.logging?.format || 'combined',
        ...config.logging
      }
    };
  }

  /**
   * Initialize Express application with middleware and routes
   */
  async initializeApp() {
    this.app = express();
    this.httpServer = createHttpServer(this.app);

    // Create a router for dynamic routes that will be inserted before SPA fallback
    this.dynamicRouter = express.Router();

    // Setup middleware stack
    this.setupBasicMiddleware();
    this.setupSecurityMiddleware();
    this.setupLoggingMiddleware();
    this.setupStaticServing();
    this.setupApiEndpoints();
    
    // Insert dynamic router before SPA fallback and error handling
    this.app.use(this.dynamicRouter);
    
    this.setupSpaFallback();
    this.setupErrorHandling();

    // Setup WebSocket server if enabled
    if (this.config.websocket.enabled) {
      await this.setupWebSocketServer();
    }

    this.logger.debug('StaticServer initialized', {
      port: this.config.server.port,
      publicDir: this.config.static.publicDir,
      websocket: this.config.websocket.enabled
    });
  }

  /**
   * Setup basic Express middleware
   */
  setupBasicMiddleware() {
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware from config
    if (this.config.api.middleware && Array.isArray(this.config.api.middleware)) {
      this.config.api.middleware.forEach(middleware => {
        if (typeof middleware === 'function') {
          this.app.use(middleware);
        }
      });
    }
  }

  /**
   * Setup security middleware (CORS, headers, etc.)
   */
  setupSecurityMiddleware() {
    // CORS configuration
    if (this.config.security.cors?.enabled) {
      const corsOptions = {
        origin: this.config.security.cors.origin || '*',
        credentials: this.config.security.cors.credentials || false,
        methods: this.config.security.cors.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: this.config.security.cors.allowedHeaders || ['Content-Type', 'Authorization'],
        ...this.config.security.cors
      };
      this.app.use(cors(corsOptions));
    }

    // Security headers
    if (this.config.security.headers) {
      this.app.use((req, res, next) => {
        const headers = {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          ...this.config.security.customHeaders
        };

        // Content Security Policy
        if (this.config.security.csp) {
          const cspDirectives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "connect-src 'self' ws: wss:",
            "img-src 'self' data:",
            "font-src 'self'",
            ...(this.config.security.cspDirectives || [])
          ];
          headers['Content-Security-Policy'] = cspDirectives.join('; ');
        }

        res.set(headers);
        next();
      });
    }
  }

  /**
   * Setup request logging middleware
   */
  setupLoggingMiddleware() {
    if (this.config.logging.requests) {
      this.app.use((req, res, next) => {
        const startTime = Date.now();
        
        // Log request
        this.logger.debug(`${req.method} ${req.path}`, {
          ip: req.ip || req.connection?.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          timestamp: new Date().toISOString()
        });

        // Log response on finish
        const originalEnd = res.end;
        res.end = function(...args) {
          const duration = Date.now() - startTime;
          res.end = originalEnd;
          res.end.apply(res, args);
          
          // Log response (only for non-200 or slow requests to avoid spam)
          if (res.statusCode >= 400 || duration > 1000) {
            this.logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
          }
        }.bind(this);

        next();
      });
    }
  }

  /**
   * Setup static file serving
   */
  setupStaticServing() {
    const publicPath = resolve(this.config.static.publicDir);
    
    // Determine cache control based on environment
    const cacheControl = this.config.static.caching
      ? (process.env.NODE_ENV === 'production' ? 'public, max-age=3600' : 'no-cache')
      : 'no-cache';

    // Static file serving
    this.app.use(express.static(publicPath, {
      index: this.config.static.index,
      setHeaders: (res, path) => {
        res.set('Cache-Control', cacheControl);
        
        // Set proper MIME types for common files
        if (path.endsWith('.js')) {
          res.set('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
          res.set('Content-Type', 'text/css');
        } else if (path.endsWith('.json')) {
          res.set('Content-Type', 'application/json');
        }
      }
    }));

    this.logger.debug(`Static files served from: ${publicPath}`);
  }

  /**
   * Setup API endpoints from configuration
   */
  setupApiEndpoints() {
    const apiPrefix = this.config.api.prefix;

    // Register configured endpoints
    Object.entries(this.config.api.endpoints).forEach(([path, handler]) => {
      if (typeof handler === 'function') {
        const fullPath = path.startsWith('/') ? path : `${apiPrefix}${path.startsWith('/') ? '' : '/'}${path}`;
        this.app.get(fullPath, handler);
        this.logger.debug(`Registered API endpoint: GET ${fullPath}`);
      } else if (typeof handler === 'object' && handler.method && handler.handler) {
        const fullPath = path.startsWith('/') ? path : `${apiPrefix}${path.startsWith('/') ? '' : '/'}${path}`;
        const method = handler.method.toLowerCase();
        
        if (this.app[method]) {
          this.app[method](fullPath, handler.handler);
          this.logger.debug(`Registered API endpoint: ${method.toUpperCase()} ${fullPath}`);
        }
      }
    });

    // Default health endpoint
    if (!this.config.api.endpoints['/health'] && !this.config.api.endpoints['health']) {
      this.app.get('/health', (req, res) => {
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          server: {
            port: this.config.server.port,
            host: this.config.server.host
          }
        });
      });
      this.logger.debug('Registered default health endpoint: GET /health');
    }

    // Note: SPA fallback is now set up in setupSpaFallback() after dynamic router
  }

  /**
   * Setup SPA fallback route (must be after dynamic router)
   */
  setupSpaFallback() {
    const apiPrefix = this.config.api.prefix;
    
    // SPA fallback route (serve index.html for unmatched routes)
    if (this.config.static.index) {
      this.app.get('*', (req, res, next) => {
        // Skip API routes and asset files
        if (req.path.startsWith(apiPrefix) || 
            req.path.includes('.') || 
            req.path.startsWith('/ws')) {
          next();
          return;
        }

        const indexPath = resolve(this.config.static.publicDir, this.config.static.index);
        res.sendFile(indexPath, (err) => {
          if (err) {
            next();
          }
        });
      });
    }
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Server error:', error);
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(error.status || 500).json({
        error: 'Internal server error',
        message: isDevelopment ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
      });
    });
  }

  /**
   * Setup WebSocket server if configured
   */
  async setupWebSocketServer() {
    if (!this.config.websocket.handler) {
      this.logger.warn('WebSocket enabled but no handler provided');
      return;
    }

    try {
      // Handler should be a function that takes (httpServer, config, logger) and returns WebSocket server
      this.wsServer = await this.config.websocket.handler(
        this.httpServer, 
        this.config.websocket, 
        this.logger
      );
      
      this.logger.debug(`WebSocket server setup on path: ${this.config.websocket.path}`);
    } catch (error) {
      this.logger.error('Failed to setup WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Start the server
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Server is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.server.port, this.config.server.host, (error) => {
        if (error) {
          this.logger.error('Failed to start server:', error);
          reject(error);
          return;
        }

        this.isRunning = true;
        const address = this.httpServer.address();
        
        this.logger.info(`StaticServer started on ${address.address}:${address.port}`, {
          publicDir: this.config.static.publicDir,
          websocket: this.config.websocket.enabled
        });

        resolve();
      });

      // Set server timeout
      this.httpServer.timeout = this.config.server.timeout;
    });
  }

  /**
   * Stop the server gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      // Close WebSocket server first
      if (this.wsServer && typeof this.wsServer.close === 'function') {
        this.wsServer.close();
      }

      // Close HTTP server
      this.httpServer.close(() => {
        this.isRunning = false;
        this.logger.info('StaticServer stopped');
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
      publicDir: this.config.static.publicDir,
      websocket: this.config.websocket.enabled,
      address: this.httpServer?.address() || null
    };
  }

  /**
   * Add a new API endpoint dynamically
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Endpoint path
   * @param {Function} handler - Request handler function
   */
  addEndpoint(method, path, handler) {
    if (!this.dynamicRouter) {
      throw new Error('Server not initialized');
    }

    const normalizedMethod = method.toLowerCase();
    if (!this.dynamicRouter[normalizedMethod]) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }

    // Add to dynamic router (which is positioned before SPA fallback)
    const fullPath = path.startsWith('/') ? path : `${this.config.api.prefix}${path.startsWith('/') ? '' : '/'}${path}`;
    this.dynamicRouter[normalizedMethod](fullPath, handler);
    
    this.logger.debug(`Added API endpoint: ${method.toUpperCase()} ${fullPath}`);
  }

  /**
   * Add multiple endpoints at once
   * @param {Object} endpoints - Object with path: handler or path: {method, handler}
   */
  addEndpoints(endpoints) {
    Object.entries(endpoints).forEach(([path, config]) => {
      if (typeof config === 'function') {
        // Simple function handler - defaults to GET
        this.addEndpoint('GET', path, config);
      } else if (config.method && config.handler) {
        // Object with method and handler
        this.addEndpoint(config.method, path, config.handler);
      } else {
        this.logger.warn(`Invalid endpoint configuration for ${path}`);
      }
    });
  }

  /**
   * Add middleware dynamically
   * @param {Function|string} pathOrMiddleware - Middleware function or path
   * @param {Function} middleware - Middleware function (if path provided)
   */
  addMiddleware(pathOrMiddleware, middleware) {
    if (!this.dynamicRouter) {
      throw new Error('Server not initialized');
    }

    if (typeof pathOrMiddleware === 'function') {
      // Global middleware on dynamic router
      this.dynamicRouter.use(pathOrMiddleware);
      this.logger.debug('Added global middleware');
    } else if (typeof pathOrMiddleware === 'string' && typeof middleware === 'function') {
      // Path-specific middleware on dynamic router
      this.dynamicRouter.use(pathOrMiddleware, middleware);
      this.logger.debug(`Added middleware for path: ${pathOrMiddleware}`);
    } else {
      throw new Error('Invalid middleware configuration');
    }
  }

  /**
   * Add a router dynamically
   * @param {string} basePath - Base path for the router
   * @param {express.Router} router - Express router instance
   */
  addRouter(basePath, router) {
    if (!this.dynamicRouter) {
      throw new Error('Server not initialized');
    }

    this.dynamicRouter.use(basePath, router);
    this.logger.debug(`Added router at base path: ${basePath}`);
  }

  /**
   * Configure CORS dynamically (updates existing CORS settings)
   * @param {Object} corsConfig - CORS configuration
   */
  async configureCORS(corsConfig) {
    if (!this.app) {
      throw new Error('Server not initialized');
    }

    // Update internal config
    this.config.security.cors = { ...this.config.security.cors, ...corsConfig };

    // Add new CORS middleware
    if (corsConfig.enabled) {
      const corsOptions = {
        origin: corsConfig.origin || '*',
        credentials: corsConfig.credentials || false,
        methods: corsConfig.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: corsConfig.allowedHeaders || ['Content-Type', 'Authorization'],
        ...corsConfig
      };
      
      // Note: Dynamic CORS requires cors to be available
      try {
        const cors = await import('cors');
        this.app.use(cors.default(corsOptions));
      } catch (error) {
        this.logger.warn('CORS package not available for dynamic configuration');
      }
      this.logger.debug('Updated CORS configuration');
    }
  }

  /**
   * Set static directory dynamically (adds additional static directories)
   * @param {string} path - URL path prefix
   * @param {string} directory - Local directory to serve
   * @param {Object} options - Static serving options
   */
  addStaticDirectory(path, directory, options = {}) {
    if (!this.dynamicRouter) {
      throw new Error('Server not initialized');
    }

    const staticOptions = {
      setHeaders: (res, filePath) => {
        const cacheControl = this.config.static.caching
          ? (process.env.NODE_ENV === 'production' ? 'public, max-age=3600' : 'no-cache')
          : 'no-cache';
        res.set('Cache-Control', cacheControl);
      },
      ...options
    };

    this.dynamicRouter.use(path, express.static(directory, staticOptions));
    this.logger.debug(`Added static directory: ${path} -> ${directory}`);
  }

  /**
   * Get the Express app instance (for advanced customization)
   * @returns {Express} Express application
   */
  getApp() {
    return this.app;
  }

  /**
   * Get the HTTP server instance
   * @returns {http.Server} HTTP server
   */
  getHttpServer() {
    return this.httpServer;
  }

  /**
   * Get the WebSocket server instance
   * @returns {*} WebSocket server (implementation-dependent)
   */
  getWebSocketServer() {
    return this.wsServer;
  }
}

export default StaticServer;