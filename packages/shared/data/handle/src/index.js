/**
 * @legion/km-data-handle - Universal Handle pattern for proxying monolithic resources
 * 
 * Main exports for the Handle package, providing Actor-integrated proxy capabilities
 * with synchronous dispatcher pattern and comprehensive introspection support.
 */

// Core Handle class - universal base for all proxy types
export { Handle } from './Handle.js';

// RemoteHandle - Convenience wrapper for accessing remote Handles via ActorSpace
export { RemoteHandle } from './RemoteHandle.js';

// DataSource interface and utilities
export { 
  DataSourceInterface, 
  validateDataSourceInterface, 
  DataSourceTemplate,
  DataSourceUtils 
} from './DataSource.js';

// Simple Object DataSource for testing and plain JS objects
export { SimpleObjectDataSource } from './SimpleObjectDataSource.js';
export { SimpleObjectHandle } from './SimpleObjectHandle.js';

// Caching utilities with multi-level cache support
export { CachedHandle } from './CachedHandle.js';

// Prototype factory for universal knowledge layer
export { PrototypeFactory } from './PrototypeFactory.js';

// Validation utilities for Handle infrastructure
export { 
  ValidationUtils,
  validateDataScriptEntityId,
  validateDataScriptQuery,
  validateDataScriptUpdateData,
  validateDataScriptAttributeName,
  validateStandardDataSourceInterface
} from './ValidationUtils.js';