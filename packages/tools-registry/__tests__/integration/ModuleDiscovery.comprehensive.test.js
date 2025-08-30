/**
 * Comprehensive Integration Tests for Module Discovery with Tool Counting
 * 
 * Tests the complete discovery workflow:
 * - find file → get path → load MODULE object → validate object → extract tools → store in registry
 * - Verifies that discovery now shows correct tool counts instead of "31 modules and 0 tools"
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ModuleService } from '../../src/services/ModuleService.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { SimpleEmitter } from '../../src/core/SimpleEmitter.js';
import { LRUCache } from '../../src/utils/LRUCache.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Module Discovery Comprehensive Integration Tests', () => {
  let moduleDiscovery;
  let moduleService;
  let databaseStorage;
  let resourceManager;
  let testDir;
  let testDbName;
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Use test database
    testDbName = `legion_discovery_test_${Date.now()}`;
    
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
        await databaseStorage.db.dropDatabase();
        await databaseStorage.close();
      } catch (error) {
        console.warn('Failed to cleanup test database:', error.message);
      }
    }
  });
  
  beforeEach(async () => {
    // Create test directory for modules
    testDir = path.join(__dirname, '../tmp/discovery-comprehensive-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Clear collections before each test
    try {
      await databaseStorage.getCollection('module-registry').deleteMany({});
      await databaseStorage.getCollection('modules').deleteMany({});
      await databaseStorage.getCollection('tools').deleteMany({});
    } catch (error) {
      // Collections might not exist yet
    }
    
    // Create ModuleDiscovery and ModuleService with proper dependencies
    moduleDiscovery = new ModuleDiscovery({ 
      resourceManager,
      databaseStorage,
      verbose: true
    });
    
    const moduleLoader = new ModuleLoader({ resourceManager });
    const eventBus = new SimpleEmitter();
    const moduleCache = new LRUCache({ maxSize: 100, ttl: 300000 });
    
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

  describe('Complete Discovery Workflow: find → load → validate → count tools → store', () => {
    it('should follow proper workflow for single module with tools', async () => {
      console.log('🧪 Testing complete discovery workflow for single module...');
      
      // Create a module with known tool count
      const testModule = `
export default class WorkflowTestModule {
  static async create(resourceManager) {
    return new WorkflowTestModule();
  }

  get name() { return 'WorkflowTestModule'; }
  
  getTools() {
    return [
      {
        name: 'workflow_tool_1',
        description: 'First workflow test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'workflow1 result' })
      },
      {
        name: 'workflow_tool_2',
        description: 'Second workflow test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'number' } } },
        execute: async (params) => ({ result: params.input * 2 })
      },
      {
        name: 'workflow_tool_3',
        description: 'Third workflow test tool',
        inputSchema: { type: 'object', properties: { data: { type: 'array' } } },
        outputSchema: { type: 'object', properties: { count: { type: 'number' } } },
        execute: async (params) => ({ count: params.data.length })
      }
    ];
  }
}`;

      const modulePath = path.join(testDir, 'WorkflowTestModule.js');
      await fs.writeFile(modulePath, testModule);

      console.log('📁 Step 1: Find module file...');
      const discoveredFiles = await moduleDiscovery.discoverModules(testDir);
      console.log('Found files:', discoveredFiles.map(f => f.name));
      
      // Find our specific test module
      const workflowModule = discoveredFiles.find(f => f.name === 'WorkflowTestModule');
      expect(workflowModule).toBeDefined();
      expect(workflowModule.path).toBe(modulePath);
      console.log('✅ Found module file:', workflowModule.name);

      console.log('📦 Step 2: Load MODULE object...');
      const moduleObject = await moduleDiscovery.moduleLoader.loadModule(modulePath);
      expect(moduleObject).toBeDefined();
      expect(typeof moduleObject.getTools).toBe('function');
      console.log('✅ Loaded MODULE object with getTools method');

      console.log('🔍 Step 3: Validate MODULE object and count tools...');
      const validation = await moduleDiscovery.validateModule(moduleObject);
      expect(validation.valid).toBe(true);
      expect(validation.toolsCount).toBe(3);
      expect(validation.errors.length).toBe(0);
      console.log('✅ Validated MODULE object - found', validation.toolsCount, 'tools');

      console.log('💾 Step 4: Store in registry with tool count...');
      const moduleWithValidation = {
        ...workflowModule,
        validation,
        moduleObject
      };
      
      const savedCount = await moduleDiscovery.saveToModuleRegistry([moduleWithValidation]);
      expect(savedCount).toBe(1);
      
      // Verify saved correctly in database with tool count
      const savedModule = await databaseStorage.getCollection('module-registry')
        .findOne({ name: 'WorkflowTestModule' });
      
      expect(savedModule).toBeDefined();
      expect(savedModule.toolsCount).toBe(3); // Should have actual tool count from validation
      expect(savedModule.status).toBe('discovered');
      console.log('✅ Stored in registry with toolsCount =', savedModule.toolsCount);

      console.log('🎉 Complete workflow validated: find → load → validate → count → store');
    });

    it('should handle multiple modules with different tool counts', async () => {
      console.log('🧪 Testing workflow with multiple modules...');
      
      // Create multiple modules with different tool counts
      const moduleSpecs = [
        { name: 'MultiModule1', toolCount: 2 },
        { name: 'MultiModule2', toolCount: 5 },
        { name: 'MultiModule3', toolCount: 0 },
        { name: 'MultiModule4', toolCount: 1 }
      ];

      for (const spec of moduleSpecs) {
        const tools = Array.from({ length: spec.toolCount }, (_, i) => ({
          name: `${spec.name.toLowerCase()}_tool_${i + 1}`,
          description: `Tool ${i + 1} for ${spec.name}`,
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
          execute: async (params) => ({ result: `Result from ${spec.name} tool ${i + 1}` })
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

      console.log('🔄 Running discoverAndValidate workflow...');
      const result = await moduleDiscovery.discoverAndValidate();

      expect(result.discovered).toBe(4);
      expect(result.validated.length).toBe(4);
      expect(result.invalid.length).toBe(0);
      
      console.log('✅ Discovered and validated', result.discovered, 'modules');

      // Verify each module has correct tool count
      for (let i = 0; i < moduleSpecs.length; i++) {
        const spec = moduleSpecs[i];
        const validatedModule = result.validated.find(m => m.name === spec.name);
        
        expect(validatedModule).toBeDefined();
        expect(validatedModule.validation.valid).toBe(true);
        expect(validatedModule.validation.toolsCount).toBe(spec.toolCount);
        console.log(`✅ ${spec.name}: ${validatedModule.validation.toolsCount} tools (expected: ${spec.toolCount})`);
      }

      // Total tools should be sum of all tool counts: 2 + 5 + 0 + 1 = 8
      const totalToolsExpected = moduleSpecs.reduce((sum, spec) => sum + spec.toolCount, 0);
      const totalToolsFound = result.validated.reduce((sum, module) => sum + module.validation.toolsCount, 0);
      
      expect(totalToolsFound).toBe(totalToolsExpected);
      console.log(`🎯 Total tools found: ${totalToolsFound} (expected: ${totalToolsExpected})`);
    });
  });

  describe('ModuleService Discovery Integration (Fixed Issue)', () => {
    it('should show correct module and tool counts via ModuleService.discoverModules', async () => {
      console.log('🧪 Testing ModuleService discovery - this should fix "31 modules and 0 tools"...');
      
      // Create test modules with known tool counts
      const moduleSpecs = [
        { name: 'ServiceModule1', toolCount: 3 },
        { name: 'ServiceModule2', toolCount: 1 },
        { name: 'ServiceModule3', toolCount: 4 }
      ];

      for (const spec of moduleSpecs) {
        const tools = Array.from({ length: spec.toolCount }, (_, i) => ({
          name: `service_${spec.name.toLowerCase()}_tool${i + 1}`,
          description: `Service tool ${i + 1} for ${spec.name}`,
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
          execute: async (params) => ({ result: `Service result ${i + 1}` })
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

      console.log('🚀 Running ModuleService.discoverModules with NEW workflow...');
      const result = await moduleService.discoverModules([testDir]);

      // This should now show correct counts instead of "X modules and 0 tools"
      expect(result.discovered).toBe(3);
      expect(result.tools).toBeGreaterThan(0); // This was the bug - should NOT be 0!
      
      const expectedTotalTools = moduleSpecs.reduce((sum, spec) => sum + spec.toolCount, 0); // 3 + 1 + 4 = 8
      expect(result.tools).toBe(expectedTotalTools);

      console.log(`📊 FIXED RESULT: ${result.discovered} modules with ${result.tools} tools`);
      console.log(`   Expected: ${moduleSpecs.length} modules with ${expectedTotalTools} tools`);
      console.log('✅ BUG FIXED: ModuleService now shows correct tool counts during discovery!');

      // Verify each module was saved with correct tool count in database
      for (const spec of moduleSpecs) {
        const savedModule = await databaseStorage.getCollection('module-registry')
          .findOne({ name: spec.name });
        
        expect(savedModule).toBeDefined();
        expect(savedModule.toolsCount).toBe(spec.toolCount);
        console.log(`   ${spec.name}: ${savedModule.toolsCount} tools saved to database`);
      }
    });

    it('should handle real monorepo discovery and show actual tool counts', async () => {
      console.log('🧪 Testing real monorepo discovery with actual modules...');
      
      // This tests the real monorepo, not test modules
      console.log('🔍 Running discovery on real monorepo...');
      const result = await moduleService.discoverModules(); // No paths = full monorepo
      
      console.log(`📊 REAL MONOREPO RESULT: ${result.discovered} modules with ${result.tools} tools`);
      
      expect(result.discovered).toBeGreaterThan(0);
      
      if (result.discovered > 0 && result.tools === 0) {
        console.warn('⚠️  Still showing 0 tools - check if real modules implement getTools() correctly');
        
        // Show first few modules to help debug
        console.log('First few discovered modules:');
        result.modules.slice(0, 5).forEach(module => {
          console.log(`  - ${module.name} (toolsCount: ${module.toolsCount}, valid: ${module.valid})`);
        });
      } else {
        console.log('✅ SUCCESS: Real monorepo discovery now shows tool counts!');
        
        // Show modules with tools
        const modulesWithTools = result.modules.filter(m => m.toolsCount > 0);
        console.log(`Modules with tools: ${modulesWithTools.length}`);
        modulesWithTools.slice(0, 3).forEach(module => {
          console.log(`  - ${module.name}: ${module.toolsCount} tools`);
        });
      }

      // The key improvement: tools should NOT be 0 if modules are found
      if (result.discovered > 10) { // If we found many modules
        expect(result.tools).toBeGreaterThan(0); // Then we should have found some tools
      }
    }, 30000); // Longer timeout for real monorepo discovery
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle modules that fail to load during discovery', async () => {
      console.log('🧪 Testing discovery with modules that fail to load...');
      
      // Create one good module and one bad module
      const goodModule = `
export default class GoodModule {
  static async create(resourceManager) {
    return new GoodModule();
  }

  get name() { return 'GoodModule'; }
  
  getTools() {
    return [
      {
        name: 'good_tool',
        description: 'A working tool',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        execute: async (params) => ({ result: 'good' })
      }
    ];
  }
}`;

      const badModule = `
// This module has syntax errors and will fail to load
export default class BadModule {
  static async create(resourceManager) {
    throw new Error('Module creation failed');
  }

  get name() { return 'BadModule'; }
  
  getTools() {
    return []; // Won't be reached due to creation failure
  }
}`;

      await fs.writeFile(path.join(testDir, 'GoodModule.js'), goodModule);
      await fs.writeFile(path.join(testDir, 'BadModule.js'), badModule);

      console.log('🔄 Running discoverAndValidate with mixed success/failure...');
      const result = await moduleDiscovery.discoverAndValidate();

      expect(result.discovered).toBe(2);
      expect(result.validated.length).toBe(1); // Only GoodModule should validate
      expect(result.invalid.length).toBe(1);   // BadModule should be invalid
      
      const goodModuleResult = result.validated.find(m => m.name === 'GoodModule');
      expect(goodModuleResult).toBeDefined();
      expect(goodModuleResult.validation.valid).toBe(true);
      expect(goodModuleResult.validation.toolsCount).toBe(1);
      
      const badModuleResult = result.invalid.find(m => m.name === 'BadModule');
      expect(badModuleResult).toBeDefined();
      expect(badModuleResult.validation.valid).toBe(false);
      expect(badModuleResult.validation.toolsCount).toBe(0);
      expect(badModuleResult.validation.errors.length).toBeGreaterThan(0);

      console.log('✅ Handled mixed success/failure correctly');
      console.log(`   Good module: ${goodModuleResult.validation.toolsCount} tools`);
      console.log(`   Bad module errors: ${badModuleResult.validation.errors.join(', ')}`);
    });

    it('should handle modules where getTools() throws an error', async () => {
      console.log('🧪 Testing modules where getTools() throws errors...');
      
      const errorModule = `
export default class ErrorToolsModule {
  static async create(resourceManager) {
    return new ErrorToolsModule();
  }

  get name() { return 'ErrorToolsModule'; }
  
  getTools() {
    throw new Error('Tools are not available right now');
  }
}`;

      await fs.writeFile(path.join(testDir, 'ErrorToolsModule.js'), errorModule);

      console.log('🔄 Running discovery with getTools() error...');
      const result = await moduleDiscovery.discoverAndValidate();

      expect(result.discovered).toBe(1);
      expect(result.validated.length).toBe(1); // Module loads successfully
      
      const moduleResult = result.validated[0];
      expect(moduleResult.validation.valid).toBe(true); // Module is valid even if getTools fails
      expect(moduleResult.validation.toolsCount).toBe(0); // Default to 0 when getTools fails
      expect(moduleResult.validation.score).toBe(50); // Lower score for getTools failure
      expect(moduleResult.validation.warnings.some(w => w.includes('Could not get tools count'))).toBe(true);

      console.log('✅ Handled getTools() error correctly');
      console.log(`   Module loads: ${moduleResult.validation.valid}`);
      console.log(`   Tools count: ${moduleResult.validation.toolsCount} (defaulted due to error)`);
      console.log(`   Warning: ${moduleResult.validation.warnings[0]}`);
    });

    it('should handle modules without getTools method', async () => {
      console.log('🧪 Testing modules without getTools() method...');
      
      const noGetToolsModule = `
export default class NoGetToolsModule {
  static async create(resourceManager) {
    return new NoGetToolsModule();
  }

  get name() { return 'NoGetToolsModule'; }
  
  // Missing getTools() method - should FAIL validation
}`;

      await fs.writeFile(path.join(testDir, 'NoGetToolsModule.js'), noGetToolsModule);

      console.log('🔄 Running discovery with missing getTools()...');
      const result = await moduleDiscovery.discoverAndValidate();

      expect(result.discovered).toBe(1);
      expect(result.validated.length).toBe(0); // Should not validate
      expect(result.invalid.length).toBe(1);   // Should be invalid
      
      const moduleResult = result.invalid[0];
      expect(moduleResult.validation.valid).toBe(false); // Must FAIL - getTools is required
      expect(moduleResult.validation.toolsCount).toBe(0);
      expect(moduleResult.validation.score).toBe(0); // Zero score for missing getTools
      expect(moduleResult.validation.errors.some(e => e.includes('does not have getTools() method'))).toBe(true);

      console.log('✅ Correctly rejected module without getTools()');
      console.log(`   Valid: ${moduleResult.validation.valid} (correctly false)`);
      console.log(`   Error: ${moduleResult.validation.errors[0]}`);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of modules efficiently', async () => {
      console.log('🧪 Testing discovery performance with many modules...');
      
      const moduleCount = 10; // Test with 10 modules for reasonable test time
      const toolsPerModule = 3;
      
      console.log(`Creating ${moduleCount} modules with ${toolsPerModule} tools each...`);
      
      for (let i = 1; i <= moduleCount; i++) {
        const tools = Array.from({ length: toolsPerModule }, (_, j) => ({
          name: `perf_module${i}_tool${j + 1}`,
          description: `Performance test tool ${j + 1} for module ${i}`,
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
          execute: async (params) => ({ result: `Result from module ${i} tool ${j + 1}` })
        }));

        const moduleCode = `
export default class PerfModule${i} {
  static async create(resourceManager) {
    return new PerfModule${i}();
  }

  get name() { return 'PerfModule${i}'; }
  
  getTools() {
    return ${JSON.stringify(tools)};
  }
}`;
        
        await fs.writeFile(path.join(testDir, `PerfModule${i}.js`), moduleCode);
      }

      const startTime = Date.now();
      
      console.log('🔄 Running discoverAndValidate on many modules...');
      const result = await moduleDiscovery.discoverAndValidate();
      
      const duration = Date.now() - startTime;
      
      expect(result.discovered).toBe(moduleCount);
      expect(result.validated.length).toBe(moduleCount);
      expect(result.invalid.length).toBe(0);
      
      const expectedTotalTools = moduleCount * toolsPerModule;
      const actualTotalTools = result.validated.reduce((sum, module) => sum + module.validation.toolsCount, 0);
      expect(actualTotalTools).toBe(expectedTotalTools);

      console.log(`✅ Performance test completed in ${duration}ms`);
      console.log(`   Processed: ${moduleCount} modules with ${actualTotalTools} total tools`);
      console.log(`   Average: ${Math.round(duration / moduleCount)}ms per module`);
      console.log(`   Throughput: ${Math.round(actualTotalTools * 1000 / duration)} tools/second`);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // Less than 10 seconds for 10 modules
    });
  });
});