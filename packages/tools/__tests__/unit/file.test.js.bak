/**
 * Unit tests for File Tool
 */

import { jest } from '@jest/globals';
import { FileOperationsTool, FileModule } from '../../src/file/FileModule.js';
import { createMockToolCall, validateToolResult, createTempFilePath } from '../utils/test-helpers.js';

// Mock fs module
const mockFs = {
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn()
  }
};

jest.unstable_mockModule('fs', () => mockFs);

describe('FileOperationsTool', () => {
  let fileTool;

  beforeEach(() => {
    fileTool = new FileOperationsTool();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(fileTool.name).toBe('file_operations');
      expect(fileTool.description).toContain('file system operations');
    });
  });

  describe('getAllToolDescriptions', () => {
    test('should return all three file operation functions', () => {
      const descriptions = fileTool.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(3);
      expect(descriptions[0].function.name).toBe('file_read');
      expect(descriptions[1].function.name).toBe('file_write');
      expect(descriptions[2].function.name).toBe('directory_create');
    });

    test('should have correct parameter schemas', () => {
      const descriptions = fileTool.getAllToolDescriptions();
      
      // File read
      expect(descriptions[0].function.parameters.required).toContain('filepath');
      expect(descriptions[0].function.parameters.properties.filepath.type).toBe('string');
      
      // File write
      expect(descriptions[1].function.parameters.required).toContain('filepath');
      expect(descriptions[1].function.parameters.required).toContain('content');
      
      // Directory create
      expect(descriptions[2].function.parameters.required).toContain('dirpath');
    });

    test('should include output schemas for success and failure', () => {
      const descriptions = fileTool.getAllToolDescriptions();
      
      descriptions.forEach(desc => {
        expect(desc.function.output.success).toBeDefined();
        expect(desc.function.output.failure).toBeDefined();
        expect(desc.function.output.failure.properties.errorCode).toBeDefined();
      });
    });
  });

  describe('getToolDescription', () => {
    test('should return the primary tool description (file_read)', () => {
      const description = fileTool.getToolDescription();
      expect(description.function.name).toBe('file_read');
    });
  });

  describe('readFile method', () => {
    test('should successfully read a file', async () => {
      const mockContent = 'Test file content';
      const mockStats = { isFile: () => true };
      
      mockFs.promises.stat.mockResolvedValue(mockStats);
      mockFs.promises.readFile.mockResolvedValue(mockContent);

      const result = await fileTool.readFile('test.txt');

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.content).toBe(mockContent);
      expect(result.data.filepath).toBe('test.txt');
      expect(result.data.size).toBe(mockContent.length);
    });

    test('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      
      mockFs.promises.stat.mockRejectedValue(error);

      const result = await fileTool.readFile('nonexistent.txt');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('ENOENT');
      expect(result.data.filepath).toBe('nonexistent.txt');
      expect(result.error).toContain('File not found');
    });

    test('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      
      mockFs.promises.stat.mockRejectedValue(error);

      const result = await fileTool.readFile('restricted.txt');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('EACCES');
      expect(result.error).toContain('Permission denied');
    });

    test('should handle directory instead of file error', async () => {
      const mockStats = { isFile: () => false };
      
      mockFs.promises.stat.mockResolvedValue(mockStats);

      const result = await fileTool.readFile('some-directory');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('EISDIR');
      expect(result.error).toContain('Path is not a file');
    });

    test('should handle unknown errors', async () => {
      const error = new Error('Unknown error');
      
      mockFs.promises.stat.mockRejectedValue(error);

      const result = await fileTool.readFile('test.txt');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('UNKNOWN');
    });
  });

  describe('writeFile method', () => {
    test('should successfully write a new file', async () => {
      const content = 'Test content to write';
      const filepath = 'new-file.txt';
      
      // Simulate file doesn't exist
      mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));
      mockFs.promises.mkdir.mockResolvedValue();
      mockFs.promises.writeFile.mockResolvedValue();

      const result = await fileTool.writeFile(filepath, content);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.filepath).toBe(filepath);
      expect(result.data.bytesWritten).toBe(content.length);
      expect(result.data.created).toBe(true);
    });

    test('should successfully overwrite existing file', async () => {
      const content = 'Updated content';
      const filepath = 'existing-file.txt';
      
      // Simulate file exists
      mockFs.promises.stat.mockResolvedValue({ isFile: () => true });
      mockFs.promises.mkdir.mockResolvedValue();
      mockFs.promises.writeFile.mockResolvedValue();

      const result = await fileTool.writeFile(filepath, content);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false); // File was overwritten
    });

    test('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      
      mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));
      mockFs.promises.mkdir.mockResolvedValue();
      mockFs.promises.writeFile.mockRejectedValue(error);

      const result = await fileTool.writeFile('restricted.txt', 'content');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('EACCES');
      expect(result.error).toContain('Permission denied');
    });

    test('should handle no space error', async () => {
      const error = new Error('No space left');
      error.code = 'ENOSPC';
      
      mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));
      mockFs.promises.mkdir.mockResolvedValue();
      mockFs.promises.writeFile.mockRejectedValue(error);

      const result = await fileTool.writeFile('test.txt', 'content');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('ENOSPC');
      expect(result.error).toContain('No space left');
    });
  });

  describe('createDirectory method', () => {
    test('should successfully create a new directory', async () => {
      const dirpath = 'new-directory';
      
      // Simulate directory doesn't exist
      mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));
      mockFs.promises.mkdir.mockResolvedValue();

      const result = await fileTool.createDirectory(dirpath);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.dirpath).toBe(dirpath);
      expect(result.data.created).toBe(true);
    });

    test('should handle existing directory', async () => {
      const dirpath = 'existing-directory';
      
      // Simulate directory exists
      mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.promises.mkdir.mockResolvedValue();

      const result = await fileTool.createDirectory(dirpath);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false); // Directory already existed
    });

    test('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      
      mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));
      mockFs.promises.mkdir.mockRejectedValue(error);

      const result = await fileTool.createDirectory('restricted-dir');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('EACCES');
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('invoke method', () => {
    test('should route file_read calls correctly', async () => {
      const mockContent = 'File content';
      const mockStats = { isFile: () => true };
      
      mockFs.promises.stat.mockResolvedValue(mockStats);
      mockFs.promises.readFile.mockResolvedValue(mockContent);

      const toolCall = createMockToolCall('file_read', { filepath: 'test.txt' });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.content).toBe(mockContent);
    });

    test('should route file_write calls correctly', async () => {
      mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));
      mockFs.promises.mkdir.mockResolvedValue();
      mockFs.promises.writeFile.mockResolvedValue();

      const toolCall = createMockToolCall('file_write', { 
        filepath: 'test.txt', 
        content: 'test content' 
      });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.bytesWritten).toBe(12); // 'test content'.length
    });

    test('should route directory_create calls correctly', async () => {
      mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));
      mockFs.promises.mkdir.mockResolvedValue();

      const toolCall = createMockToolCall('directory_create', { dirpath: 'test-dir' });
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
    });

    test('should handle unknown function names', async () => {
      const toolCall = createMockToolCall('unknown_function', {});
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function');
    });

    test('should handle missing required parameters', async () => {
      const toolCall = createMockToolCall('file_read', {}); // Missing filepath
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('filepath');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        id: 'test-call',
        type: 'function',
        function: {
          name: 'file_read',
          arguments: 'invalid json'
        }
      };
      const result = await fileTool.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
    });
  });

  describe('parameter validation', () => {
    test('should validate required parameters for file_read', () => {
      expect(() => fileTool.validateRequiredParameters({ filepath: 'test.txt' }, ['filepath']))
        .not.toThrow();
      expect(() => fileTool.validateRequiredParameters({}, ['filepath']))
        .toThrow();
    });

    test('should validate required parameters for file_write', () => {
      expect(() => fileTool.validateRequiredParameters({ 
        filepath: 'test.txt', 
        content: 'content' 
      }, ['filepath', 'content'])).not.toThrow();
      
      expect(() => fileTool.validateRequiredParameters({ 
        filepath: 'test.txt' 
      }, ['filepath', 'content'])).toThrow();
    });

    test('should validate required parameters for directory_create', () => {
      expect(() => fileTool.validateRequiredParameters({ dirpath: 'test-dir' }, ['dirpath']))
        .not.toThrow();
      expect(() => fileTool.validateRequiredParameters({}, ['dirpath']))
        .toThrow();
    });
  });
});

describe('FileModule', () => {
  let module;

  beforeEach(() => {
    module = new FileModule();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      expect(module.name).toBe('file');
      expect(module.tools).toHaveLength(1);
      expect(module.tools[0]).toBeInstanceOf(FileOperationsTool);
      expect(module.config.basePath).toBe(process.cwd());
      expect(module.config.encoding).toBe('utf8');
      expect(module.config.createDirectories).toBe(true);
      expect(module.config.permissions).toBe(0o755);
    });

    test('should accept custom configuration', () => {
      const customConfig = {
        basePath: '/custom/path',
        encoding: 'ascii',
        createDirectories: false,
        permissions: 0o644
      };
      
      const customModule = new FileModule(customConfig);
      
      expect(customModule.config.basePath).toBe('/custom/path');
      expect(customModule.config.encoding).toBe('ascii');
      expect(customModule.config.createDirectories).toBe(false);
      expect(customModule.config.permissions).toBe(0o644);
    });

    test('should have correct dependencies declared', () => {
      expect(FileModule.dependencies).toEqual([
        'basePath', 'encoding', 'createDirectories', 'permissions'
      ]);
    });
  });

  describe('getTools method', () => {
    test('should return array of file operation tools', () => {
      const tools = module.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBeInstanceOf(FileOperationsTool);
    });
  });

  describe('integration with module system', () => {
    test('should work with tool registry pattern', () => {
      const tools = module.getTools();
      const fileTool = tools[0];
      
      expect(fileTool.getToolDescription).toBeDefined();
      expect(fileTool.getAllToolDescriptions).toBeDefined();
      expect(fileTool.invoke).toBeDefined();
      expect(typeof fileTool.getToolDescription).toBe('function');
      expect(typeof fileTool.getAllToolDescriptions).toBe('function');
      expect(typeof fileTool.invoke).toBe('function');
    });

    test('should support multiple tool descriptions', () => {
      const tools = module.getTools();
      const fileTool = tools[0];
      const allDescriptions = fileTool.getAllToolDescriptions();
      
      expect(allDescriptions).toHaveLength(3);
      expect(allDescriptions.map(d => d.function.name)).toEqual([
        'file_read', 'file_write', 'directory_create'
      ]);
    });
  });
});