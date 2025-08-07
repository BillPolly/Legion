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
  constructor(initialResources = {}) {
    // Internal storage
    this._resources = new Map();
    
    // Load initial resources if provided
    if (initialResources) {
      this.load(initialResources);
    }
    
    // Return a Proxy that intercepts property access
    return new Proxy(this, {
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
   * @param {string} name - Resource name
   * @returns {*} The resource value
   */
  get(name) {
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
}

export default ResourceManager;