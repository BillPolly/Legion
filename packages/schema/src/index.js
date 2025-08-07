/**
 * @legion/schema - JSON Schema to Zod validator conversion
 * 
 * This package provides comprehensive JSON Schema to Zod conversion
 * with support for all JSON Schema draft-07 features.
 */

// Main exports
export { SchemaConverter, jsonSchemaToZod } from './SchemaConverter.js';
export { 
  ZodValidator, 
  createValidator, 
  createValidatorFunction,
  createAsyncValidatorFunction,
  createPredicate 
} from './ZodValidator.js';

// Type mapping utilities
export * from './utils/typeMapping.js';

// Re-export Zod for convenience
export { z } from 'zod';

// Default export - the most common use case
import { jsonSchemaToZod } from './SchemaConverter.js';
export default jsonSchemaToZod;