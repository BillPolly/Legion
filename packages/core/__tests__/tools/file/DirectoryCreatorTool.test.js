const DirectoryCreatorTool = require('../../../src/tools/file/DirectoryCreatorTool');
const { OpenAITool } = require('../../../src/core');
const fs = require('fs').promises;
const path = require('path');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn()
  }
}));

describe('DirectoryCreatorTool', () => {
  let tool;
  let mockDependencies;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup dependencies
    mockDependencies = {
      basePath: '/allowed/path',
      permissions: 0o755
    };

    tool = new DirectoryCreatorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should extend OpenAITool', () => {
      expect(tool).toBeInstanceOf(OpenAITool);
    });

    it('should set correct tool properties', () => {
      expect(tool.name).toBe('directory_creator');
      expect(tool.description).toBe('Creates directories in the file system');
      expect(tool.parameters).toEqual({
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description: 'The path of the directory to create'
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to create parent directories if they don\'t exist (default: true)',
            default: true
          }
        },
        required: ['directoryPath']
      });
    });

    it('should store dependencies', () => {
      expect(tool.basePath).toBe('/allowed/path');
      expect(tool.permissions).toBe(0o755);
    });

    it('should use default permissions if not provided', () => {
      const toolWithDefaults = new DirectoryCreatorTool({
        basePath: '/path'
      });
      expect(toolWithDefaults.permissions).toBe(0o755);
    });
  });

  describe('execute()', () => {
    it('should create directory successfully', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        directoryPath: 'newdir' 
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/allowed/path', 'newdir'),
        { recursive: true, mode: 0o755 }
      );
      expect(result).toEqual({
        success: true,
        path: path.join('/allowed/path', 'newdir'),
        created: true
      });
    });

    it('should create nested directories when recursive is true', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        directoryPath: 'a/b/c/d',
        recursive: true
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/allowed/path', 'a/b/c/d'),
        { recursive: true, mode: 0o755 }
      );
      expect(result.created).toBe(true);
    });

    it('should not use recursive when recursive is false', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      await tool.execute({ 
        directoryPath: 'singledir',
        recursive: false
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/allowed/path', 'singledir'),
        { recursive: false, mode: 0o755 }
      );
    });

    it('should handle absolute paths within basePath', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        directoryPath: '/allowed/path/subdir'
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        '/allowed/path/subdir',
        { recursive: true, mode: 0o755 }
      );
      expect(result.path).toBe('/allowed/path/subdir');
    });

    it('should handle existing directory gracefully', async () => {
      const error = new Error('EEXIST: file already exists');
      error.code = 'EEXIST';
      fs.mkdir.mockRejectedValue(error);
      
      fs.access.mockResolvedValue(undefined);
      const mockStats = { isDirectory: () => true };
      fs.stat.mockResolvedValue(mockStats);

      const result = await tool.execute({ 
        directoryPath: 'existing'
      });

      expect(result).toEqual({
        success: true,
        path: path.join('/allowed/path', 'existing'),
        created: false
      });
    });

    it('should throw error if path exists but is not a directory', async () => {
      const error = new Error('EEXIST: file already exists');
      error.code = 'EEXIST';
      fs.mkdir.mockRejectedValue(error);
      
      fs.access.mockResolvedValue(undefined);
      const mockStats = { isDirectory: () => false };
      fs.stat.mockResolvedValue(mockStats);

      await expect(tool.execute({ 
        directoryPath: 'existingfile.txt'
      })).rejects.toThrow('Path exists but is not a directory');
    });

    it('should throw error for path outside basePath', async () => {
      await expect(tool.execute({ 
        directoryPath: '../../../etc'
      })).rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should throw error for absolute path outside basePath', async () => {
      await expect(tool.execute({ 
        directoryPath: '/etc/config'
      })).rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should handle mkdir errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Unknown error'));

      await expect(tool.execute({ 
        directoryPath: 'protected'
      })).rejects.toThrow('Failed to create directory: Unknown error');
    });

    it('should handle missing directoryPath parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('Directory path is required');
    });

    it('should handle null directoryPath', async () => {
      await expect(tool.execute({ directoryPath: null }))
        .rejects.toThrow('Directory path must be a string');
    });

    it('should handle empty directoryPath', async () => {
      await expect(tool.execute({ directoryPath: '' }))
        .rejects.toThrow('Directory path cannot be empty');
    });

    it('should handle parent directory not existing when recursive is false', async () => {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      fs.mkdir.mockRejectedValue(error);

      await expect(tool.execute({ 
        directoryPath: 'parent/child',
        recursive: false
      })).rejects.toThrow('Parent directory does not exist');
    });

    it('should use custom permissions', async () => {
      const customTool = new DirectoryCreatorTool({
        basePath: '/allowed/path',
        permissions: 0o700
      });

      fs.mkdir.mockResolvedValue(undefined);

      await customTool.execute({ 
        directoryPath: 'secure'
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/allowed/path', 'secure'),
        { recursive: true, mode: 0o700 }
      );
    });
  });

  describe('permission checks', () => {
    it('should check if path exists when EEXIST error occurs', async () => {
      const error = new Error('EEXIST');
      error.code = 'EEXIST';
      fs.mkdir.mockRejectedValue(error);
      fs.access.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ isDirectory: () => true });

      await tool.execute({ directoryPath: 'exists' });

      expect(fs.access).toHaveBeenCalled();
      expect(fs.stat).toHaveBeenCalled();
    });

    it('should handle permission errors', async () => {
      const error = new Error('EACCES: Permission denied');
      error.code = 'EACCES';
      fs.mkdir.mockRejectedValue(error);

      await expect(tool.execute({ 
        directoryPath: 'noperm'
      })).rejects.toThrow('Permission denied');
    });
  });

  describe('getDescription()', () => {
    it('should return correct OpenAI format', () => {
      const description = tool.getDescription();

      expect(description).toEqual({
        type: 'function',
        function: {
          name: 'directory_creator',
          description: 'Creates directories in the file system',
          parameters: {
            type: 'object',
            properties: {
              directoryPath: {
                type: 'string',
                description: 'The path of the directory to create'
              },
              recursive: {
                type: 'boolean',
                description: 'Whether to create parent directories if they don\'t exist (default: true)',
                default: true
              }
            },
            required: ['directoryPath']
          }
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle directory with no parent', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        directoryPath: 'single'
      });

      expect(result.path).toBe(path.join('/allowed/path', 'single'));
    });

    it('should handle hidden directories', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        directoryPath: '.hidden'
      });

      expect(result.path).toBe(path.join('/allowed/path', '.hidden'));
    });

    it('should handle deeply nested paths', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      const result = await tool.execute({ 
        directoryPath: 'a/b/c/d/e/f/g/h/i/j'
      });

      expect(result.path).toBe(path.join('/allowed/path', 'a/b/c/d/e/f/g/h/i/j'));
    });

    it('should throw error for paths with null bytes', async () => {
      await expect(tool.execute({ 
        directoryPath: 'dir\0name'
      })).rejects.toThrow('Invalid directory path');
    });

    it('should normalize paths with multiple slashes', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      await tool.execute({ 
        directoryPath: 'dir//subdir///nested'
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/allowed/path', 'dir/subdir/nested'),
        expect.any(Object)
      );
    });

    it('should handle paths with dots', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      await tool.execute({ 
        directoryPath: './subdir/../newdir'
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/allowed/path', 'newdir'),
        expect.any(Object)
      );
    });
  });

  describe('security', () => {
    it('should prevent directory traversal attacks', async () => {
      const attacks = [
        '../../../../etc',
        '..\\..\\..\\windows\\system32',
        'subdir/../../../../../../etc',
        './././../../../etc'
      ];

      for (const attack of attacks) {
        await expect(tool.execute({ 
          directoryPath: attack
        })).rejects.toThrow('Access denied: Path is outside allowed directory');
      }
    });

    it('should handle symbolic link attempts', async () => {
      await expect(tool.execute({ 
        directoryPath: '../symlink-to-etc'
      })).rejects.toThrow('Access denied: Path is outside allowed directory');
    });
  });
});