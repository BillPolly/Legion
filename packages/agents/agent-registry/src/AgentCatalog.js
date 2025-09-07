/**
 * AgentCatalog - Searchable catalog of agent capabilities
 * Provides indexing and search functionality for agents
 */

export class AgentCatalog {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    this.resourceManager = resourceManager;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async cleanup() {
    this.initialized = false;
  }
}