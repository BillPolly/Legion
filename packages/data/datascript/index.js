// DataScript JS - Main Entry Point
// Immutable in-memory database and Datalog query engine

// Core functionality
export * from './src/core/index.js';

// Query engine
export * from './src/query/index.js';

// Storage and persistence
export * from './src/storage/index.js';

// Utilities and built-ins
export * from './src/utils/index.js';

// Extensions (datafy, pprint)
export * from './src/extensions/index.js';

// Convenience re-exports with specific naming
import { pull as _pull } from './src/query/pull.js';
export { _pull as pull };

export function pullMany(db, pattern, eids) {
  return eids.map(e => _pull(db, pattern, e));
}

export function schema(db) { 
  return db.schema; 
}