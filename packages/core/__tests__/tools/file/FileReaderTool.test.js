const FileReaderTool = require('../../../src/tools/file/FileReaderTool');
const { OpenAITool } = require('../../../src/core');
const fs = require('fs').promises;
const path = require('path');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn()
  }
}));

describe('FileReaderTool', () => {
  let tool;
  let mockDependencies;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup dependencies
    mockDependencies = {
      basePath: '/allowed/path',
      encoding: 'utf-8',
      maxFileSize: 1048576 // 1MB
    };

    tool = new FileReaderTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should extend OpenAITool', () => {
      expect(tool).toBeInstanceOf(OpenAITool);
    });

    it('should set correct tool properties', () => {
      expect(tool.name).toBe('file_reader');
      expect(tool.description).toBe('Reads the contents of a file from the file system');
      expect(tool.parameters).toEqual({
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to read'
          }
        },
        required: ['filePath']
      });
    });

    it('should store dependencies', () => {
      expect(tool.basePath).toBe('/allowed/path');
      expect(tool.encoding).toBe('utf-8');
      expect(tool.maxFileSize).toBe(1048576);
    });

    it('should use default encoding if not provided', () => {
      const toolWithDefaults = new FileReaderTool({
        basePath: '/path'
      });
      expect(toolWithDefaults.encoding).toBe('utf-8');
    });

    it('should use default maxFileSize if not provided', () => {
      const toolWithDefaults = new FileReaderTool({
        basePath: '/path'
      });
      expect(toolWithDefaults.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
    });
  });

  describe('execute()', () => {
    it('should read existing file successfully', async () => {
      const fileContent = 'Hello, World!';
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(fileContent);

      const result = await tool.execute({ filePath: 'test.txt' });

      expect(fs.access).toHaveBeenCalledWith(
        path.join('/allowed/path', 'test.txt')
      );
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/allowed/path', 'test.txt'),
        'utf-8'
      );
      expect(result).toEqual({
        content: fileContent,
        path: path.join('/allowed/path', 'test.txt')
      });
    });

    it('should handle absolute paths within basePath', async () => {
      const fileContent = 'Test content';
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(fileContent);

      const result = await tool.execute({ filePath: '/allowed/path/subdir/file.txt' });

      expect(fs.readFile).toHaveBeenCalledWith(
        '/allowed/path/subdir/file.txt',
        'utf-8'
      );
      expect(result).toEqual({
        content: fileContent,
        path: '/allowed/path/subdir/file.txt'
      });
    });

    it('should throw error for non-existent file', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(tool.execute({ filePath: 'nonexistent.txt' }))
        .rejects.toThrow('File not found or not accessible');
    });

    it('should throw error for path outside basePath', async () => {
      await expect(tool.execute({ filePath: '../../../etc/passwd' }))
        .rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should throw error for absolute path outside basePath', async () => {
      await expect(tool.execute({ filePath: '/etc/passwd' }))
        .rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should handle file read errors', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(tool.execute({ filePath: 'protected.txt' }))
        .rejects.toThrow('Failed to read file: Permission denied');
    });

    it('should handle missing filePath parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('File path is required');
    });

    it('should handle null filePath', async () => {
      await expect(tool.execute({ filePath: null }))
        .rejects.toThrow('File path must be a string');
    });

    it('should handle empty filePath', async () => {
      await expect(tool.execute({ filePath: '' }))
        .rejects.toThrow('File path cannot be empty');
    });

    it('should handle different encodings', async () => {
      const binaryTool = new FileReaderTool({
        basePath: '/allowed/path',
        encoding: 'base64'
      });

      const base64Content = 'SGVsbG8gV29ybGQ=';
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(base64Content);

      const result = await binaryTool.execute({ filePath: 'binary.dat' });

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/allowed/path', 'binary.dat'),
        'base64'
      );
      expect(result).toEqual({
        content: base64Content,
        path: path.join('/allowed/path', 'binary.dat')
      });
    });

    it('should normalize paths correctly', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue('content');

      await tool.execute({ filePath: './subdir/../file.txt' });

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/allowed/path', 'file.txt'),
        'utf-8'
      );
    });

    it('should handle paths with multiple slashes', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue('content');

      await tool.execute({ filePath: 'subdir//file.txt' });

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/allowed/path', 'subdir/file.txt'),
        'utf-8'
      );
    });
  });

  describe('permission checks', () => {
    it('should check file permissions before reading', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue('content');

      await tool.execute({ filePath: 'test.txt' });

      // Verify fs.access was called
      expect(fs.access).toHaveBeenCalled();
      // Verify fs.readFile was called after
      expect(fs.readFile).toHaveBeenCalled();
      // Verify order by checking call order
      const accessCallOrder = fs.access.mock.invocationCallOrder[0];
      const readFileCallOrder = fs.readFile.mock.invocationCallOrder[0];
      expect(accessCallOrder).toBeLessThan(readFileCallOrder);
    });

    it('should handle permission errors gracefully', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.access.mockRejectedValue(error);

      await expect(tool.execute({ filePath: 'protected.txt' }))
        .rejects.toThrow('File not found or not accessible');
    });
  });

  describe('getDescription()', () => {
    it('should return correct OpenAI format', () => {
      const description = tool.getDescription();

      expect(description).toEqual({
        type: 'function',
        function: {
          name: 'file_reader',
          description: 'Reads the contents of a file from the file system',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path to the file to read'
              }
            },
            required: ['filePath']
          }
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle file with no extension', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue('content');

      const result = await tool.execute({ filePath: 'README' });

      expect(result).toEqual({
        content: 'content',
        path: path.join('/allowed/path', 'README')
      });
    });

    it('should handle hidden files', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue('config');

      const result = await tool.execute({ filePath: '.gitignore' });

      expect(result).toEqual({
        content: 'config',
        path: path.join('/allowed/path', '.gitignore')
      });
    });

    it('should handle deeply nested paths', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue('nested content');

      const result = await tool.execute({ 
        filePath: 'a/b/c/d/e/f/file.txt' 
      });

      expect(result).toEqual({
        content: 'nested content',
        path: path.join('/allowed/path', 'a/b/c/d/e/f/file.txt')
      });
    });

    it('should throw error for paths with null bytes', async () => {
      await expect(tool.execute({ filePath: 'file\0.txt' }))
        .rejects.toThrow('Invalid file path');
    });
  });

  describe('security', () => {
    it('should prevent directory traversal attacks', async () => {
      const attacks = [
        '../../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'subdir/../../../../../../etc/passwd',
        './././../../../etc/passwd'
      ];

      for (const attack of attacks) {
        await expect(tool.execute({ filePath: attack }))
          .rejects.toThrow('Access denied: Path is outside allowed directory');
      }
    });

    it('should handle symbolic link attempts', async () => {
      // Even if the resolved path would be outside basePath
      await expect(tool.execute({ filePath: '../symlink-to-etc' }))
        .rejects.toThrow('Access denied: Path is outside allowed directory');
    });
  });
});