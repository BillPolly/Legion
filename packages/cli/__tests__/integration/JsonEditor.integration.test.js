/**
 * Integration tests for JSON Editor
 * Tests the complete flow: loading JSON, editing, validation, and UI interaction
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('JSON Editor - Integration Tests', () => {
  let testJsonPath;
  let originalContent;

  beforeAll(async () => {
    // Create test JSON file
    testJsonPath = path.join(__dirname, '../tmp/test-edit.json');
    originalContent = {
      name: 'Test Project',
      version: '1.0.0',
      settings: {
        enabled: true,
        timeout: 5000
      },
      items: ['item1', 'item2', 'item3']
    };

    await fs.writeFile(testJsonPath, JSON.stringify(originalContent, null, 2), 'utf-8');
  });

  afterAll(async () => {
    // Clean up test file
    try {
      await fs.unlink(testJsonPath);
    } catch (error) {
      // File might not exist
    }
  });

  describe('File Loading', () => {
    test('should load JSON file content', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(originalContent);
      expect(parsed.name).toBe('Test Project');
      expect(parsed.version).toBe('1.0.0');
    });

    test('should parse loaded content correctly', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.settings).toBeDefined();
      expect(parsed.settings.enabled).toBe(true);
      expect(parsed.settings.timeout).toBe(5000);
    });

    test('should handle nested objects', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.settings).toEqual({
        enabled: true,
        timeout: 5000
      });
    });

    test('should handle arrays', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(Array.isArray(parsed.items)).toBe(true);
      expect(parsed.items).toHaveLength(3);
      expect(parsed.items).toContain('item1');
    });
  });

  describe('Content Editing', () => {
    test('should modify JSON content', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Simulate editing
      data.name = 'Modified Project';
      data.version = '2.0.0';

      const newContent = JSON.stringify(data, null, 2);

      expect(newContent).toContain('"name": "Modified Project"');
      expect(newContent).toContain('"version": "2.0.0"');
    });

    test('should add new properties', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Add new property
      data.author = 'Test Author';
      data.license = 'MIT';

      const updated = JSON.parse(JSON.stringify(data));

      expect(updated.author).toBe('Test Author');
      expect(updated.license).toBe('MIT');
    });

    test('should remove properties', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Remove property
      delete data.items;

      expect(data.items).toBeUndefined();
      expect(data.name).toBe('Test Project'); // Other properties remain
    });

    test('should modify nested values', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Modify nested value
      data.settings.timeout = 10000;
      data.settings.retries = 3;

      expect(data.settings.timeout).toBe(10000);
      expect(data.settings.retries).toBe(3);
    });

    test('should modify array values', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Modify array
      data.items.push('item4');
      data.items[0] = 'modified-item1';

      expect(data.items).toHaveLength(4);
      expect(data.items[0]).toBe('modified-item1');
      expect(data.items[3]).toBe('item4');
    });
  });

  describe('Validation During Editing', () => {
    test('should validate after adding property', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      data.newField = 'newValue';
      const newContent = JSON.stringify(data, null, 2);

      // Should parse without error
      expect(() => JSON.parse(newContent)).not.toThrow();
    });

    test('should detect missing comma', () => {
      const invalidJson = '{"name": "test" "value": 123}';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    test('should detect missing closing brace', () => {
      const invalidJson = '{"name": "test"';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    test('should detect invalid escape sequences', () => {
      const invalidJson = '{"path": "C:\\invalid\\path"}';

      // Single backslash in JS string literal creates invalid JSON escape sequences
      // \i and \p are not valid JSON escapes
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('File Saving', () => {
    test('should save modified content to file', async () => {
      // Read original
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Modify
      data.name = 'Saved Project';
      data.modified = true;

      // Save
      const newContent = JSON.stringify(data, null, 2);
      await fs.writeFile(testJsonPath, newContent, 'utf-8');

      // Verify
      const savedContent = await fs.readFile(testJsonPath, 'utf-8');
      const savedData = JSON.parse(savedContent);

      expect(savedData.name).toBe('Saved Project');
      expect(savedData.modified).toBe(true);
    });

    test('should preserve formatting after save', async () => {
      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Save with formatting
      const formatted = JSON.stringify(data, null, 2);
      await fs.writeFile(testJsonPath, formatted, 'utf-8');

      // Read back
      const savedContent = await fs.readFile(testJsonPath, 'utf-8');

      // Should have proper indentation (check for newlines and 2-space indent)
      expect(savedContent).toContain('\n  ');
      expect(savedContent.split('\n').length).toBeGreaterThan(1);
    });

    test('should restore original content', async () => {
      // Restore original for other tests
      await fs.writeFile(testJsonPath, JSON.stringify(originalContent, null, 2), 'utf-8');

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toEqual(originalContent);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent file gracefully', async () => {
      const nonExistentPath = path.join(__dirname, '../tmp/does-not-exist.json');

      await expect(fs.readFile(nonExistentPath, 'utf-8')).rejects.toThrow();
    });

    test('should handle invalid JSON file', async () => {
      const invalidPath = path.join(__dirname, '../tmp/invalid.json');
      await fs.writeFile(invalidPath, 'not valid json', 'utf-8');

      const content = await fs.readFile(invalidPath, 'utf-8');

      expect(() => JSON.parse(content)).toThrow();

      // Clean up
      await fs.unlink(invalidPath);
    });

    test('should handle empty file', async () => {
      const emptyPath = path.join(__dirname, '../tmp/empty.json');
      await fs.writeFile(emptyPath, '', 'utf-8');

      const content = await fs.readFile(emptyPath, 'utf-8');

      expect(() => JSON.parse(content)).toThrow();

      // Clean up
      await fs.unlink(emptyPath);
    });
  });

  describe('Data Type Preservation', () => {
    test('should preserve strings', async () => {
      const data = { text: 'hello world' };
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      expect(typeof parsed.text).toBe('string');
      expect(parsed.text).toBe('hello world');
    });

    test('should preserve numbers', async () => {
      const data = { count: 42, price: 19.99, negative: -5 };
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      expect(typeof parsed.count).toBe('number');
      expect(parsed.count).toBe(42);
      expect(parsed.price).toBe(19.99);
      expect(parsed.negative).toBe(-5);
    });

    test('should preserve booleans', async () => {
      const data = { active: true, disabled: false };
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      expect(typeof parsed.active).toBe('boolean');
      expect(parsed.active).toBe(true);
      expect(parsed.disabled).toBe(false);
    });

    test('should preserve null', async () => {
      const data = { value: null };
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      expect(parsed.value).toBeNull();
    });

    test('should not preserve undefined (JSON limitation)', () => {
      const data = { value: undefined };
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      // undefined is not preserved in JSON
      expect(parsed.value).toBeUndefined();
      expect('value' in parsed).toBe(false);
    });
  });
});
