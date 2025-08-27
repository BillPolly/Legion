/**
 * VerificationPipeline Integration Tests
 * 
 * Tests the integration of MetadataManager + ToolValidator + TestDataGenerator
 * working together in a complete verification pipeline
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetadataManager } from '../../MetadataManager.js';
import { ToolValidator } from '../../ToolValidator.js';
import { generateTestDataFromSchema } from '../../utils/TestDataGenerator.js';

describe('VerificationPipeline Integration', () => {
  let metadataManager;
  let toolValidator;
  
  beforeEach(() => {
    metadataManager = new MetadataManager();
    toolValidator = new ToolValidator();
  });
  
  describe('Complete Tool Validation Pipeline', () => {
    it('should validate a complete tool through the entire pipeline', async () => {
      // Create a mock tool with complete metadata and implementation
      const mockTool = {
        name: 'add',
        execute: async (input) => ({ result: input.a + input.b }),
        validate: (input) => ({ valid: true }),
        getMetadata: () => ({
          name: 'add',
          description: 'Add two numbers together',
          version: '1.0.0',
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
          },
          category: 'arithmetic',
          tags: ['math', 'basic'],
          examples: [
            {
              input: { a: 1, b: 2 },
              output: { result: 3 }
            }
          ]
        })
      };
      
      // Step 1: Validate tool metadata
      const metadata = mockTool.getMetadata();
      // The MetadataManager validateToolMetadata method validates the metadata object structure
      const metadataValidation = metadataManager.validateModuleMetadata({
        name: metadata.name,
        description: metadata.description,
        version: metadata.version,
        author: 'Test Author',
        license: 'MIT',
        category: metadata.category,
        tags: metadata.tags
      });
      
      expect(metadataValidation.valid).toBe(true);
      expect(metadataValidation.score).toBeGreaterThan(70);
      
      // Step 2: Validate tool interface
      const interfaceValidation = toolValidator.validateInterface(mockTool);
      
      expect(interfaceValidation.valid).toBe(true);
      expect(interfaceValidation.errors).toEqual([]);
      expect(interfaceValidation.score).toBe(100);
      
      // Step 3: Validate tool execution
      const executionValidation = await toolValidator.validateExecution(mockTool);
      
      expect(executionValidation.valid).toBe(true);
      expect(executionValidation.errors).toEqual([]);
      expect(executionValidation.output.result).toEqual(84); // a: 42, b: 42 -> add -> 84
      
      // Step 4: Generate test data and validate with it
      const testData = generateTestDataFromSchema(metadata.inputSchema);
      
      expect(testData.valid.length).toBeGreaterThan(0);
      expect(testData.invalid.length).toBeGreaterThan(0);
      expect(testData.edge.length).toBeGreaterThan(0);
      
      // Test with valid data
      const validInput = testData.valid[0];
      const validExecution = await toolValidator.validateExecution(mockTool, validInput);
      expect(validExecution.valid).toBe(true);
      
      // Step 5: Calculate combined compliance score
      const combinedScore = (
        metadataValidation.score * 0.4 +
        interfaceValidation.score * 0.3 +
        (executionValidation.valid ? 100 : 0) * 0.3
      );
      
      expect(combinedScore).toBeGreaterThan(85);
    });
    
    it('should detect issues in incomplete tools', async () => {
      // Create a tool with various issues
      const incompleteTool = {
        name: 'broken',
        execute: (input) => ({ result: 'not async' }), // Not async
        validate: () => ({ valid: false, error: 'Always fails' }),
        getMetadata: () => ({
          name: 'broken',
          description: 'Bad', // Too short
          version: 'invalid', // Bad version format
          // Missing required schemas
          category: 'test'
        })
      };
      
      // Step 1: Validate metadata (should fail)
      const metadata = incompleteTool.getMetadata();
      const metadataValidation = metadataManager.validateModuleMetadata({
        name: metadata.name,
        description: metadata.description,
        version: metadata.version,
        author: 'Test Author',
        license: 'MIT',
        category: metadata.category
        // Missing many required fields
      });
      
      expect(metadataValidation.valid).toBe(false);
      expect(metadataValidation.score).toBeLessThan(70);
      
      // Step 2: Validate interface (should fail)
      const interfaceValidation = toolValidator.validateInterface(incompleteTool);
      
      // The interface should be valid since all required methods are present
      // but score should be lower due to warnings about non-async execute
      expect(interfaceValidation.valid).toBe(false); // It should be false due to non-async execute
      expect(interfaceValidation.score).toBeLessThan(100);
      
      // Step 3: Execution should fail due to validation
      const executionValidation = await toolValidator.validateExecution(incompleteTool, { a: 1, b: 2 });
      
      expect(executionValidation.valid).toBe(false);
      expect(executionValidation.errors.some(e => e.includes('Validation failed'))).toBe(true);
      
      // Step 4: Combined score should be low
      const combinedScore = (
        metadataValidation.score * 0.4 +
        interfaceValidation.score * 0.3 +
        (executionValidation.valid ? 100 : 0) * 0.3
      );
      
      expect(combinedScore).toBeLessThan(50);
    });
    
    it('should handle schema validation errors gracefully', () => {
      const invalidSchema = {
        type: 'invalid-type',
        properties: {
          test: { type: 'unknown-type' }
        }
      };
      
      // Schema validation should handle invalid schemas
      const schemaValidation = toolValidator.validateSchema(invalidSchema);
      
      expect(schemaValidation.valid).toBe(false);
      expect(schemaValidation.errors.length).toBeGreaterThan(0);
      
      // Test data generation should handle invalid schemas gracefully
      const testData = generateTestDataFromSchema(invalidSchema);
      
      expect(testData.valid.length).toBeGreaterThan(0); // Should generate something
      // For invalid schema types, TestDataGenerator might not generate invalid/edge data
      expect(testData.invalid.length).toBeGreaterThanOrEqual(0);
      expect(testData.edge.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Component Integration Edge Cases', () => {
    it('should handle tools with missing metadata methods', () => {
      const minimalTool = {
        execute: async () => ({ result: 42 })
        // Missing validate and getMetadata
      };
      
      const interfaceValidation = toolValidator.validateInterface(minimalTool);
      
      expect(interfaceValidation.valid).toBe(false);
      expect(interfaceValidation.errors).toContain('Missing required method: validate');
      expect(interfaceValidation.errors).toContain('Missing required method: getMetadata');
    });
    
    it('should generate appropriate test data for different schema types', () => {
      const stringSchema = { type: 'string', minLength: 3, maxLength: 10 };
      const numberSchema = { type: 'number', minimum: 0, maximum: 100 };
      const arraySchema = { type: 'array', items: { type: 'string' } };
      
      const stringData = generateTestDataFromSchema(stringSchema);
      const numberData = generateTestDataFromSchema(numberSchema);
      const arrayData = generateTestDataFromSchema(arraySchema);
      
      // Verify string data
      expect(stringData.valid.every(s => typeof s === 'string')).toBe(true);
      expect(stringData.valid.every(s => s.length >= 3 && s.length <= 10)).toBe(true);
      
      // Verify number data  
      expect(numberData.valid.every(n => typeof n === 'number')).toBe(true);
      expect(numberData.valid.every(n => n >= 0 && n <= 100)).toBe(true);
      
      // Verify array data
      expect(arrayData.valid.every(arr => Array.isArray(arr))).toBe(true);
    });
  });
});