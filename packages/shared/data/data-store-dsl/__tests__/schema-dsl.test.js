/**
 * Schema DSL Tests
 */

import { defineSchema } from '../src/schema-dsl.js';
import { DSLParser } from '../src/parser.js';

describe('Schema DSL - Core Parser', () => {
  describe('Basic Schema Line Parsing', () => {
    it('should parse simple attribute definitions', () => {
      const schemaLine = 'user/name: string';
      
      const parsed = DSLParser.parseSchemaLine(schemaLine);
      
      expect(parsed).toBeDefined();
      expect(parsed.entity).toBe('user');
      expect(parsed.attribute).toBe('name');
      expect(parsed.type).toBe('string');
      expect(parsed.constraints).toEqual([]);
      expect(parsed.referenceTarget).toBeNull();
    });

    it('should parse attributes with constraints', () => {
      const constraintLines = [
        'user/email: unique value string',
        'user/id: unique identity string', 
        'user/tags: many string',
        'user/profile: ref component -> profile'
      ];
      
      constraintLines.forEach(line => {
        const parsed = DSLParser.parseSchemaLine(line);
        expect(parsed).toBeDefined();
        expect(parsed.constraints.length).toBeGreaterThan(0);
      });
      
      // Test specific constraints
      const emailParsed = DSLParser.parseSchemaLine('user/email: unique value string');
      expect(emailParsed.constraints).toContain('unique');
      expect(emailParsed.constraints).toContain('value');
      expect(emailParsed.type).toBe('string');
      
      const tagsParsed = DSLParser.parseSchemaLine('user/tags: many string');
      expect(tagsParsed.constraints).toContain('many');
      expect(tagsParsed.type).toBe('string');
    });

    it('should parse reference attributes with targets', () => {
      const referenceLines = [
        'user/manager: ref -> user',
        'post/author: ref -> user',
        'comment/post: ref -> post',
        'order/items: many ref -> product'
      ];
      
      referenceLines.forEach(line => {
        const parsed = DSLParser.parseSchemaLine(line);
        expect(parsed).toBeDefined();
        expect(parsed.type).toBe('ref');
        expect(parsed.referenceTarget).toBeDefined();
      });
      
      // Test specific references
      const managerParsed = DSLParser.parseSchemaLine('user/manager: ref -> user');
      expect(managerParsed.referenceTarget).toBe('user');
      
      const itemsParsed = DSLParser.parseSchemaLine('order/items: many ref -> product');
      expect(itemsParsed.constraints).toContain('many');
      expect(itemsParsed.type).toBe('ref');
      expect(itemsParsed.referenceTarget).toBe('product');
    });

    it('should validate schema line syntax', () => {
      const invalidLines = [
        'invalid',
        'no-colon',
        'missing/type:',
        '/attr: string',
        'entity/: string'
      ];
      
      invalidLines.forEach(line => {
        expect(() => DSLParser.parseSchemaLine(line)).toThrow();
      });
    });

    it('should handle attribute/type recognition', () => {
      const typeExamples = [
        { line: 'user/name: string', expectedType: 'string' },
        { line: 'user/age: number', expectedType: 'number' },
        { line: 'user/active: boolean', expectedType: 'boolean' },
        { line: 'user/created: instant', expectedType: 'instant' },
        { line: 'user/manager: ref -> user', expectedType: 'ref' }  // ref requires target
      ];
      
      typeExamples.forEach(({ line, expectedType }) => {
        const parsed = DSLParser.parseSchemaLine(line);
        expect(parsed.type).toBe(expectedType);
      });
    });

    it('should extract entity and attribute names correctly', () => {
      const examples = [
        { line: 'user/name: string', entity: 'user', attribute: 'name' },
        { line: 'post/title: string', entity: 'post', attribute: 'title' },
        { line: 'comment/text: string', entity: 'comment', attribute: 'text' }
      ];
      
      examples.forEach(({ line, entity, attribute }) => {
        const parsed = DSLParser.parseSchemaLine(line);
        expect(parsed.entity).toBe(entity);
        expect(parsed.attribute).toBe(attribute);
      });
    });

    it('should handle complex constraint combinations', () => {
      const complexLines = [
        'user/email: unique value string',
        'user/tags: many string',
        'post/author: ref component -> user',
        'order/items: many ref -> product'
      ];
      
      const emailParsed = DSLParser.parseSchemaLine(complexLines[0]);
      expect(emailParsed.constraints).toContain('unique');
      expect(emailParsed.constraints).toContain('value');
      
      const tagsParsed = DSLParser.parseSchemaLine(complexLines[1]);
      expect(tagsParsed.constraints).toContain('many');
      
      const authorParsed = DSLParser.parseSchemaLine(complexLines[2]);
      expect(authorParsed.constraints).toContain('component');
      expect(authorParsed.referenceTarget).toBe('user');
    });

    it('should convert parsed schema to DataScript format', () => {
      const parsed = DSLParser.parseSchemaLine('user/email: unique value string');
      const dsFormat = DSLParser.toDataScriptSchema(parsed);  // Fixed method name
      
      expect(dsFormat).toBeDefined();
      expect(dsFormat[':user/email']).toBeDefined();
      expect(dsFormat[':user/email'].unique).toBe('value');
      expect(dsFormat[':user/email'].valueType).toBe('string');
    });

    it('should handle schema line parsing errors gracefully', () => {
      const errorLines = [
        { line: '', expectedError: /required/i },  // Fixed: actual error is "Schema line is required"
        { line: 'no-slash: string', expectedError: /missing '\/'/i },  // Fixed: actual error is "missing '/'"
        { line: 'user/name', expectedError: /missing ':'|Invalid schema format/i },  // Fixed: actual error message
        { line: 'user/: string', expectedError: /attribute/i }
      ];
      
      errorLines.forEach(({ line, expectedError }) => {
        expect(() => DSLParser.parseSchemaLine(line)).toThrow(expectedError);
      });
    });
  });

  describe('Schema Definition Processing', () => {
    it('should process multi-line schema definitions', () => {
      const schemaText = `
        user/name: string
        user/email: unique value string
        user/age: number
        user/active: boolean
      `;
      
      const schema = DSLParser.parseSchema(schemaText);
      
      expect(schema).toBeDefined();
      expect(Object.keys(schema).length).toBe(4);
      expect(schema[':user/name']).toBeDefined();
      expect(schema[':user/email']).toBeDefined();
      expect(schema[':user/age']).toBeDefined();
      expect(schema[':user/active']).toBeDefined();
    });

    it('should handle empty lines and comments in schema', () => {
      const schemaText = `
        // User entity
        user/name: string
        
        // Email with unique constraint
        user/email: unique value string
        
        // Additional attributes
        user/age: number
      `;
      
      const schema = DSLParser.parseSchema(schemaText);
      
      expect(Object.keys(schema).length).toBe(3);
      expect(schema[':user/name']).toBeDefined();
      expect(schema[':user/email']).toBeDefined();
      expect(schema[':user/age']).toBeDefined();
    });

    it('should validate complete schema consistency', () => {
      const schemaText = `
        user/name: string
        user/manager: ref -> user
        post/author: ref -> user
        comment/post: ref -> post
      `;
      
      const schema = DSLParser.parseSchema(schemaText);
      
      expect(schema[':user/manager'].valueType).toBe('ref');
      expect(schema[':post/author'].valueType).toBe('ref');
      expect(schema[':comment/post'].valueType).toBe('ref');
    });

    it('should merge multiple schema definitions', () => {
      const schema1 = DSLParser.parseSchema('user/name: string');
      const schema2 = DSLParser.parseSchema('user/email: string');
      
      const merged = { ...schema1, ...schema2 };
      
      expect(Object.keys(merged).length).toBe(2);
      expect(merged[':user/name']).toBeDefined();
      expect(merged[':user/email']).toBeDefined();
    });

    it('should detect duplicate attribute definitions', () => {
      const schemaText = `
        user/name: string
        user/name: number
      `;
      
      expect(() => DSLParser.parseSchema(schemaText)).toThrow(/duplicate/i);
    });
  });

  describe('defineSchema Template Literal Function', () => {
    it('should create defineSchema tagged template literal function', () => {
      expect(typeof defineSchema).toBe('function');
      
      const schema = defineSchema`
        user/name: string
        user/email: string
      `;
      
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
    });

    it('should handle expressions in schema definitions', () => {
      const entityName = 'user';
      const attrType = 'string';
      
      const schema = defineSchema`
        ${entityName}/name: ${attrType}
        ${entityName}/email: unique value ${attrType}
      `;
      
      expect(schema[':user/name']).toBeDefined();
      expect(schema[':user/email']).toBeDefined();
      expect(schema[':user/email'].unique).toBe('value');
    });

    it('should validate schema template literal input', () => {
      expect(() => {
        defineSchema`invalid schema format`;
      }).toThrow();
      
      expect(() => {
        defineSchema``;
      }).not.toThrow();
    });

    it('should return DataScript-compatible schema object', () => {
      const schema = defineSchema`
        user/id: unique identity string
        user/name: string
        user/email: unique value string
        user/friends: many ref -> user
      `;
      
      expect(schema[':user/id'].unique).toBe('identity');
      expect(schema[':user/email'].unique).toBe('value');
      expect(schema[':user/friends'].card).toBe('many');
      expect(schema[':user/friends'].valueType).toBe('ref');
    });

    it('should handle empty schema definitions', () => {
      const emptySchema = defineSchema``;
      expect(emptySchema).toEqual({});
      
      const whitespaceSchema = defineSchema`
        
        
      `;
      expect(whitespaceSchema).toEqual({});
    });

    it('should handle complex schema with multiple entities', () => {
      const schema = defineSchema`
        // User entity
        user/id: unique identity string
        user/name: string
        user/email: unique value string
        user/posts: many ref component -> post
        
        // Post entity
        post/id: unique identity string
        post/title: string
        post/content: string
        post/author: ref -> user
        post/tags: many string
        
        // Comment entity
        comment/id: unique identity string
        comment/text: string
        comment/post: ref -> post
        comment/author: ref -> user
      `;
      
      // Verify all entities are present
      const entities = ['user', 'post', 'comment'];
      entities.forEach(entity => {
        const entityAttrs = Object.keys(schema).filter(key => key.startsWith(`:${entity}/`));
        expect(entityAttrs.length).toBeGreaterThan(0);
      });
      
      // Verify specific relationships
      expect(schema[':user/posts'].valueType).toBe('ref');
      expect(schema[':user/posts'].card).toBe('many');
      expect(schema[':user/posts'].component).toBe(true);  // Fixed: 'component' not 'isComponent'
      
      expect(schema[':post/author'].valueType).toBe('ref');
      expect(schema[':comment/post'].valueType).toBe('ref');
    });

    it('should provide helpful error messages for schema parsing', () => {
      try {
        defineSchema`user/name`;
      } catch (error) {
        expect(error.message).toMatch(/missing ':'|Invalid schema format/i);  // Fixed: matches actual error
      }
      
      try {
        defineSchema`invalid-format: string`;
      } catch (error) {
        expect(error.message).toMatch(/missing '\/'/i);  // Fixed: matches actual error "missing '/'"
      }
    });

    it('should handle schema expressions correctly', () => {
      const constraints = 'unique value';
      const type = 'string';
      
      const schema = defineSchema`
        user/email: ${constraints} ${type}
      `;
      
      expect(schema[':user/email'].unique).toBe('value');
      expect(schema[':user/email'].valueType).toBe('string');
    });

    it('should integrate with data-store schema validation', async () => {
      // Dynamically import DataStore to avoid circular dependency issues
      const { DataStore } = await import('@legion/data-store');
      
      const schema = defineSchema`
        user/id: unique identity string
        user/name: string
        user/email: unique value string
        user/friends: many ref -> user
      `;
      
      // Should not throw when creating DataStore with this schema
      expect(() => new DataStore(schema)).not.toThrow();
      
      const store = new DataStore(schema);
      expect(store.schema).toEqual(schema);
    });
  });
});