/**
 * @fileoverview Schema helper for tool input validation
 * Implementation that creates JSON Schema for Legion framework
 */

import { createValidator } from '@legion/schema';

export function schema(definition) {
  // Convert simple object definition to JSON Schema
  const properties = {};
  const required = [];
  
  for (const [key, config] of Object.entries(definition)) {
    const property = {
      type: config.type || 'string'
    };
    
    if (config.description) {
      property.description = config.description;
    }
    
    if (config.default !== undefined) {
      property.default = config.default;
    }
    
    if (config.type === 'array') {
      property.items = { type: 'string' }; // Simple string array for now
    }
    
    properties[key] = property;
    
    // Add to required if not optional
    if (!config.optional) {
      required.push(key);
    }
  }
  
  const jsonSchema = {
    type: 'object',
    properties,
    required
  };
  
  return createValidator(jsonSchema);
}