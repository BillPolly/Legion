/**
 * Tool Search Services
 * 
 * Provides intelligent tool discovery, indexing, and search capabilities.
 * CRITICAL: Tool-specific services enforce local Nomic embeddings only.
 */

import { ToolIndexer } from './ToolIndexer.js';
import { SemanticToolDiscovery } from './SemanticToolDiscovery.js';

export { ToolIndexer } from './ToolIndexer.js';
export { SemanticToolDiscovery } from './SemanticToolDiscovery.js';
export { DocumentProcessor } from './DocumentProcessor.js';

// Tool-specific factory methods that enforce local Nomic embeddings
export const createToolIndexer = ToolIndexer.createForTools;
export const createSemanticToolDiscovery = SemanticToolDiscovery.createForTools;