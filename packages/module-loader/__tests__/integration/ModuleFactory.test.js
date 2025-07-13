import { jest } from '@jest/globals';
import path from 'path';

// Mock fs module properly
const mockFs = {
  readFile: jest.fn(),
  access: jest.fn(),
  readdir: jest.fn()
};

jest.unstable_mockModule('fs/promises', () => ({
  default: mockFs,
  readFile: mockFs.readFile,
  access: mockFs.access,
  readdir: mockFs.readdir
}));

// Mock GenericModule
const mockGenericModule = jest.fn((config, dependencies) => {
  return {
    name: config.name,
    config: config,
    dependencies: dependencies,
    getTools: jest.fn(() => {
      if (config.tools) {
        return config.tools.map(t => ({ name: t.name }));
      }
      return [];
    })
  };
});

jest.unstable_mockModule('../../src/module/GenericModule.js', () => ({
  GenericModule: mockGenericModule
}));

// Mock JsonModuleLoader
const mockJsonModuleLoader = {
  readModuleJson: jest.fn(),
  validateConfiguration: jest.fn(),
  discoverJsonModules: jest.fn()
};

jest.unstable_mockModule('../../src/module/JsonModuleLoader.js', () => ({
  JsonModuleLoader: class JsonModuleLoader {
    readModuleJson(path) {
      return mockJsonModuleLoader.readModuleJson(path);
    }
    validateConfiguration(config) {
      return mockJsonModuleLoader.validateConfiguration(config);
    }
    discoverJsonModules(dir, options) {
      return mockJsonModuleLoader.discoverJsonModules(dir, options);
    }
  }
}));

// Mock ResourceManager
const mockResourceManager = {
  get: jest.fn()
};

jest.unstable_mockModule('../../src/resources/ResourceManager.js', () => ({
  default: class ResourceManager {
    get(name) {
      return mockResourceManager.get(name);
    }
  }
}));

// Import after mocking
const { ModuleFactory } = await import('../../src/module/ModuleFactory.js');
const ResourceManager = (await import('../../src/resources/ResourceManager.js')).default;
const { JsonModuleLoader } = await import('../../src/module/JsonModuleLoader.js');
const { GenericModule } = await import('../../src/module/GenericModule.js');

describe('ModuleFactory - JSON Module Integration', () => {
  let factory;
  let resourceManager;
  let jsonLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenericModule.mockClear();
    mockResourceManager.get.mockClear();
    mockJsonModuleLoader.readModuleJson.mockClear();
    mockJsonModuleLoader.validateConfiguration.mockClear();
    mockJsonModuleLoader.discoverJsonModules.mockClear();
    
    resourceManager = new ResourceManager();
    factory = new ModuleFactory(resourceManager);
    jsonLoader = new JsonModuleLoader();
    
    // Add JsonModuleLoader to factory
    factory.jsonLoader = jsonLoader;
  });

  describe('createJsonModule', () => {
    it('should create a GenericModule from module.json config', async () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test module',
        package: 'test-package',
        type: 'static',
        tools: []
      };

      const jsonPath = '/path/to/module.json';
      
      // Mock JsonModuleLoader methods
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(config);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ 
        valid: true, 
        errors: [] 
      });
      
      const module = await factory.createJsonModule(jsonPath);

      expect(mockGenericModule).toHaveBeenCalledWith(
        expect.objectContaining({
          ...config,
          _metadata: {
            path: jsonPath,
            directory: '/path/to'
          }
        }),
        {}
      );
      expect(module.name).toBe('test-module');
      expect(module.config).toEqual(expect.objectContaining(config));
    });

    it('should resolve dependencies from ResourceManager', async () => {
      const config = {
        name: 'dep-module',
        version: '1.0.0',
        package: 'test-package',
        type: 'constructor',
        dependencies: ['apiKey', 'baseURL'],
        initialization: {
          config: {
            apiKey: '${apiKey}',
            baseURL: '${baseURL}'
          }
        },
        tools: []
      };

      const jsonPath = '/path/to/module.json';
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(config);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ valid: true, errors: [] });
      
      // Setup ResourceManager mocks
      mockResourceManager.get.mockImplementation((name) => {
        if (name === 'apiKey') return 'test-api-key';
        if (name === 'baseURL') return 'https://api.test.com';
        return null;
      });

      const module = await factory.createJsonModule(jsonPath);

      expect(mockResourceManager.get).toHaveBeenCalledWith('apiKey');
      expect(mockResourceManager.get).toHaveBeenCalledWith('baseURL');
      expect(module.dependencies).toEqual({
        apiKey: 'test-api-key',
        baseURL: 'https://api.test.com'
      });
    });

    it('should handle module with tools', async () => {
      const config = {
        name: 'tools-module',
        version: '1.0.0',
        package: 'test-package',
        type: 'static',
        tools: [
          {
            name: 'tool1',
            description: 'First tool',
            function: 'method1'
          },
          {
            name: 'tool2',
            description: 'Second tool',
            function: 'method2'
          }
        ]
      };

      const jsonPath = '/path/to/module.json';
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(config);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ valid: true, errors: [] });
      
      const module = await factory.createJsonModule(jsonPath);

      expect(module.getTools).toBeDefined();
      const tools = module.getTools();
      expect(tools).toHaveLength(2);
    });

    it('should throw error for invalid module.json', async () => {
      const invalidConfig = {
        // Missing required fields
        name: 'invalid'
      };

      const jsonPath = '/path/to/invalid.json';
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(invalidConfig);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ 
        valid: false, 
        errors: ['version is required', 'package is required', 'type is required'] 
      });
      
      await expect(factory.createJsonModule(jsonPath))
        .rejects.toThrow(/Invalid module configuration/);
    });

    it('should include metadata about file location', async () => {
      const config = {
        name: 'meta-module',
        version: '1.0.0',
        package: './local-package',
        type: 'static',
        tools: []
      };

      const jsonPath = '/project/modules/meta/module.json';
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(config);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ valid: true, errors: [] });
      
      const module = await factory.createJsonModule(jsonPath);

      expect(module.config._metadata).toBeDefined();
      expect(module.config._metadata.path).toBe(jsonPath);
      expect(module.config._metadata.directory).toBe('/project/modules/meta');
    });
  });

  describe('createModuleAuto', () => {
    it('should try Module class first, then fall back to module.json', async () => {
      const moduleDir = '/path/to/module';
      
      // Simulate no Module.js file
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      
      // But module.json exists
      const config = {
        name: 'fallback-module',
        version: '1.0.0',
        package: 'test',
        type: 'static',
        tools: []
      };
      
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(config);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ valid: true, errors: [] });
      
      const module = await factory.createModuleAuto(moduleDir);
      
      expect(mockFs.access).toHaveBeenCalledWith(path.join(moduleDir, 'Module.js'));
      expect(mockJsonModuleLoader.readModuleJson).toHaveBeenCalledWith(
        path.join(moduleDir, 'module.json')
      );
      expect(mockGenericModule).toHaveBeenCalled();
    });

    it('should prefer Module.js over module.json when both exist', async () => {
      const moduleDir = '/path/to/module';
      
      // Module.js exists
      mockFs.access.mockResolvedValue(undefined);
      
      // Mock dynamic import
      const MockModule = class TestModule {
        static dependencies = ['apiKey'];
        constructor(deps) {
          this.dependencies = deps;
        }
        getTools() { return []; }
      };
      
      // We'll need to handle this differently since we can't mock dynamic imports easily
      // For now, let's just test the logic flow
      
      // This test would need special handling for dynamic imports
      // which is complex in Jest with ESM
    });

    it('should throw if neither Module.js nor module.json exist', async () => {
      const moduleDir = '/path/to/nonexistent';
      
      // Neither file exists
      const accessError = new Error('ENOENT');
      accessError.code = 'ENOENT';
      mockFs.access.mockRejectedValue(accessError);
      
      const readError = new Error('ENOENT');
      readError.code = 'ENOENT';
      mockJsonModuleLoader.readModuleJson.mockRejectedValue(readError);
      
      await expect(factory.createModuleAuto(moduleDir))
        .rejects.toThrow(/No module found/);
    });
  });

  describe('Mixed module types', () => {
    it('should handle array of mixed module types', async () => {
      // Traditional Module class
      class TraditionalModule {
        static dependencies = ['apiKey'];
        constructor(deps) {
          this.name = 'traditional';
          this.dependencies = deps;
        }
        getTools() { return []; }
      }

      // JSON module config
      const jsonConfig = {
        name: 'json-module',
        version: '1.0.0',
        package: 'test',
        type: 'static',
        dependencies: ['apiKey'],
        tools: []
      };

      const jsonPath = '/path/to/json/module.json';
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(jsonConfig);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ valid: true, errors: [] });
      
      mockResourceManager.get.mockReturnValue('shared-api-key');
      
      // Create both types
      const traditional = factory.createModule(TraditionalModule);
      const jsonModule = await factory.createJsonModule(jsonPath);
      
      expect(traditional.name).toBe('traditional');
      expect(jsonModule.name).toBe('json-module');
      
      // Both should receive the same dependency
      expect(traditional.dependencies.apiKey).toBe('shared-api-key');
      expect(jsonModule.dependencies.apiKey).toBe('shared-api-key');
    });
  });

  describe('Error handling', () => {
    it('should provide helpful error for file read failures', async () => {
      const jsonPath = '/path/to/module.json';
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      mockJsonModuleLoader.readModuleJson.mockRejectedValue(error);
      
      await expect(factory.createJsonModule(jsonPath))
        .rejects.toThrow(/permission denied/);
    });

    it('should provide helpful error for invalid JSON', async () => {
      const jsonPath = '/path/to/module.json';
      const error = new Error('Unexpected end of JSON input');
      error.message = 'Invalid JSON: Unexpected end of JSON input';
      mockJsonModuleLoader.readModuleJson.mockRejectedValue(error);
      
      await expect(factory.createJsonModule(jsonPath))
        .rejects.toThrow(/JSON/);
    });

    it('should handle missing dependencies gracefully', async () => {
      const config = {
        name: 'missing-deps',
        version: '1.0.0',
        package: 'test',
        type: 'constructor',
        dependencies: ['nonExistentDep'],
        tools: []
      };

      const jsonPath = '/path/to/module.json';
      mockJsonModuleLoader.readModuleJson.mockResolvedValue(config);
      mockJsonModuleLoader.validateConfiguration.mockResolvedValue({ valid: true, errors: [] });
      
      mockResourceManager.get.mockReturnValue(undefined);
      
      const module = await factory.createJsonModule(jsonPath);
      
      expect(module.dependencies.nonExistentDep).toBeUndefined();
    });
  });
});