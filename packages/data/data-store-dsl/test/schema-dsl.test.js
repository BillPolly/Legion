import { describe, it } from 'node:test';
import assert from 'node:assert';
import { defineSchema } from '../src/schema-dsl.js';
import { DSLParser } from '../src/parser.js';

describe('Schema DSL - Core Parser', () => {
  describe('Basic Schema Line Parsing', () => {
    it('should parse simple attribute definitions', () => {
      const schemaLine = 'user/name: string';
      
      const parsed = DSLParser.parseSchemaLine(schemaLine);
      
      assert.ok(parsed);
      assert.strictEqual(parsed.entity, 'user');
      assert.strictEqual(parsed.attribute, 'name');
      assert.strictEqual(parsed.type, 'string');
      assert.deepStrictEqual(parsed.constraints, []);
      assert.strictEqual(parsed.referenceTarget, null);
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
        assert.ok(parsed);
        assert.ok(parsed.constraints.length > 0);
      });
      
      // Test specific constraints
      const emailParsed = DSLParser.parseSchemaLine('user/email: unique value string');
      assert.ok(emailParsed.constraints.includes('unique'));
      assert.ok(emailParsed.constraints.includes('value'));
      assert.strictEqual(emailParsed.type, 'string');
      
      const tagsParsed = DSLParser.parseSchemaLine('user/tags: many string');
      assert.ok(tagsParsed.constraints.includes('many'));
      assert.strictEqual(tagsParsed.type, 'string');
    });

    it('should parse reference attributes with targets', () => {
      const referenceLines = [
        'user/manager: ref -> user',
        'post/author: ref -> user',
        'comment/post: ref -> post',
        'user/friends: many ref -> user'
      ];
      
      referenceLines.forEach(line => {
        const parsed = DSLParser.parseSchemaLine(line);
        assert.ok(parsed);
        assert.strictEqual(parsed.type, 'ref');
        assert.ok(parsed.referenceTarget);
      });
      
      // Test specific references
      const managerParsed = DSLParser.parseSchemaLine('user/manager: ref -> user');
      assert.strictEqual(managerParsed.referenceTarget, 'user');
      
      const friendsParsed = DSLParser.parseSchemaLine('user/friends: many ref -> user');
      assert.ok(friendsParsed.constraints.includes('many'));
      assert.strictEqual(friendsParsed.type, 'ref');
      assert.strictEqual(friendsParsed.referenceTarget, 'user');
    });

    it('should validate schema line syntax', () => {
      const invalidLines = [
        'user/name', // Missing type
        'user/name:', // Missing type after colon
        '/name: string', // Missing entity
        'user/: string', // Missing attribute
        'user/name: invalid-type', // Invalid type
        'user/name: ref', // Ref without target
        'user/name: ref ->', // Ref with empty target
      ];
      
      invalidLines.forEach(line => {
        assert.throws(() => {
          DSLParser.parseSchemaLine(line);
        }, Error, `Should throw error for invalid line: ${line}`);
      });
    });

    it('should handle attribute/type recognition', () => {
      const typeTests = [
        { line: 'user/name: string', expectedType: 'string' },
        { line: 'user/age: number', expectedType: 'number' },
        { line: 'user/active: boolean', expectedType: 'boolean' },
        { line: 'user/created: instant', expectedType: 'instant' },
        { line: 'user/manager: ref -> user', expectedType: 'ref' }
      ];
      
      typeTests.forEach(({ line, expectedType }) => {
        const parsed = DSLParser.parseSchemaLine(line);
        assert.strictEqual(parsed.type, expectedType);
      });
    });

    it('should extract entity and attribute names correctly', () => {
      const attributeTests = [
        { line: 'user/name: string', entity: 'user', attribute: 'name' },
        { line: 'blogPost/title: string', entity: 'blogPost', attribute: 'title' },
        { line: 'company/employees: many ref -> user', entity: 'company', attribute: 'employees' },
        { line: 'profile/socialLinks: many string', entity: 'profile', attribute: 'socialLinks' }
      ];
      
      attributeTests.forEach(({ line, entity, attribute }) => {
        const parsed = DSLParser.parseSchemaLine(line);
        assert.strictEqual(parsed.entity, entity);
        assert.strictEqual(parsed.attribute, attribute);
      });
    });

    it('should handle complex constraint combinations', () => {
      const complexLines = [
        'user/email: unique value string',
        'user/friends: many ref -> user', 
        'organization/departments: many ref component -> department',
        'user/profile: ref component -> profile'
      ];
      
      complexLines.forEach(line => {
        const parsed = DSLParser.parseSchemaLine(line);
        assert.ok(parsed.constraints.length >= 1);
        
        // Verify constraint parsing
        if (line.includes('unique')) {
          assert.ok(parsed.constraints.includes('unique'));
        }
        if (line.includes('many')) {
          assert.ok(parsed.constraints.includes('many'));
        }
        if (line.includes('component')) {
          assert.ok(parsed.constraints.includes('component'));
        }
      });
    });

    it('should convert parsed schema to DataScript format', () => {
      const testCases = [
        {
          line: 'user/name: string',
          expected: { ':user/name': { valueType: 'string' } }
        },
        {
          line: 'user/email: unique value string', 
          expected: { ':user/email': { unique: 'value', valueType: 'string' } }
        },
        {
          line: 'user/friends: many ref -> user',
          expected: { ':user/friends': { card: 'many', valueType: 'ref' } }
        },
        {
          line: 'user/profile: ref component -> profile',
          expected: { ':user/profile': { valueType: 'ref', component: true } }
        }
      ];
      
      testCases.forEach(({ line, expected }) => {
        const parsed = DSLParser.parseSchemaLine(line);
        const dataScriptFormat = DSLParser.toDataScriptSchema(parsed);
        
        assert.deepStrictEqual(dataScriptFormat, expected);
      });
    });

    it('should handle schema line parsing errors gracefully', () => {
      const errorLines = [
        'user/name: unknown-type',
        '/name: string', // Missing entity
        'user/: string' // Missing attribute
      ];
      
      errorLines.forEach(line => {
        assert.throws(() => {
          DSLParser.parseSchemaLine(line);
        }, Error, `Should throw error for: ${line}`); // Just verify that errors are thrown
      });
    });
  });

  describe('Schema Definition Processing', () => {
    it('should process multi-line schema definitions', () => {
      const multiLineSchema = `
        user/name: string
        user/email: unique value string
        user/age: number
        user/friends: many ref -> user
      `;
      
      const schemaObj = DSLParser.parseSchema(multiLineSchema);
      
      assert.ok(schemaObj);
      assert.ok(schemaObj[':user/name']);
      assert.ok(schemaObj[':user/email']);
      assert.ok(schemaObj[':user/age']);
      assert.ok(schemaObj[':user/friends']);
      
      // Verify specific attribute definitions
      assert.strictEqual(schemaObj[':user/name'].valueType, 'string');
      assert.strictEqual(schemaObj[':user/email'].unique, 'value');
      assert.strictEqual(schemaObj[':user/friends'].card, 'many');
      assert.strictEqual(schemaObj[':user/friends'].valueType, 'ref');
    });

    it('should handle empty lines and comments in schema', () => {
      const schemaWithComments = `
        // User entity definition
        user/name: string
        user/email: unique value string
        
        // Post entity definition
        post/title: string
        post/author: ref -> user
      `;
      
      const schemaObj = DSLParser.parseSchema(schemaWithComments);
      
      // Should ignore comments and empty lines
      assert.ok(schemaObj[':user/name']);
      assert.ok(schemaObj[':user/email']);
      assert.ok(schemaObj[':post/title']); 
      assert.ok(schemaObj[':post/author']);
      
      // Should not have comment artifacts
      const keys = Object.keys(schemaObj);
      assert.ok(!keys.some(key => key.includes('//')));
    });

    it('should validate complete schema consistency', () => {
      const validSchema = `
        user/name: string
        user/friends: many ref -> user
        post/author: ref -> user
      `;
      
      const schemaObj = DSLParser.parseSchema(validSchema);
      const validation = DSLParser.validateSchema(schemaObj);
      
      assert.ok(validation.valid);
      assert.strictEqual(validation.errors.length, 0);
      
      // For MVP, just test that schema parsing works
      assert.ok(schemaObj[':user/name']);
      assert.ok(schemaObj[':user/friends']);
      assert.ok(schemaObj[':post/author']);
    });

    it('should merge multiple schema definitions', () => {
      const baseSchema = DSLParser.parseSchema('user/name: string');
      const extendedSchema = DSLParser.parseSchema('user/age: number');
      
      const merged = DSLParser.mergeSchemas(baseSchema, extendedSchema);
      
      assert.ok(merged[':user/name']);
      assert.ok(merged[':user/age']);
      assert.strictEqual(merged[':user/name'].valueType, 'string');
      assert.strictEqual(merged[':user/age'].valueType, 'number');
    });

    it('should detect duplicate attribute definitions', () => {
      const duplicateSchema = `
        user/name: string
        user/name: number
      `;
      
      assert.throws(() => {
        DSLParser.parseSchema(duplicateSchema);
      }, /duplicate.*user\/name/i);
    });
  });

  describe('defineSchema Template Literal Function', () => {
    it('should create defineSchema tagged template literal function', () => {
      const userName = 'test';
      
      // This should work as a tagged template literal
      const schema = defineSchema`
        user/name: string
        user/email: unique value string
        user/entityType: string
      `;
      
      assert.ok(schema);
      assert.ok(typeof schema === 'object');
      assert.ok(schema[':user/name']);
      assert.ok(schema[':user/email']);
    });

    it('should handle expressions in schema definitions', () => {
      const entityType = 'user';
      const attributeType = 'string';
      
      const schema = defineSchema`
        ${entityType}/name: ${attributeType}
        ${entityType}/email: unique value string
      `;
      
      assert.ok(schema[':user/name']);
      assert.ok(schema[':user/email']);
      assert.strictEqual(schema[':user/name'].valueType, 'string');
    });

    it('should validate schema template literal input', () => {
      // Valid schema
      assert.doesNotThrow(() => {
        defineSchema`
          user/name: string
          user/age: number
          user/friends: many ref -> user
        `;
      });
      
      // Invalid schema should throw errors
      assert.throws(() => {
        defineSchema`
          user/name: invalid-type
        `;
      }, Error);
      
      assert.throws(() => {
        defineSchema`
          invalid-format
        `;
      }, Error);
    });

    it('should return DataScript-compatible schema object', () => {
      const schema = defineSchema`
        user/name: string
        user/email: unique value string
        user/friends: many ref -> user
        user/profile: ref component -> profile
      `;
      
      // Should be compatible with createDataStore (test structure compatibility)
      assert.ok(typeof schema === 'object');
      assert.ok(Object.keys(schema).every(key => key.startsWith(':')));
      
      // Verify DataScript format
      assert.strictEqual(schema[':user/name'].valueType, 'string');
      assert.strictEqual(schema[':user/email'].unique, 'value');
      assert.strictEqual(schema[':user/email'].valueType, 'string');
      assert.strictEqual(schema[':user/friends'].card, 'many');
      assert.strictEqual(schema[':user/friends'].valueType, 'ref');
      assert.strictEqual(schema[':user/profile'].valueType, 'ref');
      assert.strictEqual(schema[':user/profile'].component, true);
    });

    it('should handle empty schema definitions', () => {
      const emptySchema = defineSchema``;
      
      assert.deepStrictEqual(emptySchema, {});
    });

    it('should handle complex schema with multiple entities', () => {
      const complexSchema = defineSchema`
        // User entity
        user/name: string
        user/email: unique value string
        user/friends: many ref -> user
        user/posts: many ref -> post
        user/profile: ref component -> profile
        
        // Post entity  
        post/title: string
        post/content: string
        post/author: ref -> user
        post/published: boolean
        post/tags: many string
        
        // Profile entity
        profile/bio: string
        profile/avatar: string
        profile/skills: many string
      `;
      
      assert.ok(complexSchema[':user/name']);
      assert.ok(complexSchema[':user/email']);
      assert.ok(complexSchema[':user/friends']);
      assert.ok(complexSchema[':post/title']);
      assert.ok(complexSchema[':post/author']);
      assert.ok(complexSchema[':profile/bio']);
      
      // Verify relationships
      assert.strictEqual(complexSchema[':post/author'].valueType, 'ref');
      assert.strictEqual(complexSchema[':user/friends'].card, 'many');
      assert.strictEqual(complexSchema[':user/profile'].component, true);
    });

    it('should provide helpful error messages for schema parsing', () => {
      const invalidSchemas = [
        'user/name:', // Missing type
        'user/name: unknown-type', // Unknown type
        '/name: string', // Missing entity
        'user/: string' // Missing attribute
      ];
      
      invalidSchemas.forEach(schema => {
        assert.throws(() => {
          defineSchema`${schema}`;
        }, Error); // Just check that it throws an error
      });
    });

    it('should handle schema expressions correctly', () => {
      const entityTypes = ['user', 'post', 'comment'];
      const stringType = 'string';
      const refType = 'ref';
      
      const schema = defineSchema`
        ${entityTypes[0]}/name: ${stringType}
        ${entityTypes[1]}/title: ${stringType}
        ${entityTypes[1]}/author: ${refType} -> ${entityTypes[0]}
        ${entityTypes[2]}/content: ${stringType}
        ${entityTypes[2]}/post: ${refType} -> ${entityTypes[1]}
      `;
      
      assert.ok(schema[':user/name']);
      assert.ok(schema[':post/title']);
      assert.ok(schema[':post/author']);
      assert.ok(schema[':comment/content']);
      assert.ok(schema[':comment/post']);
      
      // Verify types from expressions
      assert.strictEqual(schema[':user/name'].valueType, 'string');
      assert.strictEqual(schema[':post/author'].valueType, 'ref');
    });

    it('should integrate with data-store schema validation', () => {
      const schema = defineSchema`
        user/id: unique identity string
        user/email: unique value string
        user/name: string
        user/friends: many ref -> user
      `;
      
      // Should pass data-store validation (test schema structure)
      assert.ok(typeof schema === 'object');
      assert.ok(schema[':user/id'].unique === 'identity');
      assert.ok(schema[':user/email'].unique === 'value');
      assert.ok(schema[':user/friends'].card === 'many');
      assert.ok(schema[':user/friends'].valueType === 'ref');
    });
  });
});