/**
 * Unit tests for EditTool
 */

import { EditTool } from '../../../src/file-operations/EditTool.js';
import { 
  createTestFile,
  readTestFile,
  TEST_TEMP_DIR
} from '../../setup.js';
import {
  assertSuccess,
  assertFailure
} from '../../utils/TestUtils.js';
import path from 'path';

describe('EditTool', () => {
  let editTool;

  beforeEach(() => {
    editTool = new EditTool();
  });

  describe('Basic String Replacement', () => {
    test('should replace single occurrence', async () => {
      const content = 'Hello World! This is a test.';
      const filePath = await createTestFile('test.txt', content);

      const result = await editTool.execute({
        file_path: filePath,
        old_string: 'World',
        new_string: 'Universe'
      });
      const data = assertSuccess(result);

      expect(data.replacements_made).toBe(1);
      expect(data.preview).toContain('Universe');

      const newContent = await readTestFile('test.txt');
      expect(newContent).toBe('Hello Universe! This is a test.');
    });

    test('should replace all occurrences when replace_all is true', async () => {
      const content = 'foo bar foo baz foo';
      const filePath = await createTestFile('multi.txt', content);

      const result = await editTool.execute({
        file_path: filePath,
        old_string: 'foo',
        new_string: 'qux',
        replace_all: true
      });
      const data = assertSuccess(result);

      expect(data.replacements_made).toBe(3);

      const newContent = await readTestFile('multi.txt');
      expect(newContent).toBe('qux bar qux baz qux');
    });

    test('should fail when string is not unique and replace_all is false', async () => {
      const content = 'foo bar foo baz';
      const filePath = await createTestFile('ambiguous.txt', content);

      const result = await editTool.execute({
        file_path: filePath,
        old_string: 'foo',
        new_string: 'qux',
        replace_all: false
      });

      const error = assertFailure(result, 'AMBIGUOUS_MATCH');
      expect(error.message).toContain('not unique');
      expect(error.details.occurrences).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should fail when file does not exist', async () => {
      const result = await editTool.execute({
        file_path: '/nonexistent/file.txt',
        old_string: 'old',
        new_string: 'new'
      });

      const error = assertFailure(result, 'RESOURCE_NOT_FOUND');
      expect(error.message).toContain('not found');
    });

    test('should fail when old_string is not found', async () => {
      const filePath = await createTestFile('test.txt', 'Hello World');

      const result = await editTool.execute({
        file_path: filePath,
        old_string: 'missing',
        new_string: 'replacement'
      });

      const error = assertFailure(result, 'NOT_FOUND');
      expect(error.message).toContain('String not found');
    });

    test('should fail when old_string and new_string are the same', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const result = await editTool.execute({
        file_path: filePath,
        old_string: 'same',
        new_string: 'same'
      });

      const error = assertFailure(result, 'INVALID_PARAMETER');
      expect(error.message).toContain('cannot be the same');
    });
  });

  describe('Tool Metadata', () => {
    test('should provide correct metadata', () => {
      const metadata = editTool.getMetadata();
      
      expect(metadata.name).toBe('Edit');
      expect(metadata.description).toContain('string replacements');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.inputSchema.properties).toBeDefined();
      expect(metadata.inputSchema.properties.file_path).toBeDefined();
      expect(metadata.inputSchema.properties.old_string).toBeDefined();
      expect(metadata.inputSchema.properties.new_string).toBeDefined();
      expect(metadata.inputSchema.properties.replace_all).toBeDefined();
      expect(metadata.inputSchema.required).toContain('file_path');
      expect(metadata.inputSchema.required).toContain('old_string');
      expect(metadata.inputSchema.required).toContain('new_string');
      expect(metadata.inputSchema.required).not.toContain('replace_all');
    });
  });
});