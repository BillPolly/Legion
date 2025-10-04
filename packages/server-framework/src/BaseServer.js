/**
 * BaseServer class - Core server framework for Legion applications
 * Provides Express + WebSocket setup with actor-based communication
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'path';
import { ResourceManager } from '@legion/resource-manager';
import { ActorSpace } from '@legion/actors';
import { PackageDiscovery } from './utils/PackageDiscovery.js';
import { ImportRewriter } from './utils/ImportRewriter.js';
import { DefaultResourceProvider, CompositeResourceProvider } from './resources/index.js';

export class BaseServer {
  constructor() {
    // Initialize Express app
    this.app = express();

    // Core properties
    this.resourceManager = null;  // Will be initialized with singleton
    this.routes = new Map();      // route -> { factory, clientFile, port, spaceActorFactory }
    this.services = new Map();    // Shared services for actors
    this.servers = new Map();     // port -> HTTP server instance
    this.wssInstances = new Map(); // port -> WebSocket server instance
    this.actorSpaces = new Map(); // port -> ActorSpace instance
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
    
    // Initialize package caches
    this.packageCache = new Map();
    this.fileCache = new Map();
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

    // Serve Legion favicon
    const faviconPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'assets', 'favicon.ico');
    app.get('/favicon.ico', (req, res) => {
      res.sendFile(faviconPath);
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
      console.log('✅ Legion package routes setup completed');
    } catch (error) {
      console.error(`❌ Failed to setup Legion package routes:`, error);
      throw error; // NO FALLBACKS - fail fast
    }
    
    // Set up static routes with import rewriting middleware
    for (const [routePath, directory] of this.staticRoutes) {
      try {
        // Add middleware to rewrite imports in JS files
        app.use(routePath, async (req, res, next) => {
          // Skip WebSocket paths
          if (req.path === '/ws' || req.path.startsWith('/ws/')) {
            return next();
          }

          // Only process .js and .mjs files
          if (req.path.endsWith('.js') || req.path.endsWith('.mjs')) {
            try {
              const fs = await import('fs');
              const filePath = path.join(directory, req.path);

              // Check if file exists
              try {
                await fs.promises.access(filePath);
              } catch {
                return next(); // File doesn't exist, pass to next handler
              }

              const content = await fs.promises.readFile(filePath, 'utf8');
              const rewrittenContent = this.importRewriter.rewrite(content, {
                requestPath: req.path,
                baseUrl: routePath
              });

              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              res.send(rewrittenContent);
            } catch (error) {
              console.error(`Error rewriting imports for ${req.path}:`, error.message);
              next(); // Fall through to static handler
            }
          } else {
            next(); // Not a JS file, pass to static handler
          }
        });

        // Then add the static handler for other files
        app.use(routePath, express.static(directory));
        console.log(`Serving static files at ${routePath} from ${directory}`);
      } catch (error) {
        console.warn(`Failed to setup static route ${routePath} -> ${directory}:`, error);
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

    // Create ActorSpace for this port
    const actorSpace = new ActorSpace(`server-port-${port}`);
    this.actorSpaces.set(port, actorSpace);

    // Create space actor factory that handles routing based on query params
    // This factory will be called for EACH WebSocket connection
    const spaceActorFactory = () => {
      // Create a routing space actor that handles different routes
      return this.createRoutingSpaceActor(routes, port);
    };

    // Use ActorSpace.listen() - it handles WebSocket internally
    // Note: We already have a WebSocket server, so we'll use manual connection handling
    // and call actorSpace.connect manually for each connection
    wss.on('connection', async (ws, req) => {
      try {
        // Extract route from query parameters
        const url = new URL(req.url, `http://localhost:${port}`);
        const routePath = url.searchParams.get('route') || routes[0]?.route;

        console.log(`[WebSocket] Connecting to route: "${routePath}"`);
        console.log(`[WebSocket] Available routes:`, routes.map(r => r.route));

        // Find matching route config
        const routeConfig = routes.find(r => r.route === routePath);
        if (!routeConfig) {
          console.error(`No route found for "${routePath}"`);
          console.error(`Available routes:`, routes.map(r => r.route));
          ws.close();
          return;
        }

        // Create space actor for this connection using the route's space actor factory
        const spaceActor = routeConfig.spaceActorFactory
          ? routeConfig.spaceActorFactory(this.services, routeConfig)
          : this.createDefaultSpaceActor(routeConfig, this.services);

        // Add channel to actor space with space actor
        const channel = actorSpace.addChannel(ws, spaceActor);

        console.log(`WebSocket connected for route ${routePath} on port ${port}`);
      } catch (error) {
        console.error('Error handling WebSocket connection:', error);
        ws.close();
      }
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
    const { route, clientFile, port, importMap } = routeConfig;

    // Generate title from route name
    const title = route.substring(1).charAt(0).toUpperCase() + route.substring(2) || 'Legion App';

    return new DefaultResourceProvider({
      title: title,
      clientActorFile: clientFile,
      clientActorPath: `${route}/client.js`,  // Use route-specific path
      wsEndpoint: `ws://${this.host}:${port}/ws?route=${encodeURIComponent(route)}`,
      route: route,
      // Allow configuration customization
      clientContainer: routeConfig.clientContainer || 'app',
      importMap: importMap || {}
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
    console.log('📦 Setting up Legion package routes with dynamic imports...');
    console.log('📦 MonorepoRoot at setup time:', this.monorepoRoot);

    // Cache for resolved packages and files
    this.packageCache = new Map();
    this.fileCache = new Map();

    // Single route handler for all /legion/* requests
    app.use('/legion', async (req, res, next) => {
      try {
        // Parse request path: /package-name/file.js
        const pathParts = req.path.substring(1).split('/'); // Remove leading /
        const packageName = pathParts[0];
        const filePath = pathParts.slice(1).join('/') || 'index.js';

        console.log(`📦 /legion request: ${packageName}/${filePath}, monorepoRoot=${this.monorepoRoot}`);

        const cacheKey = `${packageName}:${filePath}`;

        // Check file cache first
        if (this.fileCache.has(cacheKey)) {
          const cached = this.fileCache.get(cacheKey);
          res.setHeader('Content-Type', cached.contentType);
          res.send(cached.content);
          return;
        }

        // Get or resolve package using simple path mapping (like aiur-ui server)
        let packageInfo = this.packageCache.get(packageName);
        if (!packageInfo) {
          try {
            // Use simple path mapping - no complex module resolution needed
            const fullPackageName = `@legion/${packageName}`;

            // Map to monorepo packages directory
            if (!this.monorepoRoot) {
              console.error('❌ Monorepo root not configured! this.monorepoRoot =', this.monorepoRoot);
              throw new Error('Monorepo root not configured');
            }
            
            const fs = await import('fs');
            let packagePath;
            
            // Try different possible locations for the package
            const possiblePaths = [
              path.join(this.monorepoRoot, 'packages', packageName), // packages/resource-manager
              path.join(this.monorepoRoot, 'packages', 'modules', packageName), // packages/modules/showme
              path.join(this.monorepoRoot, 'packages', 'frontend', packageName), // packages/frontend/declarative-components
              path.join(this.monorepoRoot, 'packages', 'shared', packageName), // packages/shared/data
              path.join(this.monorepoRoot, 'packages', 'shared', 'data', packageName), // packages/shared/data/handle
              path.join(this.monorepoRoot, 'packages', 'storage', packageName), // packages/storage/...
              path.join(this.monorepoRoot, 'packages', 'tools-registry', packageName), // packages/tools-registry/...
            ];
            
            // Find the first path that exists
            for (const tryPath of possiblePaths) {
              try {
                await fs.promises.access(tryPath);
                packagePath = tryPath;
                break;
              } catch {
                // Continue trying other paths
              }
            }
            
            if (!packagePath) {
              throw new Error(`Package @legion/${packageName} not found in any expected location`);
            }
            
            packageInfo = {
              name: fullPackageName,
              path: packagePath
            };
            
            this.packageCache.set(packageName, packageInfo);
            console.log(`📦 Resolved package: ${fullPackageName} at ${packagePath}`);
          } catch (error) {
            console.warn(`Package @legion/${packageName} not found:`, error.message);
            return next();
          }
        }
        
        // Resolve file path within package
        // Try direct path first, then src/ subdirectory
        let actualFilePath = path.join(packageInfo.path, filePath);
        let actualRequestPath = `/legion/${packageName}/${filePath}`;

        const fs = await import('fs');

        // Check if file exists, if not try src/ subdirectory
        try {
          await fs.promises.access(actualFilePath);
        } catch (err) {
          // Try src/ subdirectory
          const srcPath = path.join(packageInfo.path, 'src', filePath);
          try {
            await fs.promises.access(srcPath);
            actualFilePath = srcPath;
            actualRequestPath = `/legion/${packageName}/src/${filePath}`;
          } catch (err2) {
            console.warn(`File not found: ${cacheKey} (tried ${actualFilePath} and ${srcPath})`);
            return next();
          }
        }

        // Read and serve file
        const content = await fs.promises.readFile(actualFilePath, 'utf8');

        let finalContent = content;
        let contentType = 'text/plain';

        // For JavaScript files, rewrite imports
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          finalContent = this.importRewriter.rewrite(content, {
            legionPackage: packageName,
            requestPath: actualRequestPath,
            baseUrl: `/legion/${packageName}`
          });
          contentType = 'application/javascript; charset=utf-8';
        } else if (filePath.endsWith('.json')) {
          contentType = 'application/json';
        }
        
        // Cache the result
        this.fileCache.set(cacheKey, { content: finalContent, contentType });
        
        res.setHeader('Content-Type', contentType);
        res.send(finalContent);
        
      } catch (error) {
        console.error(`Error serving ${req.path}:`, error.message);
        next();
      }
    });
    
    console.log('✅ Legion dynamic package serving setup completed');
  }

  /**
   * Start a simple static server with Legion package support (no actors/WebSocket)
   * This provides the easiest way to serve Legion packages without actor communication
   * @param {number} port - Port to run on (defaults to 8080)
   * @param {Object} options - Static server options
   */
  async startStaticServer(port = 8080, options = {}) {
    if (!this.resourceManager) {
      await this.initialize();
    }

    // Check if server already exists on this port
    if (this.servers.has(port)) {
      console.log(`Static server already running on port ${port}`);
      return;
    }

    // Clean up any existing processes on this port
    await this.cleanupPorts([port]);

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
        service: 'legion-static-server',
        port: port,
        timestamp: new Date().toISOString(),
        legionPackages: 'dynamic'
      });
    });
    
    // Set up Legion package serving
    try {
      this.setupLegionPackageRoutes(app);
      console.log('✅ Legion package routes setup completed');
    } catch (error) {
      console.error(`❌ Failed to setup Legion package routes:`, error);
      throw error; // NO FALLBACKS - fail fast
    }
    
    // Set up static directory serving if specified
    if (options.staticDirectory) {
      try {
        app.use('/', express.static(options.staticDirectory));
        console.log(`Serving static files from ${options.staticDirectory}`);
      } catch (error) {
        console.warn(`Failed to setup static directory ${options.staticDirectory}:`, error);
        // Continue without static directory
      }
    }
    
    // Set up custom resource provider or default static provider
    const resourceProvider = options.resourceProvider || await this.createStaticResourceProvider(options);
    this.setupStaticResourceMiddleware(app, resourceProvider);
    
    // Start HTTP server (no WebSocket)
    const server = await new Promise((resolve, reject) => {
      const httpServer = app.listen(port, this.host, () => {
        console.log(`Static server with Legion packages running on http://${this.host}:${port}`);
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
    
    // Store server instance and Express app for external access
    this.servers.set(port, server);
    // Store Express app reference for adding routes later
    server._legionExpressApp = app;
    
    console.log('✅ Static server started successfully');
    
    return { server, app }; // Return both for external use
  }

  /**
   * Create static resource provider for static mode
   * @private
   */
  async createStaticResourceProvider(options) {
    const { StaticResourceProvider } = await import('./resources/StaticResourceProvider.js');
    return new StaticResourceProvider({
      title: options.title || 'Legion Static App',
      htmlFile: options.htmlFile || null,
      htmlContent: options.htmlContent || '',
      includeImportMaps: options.includeImportMaps !== false,
      customImports: options.customImports || {},
      ...options
    });
  }

  /**
   * Set up static resource serving middleware (no actors)
   * @private
   */
  setupStaticResourceMiddleware(app, resourceProvider) {
    // Handle root and favicon requests
    app.get('/', async (req, res) => {
      try {
        const resource = await resourceProvider.getResource('/', req);
        if (resource) {
          this.sendResourceResponse(res, resource);
        } else {
          res.status(404).send('Not Found');
        }
      } catch (error) {
        console.error(`Error serving root resource:`, error);
        res.status(500).send('Server Error');
      }
    });

    app.get('/favicon.ico', async (req, res) => {
      try {
        const resource = await resourceProvider.getResource('/favicon.ico', req);
        if (resource) {
          this.sendResourceResponse(res, resource);
        } else {
          res.status(404).send('Not Found');
        }
      } catch (error) {
        console.error(`Error serving favicon:`, error);
        res.status(404).send('Not Found');
      }
    });

    console.log('Static resource middleware setup completed');
  }

  /**
   * Send resource response with proper headers and content
   * @private
   */
  sendResourceResponse(res, resource) {
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
      console.log('[STATIC] Serving file:', resource.file, '-> resolved:', resolvedPath);
      
      // For JavaScript files, apply import rewriting
      if (resolvedPath.endsWith('.js') || resolvedPath.endsWith('.mjs')) {
        try {
          import('fs').then(fs => {
            fs.promises.readFile(resolvedPath, 'utf8').then(content => {
              const rewrittenContent = this.importRewriter.rewrite(content);
              
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              res.send(rewrittenContent);
              console.log('[STATIC] Applied import rewriting to JS file');
            }).catch(error => {
              console.log('[STATIC] Import rewriting failed:', error.message);
              res.status(404).send('File not found');
            });
          });
        } catch (error) {
          console.log('[STATIC] Import rewriting failed:', error.message);
          res.status(404).send('File not found');
        }
      } else {
        // Non-JS files, serve directly
        res.sendFile(resolvedPath, (err) => {
          if (err) {
            console.log('[STATIC] sendFile error:', err.message);
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
  }

  /**
   * Stop all servers
   */
  /**
   * Create a default space actor for a route
   * This handles the connection protocol and creates session actors
   * @private
   */
  createDefaultSpaceActor(routeConfig, services) {
    const { factory: sessionActorFactory, route: routePath } = routeConfig;

    return {
      isActor: true,
      sessionActorFactory,
      services,
      routePath,
      sessions: new Map(), // Track sessions for this space actor

      receive(messageType, data) {
        if (messageType === 'channel_connected') {
          console.log(`Space actor: Channel connected for route ${this.routePath}`);

          // Create session actor with error handling
          let sessionActor;
          try {
            sessionActor = this.sessionActorFactory(this.services);
          } catch (error) {
            console.error(`Error creating session actor for route ${this.routePath}:`, error.message);
            data.channel.close();
            return;
          }

          // Handle actor creation failure
          if (!sessionActor) {
            console.error(`Failed to create session actor for route ${this.routePath}`);
            data.channel.close();
            return;
          }

          const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Register session actor in the ActorSpace
          const actorSpace = data.channel.actorSpace;
          actorSpace.register(sessionActor, sessionId);

          // Track session
          this.sessions.set(sessionId, {
            actor: sessionActor,
            channel: data.channel
          });

          // Create remote actor for client (assume client has 'client-root' actor)
          const remoteClient = data.channel.makeRemote('client-root');

          // Give remote reference to session actor if it needs it
          if (typeof sessionActor.setRemoteActor === 'function') {
            sessionActor.setRemoteActor(remoteClient);
          }

          // SERVER MUST SEND FIRST (protocol requirement)
          // Send session-ready message to client
          remoteClient.receive('session-ready', {
            sessionId,
            serverActor: sessionId,
            timestamp: Date.now()
          });

          console.log(`Session created: ${sessionId} for route ${this.routePath}`);
        } else if (messageType === 'channel_closed') {
          console.log(`Space actor: Channel closed for route ${this.routePath}`);
          // Cleanup sessions associated with this channel
          for (const [sessionId, session] of this.sessions.entries()) {
            if (session.channel === data.channel) {
              this.sessions.delete(sessionId);
              console.log(`Session removed: ${sessionId}`);
            }
          }
        } else if (messageType === 'channel_error') {
          console.error(`Space actor: Channel error for route ${this.routePath}:`, data.error);
        }
      }
    };
  }

  async stop() {
    // Close all actor spaces
    for (const [port, actorSpace] of this.actorSpaces) {
      await actorSpace.destroy();
      console.log(`Destroyed ActorSpace on port ${port}`);
    }
    this.actorSpaces.clear();

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