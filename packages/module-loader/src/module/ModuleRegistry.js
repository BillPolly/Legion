/**
 * ModuleRegistry - Tracks loaded modules and their metadata
 */
export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.moduleInstances = new Map();
    this.moduleMetadata = new Map();
    this.loadOrder = [];
  }

  /**
   * Register a module
   * @param {string} name - Module name
   * @param {Object} metadata - Module metadata
   * @param {Object} instance - Module instance (optional)
   */
  register(name, metadata, instance = null) {
    if (this.modules.has(name)) {
      throw new Error(`Module '${name}' is already registered`);
    }

    const entry = {
      name,
      metadata: {
        ...metadata,
        registeredAt: new Date().toISOString(),
        status: 'registered'
      },
      instance: instance
    };

    this.modules.set(name, entry);
    this.moduleMetadata.set(name, entry.metadata);
    
    if (instance) {
      this.moduleInstances.set(name, instance);
      entry.metadata.status = 'loaded';
    }

    this.loadOrder.push(name);
  }

  /**
   * Update module status
   * @param {string} name - Module name
   * @param {string} status - New status
   */
  updateStatus(name, status) {
    const entry = this.modules.get(name);
    if (!entry) {
      throw new Error(`Module '${name}' not found in registry`);
    }
    entry.metadata.status = status;
    entry.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Set module instance
   * @param {string} name - Module name
   * @param {Object} instance - Module instance
   */
  setInstance(name, instance) {
    const entry = this.modules.get(name);
    if (!entry) {
      throw new Error(`Module '${name}' not found in registry`);
    }
    
    entry.instance = instance;
    this.moduleInstances.set(name, instance);
    this.updateStatus(name, 'loaded');
  }

  /**
   * Unregister a module
   * @param {string} name - Module name
   * @returns {boolean} True if module was unregistered
   */
  unregister(name) {
    if (!this.modules.has(name)) {
      return false;
    }

    this.modules.delete(name);
    this.moduleInstances.delete(name);
    this.moduleMetadata.delete(name);
    
    const index = this.loadOrder.indexOf(name);
    if (index > -1) {
      this.loadOrder.splice(index, 1);
    }

    return true;
  }

  /**
   * Get module by name
   * @param {string} name - Module name
   * @returns {Object|null} Module entry or null
   */
  get(name) {
    return this.modules.get(name) || null;
  }

  /**
   * Get module instance
   * @param {string} name - Module name
   * @returns {Object|null} Module instance or null
   */
  getInstance(name) {
    return this.moduleInstances.get(name) || null;
  }

  /**
   * Get module metadata
   * @param {string} name - Module name
   * @returns {Object|null} Module metadata or null
   */
  getMetadata(name) {
    return this.moduleMetadata.get(name) || null;
  }

  /**
   * Check if module is registered
   * @param {string} name - Module name
   * @returns {boolean} True if module is registered
   */
  has(name) {
    return this.modules.has(name);
  }

  /**
   * Check if module is loaded
   * @param {string} name - Module name
   * @returns {boolean} True if module is loaded
   */
  isLoaded(name) {
    const entry = this.modules.get(name);
    return entry ? entry.metadata.status === 'loaded' : false;
  }

  /**
   * Get all registered modules
   * @returns {Array} Array of module entries
   */
  getAll() {
    return Array.from(this.modules.values());
  }

  /**
   * Get all loaded modules
   * @returns {Array} Array of loaded module entries
   */
  getLoaded() {
    return this.getAll().filter(entry => entry.metadata.status === 'loaded');
  }

  /**
   * Get all module names
   * @returns {Array<string>} Array of module names
   */
  getNames() {
    return Array.from(this.modules.keys());
  }

  /**
   * Get loaded module names
   * @returns {Array<string>} Array of loaded module names
   */
  getLoadedNames() {
    return this.getLoaded().map(entry => entry.name);
  }

  /**
   * Get module statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const all = this.getAll();
    const loaded = this.getLoaded();
    
    return {
      totalRegistered: all.length,
      totalLoaded: loaded.length,
      byStatus: all.reduce((acc, entry) => {
        const status = entry.metadata.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      loadOrder: [...this.loadOrder]
    };
  }

  /**
   * Clear the registry
   */
  clear() {
    this.modules.clear();
    this.moduleInstances.clear();
    this.moduleMetadata.clear();
    this.loadOrder = [];
  }

  /**
   * Export registry data
   * @returns {Object} Serializable registry data
   */
  export() {
    return {
      modules: Array.from(this.modules.entries()).map(([name, entry]) => ({
        name,
        metadata: entry.metadata,
        hasInstance: !!entry.instance
      })),
      loadOrder: [...this.loadOrder],
      stats: this.getStats()
    };
  }
}

export default ModuleRegistry;