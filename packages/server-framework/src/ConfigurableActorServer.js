/**
 * ConfigurableActorServer
 * Configuration-driven server that automatically sets up actor routes
 */

import { BaseServer } from './BaseServer.js';
import path from 'path';
import { pathToFileURL } from 'url';

export class ConfigurableActorServer extends BaseServer {
  constructor(config) {
    super();
    this.config = config;
    this.loadedServices = new Map();
  }

  /**
   * Load and validate configuration
   */
  validateConfig() {
    if (!this.config) {
      throw new Error('Configuration is required');
    }
    
    if (!this.config.routes || !Array.isArray(this.config.routes)) {
      throw new Error('Configuration must have a routes array');
    }
    
    // Validate each route
    for (const route of this.config.routes) {
      if (!route.path) {
        throw new Error('Each route must have a path');
      }
      if (!route.serverActor) {
        throw new Error(`Route ${route.path} must have a serverActor`);
      }
      if (!route.clientActor) {
        throw new Error(`Route ${route.path} must have a clientActor`);
      }
    }
  }

  /**
   * Initialize server with configuration
   */
  async initialize() {
    // Set flag before parent initialization to skip discovery
    if (this.config.skipLegionPackages) {
      this.skipLegionPackageDiscovery = true;
    }
    
    // Call parent initialization
    await super.initialize();
    
    // Override monorepoRoot if skipLegionPackages is set
    if (this.config.skipLegionPackages) {
      this.monorepoRoot = null;
      this.legionPackages.clear();
      console.log('Skipping Legion package discovery (test mode)');
    }
    
    // Validate configuration
    this.validateConfig();
    
    // Load configured services if any
    if (this.config.services) {
      await this.loadServices();
    }
    
    // Register all configured routes
    await this.registerConfiguredRoutes();
    
    // Register static routes if configured
    if (this.config.static) {
      this.registerConfiguredStaticRoutes();
    }
  }

  /**
   * Load services defined in configuration
   */
  async loadServices() {
    for (const [serviceName, servicePath] of Object.entries(this.config.services || {})) {
      try {
        console.log(`Loading service: ${serviceName} from ${servicePath}`);
        
        // Handle different import patterns
        let serviceModule;
        if (servicePath.startsWith('@')) {
          // npm package
          serviceModule = await import(servicePath);
        } else if (servicePath.startsWith('./') || servicePath.startsWith('../')) {
          // Relative path from config file location
          const configDir = this.config.__dirname || process.cwd();
          const absolutePath = path.resolve(configDir, servicePath);
          const fileUrl = pathToFileURL(absolutePath).href;
          serviceModule = await import(fileUrl);
        } else {
          // Absolute path
          const fileUrl = pathToFileURL(servicePath).href;
          serviceModule = await import(fileUrl);
        }
        
        // Get the service (handle default exports)
        const Service = serviceModule.default || serviceModule;
        
        // Instantiate or store service
        let serviceInstance;
        if (typeof Service === 'function') {
          // If it's a class/constructor, instantiate it
          serviceInstance = new Service(this.resourceManager);
        } else {
          // Otherwise use as-is
          serviceInstance = Service;
        }
        
        // Store in services map
        this.services.set(serviceName, serviceInstance);
        this.loadedServices.set(serviceName, serviceInstance);
        
        console.log(`✅ Service loaded: ${serviceName}`);
      } catch (error) {
        console.error(`Failed to load service ${serviceName}:`, error);
        throw new Error(`Cannot load service ${serviceName}: ${error.message}`);
      }
    }
  }

  /**
   * Register routes from configuration
   */
  async registerConfiguredRoutes() {
    for (const routeConfig of this.config.routes) {
      try {
        console.log(`Registering route: ${routeConfig.path}`);
        
        // Load server actor module
        const serverActorModule = await this.loadActorModule(routeConfig.serverActor, 'server');
        
        // Resolve client actor path
        const clientActorPath = await this.resolveActorPath(routeConfig.clientActor, 'client');
        
        // Create factory function that instantiates the server actor
        const serverActorFactory = (services) => {
          // Get actor class/function
          const ServerActor = serverActorModule.default || serverActorModule;
          
          // Check if specific services are requested
          const requestedServices = routeConfig.services || [];
          const actorServices = {};
          
          // Provide requested services
          for (const serviceName of requestedServices) {
            if (services.has(serviceName)) {
              actorServices[serviceName] = services.get(serviceName);
            } else {
              console.warn(`Service ${serviceName} not found for route ${routeConfig.path}`);
            }
          }
          
          // Create actor instance
          if (typeof ServerActor === 'function') {
            // Class or constructor function
            if (ServerActor.prototype && ServerActor.prototype.constructor === ServerActor) {
              // It's a class
              return new ServerActor(actorServices);
            } else {
              // It's a factory function
              return ServerActor(actorServices);
            }
          } else {
            // It's an object, return as-is
            return ServerActor;
          }
        };
        
        // Prepare route config with context for resource provider
        const fullRouteConfig = {
          ...routeConfig,
          factory: serverActorFactory,
          clientFile: clientActorPath,
          port: routeConfig.port || this.config.port || 8080,
          __dirname: this.config.__dirname // Pass config directory for relative path resolution
        };

        // Register with base server, passing the full config
        this.registerRoute(fullRouteConfig.path, serverActorFactory, clientActorPath, fullRouteConfig.port, fullRouteConfig);
        
        console.log(`✅ Route registered: ${routeConfig.path} on port ${fullRouteConfig.port}`);
      } catch (error) {
        console.error(`Failed to register route ${routeConfig.path}:`, error);
        throw new Error(`Cannot register route ${routeConfig.path}: ${error.message}`);
      }
    }
  }

  /**
   * Register static routes from configuration
   */
  registerConfiguredStaticRoutes() {
    for (const [urlPath, directory] of Object.entries(this.config.static || {})) {
      try {
        // Resolve directory path
        const configDir = this.config.__dirname || process.cwd();
        const absoluteDir = path.resolve(configDir, directory);
        
        this.registerStaticRoute(urlPath, absoluteDir);
        console.log(`✅ Static route registered: ${urlPath} -> ${absoluteDir}`);
      } catch (error) {
        console.error(`Failed to register static route ${urlPath}:`, error);
      }
    }
  }

  /**
   * Load an actor module (server-side)
   */
  async loadActorModule(actorPath, type) {
    try {
      let module;
      
      if (actorPath.startsWith('@')) {
        // npm package
        module = await import(actorPath);
      } else if (actorPath.startsWith('./') || actorPath.startsWith('../')) {
        // Relative path from config file location
        const configDir = this.config.__dirname || process.cwd();
        const absolutePath = path.resolve(configDir, actorPath);
        const fileUrl = pathToFileURL(absolutePath).href;
        module = await import(fileUrl);
      } else {
        // Absolute path
        const fileUrl = pathToFileURL(actorPath).href;
        module = await import(fileUrl);
      }
      
      return module;
    } catch (error) {
      throw new Error(`Failed to load ${type} actor from ${actorPath}: ${error.message}`);
    }
  }

  /**
   * Resolve actor path for client-side loading
   */
  async resolveActorPath(actorPath, type) {
    if (actorPath.startsWith('@')) {
      // npm package - will be served via /legion/ routes
      // Extract package name and file path
      const parts = actorPath.split('/');
      const packageName = parts[0] + '/' + parts[1]; // e.g., @myapp/actors
      const filePath = parts.slice(2).join('/'); // e.g., ClientActor.js
      
      // This will be served via the Legion package routes
      return `/legion/${packageName.replace('@', '')}/${filePath}`;
    } else if (actorPath.startsWith('./') || actorPath.startsWith('../')) {
      // Relative path - resolve to absolute
      const configDir = this.config.__dirname || process.cwd();
      return path.resolve(configDir, actorPath);
    } else {
      // Absolute path
      return actorPath;
    }
  }

  /**
   * Start server with configuration
   */
  async start() {
    if (!this.config) {
      throw new Error('Server not configured. Call initialize() first.');
    }
    
    // Log configuration summary
    console.log('\n📋 Server Configuration:');
    console.log(`   Name: ${this.config.name || 'Legion App'}`);
    console.log(`   Routes: ${this.config.routes.length}`);
    if (this.loadedServices.size > 0) {
      console.log(`   Services: ${Array.from(this.loadedServices.keys()).join(', ')}`);
    }
    if (this.config.static) {
      console.log(`   Static routes: ${Object.keys(this.config.static).length}`);
    }
    console.log('');
    
    // Start the server
    await super.start();
  }
}

/**
 * Factory function to create and initialize a ConfigurableActorServer
 */
export async function createConfigurableServer(config) {
  const server = new ConfigurableActorServer(config);
  await server.initialize();
  return server;
}