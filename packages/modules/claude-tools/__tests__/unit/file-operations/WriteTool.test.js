/**
 * Unit tests for WriteTool
 */

import { WriteTool } from '../../../src/file-operations/WriteTool.js';
import { 
  testFileExists,
  readTestFile,
  TEST_TEMP_DIR
} from '../../setup.js';
import {
  assertSuccess,
  assertFailure
} from '../../utils/TestUtils.js';
import path from 'path';
import { promises as fs } from 'fs';

describe('WriteTool', () => {
  let writeTool;

  beforeEach(() => {
    writeTool = new WriteTool();
  });

  describe('Basic File Writing', () => {
    test('should write new file successfully', async () => {
      const filePath = path.join(TEST_TEMP_DIR, 'new-file.txt');
      const content = 'Hello, World!';

      const result = await writeTool.execute({ 
        file_path: filePath,
        content: content
      });
      const data = assertSuccess(result);

      expect(data.file_path).toBe(filePath);
      expect(data.bytes_written).toBe(content.length);
      expect(data.created).toBe(true);

      // Verify file was actually written
      const exists = await testFileExists('new-file.txt');
      expect(exists).toBe(true);
      
      const readContent = await readTestFile('new-file.txt');
      expect(readContent).toBe(content);
    });

    test('should overwrite existing file', async () => {
      const filePath = path.join(TEST_TEMP_DIR, 'existing.txt');
      
      // Create initial file
      await fs.writeFile(filePath, 'Original content');
      
      const newContent = 'New content';
      const result = await writeTool.execute({ 
        file_path: filePath,
        content: newContent
      });
      const data = assertSuccess(result);

      expect(data.created).toBe(false);
      expect(data.bytes_written).toBe(newContent.length);

      const readContent = await readTestFile('existing.txt');
      expect(readContent).toBe(newContent);
    });

    test('should write empty file', async () => {
      const filePath = path.join(TEST_TEMP_DIR, 'empty.txt');
      
      const result = await writeTool.execute({ 
        file_path: filePath,
        content: ''
      });
      const data = assertSuccess(result);

      expect(data.bytes_written).toBe(0);
      expect(data.created).toBe(true);

      const exists = await testFileExists('empty.txt');
      expect(exists).toBe(true);
    });

    test('should write large content', async () => {
      const filePath = path.join(TEST_TEMP_DIR, 'large.txt');
      const content = 'x'.repeat(100000); // 100KB

      const result = await writeTool.execute({ 
        file_path: filePath,
        content: content
      });
      const data = assertSuccess(result);

      expect(data.bytes_written).toBe(100000);
      
      const readContent = await readTestFile('large.txt');
      expect(readContent.length).toBe(100000);
    });

    test('should handle special characters and Unicode', async () => {
      const filePath = path.join(TEST_TEMP_DIR, 'unicode.txt');
      const content = '你好世界 🌍 مرحبا بالعالم\n\t"Special" & <chars>';

      const result = await writeTool.execute({ 
        file_path: filePath,
        content: content
      });
      const data = assertSuccess(result);

      const readContent = await readTestFile('unicode.txt');
      expect(readContent).toBe(content);
    });

    test('should create nested directories if they do not exist', async () => {
      const filePath = path.join(TEST_TEMP_DIR, 'nested/deep/dir/file.txt');
      const content = 'Nested file content';

      const result = await writeTool.execute({ 
        file_path: filePath,
        content: content
      });
      const data = assertSuccess(result);

      expect(data.created).toBe(true);
      
      // Verify file and directories were created
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('Binary Content', () => {
    test('should write Buffer content', async () => {
      const filePath = path.join(TEST_TEMP_DIR, 'binary.bin');
      const content = Buffer.from([0x89, 0x50, 0x4E, 0x47]);

      const result = await writeTool.execute({ 
        file_path: filePath,
        content: content
      });
      const data = assertSuccess(result);

      expect(data.bytes_written).toBe(4);
      
      const readContent = await fs.readFile(filePath);
      expect(readContent.equals(content)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should fail when file_path is missing', async () => {
      const result = await writeTool.execute({ 
        content: 'test'
      });
      
      const error = assertFailure(result, 'EXECUTION_ERROR');
      expect(error.errorMessage || error.message).toContain('file_path');
    });

    test('should fail when content is missing', async () => {
      const result = await writeTool.execute({ 
        file_path: '/tmp/test.txt'
      });
      
      const error = assertFailure(result, 'EXECUTION_ERROR');
      expect(error.errorMessage || error.message).toContain('content');
    });

    test('should fail when file_path is not a string', async () => {
      const result = await writeTool.execute({ 
        file_path: 123,
        content: 'test'
      });
      
      const error = assertFailure(result, 'EXECUTION_ERROR');
      expect(error.errorMessage || error.message).toContain('string');
    });

    test('should fail when trying to write to a directory path', async () => {
      const result = await writeTool.execute({ 
        file_path: TEST_TEMP_DIR,
        content: 'test'
      });
      
      const error = assertFailure(result, 'INVALID_PARAMETER');
      expect(error.message).toContain('directory');
    });

    test('should handle permission denied errors', async () => {
      if (process.platform !== 'win32') {
        const dirPath = path.join(TEST_TEMP_DIR, 'no-write');
        await fs.mkdir(dirPath, { mode: 0o555 }); // Read-only directory

        const result = await writeTool.execute({ 
          file_path: path.join(dirPath, 'file.txt'),
          content: 'test'
        });
        
        const error = assertFailure(result, 'PERMISSION_DENIED');
        expect(error.message).toContain('Permission denied');

        // Cleanup
        await fs.chmod(dirPath, 0o755);
      }
    });
  });

  describe('Tool Metadata', () => {
    test('should provide correct metadata', () => {
      const metadata = writeTool.getMetadata();
      
      expect(metadata.name).toBe('Write');
      expect(metadata.description).toContain('Write');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.inputSchema.properties).toBeDefined();
      expect(metadata.inputSchema.properties.file_path).toBeDefined();
      expect(metadata.inputSchema.properties.content).toBeDefined();
      expect(metadata.inputSchema.required).toContain('file_path');
      expect(metadata.inputSchema.required).toContain('content');
      expect(metadata.outputSchema).toBeDefined();
    });
  });
});