/**
 * Central registry for all resources needed by modules
 */
class ResourceManager {
  constructor() {
    this.resources = new Map();
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
    if (!this.resources.has(name)) {
      throw new Error(`Resource '${name}' not found`);
    }
    return this.resources.get(name);
  }

  /**
   * Check if a resource exists
   * @param {string} name - The name of the resource
   * @returns {boolean} True if the resource exists
   */
  has(name) {
    return this.resources.has(name);
  }
}

module.exports = ResourceManager;