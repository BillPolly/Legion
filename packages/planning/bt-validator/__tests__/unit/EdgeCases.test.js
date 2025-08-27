/**
 * Edge case tests for BTValidator
 * Tests unusual, boundary, and error conditions
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BTValidator } from '../../src/BTValidator.js';

describe('BTValidator Edge Cases', () => {
  let validator;

  beforeEach(() => {
    validator = new BTValidator({
      strictMode: true,
      validateTools: false, // Disable tool validation for edge cases
      applyDefaults: true
    });
  });

  describe('Empty and Null Structures', () => {
    test('should handle empty BT object', async () => {
      const bt = {};
      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle null BT', async () => {
      const bt = null;
      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      // With applyDefaults=true, this will throw and be caught as VALIDATION_ERROR
      expect(result.errors.some(e => 
        e.type === 'INVALID_BT_STRUCTURE' || e.type === 'VALIDATION_ERROR'
      )).toBe(true);
    });

    test('should handle undefined BT', async () => {
      const bt = undefined;
      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      // With applyDefaults=true, this will throw and be caught as VALIDATION_ERROR
      expect(result.errors.some(e => 
        e.type === 'INVALID_BT_STRUCTURE' || e.type === 'VALIDATION_ERROR'
      )).toBe(true);
    });

    test('should handle empty children array', async () => {
      const bt = {
        type: 'sequence',
        id: 'empty-seq',
        children: []
      };
      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_CHILDREN')).toBe(true);
    });

    test('should handle null children', async () => {
      const bt = {
        type: 'sequence',
        id: 'null-children',
        children: null
      };
      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_CHILDREN')).toBe(true);
    });

    test('should handle empty legacy array', async () => {
      const bt = [];
      const result = await validator.validate(bt, []);
      // Empty array becomes empty sequence which is invalid (no children)
      expect(result.valid).toBe(false);
    });
  });

  describe('Deeply Nested Structures', () => {
    test('should handle 10+ level deep nesting', async () => {
      // Create a deeply nested structure
      let deepBT = { type: 'action', id: 'leaf', tool: 'test', inputs: {} };
      for (let i = 9; i >= 0; i--) {
        deepBT = {
          type: 'sequence',
          id: `level-${i}`,
          children: [deepBT]
        };
      }

      const result = await validator.validate(deepBT, []);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle deeply nested selector chains', async () => {
      // Create a chain of selectors
      let bt = {
        type: 'selector',
        id: 'root',
        children: []
      };
      
      let current = bt;
      for (let i = 0; i < 15; i++) {
        const newSelector = {
          type: 'selector',
          id: `selector-${i}`,
          children: [
            { type: 'action', id: `action-${i}`, tool: 'test', inputs: {} }
          ]
        };
        current.children.push(newSelector);
        current = newSelector;
      }

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle deeply nested retry chains', async () => {
      let bt = { type: 'action', id: 'base', tool: 'test', inputs: {} };
      
      for (let i = 0; i < 10; i++) {
        bt = {
          type: 'retry',
          id: `retry-${i}`,
          maxRetries: 3,
          child: bt
        };
      }

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('Special Characters and IDs', () => {
    test('should handle special characters in IDs', async () => {
      const bt = {
        type: 'sequence',
        id: 'test-id_123.456:special@chars!',
        children: [
          { type: 'action', id: 'unicode-😀-id', tool: 'test', inputs: {} },
          { type: 'action', id: 'spaces in id', tool: 'test', inputs: {} },
          { type: 'action', id: 'tab\tid', tool: 'test', inputs: {} }
        ]
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle very long IDs', async () => {
      const longId = 'a'.repeat(1000);
      const bt = {
        type: 'action',
        id: longId,
        tool: 'test',
        inputs: {}
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle empty string ID', async () => {
      const bt = {
        type: 'action',
        id: '',
        tool: 'test',
        inputs: {}
      };

      const result = await validator.validate(bt, []);
      // Empty ID should still be valid (though not recommended)
      expect(result.valid).toBe(true);
    });

    test('should handle numeric IDs', async () => {
      const bt = {
        type: 'sequence',
        id: 123, // Numeric ID
        children: [
          { type: 'action', id: 456, tool: 'test', inputs: {} }
        ]
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('Malformed Inputs', () => {
    test('should handle string instead of BT object', async () => {
      const bt = "not a valid BT";
      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle number instead of BT object', async () => {
      const bt = 42;
      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle circular reference in BT', async () => {
      const bt = {
        type: 'sequence',
        id: 'circular',
        children: []
      };
      bt.children.push(bt); // Create circular reference

      const result = await validator.validate(bt, []);
      // Circular reference detection might not catch all cases
      expect(result.valid).toBe(false);
    });

    test('should handle non-array children', async () => {
      const bt = {
        type: 'sequence',
        id: 'bad-children',
        children: 'not an array'
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_CHILDREN')).toBe(true);
    });

    test('should handle non-object child in retry', async () => {
      const bt = {
        type: 'retry',
        id: 'bad-retry',
        child: 'not an object'
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(false);
    });
  });

  describe('Mixed Node Types', () => {
    test('should handle all node types in same level', async () => {
      const bt = {
        type: 'sequence',
        id: 'mixed',
        children: [
          { type: 'action', id: 'act1', tool: 'test', inputs: {} },
          {
            type: 'selector',
            id: 'sel1',
            children: [
              { type: 'action', id: 'act2', tool: 'test', inputs: {} }
            ]
          },
          {
            type: 'parallel',
            id: 'par1',
            children: [
              { type: 'action', id: 'act3', tool: 'test', inputs: {} }
            ]
          },
          {
            type: 'retry',
            id: 'ret1',
            child: { type: 'action', id: 'act4', tool: 'test', inputs: {} }
          },
          {
            type: 'condition',
            id: 'cond1',
            check: 'true'
          }
        ]
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle alternating node types', async () => {
      const bt = {
        type: 'sequence',
        id: 'root',
        children: [
          {
            type: 'selector',
            id: 's1',
            children: [
              {
                type: 'sequence',
                id: 's2',
                children: [
                  {
                    type: 'selector',
                    id: 's3',
                    children: [
                      { type: 'action', id: 'a1', tool: 'test', inputs: {} }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('Very Long Descriptions', () => {
    test('should handle very long descriptions', async () => {
      const longDescription = 'This is a very long description. '.repeat(1000);
      const bt = {
        type: 'action',
        id: 'long-desc',
        description: longDescription,
        tool: 'test',
        inputs: {}
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle descriptions with special characters', async () => {
      const bt = {
        type: 'action',
        id: 'special-desc',
        description: 'Description with\nnewlines\ttabs "quotes" \'apostrophes\' and unicode 🎉',
        tool: 'test',
        inputs: {}
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle maximum number of children', async () => {
      const children = [];
      for (let i = 0; i < 1000; i++) {
        children.push({
          type: 'action',
          id: `action-${i}`,
          tool: 'test',
          inputs: {}
        });
      }

      const bt = {
        type: 'parallel',
        id: 'many-children',
        children
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle single child in sequence', async () => {
      const bt = {
        type: 'sequence',
        id: 'single-child',
        children: [
          { type: 'action', id: 'only', tool: 'test', inputs: {} }
        ]
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle retry with maxRetries of 0', async () => {
      const bt = {
        type: 'retry',
        id: 'no-retry',
        maxRetries: 0,
        child: { type: 'action', id: 'act', tool: 'test', inputs: {} }
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });

    test('should handle very large maxRetries', async () => {
      const bt = {
        type: 'retry',
        id: 'many-retries',
        maxRetries: 999999,
        child: { type: 'action', id: 'act', tool: 'test', inputs: {} }
      };

      const result = await validator.validate(bt, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    test('should continue validation after encountering errors', async () => {
      const bt = {
        type: 'sequence',
        id: 'main',
        children: [
          { type: 'invalid', id: 'bad1' }, // Invalid type
          { type: 'action', id: 'good1', tool: 'test', inputs: {} },
          { type: 'action', id: 'good1', tool: 'test', inputs: {} }, // Duplicate ID
          { type: 'action', tool: 'test', inputs: {} }, // Missing ID (will be generated)
          { type: 'selector', id: 'empty' } // Missing children
        ]
      };

      const debugValidator = new BTValidator({ 
        validateTools: false, 
        debugMode: true 
      });
      const result = await debugValidator.validate(bt, []);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2); // Should find multiple errors
    });

    test('should handle exception during validation gracefully', async () => {
      // Create a BT that might cause an exception
      const bt = {
        type: 'sequence',
        id: 'test',
        children: [
          { 
            type: 'action', 
            id: null, // null ID might cause issues
            tool: undefined, // undefined tool
            inputs: null // null inputs
          }
        ]
      };

      const result = await validator.validate(bt, []);
      // Should handle gracefully and return validation result
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });
  });
});