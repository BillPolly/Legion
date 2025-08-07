/**
 * Tests for plan validation system
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanValidator, ValidationResult } from '@legion/plan-validator';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';
import { AtomicTool } from '../../src/core/execution/tools/index.js';

describe('PlanValidator', () => {
  let validator;
  let tools;

  beforeEach(() => {
    validator = new PlanValidator({
      strictMode: true,
      validateArtifacts: true
    });

    // Create test tools with metadata
    tools = [
      {
        name: 'writeFile',
        description: 'Write content to a file',
        getMetadata: () => ({
          name: 'writeFile',
          description: 'Write content to a file',
          input: { path: 'string', content: 'string', encoding: 'string?' },
          output: { path: 'string', size: 'number' }
        })
      },
      {
        name: 'readFile',
        description: 'Read content from a file',
        getMetadata: () => ({
          name: 'readFile',
          description: 'Read content from a file',
          input: { path: 'string' },
          output: { content: 'string', path: 'string' }
        })
      },
      {
        name: 'processData',
        description: 'Process data',
        getMetadata: () => ({
          name: 'processData',
          description: 'Process data',
          input: { input: 'string', format: 'string?' },
          output: { result: 'string', processedAt: 'string' }
        })
      }
    ];
  });

  describe('Basic validation', () => {
    test('should validate a simple valid plan', async () => {
      const plan = [
        new PlanStep('step1', 'Write a file', 'writeFile', 
          { path: 'test.txt', content: 'hello' }, [])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing tool', async () => {
      const plan = [
        new PlanStep('step1', 'Use unknown tool', 'unknownTool', 
          { param: 'value' }, [])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('TOOL_NOT_FOUND');
      expect(result.errors[0].message).toContain('unknownTool');
    });

    test('should detect missing required parameters', async () => {
      const plan = [
        new PlanStep('step1', 'Write without path', 'writeFile', 
          { content: 'hello' }, []) // Missing required 'path'
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });

    test('should allow optional parameters to be missing', async () => {
      const plan = [
        new PlanStep('step1', 'Write without encoding', 'writeFile', 
          { path: 'test.txt', content: 'hello' }, []) // 'encoding' is optional
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Artifact validation', () => {
    test('should validate artifact creation and reference', async () => {
      const plan = [
        new PlanStep('step1', 'Create file', 'writeFile',
          { path: 'input.txt', content: 'data' },
          [],
          { path: { name: 'inputFile', description: 'Input file path' } }
        ),
        new PlanStep('step2', 'Read file', 'readFile',
          { path: '@inputFile' }, // Reference artifact
          ['step1'])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect reference to non-existent artifact', async () => {
      const plan = [
        new PlanStep('step1', 'Read non-existent', 'readFile',
          { path: '@nonExistent' }, [])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('ARTIFACT_NOT_FOUND');
      expect(result.errors[0].message).toContain('@nonExistent');
    });

    test('should detect reference to artifact before it is created', async () => {
      const plan = [
        new PlanStep('step1', 'Read too early', 'readFile',
          { path: '@futureFile' }, []),
        new PlanStep('step2', 'Create file', 'writeFile',
          { path: 'file.txt', content: 'data' },
          ['step1'],
          { path: { name: 'futureFile', description: 'File path' } })
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'ARTIFACT_NOT_FOUND' && e.stepId === 'step1'
      )).toBe(true);
    });

    test('should detect duplicate artifact names', async () => {
      const plan = [
        new PlanStep('step1', 'Create first', 'writeFile',
          { path: 'file1.txt', content: 'data1' },
          [],
          { path: { name: 'myFile', description: 'First file' } }
        ),
        new PlanStep('step2', 'Create second', 'writeFile',
          { path: 'file2.txt', content: 'data2' },
          ['step1'],
          { path: { name: 'myFile', description: 'Second file' } } // Duplicate name
        )
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'DUPLICATE_ARTIFACT_NAME')).toBe(true);
    });

    test('should validate saveOutputs field exists in tool output', async () => {
      const plan = [
        new PlanStep('step1', 'Save invalid field', 'writeFile',
          { path: 'file.txt', content: 'data' },
          [],
          { 
            invalidField: { name: 'something', description: 'Invalid' } // Field doesn't exist
          })
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'INVALID_OUTPUT_FIELD')).toBe(true);
    });

    test('should handle nested artifact references', async () => {
      const plan = [
        new PlanStep('step1', 'Create file', 'writeFile',
          { path: 'input.txt', content: 'data' },
          [],
          { path: { name: 'inputPath', description: 'Input path' } }
        ),
        new PlanStep('step2', 'Process with nested ref', 'processData',
          { 
            input: '@inputPath',
            format: 'json'
          },
          ['step1'])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(true);
    });

    test('should warn about unused artifacts', async () => {
      const plan = [
        new PlanStep('step1', 'Create unused', 'writeFile',
          { path: 'unused.txt', content: 'data' },
          [],
          { path: { name: 'unusedFile', description: 'This will not be used' } }
        ),
        new PlanStep('step2', 'Do something else', 'processData',
          { input: 'other data', format: 'json' },
          ['step1'])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings.some(w => 
        w.type === 'UNUSED_ARTIFACT' && w.details.artifactName === 'unusedFile'
      )).toBe(true);
    });
  });

  describe('Dependency validation', () => {
    test('should validate valid dependencies', async () => {
      const plan = [
        new PlanStep('step1', 'First step', 'writeFile',
          { path: 'file.txt', content: 'data' }, []),
        new PlanStep('step2', 'Second step', 'readFile',
          { path: 'file.txt' }, ['step1'])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(true);
    });

    test('should detect invalid dependency reference', async () => {
      const plan = [
        new PlanStep('step1', 'Step with bad dep', 'writeFile',
          { path: 'file.txt', content: 'data' },
          ['nonExistentStep'])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'INVALID_DEPENDENCY')).toBe(true);
    });

    test('should detect forward dependency', async () => {
      const plan = [
        new PlanStep('step1', 'Depends on future', 'writeFile',
          { path: 'file.txt', content: 'data' },
          ['step2']), // Can't depend on future step
        new PlanStep('step2', 'Future step', 'readFile',
          { path: 'file.txt' }, [])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'INVALID_DEPENDENCY' && e.stepId === 'step1'
      )).toBe(true);
    });

    test('should detect circular dependencies', async () => {
      const plan = [
        new PlanStep('step1', 'First', 'writeFile',
          { path: 'file1.txt', content: 'data' },
          ['step3']),
        new PlanStep('step2', 'Second', 'writeFile',
          { path: 'file2.txt', content: 'data' },
          ['step1']),
        new PlanStep('step3', 'Third', 'writeFile',
          { path: 'file3.txt', content: 'data' },
          ['step2'])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'CIRCULAR_DEPENDENCY')).toBe(true);
    });
  });

  describe('Type validation', () => {
    test('should validate parameter types', async () => {
      const plan = [
        new PlanStep('step1', 'Wrong type', 'writeFile',
          { path: 123, content: 'data' }, []) // path should be string
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });

    test('should warn about unexpected parameters', async () => {
      const plan = [
        new PlanStep('step1', 'Extra params', 'writeFile',
          { 
            path: 'file.txt',
            content: 'data',
            unexpectedParam: 'value' // Not in schema
          }, [])
      ];

      const result = await validator.validate(plan, tools);
      
      // With @legion/schema in strict mode, extra properties are errors
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });
  });

  describe('Complex scenarios', () => {
    test('should validate complex multi-step plan with artifacts', async () => {
      const plan = [
        new PlanStep('create1', 'Create first file', 'writeFile',
          { path: 'input.txt', content: 'initial data' },
          [],
          { path: { name: 'inputFile', description: 'Input file' } }
        ),
        new PlanStep('read1', 'Read first file', 'readFile',
          { path: '@inputFile' },
          ['create1'],
          { content: { name: 'fileContent', description: 'File content' } }
        ),
        new PlanStep('process', 'Process content', 'processData',
          { input: '@fileContent', format: 'json' },
          ['read1'],
          { result: { name: 'processedData', description: 'Processed result' } }
        ),
        new PlanStep('save', 'Save result', 'writeFile',
          { path: 'output.txt', content: '@processedData' },
          ['process'])
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle multiple validation errors', async () => {
      const plan = [
        new PlanStep('step1', 'Multiple issues', 'unknownTool', // Tool doesn't exist
          { wrongParam: 123 }, // Wrong parameters
          ['nonExistent'], // Bad dependency
          { invalidField: { name: 'bad', description: 'Invalid' } }), // Invalid output field
        new PlanStep('step2', 'Has dependency issue', 'writeFile',
          { path: 'file.txt', content: 'data' },
          ['nonExistent']) // Bad dependency on second step
      ];

      const result = await validator.validate(plan, tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2); // At least tool not found and dependency error
      expect(result.errors.some(e => e.type === 'TOOL_NOT_FOUND')).toBe(true);
      expect(result.errors.some(e => e.type === 'INVALID_DEPENDENCY')).toBe(true);
    });
  });
});