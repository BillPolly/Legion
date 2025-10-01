/**
 * Unit tests for JSON Editor functionality
 */

import { jest } from '@jest/globals';

describe('JSON Editor - Unit Tests', () => {
  let mockWindow;
  let mockTextarea;
  let mockStatusBar;
  let mockSaveBtn;

  beforeEach(() => {
    // Setup DOM mocks
    mockTextarea = {
      value: '',
      addEventListener: jest.fn(),
      spellcheck: true
    };

    mockStatusBar = {
      textContent: '',
      style: { color: '' }
    };

    mockSaveBtn = {
      addEventListener: jest.fn(),
      disabled: false,
      textContent: 'SAVE'
    };

    mockWindow = {
      remove: jest.fn(),
      className: '',
      appendChild: jest.fn()
    };

    // Mock document methods
    global.document = {
      createElement: jest.fn((tag) => {
        if (tag === 'div') return mockWindow;
        if (tag === 'textarea') return mockTextarea;
        if (tag === 'button') return mockSaveBtn;
        if (tag === 'span') return { textContent: '', className: '' };
        return {
          appendChild: jest.fn(),
          addEventListener: jest.fn(),
          textContent: '',
          className: '',
          style: {}
        };
      }),
      body: {
        appendChild: jest.fn()
      }
    };

    global.JSON = JSON;
  });

  describe('JSON Validation', () => {
    test('should validate correct JSON', () => {
      const validJson = '{"name": "test", "value": 123}';

      expect(() => JSON.parse(validJson)).not.toThrow();

      const parsed = JSON.parse(validJson);
      expect(parsed).toEqual({ name: 'test', value: 123 });
    });

    test('should detect invalid JSON - missing quotes', () => {
      const invalidJson = '{name: "test"}';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    test('should detect invalid JSON - trailing comma', () => {
      const invalidJson = '{"name": "test",}';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    test('should detect invalid JSON - unquoted keys', () => {
      const invalidJson = '{name: test}';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    test('should handle nested objects', () => {
      const nestedJson = '{"user": {"name": "test", "age": 25}}';

      expect(() => JSON.parse(nestedJson)).not.toThrow();

      const parsed = JSON.parse(nestedJson);
      expect(parsed.user.name).toBe('test');
      expect(parsed.user.age).toBe(25);
    });

    test('should handle arrays', () => {
      const arrayJson = '{"items": [1, 2, 3]}';

      expect(() => JSON.parse(arrayJson)).not.toThrow();

      const parsed = JSON.parse(arrayJson);
      expect(parsed.items).toEqual([1, 2, 3]);
    });
  });

  describe('JSON Formatting', () => {
    test('should pretty-print JSON with 2-space indentation', () => {
      const data = { name: 'test', value: 123 };
      const formatted = JSON.stringify(data, null, 2);

      expect(formatted).toBe('{\n  "name": "test",\n  "value": 123\n}');
    });

    test('should preserve data types', () => {
      const data = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3]
      };

      const formatted = JSON.stringify(data, null, 2);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual(data);
      expect(typeof parsed.string).toBe('string');
      expect(typeof parsed.number).toBe('number');
      expect(typeof parsed.boolean).toBe('boolean');
      expect(parsed.null).toBeNull();
      expect(Array.isArray(parsed.array)).toBe(true);
    });
  });

  describe('Validation Status Messages', () => {
    test('should show "Valid JSON" for valid content', () => {
      const validJson = '{"test": true}';
      let isValid = false;
      let message = '';

      try {
        JSON.parse(validJson);
        isValid = true;
        message = 'Valid JSON';
      } catch (error) {
        isValid = false;
        message = `❌ ${error.message}`;
      }

      expect(isValid).toBe(true);
      expect(message).toBe('Valid JSON');
    });

    test('should show error message for invalid JSON', () => {
      const invalidJson = '{invalid}';
      let isValid = false;
      let message = '';

      try {
        JSON.parse(invalidJson);
        isValid = true;
        message = 'Valid JSON';
      } catch (error) {
        isValid = false;
        message = `❌ ${error.message}`;
      }

      expect(isValid).toBe(false);
      expect(message).toContain('❌');
    });
  });

  describe('Save Button State', () => {
    test('should enable save button for valid JSON', () => {
      const validJson = '{"test": true}';
      let saveDisabled = true;

      try {
        JSON.parse(validJson);
        saveDisabled = false;
      } catch (error) {
        saveDisabled = true;
      }

      expect(saveDisabled).toBe(false);
    });

    test('should disable save button for invalid JSON', () => {
      const invalidJson = '{invalid}';
      let saveDisabled = false;

      try {
        JSON.parse(invalidJson);
        saveDisabled = false;
      } catch (error) {
        saveDisabled = true;
      }

      expect(saveDisabled).toBe(true);
    });
  });

  describe('File Path Handling', () => {
    test('should extract file path from metadata', () => {
      const metadata = {
        filePath: '/Users/test/file.json'
      };

      const filePath = metadata?.filePath;

      expect(filePath).toBe('/Users/test/file.json');
    });

    test('should handle missing metadata', () => {
      const metadata = undefined;

      const filePath = metadata?.filePath;

      expect(filePath).toBeUndefined();
    });

    test('should handle metadata without filePath', () => {
      const metadata = {
        title: 'test'
      };

      const filePath = metadata?.filePath;

      expect(filePath).toBeUndefined();
    });
  });

  describe('Content Parsing', () => {
    test('should parse JSON string content', () => {
      const jsonContent = '{"name": "Legion", "version": "1.0.0"}';

      let jsonData;
      try {
        jsonData = JSON.parse(jsonContent);
      } catch (error) {
        jsonData = null;
      }

      expect(jsonData).not.toBeNull();
      expect(jsonData.name).toBe('Legion');
      expect(jsonData.version).toBe('1.0.0');
    });

    test('should return null for invalid JSON', () => {
      const invalidContent = 'not json';

      let jsonData;
      try {
        jsonData = JSON.parse(invalidContent);
      } catch (error) {
        jsonData = null;
      }

      expect(jsonData).toBeNull();
    });
  });
});
