/**
 * Schema Validation System - Main exports
 * 
 * This module provides the main exports for the schema validation system,
 * enabling JSON Schema storage as KG triples and validation capabilities.
 */

// Core classes
export { SchemaVocabulary } from './core/SchemaVocabulary.js';
export { SchemaDefinition } from './core/SchemaDefinition.js';
export { PropertyDefinition } from './core/PropertyDefinition.js';

// Loaders
export { JSONSchemaLoader } from './loaders/JSONSchemaLoader.js';

// Convenience aliases
export { SchemaVocabulary as Vocabulary } from './core/SchemaVocabulary.js';
export { SchemaDefinition as Schema } from './core/SchemaDefinition.js';
export { PropertyDefinition as Property } from './core/PropertyDefinition.js';
export { JSONSchemaLoader as Loader } from './loaders/JSONSchemaLoader.js';

// Default export for convenience
export { JSONSchemaLoader as default } from './loaders/JSONSchemaLoader.js';
