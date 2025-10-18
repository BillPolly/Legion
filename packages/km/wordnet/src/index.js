/**
 * WordNet Package - Main Entry Point
 *
 * Provides WordNet loading and semantic search functionality
 */

// Export loader
export { SimpleWordNetLoader } from './loader/SimpleWordNetLoader.js';

// Export semantic search components
export { WordNetSemanticIndexer } from './semantic/WordNetSemanticIndexer.js';
export { SemanticInventoryService } from './semantic/SemanticInventoryService.js';

// Export WordNet access
export { WordNetAccess } from './wordnet/WordNetAccess.js';

// Export configuration
export { DEFAULT_CONFIG, TEST_CONFIG } from './config/default.js';
