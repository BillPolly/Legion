/**
 * Unit tests for ReadTool
 */

import { ReadTool } from '../../../src/file-operations/ReadTool.js';
import { 
  createTestFile,
  createTestNotebook,
  TEST_TEMP_DIR
} from '../../setup.js';
import {
  assertSuccess,
  assertFailure,
  validateToolResult
} from '../../utils/TestUtils.js';
import path from 'path';

describe('ReadTool', () => {
  let readTool;

  beforeEach(() => {
    readTool = new ReadTool();
  });

  describe('Basic File Reading', () => {
    test('should read text file successfully', async () => {
      const content = 'Hello, World!\nThis is a test file.';
      const filePath = await createTestFile('test.txt', content);

      const result = await readTool.execute({ file_path: filePath });
      const data = assertSuccess(result);

      expect(data.content).toBe(content);
      expect(data.file_path).toBe(filePath);
      expect(data.size).toBe(content.length);
      expect(data.encoding).toBe('utf8');
    });

    test('should read file with line limit', async () => {
      const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      const content = lines.join('\n');
      const filePath = await createTestFile('multiline.txt', content);

      const result = await readTool.execute({ 
        file_path: filePath,
        limit: 3
      });
      const data = assertSuccess(result);

      const resultLines = data.content.split('\n');
      expect(resultLines).toHaveLength(3);
      expect(resultLines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    test('should read file with offset', async () => {
      const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      const content = lines.join('\n');
      const filePath = await createTestFile('offset.txt', content);

      const result = await readTool.execute({ 
        file_path: filePath,
        offset: 2,
        limit: 2
      });
      const data = assertSuccess(result);

      const resultLines = data.content.split('\n');
      expect(resultLines).toHaveLength(2);
      expect(resultLines).toEqual(['Line 3', 'Line 4']);
    });
  });

  describe('Special File Types', () => {
    test('should read Jupyter notebook', async () => {
      const cells = [
        {
          cell_type: 'code',
          source: ['import numpy as np']
        },
        {
          cell_type: 'markdown',
          source: ['# Title']
        }
      ];
      const notebookPath = await createTestNotebook('test.ipynb', cells);

      const result = await readTool.execute({ file_path: notebookPath });
      const data = assertSuccess(result);

      expect(data.content).toContain('import numpy as np');
      expect(data.content).toContain('# Title');
      expect(data.metadata).toBeDefined();
      expect(data.metadata.type).toBe('notebook');
    });

    test('should read binary file as base64', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      const filePath = path.join(TEST_TEMP_DIR, 'test.png');
      const fs = await import('fs');
      await fs.promises.writeFile(filePath, binaryContent);

      const result = await readTool.execute({ file_path: filePath });
      const data = assertSuccess(result);

      expect(data.encoding).toBe('base64');
      expect(typeof data.content).toBe('string');
      expect(data.metadata.type).toBe('binary');
    });
  });

  describe('Error Handling', () => {
    test('should fail when file does not exist', async () => {
      const result = await readTool.execute({ 
        file_path: '/nonexistent/file.txt' 
      });
      
      const error = assertFailure(result, 'RESOURCE_NOT_FOUND');
      expect(error.message).toContain('not found');
    });

    test('should fail when file_path is missing', async () => {
      const result = await readTool.execute({});
      
      const error = assertFailure(result, 'EXECUTION_ERROR');
      expect(error.errorMessage || error.message).toContain('file_path');
    });

    test('should fail when trying to read a directory', async () => {
      const result = await readTool.execute({ 
        file_path: TEST_TEMP_DIR 
      });
      
      const error = assertFailure(result, 'INVALID_PARAMETER');
      expect(error.message).toContain('directory');
    });

    test('should fail when offset is negative', async () => {
      const filePath = await createTestFile('test.txt', 'content');
      
      const result = await readTool.execute({ 
        file_path: filePath,
        offset: -1
      });
      
      const error = assertFailure(result, 'EXECUTION_ERROR');
      expect(error.errorMessage || error.message).toContain('greater than or equal to 0');
    });

    test('should fail when limit is zero or negative', async () => {
      const filePath = await createTestFile('test.txt', 'content');
      
      const result = await readTool.execute({ 
        file_path: filePath,
        limit: 0
      });
      
      const error = assertFailure(result, 'EXECUTION_ERROR');
      expect(error.errorMessage || error.message).toContain('greater than 0');
    });
  });

  describe('Tool Metadata', () => {
    test('should provide correct metadata', () => {
      const metadata = readTool.getMetadata();
      
      expect(metadata.name).toBe('Read');
      expect(metadata.description).toContain('Read files');
      expect(metadata.input).toBeDefined();
      expect(metadata.input.file_path).toBeDefined();
      expect(metadata.input.file_path.required).toBe(true);
      expect(metadata.output).toBeDefined();
    });
  });
});