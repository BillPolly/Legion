import { z } from 'zod';

/**
 * Type mapping utilities for JSON Schema to Zod conversion
 * Provides helpers for type detection, coercion, and format handling
 */

/**
 * Map of JSON Schema types to Zod schema factories
 */
export const TYPE_MAP = {
  null: () => z.null(),
  boolean: () => z.boolean(),
  integer: () => z.number().int(),
  number: () => z.number(),
  string: () => z.string(),
  array: () => z.array(z.any()),
  object: () => z.object({}).passthrough()
};

/**
 * Map of JSON Schema string formats to Zod validators
 */
export const FORMAT_MAP = {
  // Date/Time formats
  'date-time': (schema) => schema.datetime(),
  'date': (schema) => schema.regex(/^\d{4}-\d{2}-\d{2}$/),
  'time': (schema) => schema.regex(/^\d{2}:\d{2}:\d{2}$/),
  'duration': (schema) => schema.regex(/^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/),
  
  // Network formats
  'email': (schema) => schema.email(),
  'idn-email': (schema) => schema.email(),
  'hostname': (schema) => schema.regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i),
  'idn-hostname': (schema) => schema.regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i),
  'ipv4': (schema) => schema.ip({ version: 'v4' }),
  'ipv6': (schema) => schema.ip({ version: 'v6' }),
  'uri': (schema) => schema.url(),
  'uri-reference': (schema) => schema.regex(/^(?:[a-z][a-z0-9+\-.]*:)?(?:\/\/)?[^\s]*$/i),
  'iri': (schema) => schema.url(),
  'iri-reference': (schema) => schema.regex(/^(?:[a-z][a-z0-9+\-.]*:)?(?:\/\/)?[^\s]*$/i),
  'uuid': (schema) => schema.uuid(),
  'uri-template': (schema) => schema.regex(/^[^\s]*$/),
  
  // JSON formats
  'json-pointer': (schema) => schema.regex(/^(?:\/(?:[^~/]|~0|~1)*)*$/),
  'relative-json-pointer': (schema) => schema.regex(/^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/),
  
  // Regex format
  'regex': (schema) => schema.refine(
    (val) => {
      try {
        new RegExp(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid regular expression' }
  )
};

/**
 * Type coercion functions for lenient validation
 */
export const COERCION_MAP = {
  boolean: (val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    if (typeof val === 'number') {
      if (val === 1) return true;
      if (val === 0) return false;
    }
    return val;
  },
  
  number: (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    return val;
  },
  
  integer: (val) => {
    if (typeof val === 'number') return Math.floor(val);
    if (typeof val === 'string') {
      const num = Number(val);
      if (!isNaN(num)) return Math.floor(num);
    }
    return val;
  },
  
  string: (val) => {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return val;
    return String(val);
  }
};

/**
 * Detect the actual JavaScript type of a value
 * @param {*} value - Value to check
 * @returns {string} Type name
 */
export function detectType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  
  const type = typeof value;
  if (type === 'number' && Number.isInteger(value)) {
    return 'integer';
  }
  
  return type;
}

/**
 * Check if a value matches a JSON Schema type
 * @param {*} value - Value to check
 * @param {string} type - JSON Schema type
 * @returns {boolean} True if matches
 */
export function matchesType(value, type) {
  const actualType = detectType(value);
  
  switch (type) {
    case 'null':
      return actualType === 'null';
    case 'boolean':
      return actualType === 'boolean';
    case 'integer':
      return actualType === 'integer';
    case 'number':
      return actualType === 'number' || actualType === 'integer';
    case 'string':
      return actualType === 'string';
    case 'array':
      return actualType === 'array';
    case 'object':
      return actualType === 'object' && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Apply type coercion if enabled
 * @param {z.ZodSchema} schema - Zod schema
 * @param {string} type - JSON Schema type
 * @param {boolean} coerce - Whether to enable coercion
 * @returns {z.ZodSchema} Schema with coercion
 */
export function applyCoercion(schema, type, coerce = false) {
  if (!coerce || !COERCION_MAP[type]) {
    return schema;
  }
  
  return z.preprocess(COERCION_MAP[type], schema);
}

/**
 * Create a Zod schema for a specific JSON Schema type
 * @param {string} type - JSON Schema type
 * @param {Object} options - Options for schema creation
 * @returns {z.ZodSchema} Zod schema
 */
export function createTypeSchema(type, options = {}) {
  const { coerce = false } = options;
  
  if (!TYPE_MAP[type]) {
    throw new Error(`Unsupported JSON Schema type: ${type}`);
  }
  
  let schema = TYPE_MAP[type]();
  
  if (coerce) {
    schema = applyCoercion(schema, type, true);
  }
  
  return schema;
}

/**
 * Apply a format to a string schema
 * @param {z.ZodString} schema - String schema
 * @param {string} format - Format name
 * @param {Object} customFormats - Custom format handlers
 * @returns {z.ZodSchema} Schema with format applied
 */
export function applyFormat(schema, format, customFormats = {}) {
  // Check custom formats first
  if (customFormats[format]) {
    return customFormats[format](schema);
  }
  
  // Check built-in formats
  if (FORMAT_MAP[format]) {
    return FORMAT_MAP[format](schema);
  }
  
  // Unknown format - just return the schema
  console.warn(`Unknown JSON Schema format: ${format}`);
  return schema;
}

/**
 * Merge multiple Zod schemas (for allOf support)
 * @param {z.ZodSchema[]} schemas - Schemas to merge
 * @returns {z.ZodSchema} Merged schema
 */
export function mergeSchemas(schemas) {
  if (schemas.length === 0) {
    return z.any();
  }
  if (schemas.length === 1) {
    return schemas[0];
  }
  
  // Use intersection for merging
  return schemas.reduce((acc, schema) => {
    if (!acc) return schema;
    return acc.and(schema);
  });
}

/**
 * Create a union of Zod schemas (for anyOf/oneOf support)
 * @param {z.ZodSchema[]} schemas - Schemas to union
 * @param {boolean} discriminated - Whether to use discriminated union
 * @returns {z.ZodSchema} Union schema
 */
export function createUnion(schemas, discriminated = false) {
  if (schemas.length === 0) {
    return z.never();
  }
  if (schemas.length === 1) {
    return schemas[0];
  }
  
  if (discriminated) {
    // Try to create discriminated union (requires discriminator field)
    try {
      return z.discriminatedUnion(undefined, schemas);
    } catch {
      // Fall back to regular union if discriminated union fails
      return z.union(schemas);
    }
  }
  
  return z.union(schemas);
}

/**
 * Check if a JSON Schema has a specific constraint
 * @param {Object} schema - JSON Schema
 * @param {string} constraint - Constraint name
 * @returns {boolean} True if has constraint
 */
export function hasConstraint(schema, constraint) {
  return schema && constraint in schema && schema[constraint] !== undefined;
}

/**
 * Extract constraints from JSON Schema
 * @param {Object} schema - JSON Schema
 * @param {string} type - Schema type
 * @returns {Object} Constraints object
 */
export function extractConstraints(schema, type) {
  const constraints = {};
  
  switch (type) {
    case 'string':
      if (hasConstraint(schema, 'minLength')) constraints.minLength = schema.minLength;
      if (hasConstraint(schema, 'maxLength')) constraints.maxLength = schema.maxLength;
      if (hasConstraint(schema, 'pattern')) constraints.pattern = schema.pattern;
      if (hasConstraint(schema, 'format')) constraints.format = schema.format;
      break;
      
    case 'number':
    case 'integer':
      if (hasConstraint(schema, 'minimum')) constraints.minimum = schema.minimum;
      if (hasConstraint(schema, 'maximum')) constraints.maximum = schema.maximum;
      if (hasConstraint(schema, 'exclusiveMinimum')) constraints.exclusiveMinimum = schema.exclusiveMinimum;
      if (hasConstraint(schema, 'exclusiveMaximum')) constraints.exclusiveMaximum = schema.exclusiveMaximum;
      if (hasConstraint(schema, 'multipleOf')) constraints.multipleOf = schema.multipleOf;
      break;
      
    case 'array':
      if (hasConstraint(schema, 'minItems')) constraints.minItems = schema.minItems;
      if (hasConstraint(schema, 'maxItems')) constraints.maxItems = schema.maxItems;
      if (hasConstraint(schema, 'uniqueItems')) constraints.uniqueItems = schema.uniqueItems;
      break;
      
    case 'object':
      if (hasConstraint(schema, 'minProperties')) constraints.minProperties = schema.minProperties;
      if (hasConstraint(schema, 'maxProperties')) constraints.maxProperties = schema.maxProperties;
      if (hasConstraint(schema, 'required')) constraints.required = schema.required;
      if (hasConstraint(schema, 'additionalProperties')) constraints.additionalProperties = schema.additionalProperties;
      break;
  }
  
  return constraints;
}

export default {
  TYPE_MAP,
  FORMAT_MAP,
  COERCION_MAP,
  detectType,
  matchesType,
  applyCoercion,
  createTypeSchema,
  applyFormat,
  mergeSchemas,
  createUnion,
  hasConstraint,
  extractConstraints
};