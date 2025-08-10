/**
 * @fileoverview Schema helper for tool input validation
 * Mock implementation that wraps Zod for Legion framework
 */

import { z } from 'zod';

export function schema(definition) {
  // Convert simple object definition to Zod schema
  const schemaFields = {};
  
  for (const [key, config] of Object.entries(definition)) {
    let field;
    
    switch (config.type) {
      case 'string':
        field = z.string();
        if (config.description) field = field.describe(config.description);
        if (config.default !== undefined) field = field.default(config.default);
        if (config.optional) field = field.optional();
        break;
        
      case 'number':
        field = z.number();
        if (config.description) field = field.describe(config.description);
        if (config.default !== undefined) field = field.default(config.default);
        if (config.optional) field = field.optional();
        break;
        
      case 'boolean':
        field = z.boolean();
        if (config.description) field = field.describe(config.description);
        if (config.default !== undefined) field = field.default(config.default);
        if (config.optional) field = field.optional();
        break;
        
      case 'array':
        field = z.array(z.string()); // Simple string array for now
        if (config.description) field = field.describe(config.description);
        if (config.default !== undefined) field = field.default(config.default);
        if (config.optional) field = field.optional();
        break;
        
      default:
        field = z.string();
    }
    
    schemaFields[key] = field;
  }
  
  return z.object(schemaFields);
}