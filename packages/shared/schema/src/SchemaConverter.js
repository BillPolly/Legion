import { z } from 'zod';

/**
 * SchemaConverter - Converts JSON Schema to Zod validators
 * 
 * Supports JSON Schema draft-07 with comprehensive type conversion
 * including complex schemas like oneOf, anyOf, allOf, and $ref resolution
 */
export class SchemaConverter {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false;
    this.coerceTypes = options.coerceTypes || false;
    this.customFormats = options.customFormats || {};
    this.refCache = new Map();
    this.rootSchema = null;
  }

  /**
   * Convert JSON Schema to Zod schema
   * @param {Object} jsonSchema - JSON Schema object
   * @param {Object} rootSchema - Root schema for $ref resolution
   * @returns {z.ZodSchema} Zod schema
   */
  convert(jsonSchema, rootSchema = null) {
    if (!jsonSchema) {
      return z.any();
    }

    // Store root schema for $ref resolution
    if (rootSchema) {
      this.rootSchema = rootSchema;
    } else if (!this.rootSchema) {
      this.rootSchema = jsonSchema;
    }

    // Handle $ref
    if (jsonSchema.$ref) {
      return this.resolveRef(jsonSchema.$ref);
    }

    // Handle combinators
    if (jsonSchema.oneOf) {
      return this.convertOneOf(jsonSchema.oneOf);
    }
    if (jsonSchema.anyOf) {
      return this.convertAnyOf(jsonSchema.anyOf);
    }
    if (jsonSchema.allOf) {
      return this.convertAllOf(jsonSchema.allOf);
    }
    if (jsonSchema.not) {
      return this.convertNot(jsonSchema.not);
    }

    // Handle const and enum
    if (jsonSchema.const !== undefined) {
      return z.literal(jsonSchema.const);
    }
    if (jsonSchema.enum) {
      return this.convertEnum(jsonSchema.enum);
    }

    // Handle type-based conversion
    const type = jsonSchema.type;
    if (Array.isArray(type)) {
      // Multiple types - create union
      return z.union(type.map(t => this.convertByType({ ...jsonSchema, type: t })));
    }

    return this.convertByType(jsonSchema);
  }

  /**
   * Convert schema based on type
   * @private
   */
  convertByType(jsonSchema) {
    const type = jsonSchema.type;

    switch (type) {
      case 'null':
        return z.null();
      
      case 'boolean':
        return this.convertBoolean(jsonSchema);
      
      case 'integer':
      case 'number':
        return this.convertNumber(jsonSchema);
      
      case 'string':
        return this.convertString(jsonSchema);
      
      case 'array':
        return this.convertArray(jsonSchema);
      
      case 'object':
        return this.convertObject(jsonSchema);
      
      default:
        // No type specified - use any
        if (!type) {
          return z.any();
        }
        throw new Error(`Unsupported JSON Schema type: ${type}`);
    }
  }

  /**
   * Convert boolean schema
   * @private
   */
  convertBoolean(schema) {
    let zodSchema = z.boolean();
    
    if (this.coerceTypes) {
      zodSchema = z.preprocess((val) => {
        if (typeof val === 'string') {
          if (val === 'true') return true;
          if (val === 'false') return false;
        }
        return val;
      }, zodSchema);
    }

    return this.applyDescription(zodSchema, schema);
  }

  /**
   * Convert number/integer schema
   * @private
   */
  convertNumber(schema) {
    let zodSchema = schema.type === 'integer' ? z.number().int() : z.number();

    // Apply numeric constraints
    if (schema.minimum !== undefined) {
      zodSchema = zodSchema.min(schema.minimum);
    }
    if (schema.maximum !== undefined) {
      zodSchema = zodSchema.max(schema.maximum);
    }
    if (schema.exclusiveMinimum !== undefined) {
      zodSchema = zodSchema.gt(schema.exclusiveMinimum);
    }
    if (schema.exclusiveMaximum !== undefined) {
      zodSchema = zodSchema.lt(schema.exclusiveMaximum);
    }
    if (schema.multipleOf !== undefined) {
      zodSchema = zodSchema.multipleOf(schema.multipleOf);
    }

    if (this.coerceTypes) {
      zodSchema = z.preprocess((val) => {
        if (typeof val === 'string') {
          const num = Number(val);
          if (!isNaN(num)) return num;
        }
        return val;
      }, zodSchema);
    }

    return this.applyDescription(zodSchema, schema);
  }

  /**
   * Convert string schema
   * @private
   */
  convertString(schema) {
    let zodSchema = z.string();

    // Apply string constraints
    if (schema.minLength !== undefined) {
      zodSchema = zodSchema.min(schema.minLength);
    }
    if (schema.maxLength !== undefined) {
      zodSchema = zodSchema.max(schema.maxLength);
    }
    if (schema.pattern) {
      zodSchema = zodSchema.regex(new RegExp(schema.pattern));
    }

    // Handle format
    if (schema.format) {
      zodSchema = this.applyFormat(zodSchema, schema.format);
    }

    return this.applyDescription(zodSchema, schema);
  }

  /**
   * Apply format validation to string schema
   * @private
   */
  applyFormat(zodSchema, format) {
    // Check for custom format handlers
    if (this.customFormats[format]) {
      return this.customFormats[format](zodSchema);
    }

    // Built-in format handlers
    switch (format) {
      case 'email':
        return zodSchema.email();
      case 'url':
      case 'uri':
        return zodSchema.url();
      case 'uuid':
        return zodSchema.uuid();
      case 'date-time':
        return zodSchema.datetime();
      case 'date':
        return zodSchema.regex(/^\d{4}-\d{2}-\d{2}$/);
      case 'time':
        return zodSchema.regex(/^\d{2}:\d{2}:\d{2}$/);
      case 'ipv4':
        return zodSchema.ip({ version: 'v4' });
      case 'ipv6':
        return zodSchema.ip({ version: 'v6' });
      default:
        // Unknown format - just return the base schema
        return zodSchema;
    }
  }

  /**
   * Convert array schema
   * @private
   */
  convertArray(schema) {
    // Determine item schema
    let itemSchema = z.any();
    
    if (schema.items) {
      if (Array.isArray(schema.items)) {
        // Tuple validation
        const tupleSchemas = schema.items.map(item => this.convert(item));
        
        // Handle additional items
        if (schema.additionalItems === false) {
          return z.tuple(tupleSchemas);
        } else if (schema.additionalItems && typeof schema.additionalItems === 'object') {
          // Tuple with rest
          const restSchema = this.convert(schema.additionalItems);
          return z.tuple(tupleSchemas).rest(restSchema);
        } else {
          // Allow additional items
          return z.tuple(tupleSchemas).rest(z.any());
        }
      } else {
        itemSchema = this.convert(schema.items);
      }
    }

    let zodSchema = z.array(itemSchema);

    // Apply array constraints
    if (schema.minItems !== undefined) {
      zodSchema = zodSchema.min(schema.minItems);
    }
    if (schema.maxItems !== undefined) {
      zodSchema = zodSchema.max(schema.maxItems);
    }
    if (schema.uniqueItems === true) {
      // Zod doesn't have built-in unique validation, add custom refinement
      zodSchema = zodSchema.refine(
        (items) => new Set(items).size === items.length,
        { message: 'Array must contain unique items' }
      );
    }

    return this.applyDescription(zodSchema, schema);
  }

  /**
   * Convert object schema
   * @private
   */
  convertObject(schema) {
    // Handle empty object
    if (!schema.properties && !schema.patternProperties && !schema.additionalProperties) {
      return z.object({}).passthrough();
    }

    const shape = {};
    const required = schema.required || [];

    // Convert properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        let propZodSchema = this.convert(propSchema);
        
        // Make optional if not required
        if (!required.includes(key)) {
          propZodSchema = propZodSchema.optional();
        }

        // Apply default value
        if (propSchema.default !== undefined) {
          propZodSchema = propZodSchema.default(propSchema.default);
        }

        shape[key] = propZodSchema;
      }
    }

    let zodSchema = z.object(shape);

    // Handle additional properties
    if (schema.additionalProperties === false) {
      zodSchema = zodSchema.strict();
    } else if (schema.additionalProperties === true || schema.additionalProperties === undefined) {
      zodSchema = zodSchema.passthrough();
    } else if (typeof schema.additionalProperties === 'object') {
      // Additional properties with schema
      const additionalSchema = this.convert(schema.additionalProperties);
      zodSchema = zodSchema.catchall(additionalSchema);
    }

    // Handle pattern properties (not directly supported in Zod, use refinement)
    if (schema.patternProperties) {
      const patterns = Object.entries(schema.patternProperties).map(([pattern, propSchema]) => ({
        regex: new RegExp(pattern),
        schema: this.convert(propSchema)
      }));

      zodSchema = zodSchema.refine(
        (obj) => {
          for (const key of Object.keys(obj)) {
            for (const { regex, schema } of patterns) {
              if (regex.test(key)) {
                const result = schema.safeParse(obj[key]);
                if (!result.success) return false;
              }
            }
          }
          return true;
        },
        { message: 'Pattern properties validation failed' }
      );
    }

    // Handle property count constraints
    if (schema.minProperties !== undefined) {
      zodSchema = zodSchema.refine(
        (obj) => Object.keys(obj).length >= schema.minProperties,
        { message: `Object must have at least ${schema.minProperties} properties` }
      );
    }
    if (schema.maxProperties !== undefined) {
      zodSchema = zodSchema.refine(
        (obj) => Object.keys(obj).length <= schema.maxProperties,
        { message: `Object must have at most ${schema.maxProperties} properties` }
      );
    }

    // Handle dependencies
    if (schema.dependencies) {
      zodSchema = this.applyDependencies(zodSchema, schema.dependencies);
    }

    return this.applyDescription(zodSchema, schema);
  }

  /**
   * Apply dependencies to object schema
   * @private
   */
  applyDependencies(zodSchema, dependencies) {
    for (const [key, dependency] of Object.entries(dependencies)) {
      if (Array.isArray(dependency)) {
        // Property dependencies
        zodSchema = zodSchema.refine(
          (obj) => {
            if (key in obj) {
              return dependency.every(dep => dep in obj);
            }
            return true;
          },
          { message: `Property ${key} requires properties: ${dependency.join(', ')}` }
        );
      } else {
        // Schema dependencies
        const depSchema = this.convert(dependency);
        zodSchema = zodSchema.refine(
          (obj) => {
            if (key in obj) {
              return depSchema.safeParse(obj).success;
            }
            return true;
          },
          { message: `Schema dependency for ${key} failed` }
        );
      }
    }
    return zodSchema;
  }

  /**
   * Convert enum
   * @private
   */
  convertEnum(enumValues) {
    if (enumValues.length === 0) {
      return z.never();
    }
    if (enumValues.length === 1) {
      return z.literal(enumValues[0]);
    }

    // Check if all values are strings
    if (enumValues.every(v => typeof v === 'string')) {
      return z.enum(enumValues);
    }

    // Mixed types - use union of literals
    return z.union(enumValues.map(v => z.literal(v)));
  }

  /**
   * Convert oneOf combinator
   * @private
   */
  convertOneOf(schemas) {
    if (schemas.length === 0) {
      return z.never();
    }
    if (schemas.length === 1) {
      return this.convert(schemas[0]);
    }

    const zodSchemas = schemas.map(s => this.convert(s));
    return z.discriminatedUnion(undefined, zodSchemas);
  }

  /**
   * Convert anyOf combinator
   * @private
   */
  convertAnyOf(schemas) {
    if (schemas.length === 0) {
      return z.never();
    }
    if (schemas.length === 1) {
      return this.convert(schemas[0]);
    }

    const zodSchemas = schemas.map(s => this.convert(s));
    return z.union(zodSchemas);
  }

  /**
   * Convert allOf combinator
   * @private
   */
  convertAllOf(schemas) {
    if (schemas.length === 0) {
      return z.any();
    }
    if (schemas.length === 1) {
      return this.convert(schemas[0]);
    }

    // Merge all schemas (simplified implementation)
    const zodSchemas = schemas.map(s => this.convert(s));
    
    // Use intersection for objects, otherwise create refined schema
    return zodSchemas.reduce((acc, schema) => {
      return acc.and(schema);
    });
  }

  /**
   * Convert not combinator
   * @private
   */
  convertNot(schema) {
    const notSchema = this.convert(schema);
    
    return z.any().refine(
      (val) => !notSchema.safeParse(val).success,
      { message: 'Value must not match the excluded schema' }
    );
  }

  /**
   * Resolve $ref references
   * @private
   */
  resolveRef(ref) {
    // Check cache
    if (this.refCache.has(ref)) {
      return this.refCache.get(ref);
    }

    // Parse reference
    const parts = ref.split('/');
    if (parts[0] !== '#') {
      throw new Error(`External references not supported: ${ref}`);
    }

    // Navigate to referenced schema
    let current = this.rootSchema;
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].replace(/~1/g, '/').replace(/~0/g, '~');
      if (!(part in current)) {
        throw new Error(`Invalid reference: ${ref}`);
      }
      current = current[part];
    }

    // Convert and cache
    const zodSchema = this.convert(current);
    this.refCache.set(ref, zodSchema);
    return zodSchema;
  }

  /**
   * Apply description to schema
   * @private
   */
  applyDescription(zodSchema, jsonSchema) {
    if (jsonSchema.description) {
      return zodSchema.describe(jsonSchema.description);
    }
    return zodSchema;
  }

  /**
   * Clear reference cache
   */
  clearCache() {
    this.refCache.clear();
    this.rootSchema = null;
  }
}

/**
 * Convenience function to create a Zod schema from JSON Schema
 * @param {Object} jsonSchema - JSON Schema object
 * @param {Object} options - Converter options
 * @returns {z.ZodSchema} Zod schema
 */
export function jsonSchemaToZod(jsonSchema, options = {}) {
  const converter = new SchemaConverter(options);
  return converter.convert(jsonSchema);
}

export default SchemaConverter;