/**
 * Mock for @legion/resource-manager
 */

export class ResourceManager {
  constructor() {
    this.resources = new Map();
  }

  static async getInstance() {
    return new ResourceManager();
  }

  async initialize() {
    // Mock initialize
  }

  get(key) {
    return this.resources.get(key);
  }

  set(key, value) {
    this.resources.set(key, value);
  }
}