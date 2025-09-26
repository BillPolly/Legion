/**
 * Handle DSL - Template literal DSL for Handle-based reactive data management
 * 
 * This DSL provides natural language-like syntax for querying, updating, and defining
 * schemas that work with any Handle implementation. The DSL outputs generic formats
 * that Handle implementations can interpret and execute against their specific data sources.
 */

export { query } from './query-dsl.js';
export { update } from './update-dsl.js';
export { defineSchema } from './schema-dsl.js';

// Re-export parser utilities for advanced usage
export { DSLParser } from './parser.js';

// DataStore-compatible EntityProxy for examples and tests
export { EntityProxy } from './DataStoreEntityProxy.js';

// Enhanced DataStore with DSL support
export { DSLAwareDataStore, createDSLAwareDataStore } from './DSLAwareDataStore.js';