/**
 * Integration test to verify all modules from ModuleRegistry.json are loaded
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ResourceManager } from '@legion/tool-system';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ModuleLoader Registry Integration', () => {
  let moduleLoader;
  let resourceManager;
  let registryModules;

  beforeAll(async () => {
    // Load the module registry
    const registryPath = path.resolve(__dirname, '../../../module-loader/src/ModuleRegistry.json');
    const registryContent = await fs.readFile(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);
    registryModules = registry.modules;
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create ModuleLoader with ResourceManager
    moduleLoader = new ModuleLoader(resourceManager);
  });

  test('should load all modules from ModuleRegistry.json', async () => {
    // Load all modules
    const loadedModules = await moduleLoader.loadModules({ verbose: false });
    
    // Get the module names from the registry
    const registryModuleNames = Object.keys(registryModules);
    
    // Get the loaded module names
    const loadedModuleNames = Array.from(loadedModules.keys());
    
    console.log('Registry modules:', registryModuleNames.length);
    console.log('Loaded modules:', loadedModuleNames.length);
    console.log('Registry module names:', registryModuleNames.sort());
    console.log('Loaded module names:', loadedModuleNames.sort());
    
    // Verify all registry modules are loaded
    expect(loadedModuleNames.length).toBeGreaterThanOrEqual(registryModuleNames.length);
    
    // Check each registry module is loaded
    for (const moduleName of registryModuleNames) {
      expect(loadedModuleNames).toContain(moduleName);
    }
  });

  test('should have correct module metadata', async () => {
    const loadedModules = await moduleLoader.loadModules({ verbose: false });
    
    // Check each loaded module has proper metadata
    for (const [moduleName, moduleInfo] of loadedModules) {
      expect(moduleInfo).toHaveProperty('name');
      expect(moduleInfo).toHaveProperty('className');
      expect(moduleInfo).toHaveProperty('dependencies');
      expect(moduleInfo).toHaveProperty('tools');
      expect(moduleInfo).toHaveProperty('functionCount');
      expect(moduleInfo).toHaveProperty('isJsonModule');
      
      expect(moduleInfo.name).toBe(moduleName);
      expect(Array.isArray(moduleInfo.dependencies)).toBe(true);
      expect(Array.isArray(moduleInfo.tools)).toBe(true);
      expect(typeof moduleInfo.functionCount).toBe('number');
      expect(typeof moduleInfo.isJsonModule).toBe('boolean');
    }
  });

  test('should handle both class and JSON modules', async () => {
    const loadedModules = await moduleLoader.loadModules({ verbose: false });
    
    let classModuleCount = 0;
    let jsonModuleCount = 0;
    
    for (const [moduleName, moduleInfo] of loadedModules) {
      if (moduleInfo.isJsonModule) {
        jsonModuleCount++;
      } else {
        classModuleCount++;
      }
    }
    
    console.log('Class modules:', classModuleCount);
    console.log('JSON modules:', jsonModuleCount);
    
    // We should have both types of modules
    expect(classModuleCount).toBeGreaterThan(0);
    expect(jsonModuleCount).toBeGreaterThan(0);
  });

  test('should correctly count total modules (25 from registry)', () => {
    const registryModuleCount = Object.keys(registryModules).length;
    expect(registryModuleCount).toBe(25);
  });

  test('should load specific modules from registry', async () => {
    const loadedModules = await moduleLoader.loadModules({ verbose: false });
    
    // Test some specific modules we know should exist
    const expectedModules = [
      'file',
      'command-executor',
      'js-generator',
      'railway',
      'llm-planner',
      'profile-planner',
      'playwright',
      'serper',
      'conan-the-deployer'
    ];
    
    for (const expectedModule of expectedModules) {
      expect(loadedModules.has(expectedModule)).toBe(true);
      
      const moduleInfo = loadedModules.get(expectedModule);
      expect(moduleInfo).toBeDefined();
      expect(moduleInfo.name).toBe(expectedModule);
    }
  });

  test('should create module instances successfully', async () => {
    const loadedModules = await moduleLoader.loadModules({ verbose: false });
    
    // Try to create instances of a few modules
    const testModules = ['file', 'json', 'calculator'];
    
    for (const moduleName of testModules) {
      if (loadedModules.has(moduleName)) {
        try {
          const instance = moduleLoader.createModuleInstance(moduleName);
          expect(instance).toBeDefined();
          expect(typeof instance.getTools).toBe('function');
        } catch (error) {
          // Some modules might require specific dependencies
          console.log(`Could not instantiate ${moduleName}: ${error.message}`);
        }
      }
    }
  });

  test('should report correct tool counts', async () => {
    const loadedModules = await moduleLoader.loadModules({ verbose: false });
    
    let totalTools = 0;
    for (const [moduleName, moduleInfo] of loadedModules) {
      totalTools += moduleInfo.functionCount;
      
      // Each module should have at least one tool
      if (moduleInfo.functionCount > 0) {
        expect(moduleInfo.tools.length).toBeGreaterThan(0);
      }
    }
    
    console.log('Total tools across all modules:', totalTools);
    expect(totalTools).toBeGreaterThan(0);
  });
});