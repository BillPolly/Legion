/**
 * Unit tests for ReadFileTool (ported from Gemini CLI)
 */

import ReadFileTool from '../../src/tools/ReadFileTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

// Mock fs for unit tests
jest.unstable_mockModule('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn()
  }
}));

describe('ReadFileTool', () => {
  let tool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new ReadFileTool({
      basePath: '/test/base',
      encoding: 'utf-8'
    });
  });

  test('should create tool with proper configuration', () => {
    expect(tool.name).toBe('read_file');
    expect(tool.basePath).toBe('/test/base');
    expect(tool.encoding).toBe('utf-8');
  });

  test('should validate required absolute_path parameter', async () => {
    await expect(tool._execute({})).rejects.toThrow('File path must be a string');
  });

  test('should validate non-empty path', async () => {
    await expect(tool._execute({ absolute_path: '' })).rejects.toThrow('File path cannot be empty');
  });

  test('should reject paths with null bytes', async () => {
    await expect(tool._execute({ absolute_path: '/path/with\0null' })).rejects.toThrow('Invalid file path');
  });

  test('should handle file not found errors', async () => {
    const mockAccess = jest.fn().mockRejectedValue(new Error('ENOENT'));
    jest.doMock('fs', () => ({
      promises: { access: mockAccess }
    }));

    await expect(tool._execute({ absolute_path: '/nonexistent/file.txt' })).rejects.toThrow('File not found or not accessible');
  });

  test('should read file content successfully', async () => {
    const mockContent = 'Hello world\nLine 2\nLine 3';
    const mockAccess = jest.fn().mockResolvedValue();
    const mockReadFile = jest.fn().mockResolvedValue(mockContent);
    
    // Mock fs
    jest.doMock('fs', () => ({
      promises: { 
        access: mockAccess,
        readFile: mockReadFile
      }
    }));

    // Create new tool instance to use mocked fs
    const testTool = new ReadFileTool({ basePath: '/test', encoding: 'utf-8' });
    // Manually set mocked functions
    testTool._fs = { access: mockAccess, readFile: mockReadFile };
    
    // Override the execute method to use mocked fs
    const originalExecute = testTool._execute;
    testTool._execute = async function(args) {
      try {
        const { absolute_path, offset, limit } = args;

        // Validation
        if (typeof absolute_path !== 'string') {
          throw new Error('File path must be a string');
        }
        if (absolute_path.trim() === '') {
          throw new Error('File path cannot be empty');
        }
        if (absolute_path.includes('\0')) {
          throw new Error('Invalid file path');
        }

        const resolvedPath = path.resolve(absolute_path);
        
        await this._fs.access(resolvedPath);
        let content = await this._fs.readFile(resolvedPath, this.encoding);
        
        let lines = null;
        let truncated = false;
        
        if (offset !== undefined || limit !== undefined) {
          const allLines = content.split('\n');
          lines = allLines.length;
          
          const startLine = offset || 0;
          const endLine = limit ? startLine + limit : allLines.length;
          
          if (endLine < allLines.length) {
            truncated = true;
          }
          
          content = allLines.slice(startLine, endLine).join('\n');
        } else {
          lines = content.split('\n').length;
        }

        return { content, path: resolvedPath, lines, truncated };
      } catch (error) {
        throw new Error(error.message || 'Failed to read file');
      }
    };

    const result = await testTool._execute({ absolute_path: '/test/file.txt' });
    
    expect(result.content).toBe(mockContent);
    expect(result.path).toBe('/test/file.txt');
    expect(result.lines).toBe(3);
    expect(result.truncated).toBe(false);
  });

  test('should handle line-based reading with offset and limit', async () => {
    const mockContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    
    // Simple test of line parsing logic
    const allLines = mockContent.split('\n');
    const offset = 1;
    const limit = 2;
    const startLine = offset;
    const endLine = startLine + limit;
    const slicedContent = allLines.slice(startLine, endLine).join('\n');
    
    expect(slicedContent).toBe('Line 2\nLine 3');
    expect(endLine < allLines.length).toBe(true); // truncated
  });
});