import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Central registry for all resources needed by modules
 * Provides dependency injection capabilities with factories, scopes, and lazy initialization
 * Automatically loads environment variables from .env file
 */
class ResourceManager {
  constructor(options = {}) {
    this.resources = new Map();
    this.factories = new Map();
    this.modules = new Map();
    this.options = options;
    this.parent = options.parent || null; // For scoped resource managers
    this.initialized = false;
    
    // Note: .env loading will be done in initialize() method
    // since it needs to be async with ES6 modules
  }
  
  /**
   * Initialize the ResourceManager (async operations)
   * Must be called after construction if loadEnv is needed
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.options.loadEnv !== false && !this.parent) {
      await this.loadEnvFile(this.options.envPath);
    }
    
    // Register built-in service factories
    await this.registerBuiltInFactories();
    
    // Register workspace configuration
    await this.registerWorkspaceConfiguration();
    
    this.initialized = true;
  }

  /**
   * Register built-in service factories
   * @private
   */
  async registerBuiltInFactories() {
    try {
      // Register StaticServer factory
      const { createStaticServer } = await import('../services/StaticServerFactory.js');
      this.registerFactory('StaticServer', createStaticServer);
      
      // Register MCPServer factory
      const { createMCPServer } = await import('../services/MCPServerFactory.js');
      this.registerFactory('MCPServer', createMCPServer);
      
      // Register additional built-in services here as needed
      // this.registerFactory('DatabaseService', createDatabaseService);
      // this.registerFactory('CacheService', createCacheService);
      
    } catch (error) {
      // Silently fail if service factories are not available
      // This allows ResourceManager to work without optional services
    }
  }

  /**
   * Find the project root directory by searching for "legion" directory
   * @returns {string|null} Path to project root or null if not found
   */
  findProjectRoot() {
    let currentDir = process.cwd();
    const maxLevels = 10; // Prevent infinite loops
    let level = 0;

    while (level < maxLevels) {
      try {
        // Check if current directory is named "legion" (case-insensitive)
        const dirName = path.basename(currentDir).toLowerCase();
        if (dirName === 'legion') {
          return currentDir;
        }

        // Move up one directory
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          // Reached filesystem root
          break;
        }
        currentDir = parentDir;
        level++;
      } catch (error) {
        // Continue searching if we hit an error reading a directory
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          break;
        }
        currentDir = parentDir;
        level++;
      }
    }

    return null;
  }
  
  /**
   * Load environment variables from .env file
   * @param {string} envPath - Optional path to .env file
   */
  async loadEnvFile(envPath) {
    try {
      // If no path provided, search for .env file
      if (!envPath) {
        // First try to find the monorepo root by looking for package.json with workspaces
        const projectRoot = this.findProjectRoot();
        if (projectRoot) {
          const rootEnvPath = path.join(projectRoot, '.env');
          if (fs.existsSync(rootEnvPath)) {
            envPath = rootEnvPath;
          }
        }
        
        // Fallback to searching common relative locations if root detection failed
        if (!envPath) {
          const possiblePaths = [
            path.join(process.cwd(), '.env'),
            path.join(process.cwd(), '..', '.env'),
            path.join(process.cwd(), '..', '..', '.env'),
            path.join(process.cwd(), '..', '..', '..', '.env'),
            path.join(__dirname, '..', '..', '..', '.env'),
            path.join(__dirname, '..', '..', '..', '..', '.env')
          ];
          
          for (const tryPath of possiblePaths) {
            if (fs.existsSync(tryPath)) {
              envPath = tryPath;
              break;
            }
          }
        }
      }
      
      if (envPath && fs.existsSync(envPath)) {
        // Load dotenv
        const dotenv = await import('dotenv');
        dotenv.config({ path: envPath });
        
        // Register all environment variables as resources
        for (const [key, value] of Object.entries(process.env)) {
          this.register(`env.${key}`, value);
        }
      }
    } catch (error) {
      // Silently fail if .env file cannot be loaded
      // This is okay as .env files are optional
    }
  }

  /**
   * Register a resource by name
   * @param {string} name - The name of the resource
   * @param {*} resource - The resource to register (can be any type)
   */
  register(name, resource) {
    this.resources.set(name, resource);
  }

  /**
   * Get a resource by name
   * @param {string} name - The name of the resource
   * @returns {*} The registered resource
   * @throws {Error} If the resource is not found
   */
  get(name) {
    if (this.resources.has(name)) {
      return this.resources.get(name);
    }
    
    // Check parent scope if exists
    if (this.parent && this.parent.has(name)) {
      return this.parent.get(name);
    }
    
    throw new Error(`Resource '${name}' not found`);
  }

  /**
   * Check if a resource exists
   * @param {string} name - The name of the resource
   * @returns {boolean} True if the resource exists
   */
  has(name) {
    return this.resources.has(name) || !!(this.parent && this.parent.has(name));
  }

  /**
   * Register a factory function for lazy resource creation
   * @param {string} name - The name of the resource
   * @param {Function} factory - Factory function that creates the resource
   */
  registerFactory(name, factory) {
    if (typeof factory !== 'function') {
      throw new Error(`Factory for '${name}' must be a function`);
    }
    this.factories.set(name, factory);
  }

  /**
   * Register a module class for dependency injection
   * @param {string} name - The name of the module
   * @param {Class} moduleClass - The module class constructor
   */
  registerModule(name, moduleClass) {
    this.modules.set(name, moduleClass);
    // Also register as a factory
    this.registerFactory(name, (config, rm) => new moduleClass(config, rm));
  }

  /**
   * Get or create a resource using registered factory
   * @param {string} name - The name of the resource
   * @param {Object} config - Configuration to pass to factory
   * @returns {*} The resource instance
   */
  async getOrCreate(name, config = {}) {
    // Check if already exists
    if (this.has(name)) {
      return this.get(name);
    }
    
    // Check for factory in current scope
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      const instance = await factory(config, this);
      this.register(name, instance);
      return instance;
    }
    
    // Check for factory in parent scope
    if (this.parent && this.parent.factories && this.parent.factories.has(name)) {
      const factory = this.parent.factories.get(name);
      const instance = await factory(config, this);
      this.register(name, instance);
      return instance;
    }
    
    throw new Error(`Resource '${name}' not found and no factory registered`);
  }

  /**
   * Create a scoped ResourceManager for isolated testing
   * @returns {ResourceManager} A new ResourceManager with this as parent
   */
  createScope() {
    const scope = new ResourceManager({ parent: this });
    scope.initialized = true; // Inherit initialized state
    return scope;
  }

  /**
   * Remove a resource by name
   * @param {string} name - The name of the resource to remove
   * @returns {boolean} True if the resource was removed, false if it didn't exist
   */
  unregister(name) {
    return this.resources.delete(name);
  }

  /**
   * Clear all resources (useful for testing)
   */
  clear() {
    this.resources.clear();
    // Don't clear factories or modules - they can be reused
  }

  /**
   * Get all registered resource names
   * @returns {Array<string>} List of resource names
   */
  getResourceNames() {
    const names = Array.from(this.resources.keys());
    if (this.parent) {
      const parentNames = this.parent.getResourceNames();
      return [...new Set([...names, ...parentNames])];
    }
    return names;
  }

  /**
   * Get all registered factory names
   * @returns {Array<string>} List of factory names
   */
  getFactoryNames() {
    const names = Array.from(this.factories.keys());
    if (this.parent && this.parent.factories) {
      const parentNames = Array.from(this.parent.factories.keys());
      return [...new Set([...names, ...parentNames])];
    }
    return names;
  }

  /**
   * Register workspace configuration and paths
   * @private
   */
  async registerWorkspaceConfiguration() {
    const projectRoot = this.findProjectRoot();
    
    // Helper function to safely get environment variables
    const getEnvVar = (name) => {
      try {
        return this.get(`env.${name}`);
      } catch (error) {
        return undefined;
      }
    };

    // Determine workspace base directory - prefer plan-executor package over monorepo root
    let workspaceBaseDir;
    if (projectRoot) {
      const planExecutorDir = path.join(projectRoot, 'packages', 'plan-executor');
      // Check if we're in the plan-executor context
      try {
        await import('fs/promises').then(fs => fs.access(planExecutorDir));
        workspaceBaseDir = planExecutorDir;
      } catch {
        // Fallback to project root if plan-executor directory doesn't exist
        workspaceBaseDir = projectRoot;
      }
    } else {
      workspaceBaseDir = '/tmp';
    }

    // Default workspace configuration
    const workspaceConfig = {
      projectRoot: projectRoot,
      workspaceBaseDir: workspaceBaseDir,
      tempDir: getEnvVar('TEMP_DIR') || path.join(workspaceBaseDir, 'tmp'),
      artifactDir: getEnvVar('ARTIFACT_DIR') || path.join(workspaceBaseDir, '__tests__', 'tmp'),
      workspaceDir: getEnvVar('WORKSPACE_DIR') || path.join(workspaceBaseDir, '__tests__', 'tmp', 'workspaces')
    };

    // Register workspace paths
    this.register('workspace.projectRoot', workspaceConfig.projectRoot);
    this.register('workspace.workspaceBaseDir', workspaceConfig.workspaceBaseDir);
    this.register('workspace.tempDir', workspaceConfig.tempDir);
    this.register('workspace.artifactDir', workspaceConfig.artifactDir);
    this.register('workspace.workspaceDir', workspaceConfig.workspaceDir);
    
    // Register complete workspace config
    this.register('workspace.config', workspaceConfig);
  }

}

export default ResourceManager;
export { ResourceManager };