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
import { DefaultResourceProvider, CompositeResourceProvider } from './resources/index.js';

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

    // Get ResourceManager singleton - auto-initializes
    this.resourceManager = await ResourceManager.getInstance();
    
    // Store in services for actor access
    this.services.set('resourceManager', this.resourceManager);
    
    // Get configuration from ResourceManager
    this.host = 'localhost'; // Always localhost for now
    this.monorepoRoot = this.resourceManager.get('env.MONOREPO_ROOT');
    
    // Apply basic middleware
    this.setupMiddleware();
    
    // Discover Legion packages (unless overridden by subclass)
    if (this.monorepoRoot && !this.skipLegionPackageDiscovery) {
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
   * @param {Object} additionalConfig - Additional configuration for the route
   */
  registerRoute(route, serverActorFactory, clientActorFile, port = 8080, additionalConfig = {}) {
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

    // Store route information with additional config
    this.routes.set(route, {
      route: route,
      factory: serverActorFactory,
      clientFile: clientActorFile,
      port: port,
      ...additionalConfig
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
   * Kill any existing processes using the specified ports
   * @param {number[]} ports - Array of port numbers to clean up
   */
  async cleanupPorts(ports) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Skip cleanup in test environment to avoid hanging
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      console.log('🧹 Skipping port cleanup in test environment');
      return;
    }
    
    for (const port of ports) {
      try {
        console.log(`🧹 Checking port ${port}...`);
        
        // Find process using the port with timeout
        const { stdout } = await Promise.race([
          execAsync(`lsof -ti:${port}`),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('lsof timeout')), 2000)
          )
        ]);
        
        const pids = stdout.trim().split('\n').filter(pid => pid);
        
        if (pids.length > 0) {
          console.log(`🔫 Killing ${pids.length} process(es) on port ${port}: ${pids.join(', ')}`);
          
          // Kill each process with timeout
          for (const pid of pids) {
            try {
              await Promise.race([
                execAsync(`kill -9 ${pid}`),
                new Promise(resolve => setTimeout(resolve, 1000))
              ]);
              console.log(`✅ Killed process ${pid}`);
            } catch (error) {
              console.warn(`⚠️ Could not kill process ${pid}:`, error.message);
            }
          }
          
          // Wait a moment for cleanup
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log(`✅ Port ${port} is free`);
        }
      } catch (error) {
        // No processes found on port, or lsof command failed/timed out
        console.log(`✅ Port ${port} is free or check timed out`);
      }
    }
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

    // Clear any existing processes on our ports
    console.log('🧹 Cleaning up ports...');
    await this.cleanupPorts(Array.from(routesByPort.keys()));

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
      console.log(`Setting up Legion package routes for ${this.legionPackages.size} packages...`);
      this.setupLegionPackageRoutes(app);
      console.log('✅ Legion package routes setup completed');
    } catch (error) {
      console.error(`❌ Failed to setup Legion package routes:`, error);
      throw error; // NO FALLBACKS - fail fast
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
   * Set up individual route with resource provider system
   * @private
   */
  async setupRoute(app, routeConfig) {
    const { route, factory, clientFile, port } = routeConfig;
    
    // 1. Create default resource provider
    const defaultProvider = this.createDefaultResourceProvider(routeConfig);
    
    // 2. Ask server actor if it wants to customize resources (dependency inversion)
    const resourceProvider = await this.createResourceProvider(routeConfig, defaultProvider);
    
    // 3. Set up resource serving middleware
    this.setupResourceMiddleware(app, route, resourceProvider);
    
    console.log(`Set up route ${route} on port ${port} with resource provider`);
  }

  /**
   * Create default resource provider for a route
   * @private
   */
  createDefaultResourceProvider(routeConfig) {
    const { route, clientFile, port } = routeConfig;
    
    // Generate title from route name
    const title = route.substring(1).charAt(0).toUpperCase() + route.substring(2) || 'Legion App';
    
    return new DefaultResourceProvider({
      title: title,
      clientActorFile: clientFile,
      clientActorPath: `${route}/client.js`,  // Use route-specific path
      wsEndpoint: `ws://${this.host}:${port}/ws?route=${encodeURIComponent(route)}`,
      route: route,
      // Allow configuration customization
      clientContainer: routeConfig.clientContainer || 'app'
    });
  }

  /**
   * Create resource provider (ask server actor for customization)
   * @private
   */
  async createResourceProvider(routeConfig, defaultProvider) {
    try {
      // Load server actor module to check for resource customization
      const serverActorPath = routeConfig.serverActor;
      let serverActorModule;
      
      if (serverActorPath.startsWith('./') || serverActorPath.startsWith('../')) {
        // Relative path from config file location
        const configDir = routeConfig.__dirname || process.cwd();
        const absolutePath = path.resolve(configDir, serverActorPath);
        const { pathToFileURL } = await import('url');
        const fileUrl = pathToFileURL(absolutePath).href;
        serverActorModule = await import(fileUrl);
      } else {
        // Absolute path or npm package
        serverActorModule = await import(serverActorPath);
      }
      
      const ServerActorClass = serverActorModule.default || serverActorModule;
      
      // Check if server actor provides a custom resource provider
      if (ServerActorClass && typeof ServerActorClass.createResourceProvider === 'function') {
        console.log(`Route ${routeConfig.route} using custom resource provider`);
        const customProvider = ServerActorClass.createResourceProvider(defaultProvider);
        return customProvider || defaultProvider;
      }
      
      // Use default provider
      return defaultProvider;
      
    } catch (error) {
      console.warn(`Could not load server actor for resource customization: ${error.message}`);
      return defaultProvider;
    }
  }

  /**
   * Set up resource serving middleware
   * @private
   */
  setupResourceMiddleware(app, route, resourceProvider) {
    // Handle all requests under this route
    app.use(route, async (req, res, next) => {
      try {
        const requestPath = req.path === '/' ? '/' : req.path;
        const resource = await resourceProvider.getResource(requestPath, req);
        
        if (resource) {
          // Set response headers
          if (resource.status) {
            res.status(resource.status);
          }
          
          if (resource.headers) {
            for (const [key, value] of Object.entries(resource.headers)) {
              res.setHeader(key, value);
            }
          }
          
          // Set content type
          res.setHeader('Content-Type', resource.type);
          
          // Handle cache headers
          if (resource.cache) {
            if (typeof resource.cache === 'string') {
              res.setHeader('Cache-Control', `public, max-age=${this.parseMaxAge(resource.cache)}`);
            } else if (resource.cache === true) {
              res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes default
            }
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
          
          // Send response
          if (resource.file) {
            // Serve from file
            const resolvedPath = path.resolve(resource.file);
            console.log('[DEBUG] Serving file:', resource.file, '-> resolved:', resolvedPath);
            
            // For JavaScript files, apply import rewriting
            if (resolvedPath.endsWith('.js') || resolvedPath.endsWith('.mjs')) {
              try {
                const fs = await import('fs');
                const content = await fs.promises.readFile(resolvedPath, 'utf8');
                const rewrittenContent = this.importRewriter.rewrite(content);
                
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                res.send(rewrittenContent);
                console.log('[DEBUG] Applied import rewriting to JS file');
              } catch (error) {
                console.log('[DEBUG] Import rewriting failed:', error.message);
                res.status(404).send('File not found');
              }
            } else {
              // Non-JS files, serve directly
              res.sendFile(resolvedPath, (err) => {
                if (err) {
                  console.log('[DEBUG] sendFile error:', err.message);
                  res.status(404).send('File not found');
                }
              });
            }
          } else if (resource.content) {
            // Send content directly
            res.send(resource.content);
          } else {
            res.status(500).send('Invalid resource response');
          }
        } else {
          // Resource not found, continue to next middleware
          next();
        }
      } catch (error) {
        console.error(`Error serving resource for ${route}${req.path}:`, error);
        res.status(500).send('Resource serving error');
      }
    });

    // Special handling for client.js with import rewriting
    app.get(`${route}/client.js`, async (req, res) => {
      try {
        const clientFile = resourceProvider.config?.clientActorFile;
        if (!clientFile) {
          return res.status(404).send('Client actor file not configured');
        }

        const content = await import('fs').then(fs => 
          fs.promises.readFile(clientFile, 'utf8')
        );
        
        // Rewrite @legion imports in client file
        const rewritten = this.importRewriter.rewrite(content);
        
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(rewritten);
      } catch (error) {
        console.error(`Error serving client file:`, error);
        res.status(404).send('Client actor file not found');
      }
    });
  }

  /**
   * Parse cache max-age from string
   * @private
   */
  parseMaxAge(cacheString) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800,
      'y': 31536000
    };
    
    const match = cacheString.match(/^(\d+)\s*([smhdwy]?)$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2] || 's';
      return value * (units[unit] || 1);
    }
    
    return 300; // Default 5 minutes
  }

  /**
   * Set up Legion package serving routes
   * @private
   */
  setupLegionPackageRoutes(app) {
    console.log('📦 Setting up Legion package routes...');
    
    // Serve each discovered Legion package
    for (const [packageName, packageInfo] of this.legionPackages) {
      const cleanName = packageInfo.cleanName;
      const routePath = `/legion/${cleanName}`;
      
      console.log(`📦 Setting up route: ${routePath} -> ${packageInfo.path}`);
      
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
            
            // Rewrite @legion imports with full context
            const rewritten = this.importRewriter.rewrite(content, { 
              legionPackage: cleanName,
              requestPath: req.path,
              baseUrl: `/legion/${cleanName}`
            });
            
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