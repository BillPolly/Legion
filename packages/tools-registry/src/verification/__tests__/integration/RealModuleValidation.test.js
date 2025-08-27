/**
 * RealModuleValidation Integration Tests
 * 
 * Tests the verification framework against real tools from the Legion ecosystem
 * Validates that actual tools conform to the expected interface standards
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetadataManager } from '../../MetadataManager.js';
import { ToolValidator } from '../../ToolValidator.js';
import { generateTestDataFromSchema } from '../../utils/TestDataGenerator.js';

describe('RealModuleValidation Integration', () => {
  let metadataManager;
  let toolValidator;
  
  beforeEach(() => {
    metadataManager = new MetadataManager();
    toolValidator = new ToolValidator();
  });
  
  describe('Real Tool Interface Validation', () => {
    it('should validate a basic arithmetic tool implementation', async () => {
      // Create a realistic arithmetic tool similar to what would be in the ecosystem
      const arithmeticTool = {
        name: 'calculator',
        execute: async (input) => {
          const { operation, a, b } = input;
          switch (operation) {
            case 'add':
              return { result: a + b, operation: 'addition' };
            case 'subtract':
              return { result: a - b, operation: 'subtraction' };
            case 'multiply':
              return { result: a * b, operation: 'multiplication' };
            case 'divide':
              if (b === 0) throw new Error('Division by zero');
              return { result: a / b, operation: 'division' };
            default:
              throw new Error(`Unsupported operation: ${operation}`);
          }
        },
        validate: (input) => {
          if (!input || typeof input !== 'object') {
            return { valid: false, error: 'Input must be an object' };
          }
          
          const { operation, a, b } = input;
          
          if (!operation || !['add', 'subtract', 'multiply', 'divide'].includes(operation)) {
            return { valid: false, error: 'Invalid operation' };
          }
          
          if (typeof a !== 'number' || typeof b !== 'number') {
            return { valid: false, error: 'Operands must be numbers' };
          }
          
          if (operation === 'divide' && b === 0) {
            return { valid: false, error: 'Division by zero not allowed' };
          }
          
          return { valid: true };
        },
        getMetadata: () => ({
          name: 'calculator',
          description: 'Performs basic arithmetic operations on two numbers',
          version: '1.2.0',
          inputSchema: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['add', 'subtract', 'multiply', 'divide'],
                description: 'The arithmetic operation to perform'
              },
              a: {
                type: 'number',
                description: 'First operand'
              },
              b: {
                type: 'number',
                description: 'Second operand'
              }
            },
            required: ['operation', 'a', 'b'],
            additionalProperties: false
          },
          outputSchema: {
            type: 'object',
            properties: {
              result: {
                type: 'number',
                description: 'The result of the arithmetic operation'
              },
              operation: {
                type: 'string',
                description: 'The operation that was performed'
              }
            },
            required: ['result', 'operation']
          },
          category: 'mathematics',
          tags: ['arithmetic', 'calculator', 'math', 'basic'],
          examples: [
            {
              input: { operation: 'add', a: 5, b: 3 },
              output: { result: 8, operation: 'addition' }
            },
            {
              input: { operation: 'multiply', a: 4, b: 7 },
              output: { result: 28, operation: 'multiplication' }
            }
          ]
        })
      };
      
      // Validate complete tool
      const validation = await toolValidator.validateComplete(arithmeticTool);
      
      expect(validation.interface.valid).toBe(true);
      expect(validation.interface.errors).toEqual([]);
      expect(validation.interface.score).toBe(100);
      
      expect(validation.metadata).toBeTruthy();
      expect(validation.metadata.name).toBe('calculator');
      expect(validation.metadata.version).toBe('1.2.0');
      
      expect(validation.execution.valid).toBe(true);
      expect(validation.execution.errors).toEqual([]);
      
      expect(validation.combinedScore).toBeGreaterThan(95);
      expect(validation.recommendations).toEqual([]);
    });
    
    it('should validate a file system tool implementation', async () => {
      // Create a realistic file system tool
      const fileSystemTool = {
        name: 'file-reader',
        execute: async (input) => {
          const { path, encoding = 'utf8' } = input;
          
          // Mock file system operation
          if (path === '/nonexistent/file.txt') {
            throw new Error('File not found');
          }
          
          if (path === '/test/file.txt') {
            return {
              content: 'Hello, world!',
              size: 13,
              encoding: encoding,
              path: path
            };
          }
          
          return {
            content: 'Mock file content',
            size: 17,
            encoding: encoding,
            path: path
          };
        },
        validate: (input) => {
          if (!input || typeof input !== 'object') {
            return { valid: false, error: 'Input must be an object' };
          }
          
          const { path, encoding } = input;
          
          if (!path || typeof path !== 'string' || path.trim() === '') {
            return { valid: false, error: 'Path must be a non-empty string' };
          }
          
          if (encoding && typeof encoding !== 'string') {
            return { valid: false, error: 'Encoding must be a string' };
          }
          
          const validEncodings = ['utf8', 'ascii', 'base64', 'hex'];
          if (encoding && !validEncodings.includes(encoding)) {
            return { valid: false, error: 'Invalid encoding' };
          }
          
          return { valid: true };
        },
        getMetadata: () => ({
          name: 'file-reader',
          description: 'Reads the contents of a file from the filesystem',
          version: '2.1.0',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file to read',
                minLength: 1
              },
              encoding: {
                type: 'string',
                enum: ['utf8', 'ascii', 'base64', 'hex'],
                default: 'utf8',
                description: 'File encoding'
              }
            },
            required: ['path'],
            additionalProperties: false
          },
          outputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The contents of the file'
              },
              size: {
                type: 'number',
                description: 'Size of the file in bytes'
              },
              encoding: {
                type: 'string',
                description: 'Encoding used to read the file'
              },
              path: {
                type: 'string',
                description: 'Path to the file that was read'
              }
            },
            required: ['content', 'size', 'encoding', 'path']
          },
          category: 'filesystem',
          tags: ['file', 'read', 'filesystem', 'io'],
          examples: [
            {
              input: { path: '/home/user/document.txt' },
              output: { 
                content: 'Document content...',
                size: 18,
                encoding: 'utf8',
                path: '/home/user/document.txt'
              }
            }
          ]
        })
      };
      
      // Complete validation
      const validation = await toolValidator.validateComplete(fileSystemTool);
      
      expect(validation.interface.valid).toBe(true);
      expect(validation.interface.score).toBe(100);
      
      expect(validation.metadata).toBeTruthy();
      expect(validation.metadata.category).toBe('filesystem');
      expect(validation.metadata.tags).toContain('file');
      
      expect(validation.execution.valid).toBe(true);
      expect(validation.combinedScore).toBeGreaterThan(95);
    });
    
    it('should handle tools with complex validation logic', async () => {
      // Create a tool with complex validation requirements
      const dataValidatorTool = {
        name: 'schema-validator',
        execute: async (input) => {
          const { data, schema } = input;
          
          // Mock schema validation
          const isValid = validateDataAgainstSchema(data, schema);
          const errors = isValid ? [] : ['Schema validation failed'];
          
          return {
            valid: isValid,
            errors: errors,
            data: data,
            schema: schema.type || 'unknown'
          };
        },
        validate: (input) => {
          if (!input || typeof input !== 'object') {
            return { valid: false, error: 'Input must be an object' };
          }
          
          const { data, schema } = input;
          
          if (data === undefined) {
            return { valid: false, error: 'Data is required' };
          }
          
          if (!schema || typeof schema !== 'object') {
            return { valid: false, error: 'Schema must be an object' };
          }
          
          if (!schema.type) {
            return { valid: false, error: 'Schema must have a type property' };
          }
          
          return { valid: true };
        },
        getMetadata: () => ({
          name: 'schema-validator',
          description: 'Validates data against a JSON schema',
          version: '1.0.0',
          inputSchema: {
            type: 'object',
            properties: {
              data: {
                description: 'The data to validate'
              },
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string' }
                },
                required: ['type'],
                description: 'JSON schema to validate against'
              }
            },
            required: ['data', 'schema']
          },
          outputSchema: {
            type: 'object',
            properties: {
              valid: {
                type: 'boolean',
                description: 'Whether the data is valid'
              },
              errors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Validation error messages'
              },
              data: {
                description: 'The original data that was validated'
              },
              schema: {
                type: 'string',
                description: 'The schema type used for validation'
              }
            },
            required: ['valid', 'errors', 'data', 'schema']
          },
          category: 'validation',
          tags: ['schema', 'validation', 'json', 'data'],
          examples: [
            {
              input: { 
                data: "hello", 
                schema: { type: "string" }
              },
              output: {
                valid: true,
                errors: [],
                data: "hello",
                schema: "string"
              }
            }
          ]
        })
      };
      
      // Test validation with complex input
      const testInput = {
        data: "test string",
        schema: { type: "string" }
      };
      
      const interfaceValidation = toolValidator.validateInterface(dataValidatorTool);
      const executionValidation = await toolValidator.validateExecution(dataValidatorTool, testInput);
      
      expect(interfaceValidation.valid).toBe(true);
      expect(executionValidation.valid).toBe(true);
      expect(executionValidation.output.valid).toBe(true);
      expect(executionValidation.output.schema).toBe('string');
    });
  });
  
  describe('Schema Compliance Validation', () => {
    it('should validate module metadata compliance', () => {
      const moduleMetadata = {
        name: 'test-module',
        description: 'A test module for validation testing purposes',
        version: '1.0.0',
        author: 'Legion Test Suite',
        license: 'MIT',
        category: 'testing',
        tags: ['test', 'validation', 'example'],
        homepage: 'https://example.com/test-module',
        repository: 'https://github.com/legion/test-module'
      };
      
      const validation = metadataManager.validateModuleMetadata(moduleMetadata);
      
      expect(validation.valid).toBe(true);
      expect(validation.score).toBeGreaterThan(80);
      expect(validation.errors).toEqual([]);
    });
    
    it('should detect metadata quality issues', () => {
      const poorMetadata = {
        name: 'bad',
        description: 'Bad', // Too short
        version: 'invalid', // Invalid version format
        author: '',
        license: '',
        category: 'unknown'
        // Missing many recommended fields
      };
      
      const validation = metadataManager.validateModuleMetadata(poorMetadata);
      
      expect(validation.valid).toBe(false);
      expect(validation.score).toBeLessThan(60);
      expect(validation.errors.length).toBeGreaterThan(2);
    });
  });
  
  describe('Test Data Generation for Real Schemas', () => {
    it('should generate comprehensive test data for complex schemas', () => {
      const complexSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 2, maxLength: 50 },
              age: { type: 'integer', minimum: 0, maximum: 120 },
              email: { type: 'string', format: 'email' },
              active: { type: 'boolean' }
            },
            required: ['name', 'email']
          },
          preferences: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['notifications', 'updates', 'marketing']
            },
            uniqueItems: true
          },
          settings: {
            type: 'object',
            additionalProperties: true
          }
        },
        required: ['user']
      };
      
      const testData = generateTestDataFromSchema(complexSchema);
      
      expect(testData.valid.length).toBeGreaterThan(0);
      expect(testData.invalid.length).toBeGreaterThan(0);
      expect(testData.edge.length).toBeGreaterThan(0);
      
      // Verify valid data structure
      const validSample = testData.valid.find(data => data.user);
      expect(validSample).toBeTruthy();
      expect(validSample.user.name).toBeDefined();
      expect(validSample.user.email).toBeDefined();
      expect(typeof validSample.user.name).toBe('string');
      expect(typeof validSample.user.email).toBe('string');
      
      // Verify invalid data includes wrong types and missing required fields
      const hasWrongTypeInvalid = testData.invalid.some(data => 
        data && data.user && typeof data.user.name === 'number'
      );
      const hasMissingRequired = testData.invalid.some(data =>
        data && (!data.user || !data.user.name || !data.user.email)
      );
      
      expect(hasWrongTypeInvalid || hasMissingRequired).toBe(true);
    });
    
    it('should handle schema with enum and const values', () => {
      const constrainedSchema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected']
          },
          priority: {
            const: 'high'
          },
          category: {
            type: 'string',
            enum: ['bug', 'feature', 'improvement']
          }
        },
        required: ['status', 'priority']
      };
      
      const testData = generateTestDataFromSchema(constrainedSchema);
      
      expect(testData.valid.length).toBeGreaterThan(0);
      
      // All valid data should respect constraints
      testData.valid.forEach(data => {
        if (data.status) {
          expect(['pending', 'approved', 'rejected']).toContain(data.status);
        }
        if (data.priority) {
          expect(data.priority).toBe('high');
        }
        if (data.category) {
          expect(['bug', 'feature', 'improvement']).toContain(data.category);
        }
      });
      
      // Invalid data should violate constraints
      const hasInvalidEnum = testData.invalid.some(data => 
        data.status && !['pending', 'approved', 'rejected'].includes(data.status)
      );
      const hasInvalidConst = testData.invalid.some(data => 
        data.priority && data.priority !== 'high'
      );
      
      expect(hasInvalidEnum || hasInvalidConst).toBe(true);
    });
  });
});

// Helper function for mock schema validation
function validateDataAgainstSchema(data, schema) {
  // Very basic schema validation for testing purposes
  if (schema.type === 'string') {
    return typeof data === 'string';
  }
  if (schema.type === 'number') {
    return typeof data === 'number';
  }
  if (schema.type === 'boolean') {
    return typeof data === 'boolean';
  }
  if (schema.type === 'object') {
    return typeof data === 'object' && data !== null;
  }
  if (schema.type === 'array') {
    return Array.isArray(data);
  }
  return true;
}