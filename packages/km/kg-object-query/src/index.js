/**
 * KG-Object-Query - Knowledge Graph powered object query system
 * 
 * Provides backward-compatible object-query functionality powered by 
 * Legion's Knowledge Graph system for enhanced querying capabilities
 */

// Main API exports
export { ObjectQuery } from './ObjectQuery.js';

// Core implementation exports  
export { KGQueryProcessor } from './KGQueryProcessor.js';
export { KGPathTraversal } from './KGPathTraversal.js';
export { KGDataTransformations } from './KGDataTransformations.js';

// Utility exports
export { TripleConverter } from './utils/TripleConverter.js';
export { QueryOptimizer } from './utils/QueryOptimizer.js';

// Default export for convenience (backward compatibility)
import { ObjectQuery } from './ObjectQuery.js';
export default ObjectQuery;