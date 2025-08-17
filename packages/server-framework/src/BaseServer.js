/**
 * BaseServer class - Core server framework for Legion applications
 * Provides Express + WebSocket setup with actor-based communication
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'path';
import { ResourceManager } from '@legion/resource-manager';
import { ActorSpaceManager } from './ActorSpaceManager.js';
import { PackageDiscovery } from './utils/PackageDiscovery.js';
import { ImportRewriter } from './utils/ImportRewriter.js';

export class BaseServer {
  constructor() {
    // Initialize Express app
    this.app = express();
    
    // Core properties
    this.resourceManager = null;  // Will be initialized with singleton
    this.routes = new Map();      // route -> { factory, clientFile, port }
    this.services = new Map();    // Shared services for actors
    this.servers = new Map();     // port -> HTTP server instance
    this.wssInstances = new Map(); // port -> WebSocket server instance
    this.actorManagers = new Map(); // port -> ActorSpaceManager instance  
    this.staticRoutes = new Map(); // path -> directory
    this.host = null;
    this.monorepoRoot = null;
    this.legionPackages = new Map(); // Discovered Legion packages
    this.importRewriter = new ImportRewriter();
  }

  /**
   * Initialize server with ResourceManager singleton
   */
  async initialize() {
    // Only initialize once
    if (this.resourceManager) {
      return;
    }

    // Get ResourceManager singleton - NEVER create new one
    this.resourceManager = ResourceManager.getInstance();
    await this.resourceManager.initialize();
    
    // Store in services for actor access
    this.services.set('resourceManager', this.resourceManager);
    
    // Get configuration from ResourceManager
    this.host = 'localhost'; // Always localhost for now
    this.monorepoRoot = this.resourceManager.get('env.MONOREPO_ROOT');
    
    // Apply basic middleware
    this.setupMiddleware();
    
    // Discover Legion packages
    if (this.monorepoRoot) {
      await this.discoverLegionPackages();
    }
  }

  /**
   * Discover Legion packages in the monorepo
   */
  async discoverLegionPackages() {
    try {
      const discovery = new PackageDiscovery(this.resourceManager);
      this.legionPackages = await discovery.discoverPackages(this.monorepoRoot);
      console.log(`Discovered ${this.legionPackages.size} Legion packages`);
    } catch (error) {
      console.error('Failed to discover Legion packages:', error);
    }
  }

  /**
   * Set up basic Express middleware
   */
  setupMiddleware() {
    // CORS configuration
    const corsOrigins = this.resourceManager.get('env.CORS_ORIGINS')?.split(',') || ['http://localhost:3000'];
    this.app.use(cors({
      origin: corsOrigins,
      credentials: true
    }));
    
    // JSON parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging in development
    if (this.resourceManager.get('env.NODE_ENV') !== 'production') {
      this.app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
      });
    }
  }

  /**
   * Register a route with server actor factory and client actor file
   * @param {string} route - Route path (e.g., '/tools')
   * @param {Function} serverActorFactory - Factory function to create server actor instances
   * @param {string} clientActorFile - Path to client actor JavaScript file
   * @param {number} port - Port to run on (defaults to 8080)
   */
  registerRoute(route, serverActorFactory, clientActorFile, port = 8080) {
    // Validate inputs
    if (!route || typeof route !== 'string') {
      throw new Error('Route is required and must be a string');
    }
    if (!route.startsWith('/')) {
      throw new Error('Route must start with /');
    }
    if (typeof serverActorFactory !== 'function') {
      throw new Error('Server actor factory must be a function');
    }
    if (!clientActorFile) {
      throw new Error('Client actor file path is required');
    }
    if (typeof port !== 'number') {
      throw new Error('Port must be a number');
    }
    if (port < 1024 || port > 65535) {
      throw new Error('Port must be between 1024 and 65535');
    }

    // Store route information
    this.routes.set(route, {
      factory: serverActorFactory,
      clientFile: clientActorFile,
      port: port
    });

    console.log(`Registered route ${route} on port ${port}`);
  }

  /**
   * Register a static file serving route
   * @param {string} path - URL path to serve from
   * @param {string} directory - Directory to serve files from
   */
  registerStaticRoute(path, directory) {
    if (!path || !path.startsWith('/')) {
      throw new Error('Path must start with /');
    }
    if (!directory) {
      throw new Error('Directory is required');
    }

    this.staticRoutes.set(path, directory);
    console.log(`Registered static route ${path} -> ${directory}`);
  }

  /**
   * Start the server(s)
   * Creates separate Express instances for each unique port
   */
  async start() {
    if (!this.resourceManager) {
      throw new Error('Server not initialized. Call initialize() first.');
    }

    // Group routes by port
    const routesByPort = new Map();
    for (const [route, config] of this.routes) {
      if (!routesByPort.has(config.port)) {
        routesByPort.set(config.port, []);
      }
      routesByPort.get(config.port).push({ route, ...config });
    }

    // Start a server for each port
    const startupErrors = [];
    for (const [port, routes] of routesByPort) {
      try {
        await this.startServerOnPort(port, routes);
      } catch (error) {
        startupErrors.push({ port, error });
        console.error(`Failed to start server on port ${port}:`, error);
      }
    }

    if (startupErrors.length > 0) {
      const errorMsg = `Failed to start ${startupErrors.length} server(s): ${startupErrors.map(e => `port ${e.port} (${e.error.message})`).join(', ')}`;
      throw new Error(errorMsg);
    }

    console.log('All servers started successfully');
  }

  /**
   * Start server on specific port with routes
   * @private
   */
  async startServerOnPort(port, routes) {
    // Check if server already exists on this port
    if (this.servers.has(port)) {
      console.log(`Server already running on port ${port}`);
      return;
    }
    
    // Create new Express instance for this port
    const app = express();
    
    // Apply middleware
    const corsOrigins = this.resourceManager.get('env.CORS_ORIGINS')?.split(',') || ['http://localhost:3000'];
    app.use(cors({
      origin: corsOrigins,
      credentials: true
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Add health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'legion-server',
        port: port,
        timestamp: new Date().toISOString()
      });
    });
    
    // Set up routes for this port
    for (const route of routes) {
      try {
        await this.setupRoute(app, route);
      } catch (error) {
        console.error(`Failed to setup route ${route.route}:`, error);
        throw new Error(`Route setup failed for ${route.route}: ${error.message}`);
      }
    }
    
    // Set up Legion package serving
    try {
      this.setupLegionPackageRoutes(app);
    } catch (error) {
      console.warn(`Failed to setup Legion package routes:`, error);
      // Continue anyway as this is not critical for basic functionality
    }
    
    // Set up static routes
    for (const [path, directory] of this.staticRoutes) {
      try {
        app.use(path, express.static(directory));
        console.log(`Serving static files at ${path} from ${directory}`);
      } catch (error) {
        console.warn(`Failed to setup static route ${path} -> ${directory}:`, error);
        // Continue with other routes
      }
    }
    
    // Start HTTP server
    const server = await new Promise((resolve, reject) => {
      const httpServer = app.listen(port, this.host, () => {
        console.log(`Server running on http://${this.host}:${port}`);
        resolve(httpServer);
      });
      
      httpServer.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
    
    // Store server instance
    this.servers.set(port, server);
    
    // Create WebSocket server
    const wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });
    
    // Store WSS instance
    this.wssInstances.set(port, wss);
    
    // Create ActorSpaceManager for this port
    // Pass only routes for this specific port
    const portRoutes = new Map();
    for (const route of routes) {
      portRoutes.set(route.route, route);
    }
    
    const actorManager = new ActorSpaceManager(this.services, portRoutes);
    this.actorManagers.set(port, actorManager);
    
    // Handle WebSocket connections with ActorSpaceManager
    wss.on('connection', (ws, req) => {
      actorManager.handleConnection(ws, req);
    });
  }
  
  /**
   * Set up individual route with HTML and client actor serving
   * @private
   */
  async setupRoute(app, routeConfig) {
    const { route, factory, clientFile, port } = routeConfig;
    
    // Import HTML template generator
    const { generateHTML } = await import('./htmlTemplate.js');
    
    // Serve HTML page at route
    app.get(route, (req, res) => {
      // Generate title from route name
      const title = route.substring(1).charAt(0).toUpperCase() + route.substring(2) || 'Legion App';
      
      const html = generateHTML({
        title: title,
        clientActorPath: `${route}/client.js`,
        wsEndpoint: `ws://${this.host}:${port}/ws?route=${encodeURIComponent(route)}`,
        route: route
      });
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    });
    
    // Serve client actor JavaScript file
    app.get(`${route}/client.js`, async (req, res) => {
      try {
        const content = await import('fs').then(fs => 
          fs.promises.readFile(clientFile, 'utf8')
        );
        
        // Rewrite @legion imports in client file
        const rewritten = this.importRewriter.rewrite(content);
        
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(rewritten);
      } catch (error) {
        console.error(`Error serving client file ${clientFile}:`, error);
        res.status(404).send('Client actor file not found');
      }
    });
    
    console.log(`Set up route ${route} on port ${port}`);
  }

  /**
   * Set up Legion package serving routes
   * @private
   */
  setupLegionPackageRoutes(app) {
    // Serve each discovered Legion package
    for (const [packageName, packageInfo] of this.legionPackages) {
      const cleanName = packageInfo.cleanName;
      const routePath = `/legion/${cleanName}`;
      
      // Serve package files with import rewriting for JS files
      app.use(routePath, async (req, res, next) => {
        // Handle different path patterns:
        // - /legion/package/file.js -> packagePath/src/file.js  
        // - /legion/package/src/file.js -> packagePath/src/file.js
        let filePath;
        if (req.path.startsWith('/src/')) {
          // Direct src access: /legion/utils/src/index.js -> /packages/utils/src/index.js
          filePath = path.join(packageInfo.path, req.path);
        } else {
          // Root file access: /legion/actors/ActorSpace.js -> /packages/actors/src/ActorSpace.js
          filePath = path.join(packageInfo.srcPath, req.path);
        }
        
        try {
          // Check if file exists
          await import('fs').then(fs => fs.promises.access(filePath));
          
          // For JavaScript files, rewrite imports
          if (req.path.endsWith('.js') || req.path.endsWith('.mjs')) {
            const content = await import('fs').then(fs => 
              fs.promises.readFile(filePath, 'utf8')
            );
            
            // Rewrite @legion imports
            const rewritten = this.importRewriter.rewrite(content);
            
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.send(rewritten);
          } else {
            // For other files, serve as static
            res.sendFile(filePath);
          }
        } catch (error) {
          // File not found, continue to next handler
          next();
        }
      });
    }
    
    console.log(`Set up /legion/* routes for ${this.legionPackages.size} packages`);
  }

  /**
   * Stop all servers
   */
  async stop() {
    // Close all active WebSocket connections first
    for (const [port, actorManager] of this.actorManagers) {
      actorManager.closeAllConnections();
    }
    this.actorManagers.clear();

    // Close WebSocket servers
    for (const [port, wss] of this.wssInstances) {
      wss.close();
      console.log(`Closed WebSocket server on port ${port}`);
    }
    this.wssInstances.clear();

    // Close HTTP servers
    const closePromises = [];
    for (const [port, server] of this.servers) {
      closePromises.push(new Promise((resolve) => {
        server.close(() => {
          console.log(`Closed HTTP server on port ${port}`);
          resolve();
        });
      }));
    }
    
    await Promise.all(closePromises);
    this.servers.clear();
    
    console.log('All servers stopped');
  }
}