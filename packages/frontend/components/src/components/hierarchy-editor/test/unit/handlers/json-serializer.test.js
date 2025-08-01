/**
 * JSON Serializer Tests
 */
import { createTestNode, createTestHierarchy } from '../../test-helpers.js';

describe('JSON Serializer', () => {
  let JsonHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/JsonHandler.js');
    JsonHandler = module.JsonHandler;
  });

  describe('Serializing Objects', () => {
    test('should serialize empty object', () => {
      const handler = new JsonHandler();
      const node = createTestNode('object', 'root', null);
      
      const result = handler.serialize(node);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual({});
    });

    test('should serialize object with primitive values', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      
      // Add child nodes
      const nameNode = createTestNode('value', 'name', 'John');
      const ageNode = createTestNode('value', 'age', 30);
      const activeNode = createTestNode('value', 'active', true);
      
      nameNode.parent = root;
      ageNode.parent = root;
      activeNode.parent = root;
      root.children = [nameNode, ageNode, activeNode];
      
      const result = handler.serialize(root);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual({
        name: 'John',
        age: 30,
        active: true
      });
    });

    test('should serialize object with null values', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      
      const nullNode = createTestNode('value', 'nullValue', null);
      nullNode.parent = root;
      root.children = [nullNode];
      
      const result = handler.serialize(root);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual({
        nullValue: null
      });
    });

    test('should handle special characters in keys and values', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      
      const spaceKeyNode = createTestNode('value', 'key with spaces', 'value with spaces');
      const specialValueNode = createTestNode('value', 'special', 'value\nwith\nnewlines\t\rand "quotes"');
      
      spaceKeyNode.parent = root;
      specialValueNode.parent = root;
      root.children = [spaceKeyNode, specialValueNode];
      
      const result = handler.serialize(root);
      const parsed = JSON.parse(result);
      
      expect(parsed['key with spaces']).toBe('value with spaces');
      expect(parsed.special).toBe('value\nwith\nnewlines\t\rand "quotes"');
    });
  });

  describe('Serializing Arrays', () => {
    test('should serialize empty array', () => {
      const handler = new JsonHandler();
      const node = createTestNode('array', 'root', null);
      
      const result = handler.serialize(node);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual([]);
    });

    test('should serialize array with primitive values', () => {
      const handler = new JsonHandler();
      const root = createTestNode('array', 'root', null);
      
      // Add array elements
      const item0 = createTestNode('value', '0', 'apple');
      const item1 = createTestNode('value', '1', 'banana');
      const item2 = createTestNode('value', '2', 'cherry');
      
      item0.parent = root;
      item1.parent = root;
      item2.parent = root;
      root.children = [item0, item1, item2];
      
      const result = handler.serialize(root);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual(['apple', 'banana', 'cherry']);
    });

    test('should serialize array with mixed types', () => {
      const handler = new JsonHandler();
      const root = createTestNode('array', 'root', null);
      
      const children = [
        createTestNode('value', '0', 42),
        createTestNode('value', '1', 'text'),
        createTestNode('value', '2', true),
        createTestNode('value', '3', null)
      ];
      
      children.forEach(child => {
        child.parent = root;
      });
      root.children = children;
      
      const result = handler.serialize(root);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual([42, 'text', true, null]);
    });

    test('should handle array indices correctly', () => {
      const handler = new JsonHandler();
      const root = createTestNode('array', 'root', null);
      
      // Create items with indices not in order
      const item5 = createTestNode('value', '5', 'fifth');
      const item1 = createTestNode('value', '1', 'second');
      const item3 = createTestNode('value', '3', 'fourth');
      const item0 = createTestNode('value', '0', 'first');
      
      [item5, item1, item3, item0].forEach(child => {
        child.parent = root;
      });
      root.children = [item5, item1, item3, item0]; // Intentionally out of order
      
      const result = handler.serialize(root);
      const parsed = JSON.parse(result);
      
      // Should be ordered correctly by index
      expect(parsed[0]).toBe('first');
      expect(parsed[1]).toBe('second');
      expect(parsed[3]).toBe('fourth');
      expect(parsed[5]).toBe('fifth');
      expect(parsed.length).toBe(6); // Sparse array with undefined at index 2 and 4
    });
  });

  describe('Maintaining Formatting', () => {
    test('should produce formatted JSON output', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      
      const nameNode = createTestNode('value', 'name', 'John');
      nameNode.parent = root;
      root.children = [nameNode];
      
      const result = handler.serialize(root);
      
      // Should be formatted with 2-space indentation
      expect(result).toContain('{\n  "name": "John"\n}');
    });

    test('should handle nested formatting correctly', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      
      const person = createTestNode('object', 'person', null);
      const name = createTestNode('value', 'name', 'Alice');
      
      name.parent = person;
      person.children = [name];
      person.parent = root;
      root.children = [person];
      
      const result = handler.serialize(root);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('{');
      expect(lines[1]).toBe('  "person": {');
      expect(lines[2]).toBe('    "name": "Alice"');
      expect(lines[3]).toBe('  }');
      expect(lines[4]).toBe('}');
    });

    test('should preserve data types in output', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      
      const children = [
        createTestNode('value', 'string', 'text'),
        createTestNode('value', 'number', 42),
        createTestNode('value', 'boolean', true),
        createTestNode('value', 'null', null)
      ];
      
      children.forEach(child => {
        child.parent = root;
      });
      root.children = children;
      
      const result = handler.serialize(root);
      const parsed = JSON.parse(result);
      
      expect(typeof parsed.string).toBe('string');
      expect(typeof parsed.number).toBe('number');
      expect(typeof parsed.boolean).toBe('boolean');
      expect(parsed.null).toBeNull();
    });
  });

  describe('Round-trip Conversion', () => {
    test('should handle simple round-trip conversion', () => {
      const originalData = {
        name: 'John',
        age: 30,
        active: true
      };
      
      const handler = new JsonHandler();
      
      // Parse to hierarchy
      const parsed = handler.parse(JSON.stringify(originalData));
      
      // Serialize back to JSON
      const serialized = handler.serialize(parsed);
      const result = JSON.parse(serialized);
      
      expect(result).toEqual(originalData);
    });

    test('should handle complex round-trip conversion', () => {
      const originalData = {
        users: [
          {
            name: 'Alice',
            profile: {
              age: 28,
              preferences: ['reading', 'coding']
            }
          },
          {
            name: 'Bob',
            profile: {
              age: 35,
              preferences: ['gaming', 'music']
            }
          }
        ],
        settings: {
          theme: 'dark',
          notifications: true
        }
      };
      
      const handler = new JsonHandler();
      
      const parsed = handler.parse(JSON.stringify(originalData));
      const serialized = handler.serialize(parsed);
      const result = JSON.parse(serialized);
      
      expect(result).toEqual(originalData);
    });

    test('should preserve array order in round-trip', () => {
      const originalData = ['first', 'second', 'third', 'fourth'];
      
      const handler = new JsonHandler();
      
      const parsed = handler.parse(JSON.stringify(originalData));
      const serialized = handler.serialize(parsed);
      const result = JSON.parse(serialized);
      
      expect(result).toEqual(originalData);
    });

    test('should handle edge cases in round-trip', () => {
      const originalData = {
        empty: {},
        emptyArray: [],
        nullValue: null,
        emptyString: '',
        zero: 0,
        false: false
      };
      
      const handler = new JsonHandler();
      
      const parsed = handler.parse(JSON.stringify(originalData));
      const serialized = handler.serialize(parsed);
      const result = JSON.parse(serialized);
      
      expect(result).toEqual(originalData);
    });

    test('should maintain node relationships after round-trip', () => {
      const originalData = { parent: { child: 'value' } };
      
      const handler = new JsonHandler();
      const parsed = handler.parse(JSON.stringify(originalData));
      
      // Check parent-child relationships exist
      const parent = parsed.children[0]; // 'parent' node
      const child = parent.children[0];  // 'child' node
      
      expect(child.parent).toBe(parent);
      expect(parent.parent).toBe(parsed);
      
      // Serialize and verify result is correct
      const serialized = handler.serialize(parsed);
      const result = JSON.parse(serialized);
      expect(result).toEqual(originalData);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for null node', () => {
      const handler = new JsonHandler();
      
      expect(() => handler.serialize(null)).toThrow('Node is required for serialization');
    });

    test('should throw error for undefined node', () => {
      const handler = new JsonHandler();
      
      expect(() => handler.serialize(undefined)).toThrow('Node is required for serialization');
    });

    test('should throw error for unknown node type', () => {
      const handler = new JsonHandler();
      const invalidNode = createTestNode('unknown', 'test', 'value');
      invalidNode.type = 'unknown';
      
      expect(() => handler.serialize(invalidNode)).toThrow('Unknown node type: unknown');
    });

    test('should handle malformed hierarchy gracefully', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      
      // Create child without proper parent reference
      const orphanChild = createTestNode('value', 'orphan', 'value');
      // Don't set parent reference
      root.children = [orphanChild];
      
      // Should still serialize successfully
      expect(() => handler.serialize(root)).not.toThrow();
    });

    test('should handle circular references gracefully', () => {
      const handler = new JsonHandler();
      const root = createTestNode('object', 'root', null);
      const child = createTestNode('object', 'child', null);
      
      // Create circular reference
      child.parent = root;
      root.children = [child];
      child.children = [root]; // Circular!
      
      // JSON.stringify should handle this with error
      expect(() => handler.serialize(root)).toThrow();
    });
  });
});