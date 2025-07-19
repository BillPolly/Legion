/**
 * ResourceManager - Manages shared resources across the application
 * Provides dependency injection for Docker clients, databases, etc.
 */
class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the resource manager with default resources
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Setup Docker client if available
    await this.setupDockerClient();
    
    // Setup Railway API key if available
    this.setupRailwayApiKey();
    
    this.initialized = true;
  }

  /**
   * Setup Docker client from dockerode library
   */
  async setupDockerClient() {
    try {
      // Dynamically import dockerode if available
      const { default: Docker } = await import('dockerode');
      
      // Create Docker client with default configuration
      const docker = new Docker();
      
      // Test connection
      await docker.ping();
      
      this.register('docker-client', docker);
      console.log('Docker client registered successfully');
      
    } catch (error) {
      console.warn('Docker client not available:', error.message);
      console.warn('Install dockerode: npm install dockerode');
      // Don't throw error, just log warning - Docker provider will handle this
    }
  }

  /**
   * Setup Railway API key from environment variables
   */
  setupRailwayApiKey() {
    const railwayApiKey = process.env.RAILWAY;
    
    if (railwayApiKey) {
      this.register('railway-api-key', railwayApiKey);
      console.log('Railway API key registered successfully');
    } else {
      console.warn('Railway API key not available. Set RAILWAY environment variable.');
    }
  }

  /**
   * Register a resource
   */
  register(key, resource) {
    this.resources.set(key, resource);
  }

  /**
   * Get a resource by key
   */
  get(key) {
    return this.resources.get(key);
  }

  /**
   * Check if a resource exists
   */
  has(key) {
    return this.resources.has(key);
  }

  /**
   * Remove a resource
   */
  unregister(key) {
    return this.resources.delete(key);
  }

  /**
   * Get all registered resources
   */
  listResources() {
    return Array.from(this.resources.keys());
  }

  /**
   * Clear all resources
   */
  clear() {
    this.resources.clear();
    this.initialized = false;
  }

  /**
   * Create a scoped resource manager for testing
   */
  createScope() {
    const scope = new ResourceManager();
    
    // Copy existing resources to scope
    for (const [key, resource] of this.resources) {
      scope.register(key, resource);
    }
    
    return scope;
  }
}

export default ResourceManager;