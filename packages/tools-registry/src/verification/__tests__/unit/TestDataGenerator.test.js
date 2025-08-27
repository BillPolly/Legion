/**
 * TestDataGenerator Unit Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  generateTestDataFromSchema, 
  generateKeywordTestData 
} from '../../utils/TestDataGenerator.js';

describe('TestDataGenerator', () => {
  describe('generateTestDataFromSchema', () => {
    describe('string type', () => {
      it('should generate valid string data', () => {
        const schema = {
          type: 'string',
          minLength: 5,
          maxLength: 10
        };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.valid.length).toBeGreaterThan(0);
        data.valid.forEach(value => {
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThanOrEqual(5);
          expect(value.length).toBeLessThanOrEqual(10);
        });
      });
      
      it('should generate invalid string data', () => {
        const schema = {
          type: 'string',
          minLength: 5,
          maxLength: 10
        };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.invalid.length).toBeGreaterThan(0);
        // Should include wrong types
        expect(data.invalid.some(v => typeof v === 'number')).toBe(true);
        expect(data.invalid.some(v => v === null)).toBe(true);
      });
      
      it('should respect pattern constraints', () => {
        const schema = {
          type: 'string',
          pattern: '^[A-Z][a-z]+$'
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(value => {
          expect(value).toMatch(/^[A-Z][a-z]+$/);
        });
      });
      
      it('should generate edge cases for strings', () => {
        const schema = {
          type: 'string',
          minLength: 1,
          maxLength: 100
        };
        
        const data = generateTestDataFromSchema(schema);
        
        // Should include boundary values
        expect(data.edge.some(v => v.length === 1)).toBe(true);
        expect(data.edge.some(v => v.length === 100)).toBe(true);
        expect(data.edge.some(v => v === '')).toBe(true);
      });
    });
    
    describe('number type', () => {
      it('should generate valid number data', () => {
        const schema = {
          type: 'number',
          minimum: 0,
          maximum: 100
        };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.valid.length).toBeGreaterThan(0);
        data.valid.forEach(value => {
          expect(typeof value).toBe('number');
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        });
      });
      
      it('should respect multipleOf constraint', () => {
        const schema = {
          type: 'number',
          multipleOf: 0.5
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(value => {
          expect(value % 0.5).toBe(0);
        });
      });
      
      it('should generate edge cases for numbers', () => {
        const schema = {
          type: 'number',
          minimum: -10,
          maximum: 10
        };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.edge).toContain(-10);
        expect(data.edge).toContain(10);
        expect(data.edge).toContain(0);
      });
      
      it('should handle exclusive bounds', () => {
        const schema = {
          type: 'number',
          exclusiveMinimum: 0,
          exclusiveMaximum: 10
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(value => {
          expect(value).toBeGreaterThan(0);
          expect(value).toBeLessThan(10);
        });
      });
    });
    
    describe('integer type', () => {
      it('should generate only integers', () => {
        const schema = {
          type: 'integer',
          minimum: -100,
          maximum: 100
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(value => {
          expect(Number.isInteger(value)).toBe(true);
        });
      });
    });
    
    describe('boolean type', () => {
      it('should generate boolean values', () => {
        const schema = { type: 'boolean' };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.valid).toContain(true);
        expect(data.valid).toContain(false);
        expect(data.invalid.some(v => v === 'true')).toBe(true);
        expect(data.invalid.some(v => v === 0)).toBe(true);
      });
    });
    
    describe('array type', () => {
      it('should generate valid arrays', () => {
        const schema = {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(arr => {
          expect(Array.isArray(arr)).toBe(true);
          expect(arr.length).toBeGreaterThanOrEqual(1);
          expect(arr.length).toBeLessThanOrEqual(5);
          arr.forEach(item => {
            expect(typeof item).toBe('string');
          });
        });
      });
      
      it('should generate arrays with unique items', () => {
        const schema = {
          type: 'array',
          items: { type: 'number' },
          uniqueItems: true
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(arr => {
          const unique = new Set(arr);
          expect(unique.size).toBe(arr.length);
        });
      });
      
      it('should generate edge cases for arrays', () => {
        const schema = {
          type: 'array',
          minItems: 0,
          maxItems: 10
        };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.edge.some(arr => arr.length === 0)).toBe(true);
        expect(data.edge.some(arr => arr.length === 10)).toBe(true);
      });
    });
    
    describe('object type', () => {
      it('should generate valid objects', () => {
        const schema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number', minimum: 0 }
          },
          required: ['name']
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(obj => {
          expect(typeof obj).toBe('object');
          expect(obj).not.toBeNull();
          expect(typeof obj.name).toBe('string');
          if ('age' in obj) {
            expect(typeof obj.age).toBe('number');
            expect(obj.age).toBeGreaterThanOrEqual(0);
          }
        });
      });
      
      it('should respect required properties', () => {
        const schema = {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['id', 'name']
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(obj => {
          expect(obj).toHaveProperty('id');
          expect(obj).toHaveProperty('name');
        });
      });
      
      it('should generate invalid objects', () => {
        const schema = {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        };
        
        const data = generateTestDataFromSchema(schema);
        
        // Should include objects missing required fields
        expect(data.invalid.some(obj => !('id' in obj))).toBe(true);
        // Should include wrong types
        expect(data.invalid.some(obj => obj && typeof obj.id === 'number')).toBe(true);
      });
      
      it('should handle additionalProperties', () => {
        const schema = {
          type: 'object',
          properties: {
            known: { type: 'string' }
          },
          additionalProperties: false
        };
        
        const data = generateTestDataFromSchema(schema);
        
        // Valid objects should only have known properties
        data.valid.forEach(obj => {
          const keys = Object.keys(obj);
          keys.forEach(key => {
            expect(['known']).toContain(key);
          });
        });
      });
    });
    
    describe('null type', () => {
      it('should generate null values', () => {
        const schema = { type: 'null' };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.valid).toContain(null);
        expect(data.invalid.some(v => v === undefined)).toBe(true);
        expect(data.invalid.some(v => v === 0)).toBe(true);
      });
    });
    
    describe('enum constraint', () => {
      it('should generate enum values', () => {
        const schema = {
          type: 'string',
          enum: ['red', 'green', 'blue']
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(value => {
          expect(['red', 'green', 'blue']).toContain(value);
        });
        
        // Should have invalid values not in enum
        expect(data.invalid.some(v => v === 'yellow')).toBe(true);
      });
    });
    
    describe('const constraint', () => {
      it('should generate const value', () => {
        const schema = {
          type: 'string',
          const: 'fixed-value'
        };
        
        const data = generateTestDataFromSchema(schema);
        
        expect(data.valid).toContain('fixed-value');
        expect(data.invalid.some(v => v === 'other-value')).toBe(true);
      });
    });
    
    describe('anyOf/oneOf/allOf', () => {
      it('should handle anyOf schemas', () => {
        const schema = {
          anyOf: [
            { type: 'string' },
            { type: 'number' }
          ]
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(value => {
          const isString = typeof value === 'string';
          const isNumber = typeof value === 'number';
          expect(isString || isNumber).toBe(true);
        });
      });
      
      it('should handle oneOf schemas', () => {
        const schema = {
          oneOf: [
            { type: 'string', minLength: 10 },
            { type: 'string', maxLength: 5 }
          ]
        };
        
        const data = generateTestDataFromSchema(schema);
        
        data.valid.forEach(value => {
          const isLong = typeof value === 'string' && value.length >= 10;
          const isShort = typeof value === 'string' && value.length <= 5;
          // Should match exactly one
          expect(isLong !== isShort).toBe(true);
        });
      });
    });
  });
  
  describe('generateKeywordTestData', () => {
    it('should generate data for search keywords', () => {
      const keywords = ['calculator', 'add', 'math'];
      
      const data = generateKeywordTestData(keywords);
      
      expect(data.exact.length).toBeGreaterThan(0);
      expect(data.partial.length).toBeGreaterThan(0);
      expect(data.fuzzy.length).toBeGreaterThan(0);
      expect(data.negative.length).toBeGreaterThan(0);
    });
    
    it('should generate exact matches', () => {
      const keywords = ['test', 'tool'];
      
      const data = generateKeywordTestData(keywords);
      
      data.exact.forEach(query => {
        const hasKeyword = keywords.some(k => 
          query.toLowerCase().includes(k.toLowerCase())
        );
        expect(hasKeyword).toBe(true);
      });
    });
    
    it('should generate partial matches', () => {
      const keywords = ['calculator'];
      
      const data = generateKeywordTestData(keywords);
      
      expect(data.partial.some(q => q.includes('calc'))).toBe(true);
      expect(data.partial.some(q => q.includes('ulator'))).toBe(true);
    });
    
    it('should generate fuzzy matches', () => {
      const keywords = ['search'];
      
      const data = generateKeywordTestData(keywords);
      
      // Should include typos
      expect(data.fuzzy.some(q => 
        q.includes('serach') || q.includes('saerch')
      )).toBe(true);
    });
    
    it('should generate negative test cases', () => {
      const keywords = ['specific'];
      
      const data = generateKeywordTestData(keywords);
      
      data.negative.forEach(query => {
        expect(query.toLowerCase()).not.toContain('specific');
      });
    });
  });
  
  describe('edge cases and error handling', () => {
    it('should handle empty schemas', () => {
      const schema = {};
      
      const data = generateTestDataFromSchema(schema);
      
      expect(data.valid.length).toBeGreaterThan(0);
      expect(data.invalid.length).toBeGreaterThan(0);
    });
    
    it('should handle unsupported types gracefully', () => {
      const schema = {
        type: 'unsupported-type'
      };
      
      const data = generateTestDataFromSchema(schema);
      
      // Should still generate some test data
      expect(data.valid.length).toBeGreaterThan(0);
    });
    
    it('should handle deeply nested schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      };
      
      const data = generateTestDataFromSchema(schema);
      
      data.valid.forEach(obj => {
        if (obj.level1 && obj.level1.level2) {
          expect(Array.isArray(obj.level1.level2)).toBe(true);
        }
      });
    });
    
    it('should handle circular references safely', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      // Create circular reference
      schema.properties.self = schema;
      
      // Should not throw or infinite loop
      expect(() => {
        generateTestDataFromSchema(schema);
      }).not.toThrow();
    });
  });
});