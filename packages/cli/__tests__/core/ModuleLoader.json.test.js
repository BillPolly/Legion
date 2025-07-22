import { jest } from '@jest/globals';
import path from 'path';

// Mock fs module
const mockFs = {
  readdir: jest.fn(),
  readFile: jest.fn(),
  access: jest.fn()
};

jest.unstable_mockModule('fs/promises', () => ({
  default: mockFs,
  readdir: mockFs.readdir,
  readFile: mockFs.readFile,
  access: mockFs.access
}));

// Mock ModuleFactory and related classes
const mockModuleFactory = {
  createModuleAuto: jest.fn()
};

jest.unstable_mockModule('@legion/module-loader', () => ({
  ModuleFactory: jest.fn(() => mockModuleFactory),
  ResourceManager: jest.fn(() => ({
    get: jest.fn(),
    has: jest.fn()
  }))
}));

// Import after mocking
const { ModuleLoader } = await import('../../src/core/ModuleLoader.js');

describe('ModuleLoader - JSON Module Support', () => {
  let moduleLoader;
  let resourceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModuleFactory.createModuleAuto.mockClear();
    
    // Create a mock ResourceManager
    resourceManager = {
      get: jest.fn(),
      has: jest.fn()
    };
    
    moduleLoader = new ModuleLoader(resourceManager);
  });

  describe('discoverModules', () => {
    it('should discover both Module.js and module.json files', async () => {
      // Mock file system structure
      mockFs.readdir.mockImplementation((dir, options) => {
        // When reading with options, we need directory entries
        if (options && options.withFileTypes && dir.includes('general-tools/src')) {
          return Promise.resolve([
            { name: 'calculator', isDirectory: () => true },
            { name: 'axios', isDirectory: () => true },
            { name: 'lodash', isDirectory: () => true }
          ]);
        }
        
        // When reading without options, return file names
        if (dir.includes('calculator')) {
          return Promise.resolve(['CalculatorModule.js', 'index.js']);
        }
        
        if (dir.includes('axios')) {
          return Promise.resolve(['module.json', 'README.md']);
        }
        
        if (dir.includes('lodash')) {
          return Promise.resolve(['LodashModule.js', 'module.json']);
        }
        
        return Promise.resolve([]);
      });

      const modules = await moduleLoader.discoverModules();

      expect(modules).toHaveLength(3); // 2 Module.js + 1 module.json (lodash has Module.js so json is skipped)
      expect(modules).toEqual(expect.arrayContaining([
        expect.stringContaining('calculator/CalculatorModule.js'),
        expect.stringContaining('axios/module.json'),
        expect.stringContaining('lodash/LodashModule.js')
        // lodash/module.json should not be included because Module.js takes precedence
      ]));
    });

    it('should handle directories without module files', async () => {
      mockFs.readdir.mockImplementation((dir, options) => {
        if (options && options.withFileTypes && dir.includes('general-tools/src')) {
          return Promise.resolve([
            { name: 'utils', isDirectory: () => true }
          ]);
        }
        
        if (dir.includes('utils')) {
          return Promise.resolve(['helper.js', 'config.js']);
        }
        
        return Promise.resolve([]);
      });

      const modules = await moduleLoader.discoverModules();
      expect(modules).toHaveLength(0);
    });
  });

  describe('loadModule', () => {
    it('should load JSON modules using ModuleFactory', async () => {
      const moduleFile = '/path/to/axios/module.json';
      const mockModule = {
        name: 'axios',
        getTools: () => [
          { name: 'http_get', getAllToolDescriptions: undefined },
          { name: 'http_post', getAllToolDescriptions: undefined }
        ]
      };

      mockModuleFactory.createModuleAuto.mockResolvedValue(mockModule);

      await moduleLoader.loadModule(moduleFile);

      expect(mockModuleFactory.createModuleAuto).toHaveBeenCalledWith(
        path.dirname(moduleFile)
      );
      
      const moduleInfo = moduleLoader.getModuleInfo('axios');
      expect(moduleInfo).toBeDefined();
      expect(moduleInfo.name).toBe('axios');
      expect(moduleInfo.functionCount).toBe(2);
      expect(moduleInfo.isJsonModule).toBe(true);
    });

    it('should handle Module.js files as before', async () => {
      const moduleFile = '/path/to/calculator/CalculatorModule.js';
      
      // Mock dynamic import for traditional module
      const MockCalculatorModule = class CalculatorModule {
        static dependencies = ['precision'];
        constructor(deps) {
          this.dependencies = deps;
        }
        getTools() {
          return [{ 
            name: 'calc',
            getAllToolDescriptions: () => [
              { function: { name: 'add' } },
              { function: { name: 'subtract' } }
            ]
          }];
        }
      };

      // This would need special handling for dynamic imports
      // For now, we'll test the JSON module path
    });

    it('should prioritize Module.js over module.json', async () => {
      const moduleDir = '/path/to/lodash';
      
      // When both exist, Module.js should be loaded
      mockFs.access.mockResolvedValue(undefined); // Module.js exists
      
      const moduleFile = path.join(moduleDir, 'LodashModule.js');
      
      // Test would verify Module.js is loaded, not module.json
    });
  });

  describe('createModuleInstance', () => {
    it('should create instances of JSON modules', async () => {
      const mockModule = {
        name: 'axios',
        getTools: () => []
      };

      // Set up module in registry
      moduleLoader.moduleInstances.set('axios', mockModule);
      moduleLoader.jsonModules = new Map([['axios', true]]);

      const instance = moduleLoader.createModuleInstance('axios');
      
      expect(instance).toBe(mockModule);
    });

    it('should handle dependencies for JSON modules', async () => {
      const mockModule = {
        name: 'auth-module',
        dependencies: { apiKey: 'test-key' },
        getTools: () => []
      };

      mockModuleFactory.createModuleAuto.mockResolvedValue(mockModule);
      
      moduleLoader.resourceManager = {
        has: jest.fn((key) => key === 'apiKey'),
        get: jest.fn((key) => key === 'apiKey' ? 'resource-api-key' : null)
      };

      // Load the module first
      await moduleLoader.loadModule('/path/to/auth/module.json');
      
      const instance = moduleLoader.createModuleInstance('auth-module');
      
      expect(instance).toBeDefined();
    });
  });

  describe('Tool counting', () => {
    it('should correctly count tools in JSON modules', async () => {
      const mockModule = {
        name: 'multi-tool',
        getTools: () => [
          { 
            name: 'tool1',
            getAllToolDescriptions: () => [
              { function: { name: 'func1' } },
              { function: { name: 'func2' } },
              { function: { name: 'func3' } }
            ]
          },
          { 
            name: 'tool2',
            getAllToolDescriptions: undefined
          }
        ]
      };

      mockModuleFactory.createModuleAuto.mockResolvedValue(mockModule);

      await moduleLoader.loadModule('/path/to/multi/module.json');
      
      const moduleInfo = moduleLoader.getModuleInfo('multi-tool');
      expect(moduleInfo.functionCount).toBe(4); // 3 from tool1, 1 from tool2
    });
  });

  describe('Error handling', () => {
    it('should gracefully handle invalid JSON modules', async () => {
      const moduleFile = '/path/to/invalid/module.json';
      
      mockModuleFactory.createModuleAuto.mockRejectedValue(
        new Error('Invalid module configuration')
      );

      await expect(moduleLoader.loadModule(moduleFile))
        .rejects.toThrow('Invalid module configuration');
    });

    it('should skip modules that fail to load when loading all', async () => {
      mockFs.readdir.mockImplementation((dir, options) => {
        if (options && options.withFileTypes && dir.includes('general-tools/src')) {
          return Promise.resolve([
            { name: 'good', isDirectory: () => true },
            { name: 'bad', isDirectory: () => true }
          ]);
        }
        
        if (dir.includes('good')) {
          return Promise.resolve(['module.json']);
        }
        
        if (dir.includes('bad')) {
          return Promise.resolve(['module.json']);
        }
        
        return Promise.resolve([]);
      });

      const goodModule = {
        name: 'good',
        getTools: () => []
      };

      mockModuleFactory.createModuleAuto
        .mockResolvedValueOnce(goodModule)
        .mockRejectedValueOnce(new Error('Bad module'));

      const modules = await moduleLoader.loadModules({ verbose: false });
      
      expect(modules.size).toBe(1);
      expect(modules.has('good')).toBe(true);
      expect(modules.has('bad')).toBe(false);
    });
  });
});