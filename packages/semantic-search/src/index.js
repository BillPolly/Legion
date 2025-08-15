/**
 * @legion/semantic-search - Main exports
 * 
 * Semantic search provider for Legion framework using local embeddings
 * and Qdrant vector database for natural language tool discovery.
 */

// Core provider
export { SemanticSearchProvider } from './SemanticSearchProvider.js';

// Services
export { LocalEmbeddingService } from './services/LocalEmbeddingService.js';
export { QdrantVectorStore } from './services/QdrantVectorStore.js';

// Utilities
export { EmbeddingCache } from './utils/EmbeddingCache.js';
export { DocumentProcessor } from './utils/DocumentProcessor.js';

// Types and interfaces
export * from './types/SearchTypes.js';

// Version information
export const version = '0.1.0';
export const name = '@legion/semantic-search';