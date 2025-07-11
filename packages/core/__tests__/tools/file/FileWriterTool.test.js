const FileWriterTool = require('../../../src/tools/file/FileWriterTool');
const { OpenAITool } = require('../../../src/core');
const fs = require('fs').promises;
const path = require('path');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

describe('FileWriterTool', () => {
  let tool;
  let mockDependencies;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup dependencies
    mockDependencies = {
      basePath: '/allowed/path',
      encoding: 'utf-8',
      createDirectories: true
    };

    tool = new FileWriterTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should extend OpenAITool', () => {
      expect(tool).toBeInstanceOf(OpenAITool);
    });

    it('should set correct tool properties', () => {
      expect(tool.name).toBe('file_writer');
      expect(tool.description).toBe('Writes content to a file in the file system');
      expect(tool.parameters).toEqual({
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path where the file should be written'
          },
          content: {
            type: 'string',
            description: 'The content to write to the file'
          },
          append: {
            type: 'boolean',
            description: 'Whether to append to existing file (default: false)',
            default: false
          }
        },
        required: ['filePath', 'content']
      });
    });

    it('should store dependencies', () => {
      expect(tool.basePath).toBe('/allowed/path');
      expect(tool.encoding).toBe('utf-8');
      expect(tool.createDirectories).toBe(true);
    });

    it('should use default encoding if not provided', () => {
      const toolWithDefaults = new FileWriterTool({
        basePath: '/path'
      });
      expect(toolWithDefaults.encoding).toBe('utf-8');
    });

    it('should use default createDirectories if not provided', () => {
      const toolWithDefaults = new FileWriterTool({
        basePath: '/path'
      });
      expect(toolWithDefaults.createDirectories).toBe(false);
    });
  });

  describe('execute()', () => {
    it('should write file successfully', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        filePath: 'test.txt', 
        content: 'Hello, World!' 
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/allowed/path', 'test.txt'),
        'Hello, World!',
        { encoding: 'utf-8', flag: 'w' }
      );
      expect(result).toEqual({
        success: true,
        path: path.join('/allowed/path', 'test.txt'),
        bytesWritten: 13
      });
    });

    it('should append to file when append is true', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      await tool.execute({ 
        filePath: 'test.txt', 
        content: 'Appended text',
        append: true
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/allowed/path', 'test.txt'),
        'Appended text',
        { encoding: 'utf-8', flag: 'a' }
      );
    });

    it('should handle absolute paths within basePath', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        filePath: '/allowed/path/subdir/file.txt',
        content: 'Test content'
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/allowed/path/subdir/file.txt',
        'Test content',
        { encoding: 'utf-8', flag: 'w' }
      );
      expect(result.path).toBe('/allowed/path/subdir/file.txt');
    });

    it('should create directories if createDirectories is true', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      await tool.execute({ 
        filePath: 'new/dir/file.txt',
        content: 'Content'
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/allowed/path', 'new/dir'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should not create directories if createDirectories is false', async () => {
      const toolNoDirs = new FileWriterTool({
        basePath: '/allowed/path',
        createDirectories: false
      });

      fs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(toolNoDirs.execute({ 
        filePath: 'new/dir/file.txt',
        content: 'Content'
      })).rejects.toThrow('Directory does not exist');

      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should throw error for path outside basePath', async () => {
      await expect(tool.execute({ 
        filePath: '../../../etc/passwd',
        content: 'malicious'
      })).rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should throw error for absolute path outside basePath', async () => {
      await expect(tool.execute({ 
        filePath: '/etc/passwd',
        content: 'malicious'
      })).rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should handle write errors', async () => {
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(tool.execute({ 
        filePath: 'test.txt',
        content: 'content'
      })).rejects.toThrow('Failed to write file: Disk full');
    });

    it('should handle missing filePath parameter', async () => {
      await expect(tool.execute({ content: 'test' }))
        .rejects.toThrow('File path is required');
    });

    it('should handle missing content parameter', async () => {
      await expect(tool.execute({ filePath: 'test.txt' }))
        .rejects.toThrow('Content is required');
    });

    it('should handle null filePath', async () => {
      await expect(tool.execute({ filePath: null, content: 'test' }))
        .rejects.toThrow('File path must be a string');
    });

    it('should handle null content', async () => {
      await expect(tool.execute({ filePath: 'test.txt', content: null }))
        .rejects.toThrow('Content must be a string');
    });

    it('should handle empty filePath', async () => {
      await expect(tool.execute({ filePath: '', content: 'test' }))
        .rejects.toThrow('File path cannot be empty');
    });

    it('should allow empty content', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        filePath: 'empty.txt',
        content: ''
      });

      expect(result).toEqual({
        success: true,
        path: path.join('/allowed/path', 'empty.txt'),
        bytesWritten: 0
      });
    });

    it('should handle different encodings', async () => {
      const binaryTool = new FileWriterTool({
        basePath: '/allowed/path',
        encoding: 'base64'
      });

      fs.access.mockResolvedValue(undefined); // Mock directory exists
      fs.writeFile.mockResolvedValue(undefined);

      await binaryTool.execute({ 
        filePath: 'binary.dat',
        content: 'SGVsbG8gV29ybGQ='
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/allowed/path', 'binary.dat'),
        'SGVsbG8gV29ybGQ=',
        { encoding: 'base64', flag: 'w' }
      );
    });

    it('should handle unicode content', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const content = 'Hello 世界 🌍';
      const result = await tool.execute({ 
        filePath: 'unicode.txt',
        content
      });

      expect(result.bytesWritten).toBe(content.length);
    });
  });

  describe('permission checks', () => {
    it('should check directory existence when createDirectories is true', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      await tool.execute({ 
        filePath: 'subdir/test.txt',
        content: 'test'
      });

      expect(fs.access).toHaveBeenCalledWith(
        path.join('/allowed/path', 'subdir')
      );
    });

    it('should handle permission errors gracefully', async () => {
      fs.writeFile.mockRejectedValue(new Error('EACCES: Permission denied'));

      await expect(tool.execute({ 
        filePath: 'protected.txt',
        content: 'test'
      })).rejects.toThrow('Failed to write file: EACCES: Permission denied');
    });
  });

  describe('getDescription()', () => {
    it('should return correct OpenAI format', () => {
      const description = tool.getDescription();

      expect(description).toEqual({
        type: 'function',
        function: {
          name: 'file_writer',
          description: 'Writes content to a file in the file system',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path where the file should be written'
              },
              content: {
                type: 'string',
                description: 'The content to write to the file'
              },
              append: {
                type: 'boolean',
                description: 'Whether to append to existing file (default: false)',
                default: false
              }
            },
            required: ['filePath', 'content']
          }
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle file with no extension', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        filePath: 'README',
        content: 'content'
      });

      expect(result.path).toBe(path.join('/allowed/path', 'README'));
    });

    it('should handle hidden files', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        filePath: '.gitignore',
        content: 'node_modules/'
      });

      expect(result.path).toBe(path.join('/allowed/path', '.gitignore'));
    });

    it('should handle deeply nested paths', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        filePath: 'a/b/c/d/e/f/file.txt',
        content: 'nested content'
      });

      expect(result.path).toBe(path.join('/allowed/path', 'a/b/c/d/e/f/file.txt'));
    });

    it('should throw error for paths with null bytes', async () => {
      await expect(tool.execute({ 
        filePath: 'file\0.txt',
        content: 'test'
      })).rejects.toThrow('Invalid file path');
    });

    it('should handle very large content', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const largeContent = 'x'.repeat(1000000); // 1MB
      const result = await tool.execute({ 
        filePath: 'large.txt',
        content: largeContent
      });

      expect(result.bytesWritten).toBe(1000000);
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
        await expect(tool.execute({ 
          filePath: attack,
          content: 'malicious'
        })).rejects.toThrow('Access denied: Path is outside allowed directory');
      }
    });

    it('should handle symbolic link attempts', async () => {
      await expect(tool.execute({ 
        filePath: '../symlink-to-etc',
        content: 'malicious'
      })).rejects.toThrow('Access denied: Path is outside allowed directory');
    });
  });
});