/**
 * Unit tests for GlobTool
 */

import { GlobTool } from '../../../src/search-navigation/GlobTool.js';
import { 
  createTestDirectory,
  TEST_TEMP_DIR
} from '../../setup.js';
import {
  assertSuccess,
  assertFailure
} from '../../utils/TestUtils.js';

describe('GlobTool', () => {
  let globTool;

  beforeEach(() => {
    globTool = new GlobTool();
  });

  describe('Pattern Matching', () => {
    test('should find files by extension pattern', async () => {
      await createTestDirectory('glob-test', {
        'file1.js': 'content',
        'file2.js': 'content',
        'file3.txt': 'content',
        'nested': {
          'file4.js': 'content'
        }
      });

      const result = await globTool.execute({
        pattern: '**/*.js',
        path: TEST_TEMP_DIR
      });
      const data = assertSuccess(result);

      expect(data.total_matches).toBe(3);
      expect(data.matches.some(m => m.relative_path.includes('file1.js'))).toBe(true);
      expect(data.matches.some(m => m.relative_path.includes('nested/file4.js'))).toBe(true);
    });

    test('should ignore specified patterns', async () => {
      await createTestDirectory('ignore-test', {
        'wanted.js': 'content',
        'ignored.js': 'content',
        'node_modules': {
          'lib.js': 'content'
        }
      });

      const result = await globTool.execute({
        pattern: '**/*.js',
        path: TEST_TEMP_DIR,
        ignore: ['**/ignored.js']
      });
      const data = assertSuccess(result);

      expect(data.matches.some(m => m.relative_path.includes('wanted.js'))).toBe(true);
      expect(data.matches.some(m => m.relative_path.includes('ignored.js'))).toBe(false);
      expect(data.matches.some(m => m.relative_path.includes('node_modules'))).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should fail when directory does not exist', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: '/nonexistent/dir'
      });

      const error = assertFailure(result, 'RESOURCE_NOT_FOUND');
      expect(error.message).toContain('not found');
    });
  });

  describe('Tool Metadata', () => {
    test('should provide correct metadata', () => {
      const metadata = globTool.getMetadata();
      
      expect(metadata.name).toBe('Glob');
      expect(metadata.description).toContain('pattern matching');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.inputSchema.properties).toBeDefined();
      expect(metadata.inputSchema.properties.pattern).toBeDefined();
      expect(metadata.inputSchema.required).toContain('pattern');
      expect(metadata.outputSchema).toBeDefined();
    });
  });
});