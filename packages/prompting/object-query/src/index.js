/**
 * @legion/object-query - Intelligent data extraction from root objects
 * 
 * This package provides data extraction capabilities using JSON query definitions,
 * transforming complex objects into labeled inputs ready for prompt-builder processing.
 */

// Main exports will be implemented during development
export { ObjectQuery } from './ObjectQuery.js';
export { QueryProcessor } from './QueryProcessor.js';
export { PathTraversal } from './PathTraversal.js';
export { DataTransformations } from './DataTransformations.js';

// Default export - the most common use case
export { ObjectQuery as default } from './ObjectQuery.js';