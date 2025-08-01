/**
 * JSON Parser Tests
 */
import { createTestNode } from '../../test-helpers.js';

describe('JSON Parser', () => {
  let JsonHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/JsonHandler.js');
    JsonHandler = module.JsonHandler;
  });

  describe('Simple JSON Objects', () => {
    test('should parse empty object', () => {
      const handler = new JsonHandler();
      const result = handler.parse('{}');
      
      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.children.length).toBe(0);
      expect(result.value).toBeNull();
    });

    test('should parse object with string values', () => {
      const content = '{"name": "John", "city": "New York"}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('object');
      expect(result.children.length).toBe(2);
      
      const nameChild = result.children.find(child => child.name === 'name');
      expect(nameChild).toBeDefined();
      expect(nameChild.type).toBe('value');
      expect(nameChild.value).toBe('John');
      
      const cityChild = result.children.find(child => child.name === 'city');
      expect(cityChild).toBeDefined();
      expect(cityChild.type).toBe('value');
      expect(cityChild.value).toBe('New York');
    });

    test('should parse object with mixed value types', () => {
      const content = '{"name": "Alice", "age": 30, "active": true, "score": null}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('object');
      expect(result.children.length).toBe(4);
      
      const children = result.children.reduce((acc, child) => {
        acc[child.name] = child;
        return acc;
      }, {});
      
      expect(children.name.value).toBe('Alice');
      expect(children.name.type).toBe('value');
      
      expect(children.age.value).toBe(30);
      expect(children.age.type).toBe('value');
      
      expect(children.active.value).toBe(true);
      expect(children.active.type).toBe('value');
      
      expect(children.score.value).toBeNull();
      expect(children.score.type).toBe('value');
    });

    test('should handle special characters in keys and values', () => {
      const content = '{"key with spaces": "value with spaces", "key-with-dashes": "value\\nwith\\nnewlines"}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.children.length).toBe(2);
      
      const spaceChild = result.children.find(child => child.name === 'key with spaces');
      expect(spaceChild.value).toBe('value with spaces');
      
      const dashChild = result.children.find(child => child.name === 'key-with-dashes');
      expect(dashChild.value).toBe('value\nwith\nnewlines');
    });
  });

  describe('Array Parsing', () => {
    test('should parse empty array', () => {
      const handler = new JsonHandler();
      const result = handler.parse('[]');
      
      expect(result.type).toBe('array');
      expect(result.children.length).toBe(0);
      expect(result.value).toBeNull();
    });

    test('should parse array with primitive values', () => {
      const content = '["apple", "banana", "cherry"]';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('array');
      expect(result.children.length).toBe(3);
      
      expect(result.children[0].name).toBe('0');
      expect(result.children[0].value).toBe('apple');
      expect(result.children[1].name).toBe('1');
      expect(result.children[1].value).toBe('banana');
      expect(result.children[2].name).toBe('2');
      expect(result.children[2].value).toBe('cherry');
    });

    test('should parse array with mixed types', () => {
      const content = '[42, "text", true, null, 3.14]';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('array');
      expect(result.children.length).toBe(5);
      
      expect(result.children[0].value).toBe(42);
      expect(result.children[1].value).toBe('text');
      expect(result.children[2].value).toBe(true);
      expect(result.children[3].value).toBeNull();
      expect(result.children[4].value).toBe(3.14);
    });

    test('should handle array indices as names', () => {
      const content = '[10, 20, 30]';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      result.children.forEach((child, index) => {
        expect(child.name).toBe(index.toString());
        expect(child.type).toBe('value');
      });
    });
  });

  describe('Nested Structures', () => {
    test('should parse nested objects', () => {
      const content = '{"person": {"name": "John", "address": {"street": "123 Main St", "city": "Boston"}}}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('object');
      expect(result.children.length).toBe(1);
      
      const person = result.children[0];
      expect(person.name).toBe('person');
      expect(person.type).toBe('object');
      expect(person.children.length).toBe(2);
      
      const name = person.children.find(child => child.name === 'name');
      expect(name.value).toBe('John');
      
      const address = person.children.find(child => child.name === 'address');
      expect(address.type).toBe('object');
      expect(address.children.length).toBe(2);
      
      const street = address.children.find(child => child.name === 'street');
      expect(street.value).toBe('123 Main St');
      
      const city = address.children.find(child => child.name === 'city');
      expect(city.value).toBe('Boston');
    });

    test('should parse nested arrays', () => {
      const content = '[[1, 2], [3, 4], [5, 6]]';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('array');
      expect(result.children.length).toBe(3);
      
      result.children.forEach((child, index) => {
        expect(child.type).toBe('array');
        expect(child.name).toBe(index.toString());
        expect(child.children.length).toBe(2);
      });
      
      expect(result.children[0].children[0].value).toBe(1);
      expect(result.children[0].children[1].value).toBe(2);
      expect(result.children[1].children[0].value).toBe(3);
      expect(result.children[1].children[1].value).toBe(4);
    });

    test('should parse mixed nested structures', () => {
      const content = '{"users": [{"name": "Alice", "tags": ["admin", "user"]}, {"name": "Bob", "tags": ["user"]}]}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('object');
      const users = result.children[0];
      expect(users.name).toBe('users');
      expect(users.type).toBe('array');
      expect(users.children.length).toBe(2);
      
      const alice = users.children[0];
      expect(alice.type).toBe('object');
      const aliceName = alice.children.find(child => child.name === 'name');
      expect(aliceName.value).toBe('Alice');
      
      const aliceTags = alice.children.find(child => child.name === 'tags');
      expect(aliceTags.type).toBe('array');
      expect(aliceTags.children.length).toBe(2);
      expect(aliceTags.children[0].value).toBe('admin');
      expect(aliceTags.children[1].value).toBe('user');
    });

    test('should maintain parent-child relationships in nested structures', () => {
      const content = '{"level1": {"level2": {"level3": "deep"}}}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const level1 = result.children[0];
      expect(level1.parent).toBe(result);
      
      const level2 = level1.children[0];
      expect(level2.parent).toBe(level1);
      
      const level3 = level2.children[0];
      expect(level3.parent).toBe(level2);
      expect(level3.value).toBe('deep');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null values', () => {
      const content = '{"nullValue": null}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const nullChild = result.children[0];
      expect(nullChild.value).toBeNull();
      expect(nullChild.type).toBe('value');
    });

    test('should handle undefined as null', () => {
      // JSON doesn't support undefined, but we should handle it gracefully
      const content = '{"key": null}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const child = result.children[0];
      expect(child.value).toBeNull();
    });

    test('should handle empty strings', () => {
      const content = '{"empty": ""}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const child = result.children[0];
      expect(child.value).toBe('');
      expect(child.type).toBe('value');
    });

    test('should handle numeric edge cases', () => {
      const content = '{"zero": 0, "negative": -42, "float": 3.14159, "scientific": 1.23e-4}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const children = result.children.reduce((acc, child) => {
        acc[child.name] = child.value;
        return acc;
      }, {});
      
      expect(children.zero).toBe(0);
      expect(children.negative).toBe(-42);
      expect(children.float).toBeCloseTo(3.14159);
      expect(children.scientific).toBeCloseTo(0.000123);
    });

    test('should handle boolean values', () => {
      const content = '{"isTrue": true, "isFalse": false}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const children = result.children.reduce((acc, child) => {
        acc[child.name] = child.value;
        return acc;
      }, {});
      
      expect(children.isTrue).toBe(true);
      expect(children.isFalse).toBe(false);
    });

    test('should handle whitespace in JSON', () => {
      const content = `{
        "name": "John",
        "age": 30,
        "nested": {
          "key": "value"
        }
      }`;
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.type).toBe('object');
      expect(result.children.length).toBe(3);
    });

   test('should handle invalid JSON gracefully', () => {
      const handler = new JsonHandler();
      
      expect(() => handler.parse('{')).toThrow();
      expect(() => handler.parse('{"key": value}')).toThrow(); // Unquoted value
      expect(() => handler.parse('{"key": "value",}')).toThrow(); // Trailing comma
    });

    test('should handle empty or null input', () => {
      const handler = new JsonHandler();
      
      expect(() => handler.parse('')).toThrow();
      expect(() => handler.parse(null)).toThrow();
      expect(() => handler.parse(undefined)).toThrow();
    });
  });

  describe('Node ID Generation', () => {
    test('should generate unique IDs for all nodes', () => {
      const content = '{"a": {"b": {"c": "value"}}}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const ids = new Set();
      
      function collectIds(node) {
        ids.add(node.id);
        node.children.forEach(collectIds);
      }
      
      collectIds(result);
      
      // Should have 4 unique IDs: root, a, b, c
      expect(ids.size).toBe(4);
    });

    test('should assign proper node types', () => {
      const content = '{"obj": {}, "arr": [], "str": "text", "num": 42, "bool": true, "null": null}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      const typeMap = result.children.reduce((acc, child) => {
        acc[child.name] = child.type;
        return acc;
      }, {});
      
      expect(typeMap.obj).toBe('object');
      expect(typeMap.arr).toBe('array');
      expect(typeMap.str).toBe('value');
      expect(typeMap.num).toBe('value');
      expect(typeMap.bool).toBe('value');
      expect(typeMap.null).toBe('value');
    });

    test('should preserve JSON metadata', () => {
      const content = '{"key": "value"}';
      const handler = new JsonHandler();
      const result = handler.parse(content);
      
      expect(result.metadata).toHaveProperty('format');
      expect(result.metadata.format).toBe('json');
      expect(result.metadata).toHaveProperty('originalContent');
    });
  });
});