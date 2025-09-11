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
  static _initPromise = null;
  
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
        
        // Special handling for llmClient - create it lazily if needed
        if (prop === 'llmClient' && !target._resources.has('llmClient')) {
          // Return a promise that will create the client
          // Note: This is synchronous access, so we need to handle it carefully
          // The caller should use await resourceManager.get('llmClient') for async creation
          return undefined; // Will be handled by get() method
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
   * Get the singleton instance of ResourceManager (auto-initializes)
   * @returns {Promise<ResourceManager>} The initialized singleton instance
   */
  static async getInstance() {
    if (!ResourceManager._instance) {
      ResourceManager._instance = new ResourceManager();
      // Start initialization immediately
      ResourceManager._initPromise = ResourceManager._instance.initialize();
    }
    
    // Always wait for initialization to complete
    await ResourceManager._initPromise;
    return ResourceManager._instance;
  }
  
  /**
   * Deprecated: Use getInstance() instead
   * @deprecated getInstance() now auto-initializes
   * @returns {Promise<ResourceManager>} The initialized singleton instance
   */
  static async getResourceManager() {
    return ResourceManager.getInstance();
  }
  
  /**
   * Initialize ResourceManager (compatibility method)
   * Loads environment variables from .env file automatically
   * @returns {Promise<void>}
   */
  async initialize() {
    // Guard against multiple initializations
    if (this.initialized) {
      return;
    }
    
    try {
      // Load dotenv for environment variables
      const dotenv = await import('dotenv');
      const fs = await import('fs');
      const path = await import('path');
      
      // Find project root with .env file
      const { envPath, envResult } = this._findProjectEnv(dotenv, fs, path);
      
      const verbose = process.env.DEBUG_RESOURCE_MANAGER === 'true';
      
      if (verbose) {
        console.log(`ResourceManager: Loading .env from ${envPath}`);
      }
      const result = envResult;
      
      if (result.error) {
        throw new Error(`ResourceManager: Failed to load .env file: ${result.error.message}`);
      }
      
      if (verbose) {
        console.log(`ResourceManager: Successfully loaded ${Object.keys(result.parsed || {}).length} environment variables`);
      }
      
      // Store environment variables under 'env' namespace for dot notation access
      if (result.parsed) {
        // Create env object to store all environment variables
        const envVars = {};
        for (const [key, value] of Object.entries(result.parsed)) {
          envVars[key] = value;
          if (verbose) {
            console.log(`ResourceManager: Loaded env var: ${key}`);
          }
        }
        this._resources.set('env', envVars);
      }
      
      // Ensure required services are running
      await this._ensureServicesRunning();
      
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
    // Special handling for llmClient - create it if it doesn't exist
    if (name === 'llmClient' && !this._resources.has('llmClient')) {
      // Create the LLM client synchronously by blocking on the promise
      // This is not ideal but maintains backward compatibility
      // Better to use getOrInitialize for async resources
      const promise = this.createLLMClient();
      // Store the promise so multiple calls don't create multiple clients
      this._resources.set('llmClient', promise);
      return promise;
    }

    // Special handling for simplePromptClient - create it if it doesn't exist
    if (name === 'simplePromptClient' && !this._resources.has('simplePromptClient')) {
      const promise = this.createSimplePromptClient();
      this._resources.set('simplePromptClient', promise);
      return promise;
    }
    
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
   * Get or initialize a resource lazily
   * This is the generic pattern for managing expensive/async resources
   * @param {string} key - Resource key
   * @param {Function} initFunction - Async function to initialize the resource
   * @returns {Promise<*>} The resource
   */
  async getOrInitialize(key, initFunction) {
    // Check if resource already exists
    if (!this.has(key)) {
      // Initialize the resource
      const resource = await initFunction();
      this.set(key, resource);
    }
    return this.get(key);
  }
  
  /**
   * Initialize a resource if not present, with dependency injection
   * @param {string} key - Resource key
   * @param {Function} initFunction - Async function that receives ResourceManager
   * @returns {Promise<*>} The resource
   */
  async ensureResource(key, initFunction) {
    if (!this.has(key)) {
      const resource = await initFunction(this);
      this.set(key, resource);
    }
    return this.get(key);
  }

  /**
   * Create LLM client using environment variables
   * @param {Object} config - LLM configuration
   * @returns {Promise<Object>} LLM client instance
   */
  async createLLMClient(config = {}) {
    // Get API key, base URL, and model from environment
    const anthropicKey = this.get('env.ANTHROPIC_API_KEY');
    const anthropicBaseURL = this.get('env.ANTHROPIC_BASE_URL');
    const anthropicModel = this.get('env.ANTHROPIC_MODEL');
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment variables. Please set it in your .env file.');
    }

    // Import LLMClient dynamically
    const { LLMClient } = await import('@legion/llm-client');
    
    const llmClient = new LLMClient({
      provider: config.provider || 'anthropic',
      apiKey: anthropicKey,
      baseURL: anthropicBaseURL,
      model: config.model || anthropicModel || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7,
      ...config
    });

    // Store in ResourceManager for reuse
    this.llmClient = llmClient;

    return llmClient;
  }

  /**
   * Create and configure a SimplePromptClient for easy LLM interactions
   * @param {Object} config - Optional configuration override
   * @returns {Promise<SimplePromptClient>} Configured SimplePromptClient instance
   */
  async createSimplePromptClient(config = {}) {
    // Get the LLMClient instance
    const llmClient = await this.get('llmClient');

    // Import SimplePromptClient dynamically  
    const { SimplePromptClient } = await import('@legion/llm-client');

    const simpleClient = new SimplePromptClient({
      llmClient: llmClient,
      defaultOptions: {
        maxTokens: config.maxTokens || 1000,
        temperature: config.temperature !== undefined ? config.temperature : 0.7,
        ...config.defaultOptions
      },
      ...config
    });

    // Store in ResourceManager for reuse
    this.simplePromptClient = simpleClient;

    return simpleClient;
  }

  /**
   * Ensure required services are running (Docker, Qdrant, MongoDB)
   * @private
   */
  async _ensureServicesRunning() {
    const { execSync } = await import('child_process');
    
    try {
      // Check if Docker is running
      try {
        execSync('docker ps', { stdio: 'pipe' });
      } catch (dockerError) {
        console.log('Docker not running, attempting to start...');
        
        // Try to start colima (Docker for Mac)
        try {
          execSync('colima start --cpu 2 --memory 2', { 
            stdio: 'pipe',
            timeout: 60000 // 1 minute timeout
          });
          console.log('Docker started successfully via colima');
        } catch (colimaError) {
          // Try docker desktop
          try {
            execSync('open -a Docker', { stdio: 'pipe' });
            // Wait for Docker to be ready
            let retries = 30;
            while (retries > 0) {
              try {
                execSync('docker ps', { stdio: 'pipe' });
                console.log('Docker started successfully');
                break;
              } catch {
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries--;
              }
            }
            if (retries === 0) {
              throw new Error('Docker failed to start in time');
            }
          } catch (dockerDesktopError) {
            console.warn('Warning: Could not start Docker. Some features may not work.');
            console.warn('Please start Docker manually.');
          }
        }
      }
      
      // Check if Qdrant is running
      const qdrantUrl = this.get('env.QDRANT_URL');
      if (qdrantUrl) {
        try {
          // Check if Qdrant container exists and is running
          const qdrantStatus = execSync('docker ps --format "{{.Names}}" | grep -i qdrant', { 
            stdio: 'pipe' 
          }).toString().trim();
          
          if (!qdrantStatus) {
            // Check if container exists but is stopped
            const stoppedQdrant = execSync('docker ps -a --format "{{.Names}}" | grep -i qdrant || echo ""', { 
              stdio: 'pipe' 
            }).toString().trim();
            
            if (stoppedQdrant) {
              console.log('Starting existing Qdrant container...');
              execSync(`docker start ${stoppedQdrant.split('\n')[0]}`, { stdio: 'pipe' });
            } else {
              // Create and start new Qdrant container
              console.log('Creating new Qdrant container...');
              execSync(
                'docker run -d --name legion-qdrant -p 6333:6333 -p 6334:6334 ' +
                '-v $(pwd)/qdrant_storage:/qdrant/storage:z qdrant/qdrant:latest',
                { stdio: 'pipe' }
              );
            }
            
            // Wait for Qdrant to be ready
            console.log('Waiting for Qdrant to be ready...');
            let retries = 10;
            while (retries > 0) {
              try {
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(`${qdrantUrl}/collections`);
                if (response.ok) {
                  console.log('Qdrant is ready');
                  break;
                }
              } catch {
                // Still starting up
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
              retries--;
            }
          }
        } catch (error) {
          console.warn('Warning: Could not verify Qdrant status:', error.message);
        }
      }
      
      // Check if MongoDB is running (if needed)
      const mongoUrl = this.get('env.MONGODB_URL');
      if (mongoUrl) {
        try {
          // Check if MongoDB container is running
          const mongoStatus = execSync('docker ps --format "{{.Names}}" | grep -i mongo || echo ""', { 
            stdio: 'pipe' 
          }).toString().trim();
          
          if (!mongoStatus) {
            // Check if we should start MongoDB
            const stoppedMongo = execSync('docker ps -a --format "{{.Names}}" | grep -i mongo || echo ""', { 
              stdio: 'pipe' 
            }).toString().trim();
            
            if (stoppedMongo) {
              console.log('Starting existing MongoDB container...');
              execSync(`docker start ${stoppedMongo.split('\n')[0]}`, { stdio: 'pipe' });
            }
            // Note: Not creating new MongoDB container automatically as it may need specific setup
          }
        } catch (error) {
          // MongoDB might be running locally, not in Docker
          console.log('MongoDB status check skipped (might be running locally)');
        }
      }
      
    } catch (error) {
      console.error('Error ensuring services are running:', error.message);
      // Don't throw - allow ResourceManager to initialize even if services aren't available
      // Tests should fail appropriately if they need these services
    }
  }
}

export default ResourceManager;