/**
 * ToolValidator Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ToolValidator } from '../../ToolValidator.js';
import { createMockTool, createTestSchema } from '../setup.js';

describe('ToolValidator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new ToolValidator();
  });
  
  describe('validateInterface', () => {
    it('should validate tool with correct interface', () => {
      const tool = {
        execute: async (input) => ({ result: input.a + input.b }),
        validate: (input) => true,
        getMetadata: () => ({ name: 'add', description: 'Add numbers' })
      };
      
      const result = validator.validateInterface(tool);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.score).toBe(100);
    });
    
    it('should detect missing required methods', () => {
      const tool = {
        execute: async (input) => ({ result: input })
      };
      
      const result = validator.validateInterface(tool);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required method: validate');
      expect(result.errors).toContain('Missing required method: getMetadata');
    });
    
    it('should detect non-function methods', () => {
      const tool = {
        execute: 'not-a-function',
        validate: () => true,
        getMetadata: () => ({})
      };
      
      const result = validator.validateInterface(tool);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('execute must be a function');
    });
    
    it('should detect async execute requirement', () => {
      const tool = {
        execute: (input) => ({ result: input }),
        validate: (input) => true,
        getMetadata: () => ({})
      };
      
      const result = validator.validateInterface(tool);
      
      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('execute should be an async function');
    });
  });
  
  describe('validateSchema', () => {
    it('should validate correct JSON schema', () => {
      const schema = {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      };
      
      const result = validator.validateSchema(schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should detect invalid type', () => {
      const schema = {
        type: 'invalid-type'
      };
      
      const result = validator.validateSchema(schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });
    
    it('should detect missing properties for object type', () => {
      const schema = {
        type: 'object'
      };
      
      const result = validator.validateSchema(schema);
      
      expect(result.warnings).toContain('Object schema should define properties');
    });
    
    it('should validate nested schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              value: { type: 'string' }
            }
          }
        }
      };
      
      const result = validator.validateSchema(schema);
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate array schemas', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'number'
        }
      };
      
      const result = validator.validateSchema(schema);
      
      expect(result.valid).toBe(true);
    });
  });
  
  describe('validateExecution', () => {
    it('should validate successful execution', async () => {
      const tool = {
        execute: async (input) => ({ result: input.a + input.b }),
        validate: (input) => ({ valid: true }),
        getMetadata: () => ({
          name: 'add',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['a', 'b']
          },
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'number' }
            }
          }
        })
      };
      
      const result = await validator.validateExecution(tool);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should detect validation failures', async () => {
      const tool = {
        execute: async (input) => ({ result: 'not-a-number' }),
        validate: (input) => ({ valid: false, error: 'Invalid input' }),
        getMetadata: () => ({
          name: 'add',
          inputSchema: { type: 'object' },
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'number' }
            }
          }
        })
      };
      
      const testInput = { a: 1, b: 2 };
      const result = await validator.validateExecution(tool, testInput);
      
      expect(result.errors.some(e => e.includes('Validation failed'))).toBe(true);
    });
    
    it('should detect output schema mismatches', async () => {
      const tool = {
        execute: async (input) => ({ result: 'string-instead-of-number' }),
        validate: (input) => ({ valid: true }),
        getMetadata: () => ({
          name: 'add',
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'number' }
            }
          }
        })
      };
      
      const result = await validator.validateExecution(tool, { a: 1, b: 2 });
      
      expect(result.errors.some(e => e.includes('Output does not match schema'))).toBe(true);
    });
    
    it('should handle execution timeouts', async () => {
      const tool = {
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 6000));
          return { result: 42 };
        },
        validate: () => ({ valid: true }),
        getMetadata: () => ({ name: 'slow-tool' })
      };
      
      const result = await validator.validateExecution(tool, {}, { timeout: 100 });
      
      expect(result.errors.some(e => e.includes('timeout'))).toBe(true);
    });
    
    it('should handle execution errors gracefully', async () => {
      const tool = {
        execute: async () => {
          throw new Error('Tool execution failed');
        },
        validate: () => ({ valid: true }),
        getMetadata: () => ({ name: 'failing-tool' })
      };
      
      const result = await validator.validateExecution(tool, {});
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Tool execution failed'))).toBe(true);
    });
  });
  
  
  describe('validateComplete', () => {
    it('should run all validations', async () => {
      const tool = {
        execute: async (input) => ({ result: input.a + input.b }),
        validate: (input) => ({ valid: true }),
        getMetadata: () => ({
          name: 'add',
          description: 'Add two numbers',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['a', 'b']
          },
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'number' }
            }
          }
        })
      };
      
      const result = await validator.validateComplete(tool);
      
      expect(result.interface.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.execution.valid).toBe(true);
      expect(result.combinedScore).toBeGreaterThan(80);
    });
    
    it('should calculate weighted combined score', async () => {
      const tool = {
        execute: async () => ({ result: 42 }),
        validate: () => ({ valid: false }),
        getMetadata: () => ({ name: 'test' })
      };
      
      const result = await validator.validateComplete(tool);
      
      expect(result.combinedScore).toBeLessThan(100);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});