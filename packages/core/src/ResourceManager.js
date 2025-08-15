/**
 * ResourceManager with Proxy-based transparent access
 * 
 * This ResourceManager uses JavaScript Proxy to provide transparent
 * property access while maintaining all the benefits of centralized
 * resource management.
 * 
 * @example
 * const rm = new ResourceManager();
 * 
 * // Set resources - looks like plain object
 * rm.apiKey = 'sk-123';
 * rm.basePath = '/workspace';
 * 
 * // Get resources - also like plain object  
 * console.log(rm.apiKey); // 'sk-123'
 * 
 * // Can still use methods when needed
 * rm.load({ apiKey: 'sk-456', model: 'gpt-4' });
 * console.log(rm.has('model')); // true
 */
export class ResourceManager {
  static _instance = null;
  
  constructor(initialResources = {}) {
    // Implement singleton pattern
    if (ResourceManager._instance) {
      return ResourceManager._instance;
    }
    
    // Internal storage
    this._resources = new Map();
    
    // Flag to track initialization status
    this.initialized = false;
    
    // Load initial resources if provided
    if (initialResources) {
      this.load(initialResources);
    }
    
    // Create the proxy
    const proxiedInstance = new Proxy(this, {
      get(target, prop, receiver) {
        // If it's a ResourceManager method or private property, access directly
        if (prop in target || prop.startsWith('_')) {
          return Reflect.get(target, prop, receiver);
        }
        
        // Otherwise, get the resource
        return target._resources.get(prop);
      },
      
      set(target, prop, value) {
        // Don't allow setting private properties or methods
        if (prop.startsWith('_') || prop in target) {
          return Reflect.set(target, prop, value);
        }
        
        // Set the resource
        target._resources.set(prop, value);
        return true;
      },
      
      has(target, prop) {
        // Check if it's a ResourceManager property/method
        if (prop in target) {
          return true;
        }
        
        // Check if resource exists
        return target._resources.has(prop);
      },
      
      deleteProperty(target, prop) {
        // Don't allow deleting methods
        if (prop in target) {
          return false;
        }
        
        // Delete the resource
        return target._resources.delete(prop);
      },
      
      ownKeys(target) {
        // Return both ResourceManager methods and resource keys
        const keys = Object.getOwnPropertyNames(target);
        const resourceKeys = Array.from(target._resources.keys());
        return [...new Set([...keys, ...resourceKeys])];
      },
      
      getOwnPropertyDescriptor(target, prop) {
        // For ResourceManager methods/properties
        if (prop in target) {
          return Object.getOwnPropertyDescriptor(target, prop);
        }
        
        // For resources
        if (target._resources.has(prop)) {
          return {
            enumerable: true,
            configurable: true,
            value: target._resources.get(prop)
          };
        }
        
        return undefined;
      }
    });
    
    // Set singleton instance to the proxy
    ResourceManager._instance = proxiedInstance;
    return proxiedInstance;
  }
  
  /**
   * Get the singleton instance of ResourceManager
   * @returns {ResourceManager} The singleton instance
   */
  static getInstance() {
    if (!ResourceManager._instance) {
      ResourceManager._instance = new ResourceManager();
    }
    return ResourceManager._instance;
  }
  
  /**
   * Get the singleton ResourceManager, initialized and ready to use
   * This is the preferred way to get ResourceManager - it auto-initializes
   * @returns {Promise<ResourceManager>} The initialized singleton instance
   */
  static async getResourceManager() {
    const instance = ResourceManager.getInstance();
    if (!instance.initialized) {
      await instance.initialize();
    }
    return instance;
  }
  
  /**
   * Initialize ResourceManager (compatibility method)
   * Loads environment variables from .env file automatically
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load dotenv for environment variables
      const dotenv = await import('dotenv');
      const fs = await import('fs');
      const path = await import('path');
      
      // Find project root with .env file
      const { envPath, envResult } = this._findProjectEnv(dotenv, fs, path);
      
      console.log(`ResourceManager: Loading .env from ${envPath}`);
      const result = envResult;
      
      if (result.error) {
        throw new Error(`ResourceManager: Failed to load .env file: ${result.error.message}`);
      }
      
      console.log(`ResourceManager: Successfully loaded ${Object.keys(result.parsed || {}).length} environment variables`);
      
      // Store environment variables under 'env' namespace for dot notation access
      if (result.parsed) {
        // Create env object to store all environment variables
        const envVars = {};
        for (const [key, value] of Object.entries(result.parsed)) {
          envVars[key] = value;
          console.log(`ResourceManager: Loaded env var: ${key}`);
        }
        this._resources.set('env', envVars);
      }
      
      // Mark as initialized
      this.initialized = true;
    } catch (error) {
      console.error('ResourceManager initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Find project .env file by walking up directory tree
   * @param {Object} dotenv - dotenv module
   * @param {Object} fs - fs module
   * @param {Object} path - path module
   * @returns {Object} { envPath, envResult }
   */
  _findProjectEnv(dotenv, fs, path) {
    let currentDir = process.cwd();
    
    // Walk up directory tree looking for .env with MONOREPO_ROOT
    while (currentDir !== '/') {
      const envPath = path.join(currentDir, '.env');
      
      if (fs.existsSync(envPath)) {
        const envResult = dotenv.config({ path: envPath });
        
        if (envResult.parsed?.MONOREPO_ROOT) {
          const monorepoRoot = envResult.parsed.MONOREPO_ROOT;
          
          // Check if the current directory is the monorepo root or a subdirectory of it
          if (currentDir === monorepoRoot || currentDir.startsWith(monorepoRoot + path.sep)) {
            return { envPath, envResult };
          }
        }
      }
      
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }
    
    throw new Error('ResourceManager: Could not find .env file with matching MONOREPO_ROOT');
  }
  
  /**
   * Load resources from an object
   * @param {Object} resources - Object with key-value pairs to load
   */
  load(resources) {
    if (resources && typeof resources === 'object') {
      Object.entries(resources).forEach(([key, value]) => {
        this._resources.set(key, value);
      });
    }
  }
  
  /**
   * Check if a resource exists
   * @param {string} name - Resource name
   * @returns {boolean} True if resource exists
   */
  has(name) {
    return this._resources.has(name);
  }
  
  /**
   * Get a resource (explicit method)
   * @param {string} name - Resource name (supports dot notation like 'env.ANTHROPIC_API_KEY')
   * @returns {*} The resource value
   */
  get(name) {
    // Handle dot notation (e.g., 'env.ANTHROPIC_API_KEY')
    if (name.includes('.')) {
      const parts = name.split('.');
      let current = this._resources.get(parts[0]);
      
      for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = current[parts[i]];
      }
      
      return current;
    }
    
    // Direct key access
    return this._resources.get(name);
  }
  
  /**
   * Set a resource (explicit method)
   * @param {string} name - Resource name
   * @param {*} value - Resource value
   */
  set(name, value) {
    this._resources.set(name, value);
  }
  
  /**
   * Remove a resource
   * @param {string} name - Resource name
   * @returns {boolean} True if resource was deleted
   */
  remove(name) {
    return this._resources.delete(name);
  }
  
  /**
   * Clear all resources
   */
  clear() {
    this._resources.clear();
  }
  
  /**
   * Get all resource keys
   * @returns {string[]} Array of resource names
   */
  keys() {
    return Array.from(this._resources.keys());
  }
  
  /**
   * Get all resources as a plain object
   * @returns {Object} Object with all resources
   */
  toObject() {
    const obj = {};
    for (const [key, value] of this._resources) {
      obj[key] = value;
    }
    return obj;
  }
  
  /**
   * Get the number of resources
   * @returns {number} Number of resources
   */
  get size() {
    return this._resources.size;
  }
  
  /**
   * Create a child ResourceManager with this as parent
   * Child can access parent resources but changes don't affect parent
   * @param {Object} childResources - Initial resources for child
   * @returns {ResourceManager} New ResourceManager instance
   */
  createChild(childResources = {}) {
    // Create child with parent's resources as base
    const child = new ResourceManager({
      ...this.toObject(),
      ...childResources
    });
    
    return child;
  }

  /**
   * Create LLM client using environment variables
   * @param {Object} config - LLM configuration
   * @returns {Promise<Object>} LLM client instance
   */
  async createLLMClient(config = {}) {
    // Get API key from environment
    const anthropicKey = this.get('env.ANTHROPIC_API_KEY');
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment variables. Please set it in your .env file.');
    }

    // Import LLMClient dynamically
    const { LLMClient } = await import('@legion/llm');
    
    const llmClient = new LLMClient({
      provider: config.provider || 'anthropic',
      apiKey: anthropicKey,
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7,
      ...config
    });

    // Store in ResourceManager for reuse
    this.llmClient = llmClient;

    return llmClient;
  }
}

export default ResourceManager;