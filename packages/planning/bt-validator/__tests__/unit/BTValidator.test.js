/**
 * Comprehensive tests for BTValidator
 * Tests all node types, intelligent defaults, and validation scenarios
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BTValidator, ValidationResult } from '../../src/BTValidator.js';

describe('BTValidator', () => {
  let validator;
  let mockTools;

  beforeEach(() => {
    validator = new BTValidator({
      strictMode: true,
      validateTools: true,
      applyDefaults: true,
      coerceTypes: false
    });

    // Mock tools for testing
    mockTools = [
      {
        name: 'writeFile',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'readFile',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      },
      {
        name: 'processData',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            format: { type: 'string', default: 'json' }
          },
          required: ['data']
        }
      }
    ];
  });

  describe('Node Type Validation', () => {
    test('should validate sequence node with children', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        description: 'Main sequence',
        children: [
          { type: 'action', id: 'step1', tool: 'readFile', inputs: { path: 'input.txt' } },
          { type: 'action', id: 'step2', tool: 'writeFile', inputs: { path: 'output.txt', content: 'data' } }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate selector node (fallback)', async () => {
      const bt = {
        type: 'selector',
        id: 'fallback',
        description: 'Try primary then backup',
        children: [
          { type: 'action', id: 'primary', tool: 'readFile', inputs: { path: 'primary.txt' } },
          { type: 'action', id: 'backup', tool: 'readFile', inputs: { path: 'backup.txt' } }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate parallel node', async () => {
      const bt = {
        type: 'parallel',
        id: 'concurrent',
        description: 'Run tasks concurrently',
        children: [
          { type: 'action', id: 'task1', tool: 'processData', inputs: { data: 'a' } },
          { type: 'action', id: 'task2', tool: 'processData', inputs: { data: 'b' } },
          { type: 'action', id: 'task3', tool: 'processData', inputs: { data: 'c' } }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate action node', async () => {
      const bt = {
        type: 'action',
        id: 'write',
        tool: 'writeFile',
        inputs: { path: 'test.txt', content: 'hello' }
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate retry node with child', async () => {
      const bt = {
        type: 'retry',
        id: 'retry-write',
        maxRetries: 3,
        child: {
          type: 'action',
          id: 'write',
          tool: 'writeFile',
          inputs: { path: 'test.txt', content: 'data' }
        }
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate condition node', async () => {
      const bt = {
        type: 'condition',
        id: 'check-result',
        check: "context['step1'].status === 'SUCCESS'",
        description: 'Check if step1 succeeded'
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid node type', async () => {
      const bt = {
        type: 'invalid_type',
        id: 'bad',
        children: []
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'INVALID_NODE_TYPE')).toBe(true);
    });

    test('should detect missing children in sequence', async () => {
      const bt = {
        type: 'sequence',
        id: 'empty'
        // Missing children
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_CHILDREN')).toBe(true);
    });

    test('should detect missing tool in action', async () => {
      const bt = {
        type: 'action',
        id: 'no-tool'
        // Missing tool
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_TOOL')).toBe(true);
    });
  });

  describe('Intelligent Defaults', () => {
    test('should apply sequence type when children present', async () => {
      const bt = {
        id: 'auto-sequence',
        children: [
          { type: 'action', id: 'step1', tool: 'readFile', inputs: { path: 'file.txt' } }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should apply action type when tool present', async () => {
      const bt = {
        id: 'auto-action',
        tool: 'writeFile',
        inputs: { path: 'test.txt', content: 'data' }
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should generate IDs when missing', async () => {
      const bt = {
        type: 'sequence',
        children: [
          { tool: 'readFile', inputs: { path: 'test.txt' } },
          { tool: 'writeFile', inputs: { path: 'out.txt', content: 'data' } }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should convert legacy array format', async () => {
      const legacyPlan = [
        { tool: 'readFile', inputs: { path: 'input.txt' } },
        { tool: 'processData', inputs: { data: 'test' } },
        { tool: 'writeFile', inputs: { path: 'output.txt', content: 'result' } }
      ];

      const result = await validator.validate(legacyPlan, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should add missing inputs field to action nodes', async () => {
      const bt = {
        type: 'action',
        id: 'test',
        tool: 'readFile'
        // Missing inputs - should be added as empty object
      };

      validator.applyDefaults = true;
      const normalized = validator.applyIntelligentDefaults(bt);
      expect(normalized.inputs).toBeDefined();
      expect(normalized.inputs).toEqual({});
    });
  });

  describe('Variable Reference Validation', () => {
    test('should validate artifact references in conditions', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        children: [
          {
            type: 'action',
            id: 'step1',
            tool: 'readFile',
            inputs: { path: 'test.txt' },
            outputs: { result: 'fileContent' }
          },
          {
            type: 'condition',
            id: 'check',
            check: "artifacts['fileContent'] !== null"
          }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect undefined variable references', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        children: [
          {
            type: 'action',
            id: 'step1',
            tool: 'readFile',
            inputs: { path: 'test.txt' }
            // No outputs defined
          },
          {
            type: 'condition',
            id: 'check',
            check: "artifacts['undefinedVar'] !== null"
          }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'UNDEFINED_VARIABLE' || e.type === 'INVALID_ARTIFACT_REFERENCE'
      )).toBe(true);
    });

    test('should warn about unused variables', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        children: [
          {
            type: 'action',
            id: 'step1',
            tool: 'readFile',
            inputs: { path: 'test.txt' },
            outputs: { result: 'unusedVar' }
          },
          {
            type: 'action',
            id: 'step2',
            tool: 'writeFile',
            inputs: { path: 'out.txt', content: 'fixed' }
          }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.warnings.some(w => w.type === 'UNUSED_VARIABLE')).toBe(true);
    });

    test('should validate context references', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        children: [
          {
            type: 'action',
            id: 'step1',
            tool: 'readFile',
            inputs: { path: 'test.txt' }
          },
          {
            type: 'condition',
            id: 'check',
            check: "context['step1'].status === 'SUCCESS'"
          }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Error Detection', () => {
    test('should detect duplicate node IDs', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        children: [
          { type: 'action', id: 'duplicate', tool: 'readFile', inputs: { path: 'a.txt' } },
          { type: 'action', id: 'duplicate', tool: 'writeFile', inputs: { path: 'b.txt', content: 'data' } }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'DUPLICATE_NODE_ID')).toBe(true);
    });

    test('should detect missing node ID', async () => {
      const bt = {
        type: 'sequence',
        // Missing ID
        children: [
          { type: 'action', id: 'step1', tool: 'readFile', inputs: { path: 'test.txt' } }
        ]
      };

      validator.applyDefaults = false; // Disable defaults to test ID requirement
      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_NODE_ID')).toBe(true);
    });

    test('should detect tool not found', async () => {
      const bt = {
        type: 'action',
        id: 'unknown',
        tool: 'nonExistentTool',
        inputs: {}
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'TOOL_NOT_FOUND')).toBe(true);
    });

    test('should validate parameter schemas', async () => {
      const bt = {
        type: 'action',
        id: 'invalid-params',
        tool: 'writeFile',
        inputs: { path: 'test.txt' } // Missing required 'content'
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    test('should validate nested sequence and selector', async () => {
      const bt = {
        type: 'sequence',
        id: 'root',
        children: [
          {
            type: 'selector',
            id: 'try-sources',
            children: [
              { type: 'action', id: 'primary', tool: 'readFile', inputs: { path: 'primary.txt' } },
              { type: 'action', id: 'backup', tool: 'readFile', inputs: { path: 'backup.txt' } }
            ]
          },
          { type: 'action', id: 'process', tool: 'processData', inputs: { data: 'test' } }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate retry with sequence child', async () => {
      const bt = {
        type: 'retry',
        id: 'retry-sequence',
        maxRetries: 3,
        child: {
          type: 'sequence',
          id: 'steps',
          children: [
            { type: 'action', id: 'step1', tool: 'readFile', inputs: { path: 'in.txt' } },
            { type: 'action', id: 'step2', tool: 'processData', inputs: { data: 'test' } },
            { type: 'action', id: 'step3', tool: 'writeFile', inputs: { path: 'out.txt', content: 'result' } }
          ]
        }
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle mixed validation errors and warnings', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        children: [
          { type: 'action', id: 'step1', tool: 'unknownTool', inputs: {} }, // Tool not found
          { type: 'action', id: 'step1', tool: 'readFile', inputs: {} }, // Duplicate ID + missing params
          { type: 'invalid', id: 'step3' }, // Invalid node type
          {
            type: 'action',
            id: 'step4',
            tool: 'writeFile',
            inputs: { path: 'test.txt', content: 'data' },
            outputs: { result: 'unusedOutput' } // Will generate warning
          }
        ]
      };

      const result = await validator.validate(bt, mockTools);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Options', () => {
    test('should respect strictMode option', async () => {
      const strictValidator = new BTValidator({ strictMode: true });
      const lenientValidator = new BTValidator({ strictMode: false });

      const bt = {
        type: 'action',
        id: 'test',
        tool: 'writeFile',
        inputs: { path: 'test.txt', content: 'data', extra: 'field' } // Extra field
      };

      const strictResult = await strictValidator.validate(bt, mockTools);
      const lenientResult = await lenientValidator.validate(bt, mockTools);

      // Both should be valid but strict might have warnings
      expect(strictResult.valid).toBe(true);
      expect(lenientResult.valid).toBe(true);
    });

    test('should skip tool validation when disabled', async () => {
      const noToolValidator = new BTValidator({ validateTools: false });

      const bt = {
        type: 'action',
        id: 'test',
        tool: 'nonExistentTool',
        inputs: {}
      };

      const result = await noToolValidator.validate(bt, mockTools);
      expect(result.valid).toBe(true); // Should pass without tool validation
    });

    test('should skip defaults when disabled', async () => {
      const noDefaultsValidator = new BTValidator({ applyDefaults: false });

      const bt = {
        type: 'sequence',
        // Missing ID - should fail without defaults
        children: [
          { type: 'action', tool: 'readFile', inputs: { path: 'test.txt' } }
        ]
      };

      const result = await noDefaultsValidator.validate(bt, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_NODE_ID')).toBe(true);
    });
  });

  describe('ValidationResult class', () => {
    test('should merge results correctly', () => {
      const result1 = new ValidationResult();
      result1.addError('ERROR1', 'First error');
      result1.addWarning('WARN1', 'First warning');

      const result2 = new ValidationResult();
      result2.addError('ERROR2', 'Second error');

      result1.merge(result2);

      expect(result1.valid).toBe(false);
      expect(result1.errors).toHaveLength(2);
      expect(result1.warnings).toHaveLength(1);
    });

    test('should format toString correctly', () => {
      const result = new ValidationResult();
      result.addError('ERROR1', 'Test error');
      result.addWarning('WARN1', 'Test warning');
      result.addWarning('WARN2', 'Another warning');

      const str = result.toString();
      expect(str).toBe('BT Validation: INVALID (1 errors, 2 warnings)');
    });
  });
});