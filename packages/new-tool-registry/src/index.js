/**
 * Main entry point for the new-tool-registry package
 * 
 * Exports all the key components and utilities for tool registry functionality
 * with comprehensive module discovery, loading, caching, perspectives, and semantic search
 */

// Main integration class
export { ToolRegistry } from './integration/ToolRegistry.js';

// Core functionality
export { ModuleLoader } from './core/ModuleLoader.js';
export { ModuleDiscovery } from './core/ModuleDiscovery.js';
export { ModuleRegistry } from './core/ModuleRegistry.js';
export { DatabaseOperations } from './core/DatabaseOperations.js';

// Storage
export { DatabaseStorage } from './core/DatabaseStorage.js';

// Search functionality
export { TextSearch } from './search/TextSearch.js';
export { Perspectives } from './search/Perspectives.js';
export { VectorStore } from './search/VectorStore.js';
export { LLMClient } from '@legion/llm';
export { EmbeddingService } from './search/EmbeddingService.js';

// Utilities
export { LRUCache } from './utils/LRUCache.js';
export { ConnectionPool } from './utils/ConnectionPool.js';

// Errors
export * from './errors/index.js';

// Factory functions for easy instantiation
export async function createToolRegistry(resourceManager, options = {}) {
  const registry = new ToolRegistry({ resourceManager, options });
  await registry.initialize();
  return registry;
}

export async function createModuleDiscovery(resourceManager, searchPaths = []) {
  return new ModuleDiscovery({
    resourceManager,
    searchPaths
  });
}

export async function createPerspectives(databaseStorage, llmClient, options = {}) {
  return new Perspectives({
    databaseStorage,
    llmClient,
    ...options
  });
}

export async function createVectorStore(embeddingService, vectorDatabase, options = {}) {
  const store = new VectorStore({
    embeddingClient: embeddingService,
    vectorDatabase,
    ...options
  });
  await store.initialize();
  return store;
}