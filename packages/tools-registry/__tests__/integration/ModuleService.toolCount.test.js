/**
 * Integration tests for ModuleService tool counting functionality
 * 
 * Tests that ModuleService properly:
 * - Saves discovered modules with correct tool counts
 * - Updates tool counts when modules are loaded
 * - Maintains separation between discovery and loading
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ModuleService } from '../../src/services/ModuleService.js';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { LRUCache } from '../../src/utils/LRUCache.js';
import { SimpleEmitter } from '../../src/core/SimpleEmitter.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ModuleService Tool Count Integration Tests', () => {
  let moduleService;
  let databaseStorage;
  let resourceManager;
  let testDir;
  let testDbName;
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Use test database
    testDbName = `legion_tools_test_${Date.now()}`;
    
    // Initialize database storage for testing
    databaseStorage = new DatabaseStorage({
      resourceManager,
      databaseName: testDbName
    });
    await databaseStorage.initialize();
  });
  
  afterAll(async () => {
    // Clean up test database
    if (databaseStorage) {
      try {
        // Drop the test database
        await databaseStorage.db.dropDatabase();
        await databaseStorage.close();
      } catch (error) {
        console.warn('Failed to cleanup test database:', error.message);
      }
    }
  });
  
  beforeEach(async () => {
    // Create test directory for modules
    testDir = path.join(__dirname, '../tmp/moduleservice-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Clear collections before each test
    try {
      await databaseStorage.getCollection('module-registry').deleteMany({});
      await databaseStorage.getCollection('modules').deleteMany({});
      await databaseStorage.getCollection('tools').deleteMany({});
    } catch (error) {
      // Collections might not exist yet
    }
    
    // Create ModuleService with dependencies
    const moduleDiscovery = new ModuleDiscovery({ 
      resourceManager,
      databaseStorage 
    });
    const moduleLoader = new ModuleLoader({ resourceManager });
    const moduleCache = new LRUCache({ maxSize: 100, ttl: 300000 });
    const eventBus = new SimpleEmitter();
    
    moduleService = new ModuleService({
      moduleDiscovery,
      moduleLoader,
      moduleCache,
      databaseService: databaseStorage,
      eventBus
    });
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('discoverModules tool count behavior', () => {
    it('should save discovered modules with correct toolsCount from MODULE object', async () => {
      // Create a test module
      const testModule = `
export default class DiscoveryTestModule {
  static async create(resourceManager) {
    return new DiscoveryTestModule();
  }

  get name() { return 'DiscoveryTestModule'; }
  
  getTools() {
    return [
      {
        name: 'testTool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'test result' })
      }
    ];
  }
}`;

      const modulePath = path.join(testDir, 'DiscoveryTestModule.js');
      await fs.writeFile(modulePath, testModule);

      // Discover modules - should now count tools by loading MODULE objects
      const result = await moduleService.discoverModules([testDir]);

      expect(result.discovered).toBe(1);
      expect(result.modules.length).toBe(1);
      
      const discoveredModule = result.modules[0];
      expect(discoveredModule.name).toBe('DiscoveryTestModule');
      expect(discoveredModule._id).toBeDefined(); // Should have database ID
      
      // Check module was saved in database with correct toolsCount (discovery now counts tools)
      const savedModule = await databaseStorage.getCollection('module-registry')
        .findOne({ name: 'DiscoveryTestModule' });
      
      expect(savedModule).toBeDefined();
      expect(savedModule.toolsCount).toBe(1); // Discovery phase now counts tools from MODULE object
      expect(savedModule.status).toBe('discovered');
    });
    
    it('should discover multiple modules and count tools correctly', async () => {
      // Create multiple test modules with different tool counts
      const modules = [
        {
          name: 'Fast1',
          tools: ['tool1', 'tool2']
        },
        {
          name: 'Fast2', 
          tools: ['toolA', 'toolB', 'toolC']
        },
        {
          name: 'Fast3',
          tools: [] // No tools
        }
      ];

      for (const moduleSpec of modules) {
        const moduleCode = `
export default class ${moduleSpec.name}Module {
  static async create(resourceManager) {
    return new ${moduleSpec.name}Module();
  }

  get name() { return '${moduleSpec.name}Module'; }
  
  getTools() {
    return ${JSON.stringify(moduleSpec.tools.map(toolName => ({
      name: toolName,
      description: `${toolName} description`,
      inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
      execute: async (params) => ({ result: `${toolName} result` })
    })))};
  }
}`;
        
        await fs.writeFile(path.join(testDir, `${moduleSpec.name}Module.js`), moduleCode);
      }

      const startTime = Date.now();
      
      // Discovery should count tools from loaded MODULE objects
      const result = await moduleService.discoverModules([testDir]);
      
      const duration = Date.now() - startTime;
      
      expect(result.discovered).toBe(3);
      expect(duration).toBeLessThan(3000); // Should be fast
      
      // All modules should be in database with correct toolsCount from discovery
      for (const moduleSpec of modules) {
        const savedModule = await databaseStorage.getCollection('module-registry')
          .findOne({ name: `${moduleSpec.name}Module` });
        
        expect(savedModule).toBeDefined();
        expect(savedModule.toolsCount).toBe(moduleSpec.tools.length); // Discovery now counts tools from MODULE object
        expect(savedModule.status).toBe('discovered');
      }

      console.log(`✅ Fast discovery of 3 modules completed in ${duration}ms`);
    });
  });

  describe('loadModule tool count updating', () => {
    beforeEach(async () => {
      // Create and save a test module first
      const testModule = `
export default class LoadTestModule {
  static async create(resourceManager) {
    return new LoadTestModule();
  }

  get name() { return 'LoadTestModule'; }
  
  getTools() {
    return [
      {
        name: 'loadTool1',
        description: 'First load test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'load1 result' })
      },
      {
        name: 'loadTool2', 
        description: 'Second load test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'number' } } },
        execute: async (params) => ({ result: params.input * 2 })
      }
    ];
  }
}`;

      const modulePath = path.join(testDir, 'LoadTestModule.js');
      await fs.writeFile(modulePath, testModule);

      // Discover the module first
      await moduleService.discoverModules([testDir]);
    });

    it('should update toolsCount when module is loaded', async () => {
      // Load the module - should count tools and update database
      const result = await moduleService.loadModule('LoadTestModule');

      expect(result.success).toBe(true);
      expect(result.toolCount).toBe(2);
      expect(result.toolsLoaded).toBe(2);
      expect(result.moduleId).toBeDefined();

      // Check that toolsCount was updated in database
      const updatedModule = await databaseStorage.getCollection('module-registry')
        .findOne({ name: 'LoadTestModule' });
      
      expect(updatedModule).toBeDefined();
      expect(updatedModule.toolsCount).toBe(2); // Should be updated from 0 to 2
      expect(updatedModule.status).toBe('loaded'); // Status should be updated

      // Check that tools were saved to database
      const savedTools = await databaseStorage.getCollection('tools')
        .find({ moduleName: 'LoadTestModule' }).toArray();
      
      expect(savedTools.length).toBe(2);
      expect(savedTools.map(t => t.name)).toContain('loadTool1');
      expect(savedTools.map(t => t.name)).toContain('loadTool2');
    });

    it('should handle modules with no tools correctly', async () => {
      // Create module with no tools
      const noToolsModule = `
export default class NoToolsModule {
  static async create(resourceManager) {
    return new NoToolsModule();
  }

  get name() { return 'NoToolsModule'; }
  
  getTools() {
    return [];
  }
}`;

      const modulePath = path.join(testDir, 'NoToolsModule.js');
      await fs.writeFile(modulePath, noToolsModule);

      // Discover and load
      await moduleService.discoverModules([testDir]);
      const result = await moduleService.loadModule('NoToolsModule');

      expect(result.success).toBe(true);
      expect(result.toolCount).toBe(0);

      // Check database update
      const updatedModule = await databaseStorage.getCollection('module-registry')
        .findOne({ name: 'NoToolsModule' });
      
      expect(updatedModule.toolsCount).toBe(0);
      expect(updatedModule.status).toBe('loaded');
    });
  });

  describe('getModuleStatistics accuracy', () => {
    it('should return accurate tool counts from database', async () => {
      // Create modules with known tool counts
      const moduleSpecs = [
        { name: 'StatsModule1', toolCount: 2 },
        { name: 'StatsModule2', toolCount: 5 },
        { name: 'StatsModule3', toolCount: 0 }
      ];

      for (const spec of moduleSpecs) {
        const tools = Array.from({ length: spec.toolCount }, (_, i) => ({
          name: `${spec.name}_tool${i + 1}`,
          description: `Tool ${i + 1} for ${spec.name}`,
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
          execute: async (params) => ({ result: `Result from tool ${i + 1}` })
        }));

        const moduleCode = `
export default class ${spec.name} {
  static async create(resourceManager) {
    return new ${spec.name}();
  }

  get name() { return '${spec.name}'; }
  
  getTools() {
    return ${JSON.stringify(tools)};
  }
}`;
        
        await fs.writeFile(path.join(testDir, `${spec.name}.js`), moduleCode);
      }

      // Discover all modules
      await moduleService.discoverModules([testDir]);

      // Load all modules to populate tool counts
      for (const spec of moduleSpecs) {
        await moduleService.loadModule(spec.name);
      }

      // Get statistics
      const stats = await moduleService.getModuleStatistics();

      expect(stats.totalDiscovered).toBe(3);
      expect(stats.totalLoaded).toBe(3);
      expect(stats.totalToolsDiscovered).toBe(7); // 2 + 5 + 0 = 7

      console.log(`✅ Statistics: ${stats.totalDiscovered} modules, ${stats.totalToolsDiscovered} tools`);
    });
  });

  describe('module loading with database lookup', () => {
    it('should load module from database when not in memory', async () => {
      // Create and discover a module
      const testModule = `
export default class DatabaseLookupModule {
  static async create(resourceManager) {
    return new DatabaseLookupModule();
  }

  get name() { return 'DatabaseLookupModule'; }
  
  getTools() {
    return [
      {
        name: 'dbTool',
        description: 'Database lookup tool',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'db result' })
      }
    ];
  }
}`;

      const modulePath = path.join(testDir, 'DatabaseLookupModule.js');
      await fs.writeFile(modulePath, testModule);

      // Discover the module (this saves it to database)
      await moduleService.discoverModules([testDir]);

      // Create a new ModuleService instance (empty discoveredModules array)
      const newModuleService = new ModuleService({
        moduleDiscovery: new ModuleDiscovery({ resourceManager, databaseStorage }),
        moduleLoader: new ModuleLoader({ resourceManager }),
        moduleCache: new LRUCache({ maxSize: 100, ttl: 300000 }),
        databaseService: databaseStorage,
        eventBus: new SimpleEmitter()
      });

      // Should be able to load module by looking it up from database
      const result = await newModuleService.getModule('DatabaseLookupModule');

      expect(result).toBeDefined();
      expect(result.name).toBe('DatabaseLookupModule');
      expect(typeof result.getTools).toBe('function');
      expect(result.getTools().length).toBe(1);
    });
  });
});