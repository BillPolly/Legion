/**
 * YAML Serialization Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('YAML Serialization', () => {
  let YamlHandler;
  let yamlHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/YamlHandler.js');
    YamlHandler = module.YamlHandler;
    yamlHandler = new YamlHandler();
  });

  describe('Basic Value Serialization', () => {
    test('should serialize simple values', () => {
      const node = {
        type: 'object',
        children: [
          { type: 'value', name: 'string_val', value: 'Hello World' },
          { type: 'value', name: 'number_val', value: 42 },
          { type: 'value', name: 'boolean_val', value: true },
          { type: 'value', name: 'null_val', value: null }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('string_val: Hello World');
      expect(yaml).toContain('number_val: 42');
      expect(yaml).toContain('boolean_val: true');
      expect(yaml).toContain('null_val: null');
    });

    test('should serialize strings with special characters', () => {
      const node = {
        type: 'object',
        children: [
          { type: 'value', name: 'colon_string', value: 'key: value' },
          { type: 'value', name: 'quote_string', value: 'He said "Hello"' },
          { type: 'value', name: 'multiline', value: 'Line 1\nLine 2\nLine 3' },
          { type: 'value', name: 'hash_string', value: 'This has # hash' }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('colon_string: "key: value"');
      expect(yaml).toContain('quote_string: "He said \\"Hello\\""');
      expect(yaml).toContain('hash_string: "This has # hash"');
    });

    test('should serialize numbers correctly', () => {
      const node = {
        type: 'object',
        children: [
          { type: 'value', name: 'integer', value: 42 },
          { type: 'value', name: 'float', value: 3.14159 },
          { type: 'value', name: 'negative', value: -17 },
          { type: 'value', name: 'zero', value: 0 },
          { type: 'value', name: 'scientific', value: 1.23e+10 }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('integer: 42');
      expect(yaml).toContain('float: 3.14159');
      expect(yaml).toContain('negative: -17');
      expect(yaml).toContain('zero: 0');
      expect(yaml).toContain('scientific: 12300000000');
    });
  });

  describe('Object Serialization', () => {
    test('should serialize nested objects', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'object',
            name: 'parent',
            children: [
              { type: 'value', name: 'child1', value: 'value1' },
              { type: 'value', name: 'child2', value: 'value2' },
              {
                type: 'object',
                name: 'nested',
                children: [
                  { type: 'value', name: 'deep', value: 'deep_value' }
                ]
              }
            ]
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('parent:');
      expect(yaml).toContain('  child1: value1');
      expect(yaml).toContain('  child2: value2');
      expect(yaml).toContain('  nested:');
      expect(yaml).toContain('    deep: deep_value');
    });

    test('should serialize empty objects', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'object',
            name: 'empty_obj',
            children: []
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('empty_obj: {}');
    });
  });

  describe('Array Serialization', () => {
    test('should serialize simple arrays', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'array',
            name: 'simple_array',
            children: [
              { type: 'value', name: '0', value: 'item1' },
              { type: 'value', name: '1', value: 'item2' },
              { type: 'value', name: '2', value: 'item3' }
            ]
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('simple_array:');
      expect(yaml).toContain('  - item1');
      expect(yaml).toContain('  - item2');
      expect(yaml).toContain('  - item3');
    });

    test('should serialize arrays with objects', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'array',
            name: 'object_array',
            children: [
              {
                type: 'object',
                name: '0',
                children: [
                  { type: 'value', name: 'name', value: 'John' },
                  { type: 'value', name: 'age', value: 30 }
                ]
              },
              {
                type: 'object',
                name: '1',
                children: [
                  { type: 'value', name: 'name', value: 'Jane' },
                  { type: 'value', name: 'age', value: 25 }
                ]
              }
            ]
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('object_array:');
      expect(yaml).toContain('  - name: John');
      expect(yaml).toContain('    age: 30');
      expect(yaml).toContain('  - name: Jane');
      expect(yaml).toContain('    age: 25');
    });

    test('should serialize nested arrays', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'array',
            name: 'nested_array',
            children: [
              {
                type: 'array',
                name: '0',
                children: [
                  { type: 'value', name: '0', value: 1 },
                  { type: 'value', name: '1', value: 2 }
                ]
              },
              {
                type: 'array',
                name: '1',
                children: [
                  { type: 'value', name: '0', value: 3 },
                  { type: 'value', name: '1', value: 4 }
                ]
              }
            ]
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('nested_array:');
      expect(yaml).toContain('  - - 1');
      expect(yaml).toContain('    - 2');
      expect(yaml).toContain('  - - 3');
      expect(yaml).toContain('    - 4');
    });

    test('should serialize empty arrays', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'array',
            name: 'empty_array',
            children: []
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('empty_array: []');
    });
  });

  describe('Special Formatting', () => {
    test('should serialize with flow style for compact arrays', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'array',
            name: 'compact_array',
            children: [
              { type: 'value', name: '0', value: 1 },
              { type: 'value', name: '1', value: 2 },
              { type: 'value', name: '2', value: 3 }
            ],
            metadata: { yamlStyle: 'flow' }
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('compact_array: [1, 2, 3]');
    });

    test('should serialize multiline strings with literal style', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'value',
            name: 'multiline_literal',
            value: 'Line 1\nLine 2\nLine 3',
            metadata: { yamlStyle: '|' }
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('multiline_literal: |');
      expect(yaml).toContain('  Line 1');
      expect(yaml).toContain('  Line 2');
      expect(yaml).toContain('  Line 3');
    });

    test('should serialize multiline strings with folded style', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'value',
            name: 'multiline_folded',
            value: 'This is a long string that should be folded across multiple lines for better readability.',
            metadata: { yamlStyle: '>' }
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('multiline_folded: >');
      expect(yaml).toContain('  This is a long string');
    });
  });

  describe('Key Serialization', () => {
    test('should handle simple keys', () => {
      const node = {
        type: 'object',
        children: [
          { type: 'value', name: 'simple_key', value: 'value' },
          { type: 'value', name: 'key_with_underscore', value: 'value' },
          { type: 'value', name: 'key-with-dash', value: 'value' }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('simple_key: value');
      expect(yaml).toContain('key_with_underscore: value');
      expect(yaml).toContain('key-with-dash: value');
    });

    test('should quote keys with special characters', () => {
      const node = {
        type: 'object',
        children: [
          { type: 'value', name: 'key with spaces', value: 'value' },
          { type: 'value', name: 'key:with:colons', value: 'value' },
          { type: 'value', name: 'key#with#hash', value: 'value' },
          { type: 'value', name: 'key"with"quotes', value: 'value' }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('"key with spaces": value');
      expect(yaml).toContain('"key:with:colons": value');
      expect(yaml).toContain('"key#with#hash": value');
      expect(yaml).toContain('"key\\"with\\"quotes": value');
    });

    test('should handle numeric keys', () => {
      const node = {
        type: 'object',
        children: [
          { type: 'value', name: '123', value: 'numeric key' },
          { type: 'value', name: '0', value: 'zero key' },
          { type: 'value', name: '3.14', value: 'float key' }
        ]
      };
      
      const yaml = yamlHandler.serialize(node);
      
      expect(yaml).toContain('"123": numeric key');
      expect(yaml).toContain('"0": zero key');
      expect(yaml).toContain('"3.14": float key');
    });
  });

  describe('Indentation Options', () => {
    test('should serialize with custom indentation', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'object',
            name: 'parent',
            children: [
              { type: 'value', name: 'child', value: 'value' }
            ]
          }
        ]
      };
      
      const yaml2spaces = yamlHandler.serialize(node, { indent: '  ' });
      const yaml4spaces = yamlHandler.serialize(node, { indent: '    ' });
      const yamlTab = yamlHandler.serialize(node, { indent: '\t' });
      
      expect(yaml2spaces).toContain('  child: value');
      expect(yaml4spaces).toContain('    child: value');
      expect(yamlTab).toContain('\tchild: value');
    });

    test('should handle deep nesting with proper indentation', () => {
      const node = {
        type: 'object',
        children: [
          {
            type: 'object',
            name: 'level1',
            children: [
              {
                type: 'object',
                name: 'level2',
                children: [
                  {
                    type: 'object',
                    name: 'level3',
                    children: [
                      { type: 'value', name: 'deep_value', value: 'found' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const yaml = yamlHandler.serialize(node, { indent: '  ' });
      
      expect(yaml).toContain('level1:');
      expect(yaml).toContain('  level2:');
      expect(yaml).toContain('    level3:');
      expect(yaml).toContain('      deep_value: found');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid node types', () => {
      const node = {
        type: 'unknown',
        name: 'test'
      };
      
      expect(() => yamlHandler.serialize(node)).toThrow();
    });

    test('should handle circular references', () => {
      const parent = {
        type: 'object',
        name: 'parent',
        children: []
      };
      
      const child = {
        type: 'object',
        name: 'child',
        children: [parent] // Circular reference
      };
      
      parent.children = [child];
      
      expect(() => yamlHandler.serialize(parent)).toThrow();
    });

    test('should handle missing required properties', () => {
      const node = {
        // Missing type
        name: 'test',
        children: []
      };
      
      expect(() => yamlHandler.serialize(node)).toThrow();
    });
  });

  describe('Round-trip Serialization', () => {
    test('should maintain data through parse-serialize cycle', () => {
      const originalYaml = `
name: John Doe
age: 30
active: true
scores: [85, 92, 78]
address:
  street: 123 Main St
  city: Springfield
  zip: "12345"
      `.trim();
      
      const parsed = yamlHandler.parse(originalYaml);
      const serialized = yamlHandler.serialize(parsed);
      const reparsed = yamlHandler.parse(serialized);
      
      expect(reparsed.children.find(child => child.name === 'name').value).toBe('John Doe');
      expect(reparsed.children.find(child => child.name === 'age').value).toBe(30);
      expect(reparsed.children.find(child => child.name === 'active').value).toBe(true);
      
      const scoresChild = reparsed.children.find(child => child.name === 'scores');
      expect(scoresChild.type).toBe('array');
      expect(scoresChild.children).toHaveLength(3);
      
      const addressChild = reparsed.children.find(child => child.name === 'address');
      expect(addressChild.type).toBe('object');
      expect(addressChild.children).toHaveLength(3);
    });
  });
});