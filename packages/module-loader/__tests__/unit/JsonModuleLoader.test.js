import { jest } from '@jest/globals';

// Create mocks
const mockReadFile = jest.fn();
const mockReaddir = jest.fn();
const mockStat = jest.fn();

// Mock fs module before imports
jest.unstable_mockModule('fs', () => ({
  promises: {
    readFile: mockReadFile,
    readdir: mockReaddir,
    stat: mockStat
  }
}));

// Import after mocking
const { JsonModuleLoader } = await import('../../src/module/JsonModuleLoader.js');

describe('JsonModuleLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new JsonModuleLoader();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      expect(loader).toBeDefined();
      expect(loader.validator).toBeDefined();
      expect(loader.cache).toBeInstanceOf(Map);
    });

    it('should accept custom options', () => {
      const customLoader = new JsonModuleLoader({
        cacheEnabled: false,
        strict: true
      });
      expect(customLoader.options.cacheEnabled).toBe(false);
      expect(customLoader.options.strict).toBe(true);
    });
  });

  describe('readModuleJson', () => {
    it('should read and parse valid module.json file', async () => {
      const mockConfig = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test module',
        package: 'test-package',
        type: 'static',
        tools: []
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig, null, 2));

      const result = await loader.readModuleJson('/path/to/module.json');
      
      expect(mockReadFile).toHaveBeenCalledWith('/path/to/module.json', 'utf8');
      expect(result).toEqual(mockConfig);
    });

    it('should throw error for non-existent file', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(loader.readModuleJson('/invalid/path.json'))
        .rejects.toThrow('Failed to read module.json');
    });

    it('should throw error for invalid JSON', async () => {
      mockReadFile.mockResolvedValue('{ invalid json }');

      await expect(loader.readModuleJson('/path/to/invalid.json'))
        .rejects.toThrow('Invalid JSON in module.json');
    });

    it('should use cache for repeated reads', async () => {
      const mockConfig = { name: 'cached-module' };
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

      // First read
      const result1 = await loader.readModuleJson('/path/to/module.json');
      expect(mockReadFile).toHaveBeenCalledTimes(1);

      // Second read should use cache
      const result2 = await loader.readModuleJson('/path/to/module.json');
      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(result2).toBe(result1);
    });

    it('should bypass cache when disabled', async () => {
      const noCache = new JsonModuleLoader({ cacheEnabled: false });
      const mockConfig = { name: 'no-cache' };
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

      await noCache.readModuleJson('/path/to/module.json');
      await noCache.readModuleJson('/path/to/module.json');

      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', async () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'static',
        tools: []
      };

      const result = await loader.validateConfiguration(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors', async () => {
      const config = {
        name: 'invalid-NAME', // uppercase not allowed
        // missing required fields
      };

      const result = await loader.validateConfiguration(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should throw in strict mode for invalid config', async () => {
      const strictLoader = new JsonModuleLoader({ strict: true });
      const invalidConfig = { name: 'test' };

      await expect(strictLoader.validateConfiguration(invalidConfig))
        .rejects.toThrow('Module configuration validation failed');
    });
  });

  describe('loadModuleConfig', () => {
    it('should load and validate module configuration', async () => {
      const mockConfig = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test module',
        package: 'test-package',
        type: 'static',
        tools: [{
          name: 'test_tool',
          description: 'Test tool',
          function: 'testFunc'
        }]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await loader.loadModuleConfig('/path/to/module.json');
      
      expect(result).toEqual(expect.objectContaining(mockConfig));
      expect(result._metadata).toBeDefined();
      expect(result._metadata.path).toBe('/path/to/module.json');
      expect(result._metadata.directory).toBe('/path/to');
    });

    it('should reject invalid configuration in strict mode', async () => {
      const strictLoader = new JsonModuleLoader({ strict: true });
      const invalidConfig = {
        name: 'TEST', // uppercase
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'invalid-type',
        tools: []
      };

      mockReadFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(strictLoader.loadModuleConfig('/path/to/module.json'))
        .rejects.toThrow('Module configuration validation failed');
    });
  });

  describe('error handling', () => {
    it('should provide context in error messages', async () => {
      mockReadFile.mockRejectedValue(new Error('EACCES: permission denied'));

      try {
        await loader.readModuleJson('/restricted/module.json');
      } catch (error) {
        expect(error.message).toContain('Failed to read module.json');
        expect(error.message).toContain('/restricted/module.json');
        expect(error.cause).toBeDefined();
      }
    });

    it('should handle JSON parse errors with context', async () => {
      mockReadFile.mockResolvedValue('{ "name": "test", invalid }');

      try {
        await loader.readModuleJson('/path/to/bad.json');
      } catch (error) {
        expect(error.message).toContain('Invalid JSON');
        expect(error.message).toContain('/path/to/bad.json');
      }
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      const mockConfig = { name: 'cached' };
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

      // Load to cache
      await loader.readModuleJson('/path/to/module.json');
      expect(loader.cache.size).toBe(1);

      // Clear cache
      loader.clearCache();
      expect(loader.cache.size).toBe(0);

      // Next read should hit filesystem
      await loader.readModuleJson('/path/to/module.json');
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('discoverJsonModules', () => {
    it('should discover module.json files in directory', async () => {
      mockReaddir.mockImplementation(async (dir) => {
        if (dir === '/path/to/modules') {
          return [
            { name: 'module1', isDirectory: () => true },
            { name: 'module2', isDirectory: () => true },
            { name: 'file.js', isDirectory: () => false },
            { name: 'README.md', isDirectory: () => false }
          ];
        }
        // Return empty for subdirectories to prevent recursion
        return [];
      });

      mockStat.mockImplementation(async (path) => {
        if (path === '/path/to/modules/module1/module.json' ||
            path === '/path/to/modules/module2/module.json') {
          return { isFile: () => true };
        }
        throw new Error('ENOENT');
      });

      const result = await loader.discoverJsonModules('/path/to/modules');

      expect(result).toHaveLength(2);
      expect(result).toContain('/path/to/modules/module1/module.json');
      expect(result).toContain('/path/to/modules/module2/module.json');
    });

    it('should handle nested directories', async () => {
      mockReaddir.mockImplementation(async (dir) => {
        if (dir === '/path/to/modules') {
          return [{ name: 'category1', isDirectory: () => true }];
        }
        if (dir === '/path/to/modules/category1') {
          return [{ name: 'module1', isDirectory: () => true }];
        }
        return [];
      });

      mockStat.mockImplementation(async (path) => {
        if (path === '/path/to/modules/category1/module1/module.json') {
          return { isFile: () => true };
        }
        throw new Error('ENOENT');
      });

      const result = await loader.discoverJsonModules('/path/to/modules');

      expect(result).toContain('/path/to/modules/category1/module1/module.json');
    });

    it('should ignore non-module.json files', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'module1', isDirectory: () => true }
      ]);

      mockStat.mockImplementation(async (path) => {
        if (path.includes('package.json')) {
          return { isFile: () => true };
        }
        throw new Error('ENOENT');
      });

      const result = await loader.discoverJsonModules('/path/to/modules');

      expect(result).toHaveLength(0);
    });

    it('should handle empty directories', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await loader.discoverJsonModules('/path/to/empty');

      expect(result).toHaveLength(0);
    });

    it('should handle read errors gracefully', async () => {
      mockReaddir.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await loader.discoverJsonModules('/restricted/path');

      expect(result).toHaveLength(0);
    });

    it('should filter by options', async () => {
      mockReaddir.mockImplementation(async (dir) => {
        if (dir === '/path/to/modules') {
          return [
            { name: 'enabled-module', isDirectory: () => true },
            { name: 'disabled-module', isDirectory: () => true },
            { name: 'test-module', isDirectory: () => true }
          ];
        }
        return [];
      });

      mockStat.mockImplementation(async (path) => {
        // Only enabled-module should have module.json
        if (path === '/path/to/modules/enabled-module/module.json') {
          return { isFile: () => true };
        }
        throw new Error('ENOENT');
      });

      const result = await loader.discoverJsonModules('/path/to/modules', {
        filter: (path) => !path.includes('disabled') && !path.includes('test')
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('enabled-module');
    });
  });
});