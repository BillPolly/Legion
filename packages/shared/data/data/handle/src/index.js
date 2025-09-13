/**
 * @legion/km-data-handle - Universal Handle pattern for proxying monolithic resources
 * 
 * Main exports for the Handle package, providing Actor-integrated proxy capabilities
 * with synchronous dispatcher pattern and comprehensive introspection support.
 */

// Core Handle class - universal base for all proxy types
export { Handle } from './Handle.js';

// ResourceManager interface and utilities
export { 
  ResourceManagerInterface, 
  validateResourceManagerInterface, 
  ResourceManagerTemplate,
  ResourceManagerUtils 
} from './ResourceManager.js';

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
  validateStandardResourceManagerInterface
} from './ValidationUtils.js';