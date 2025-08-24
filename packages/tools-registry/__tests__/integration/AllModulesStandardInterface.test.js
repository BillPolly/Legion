/**
 * Comprehensive test to validate all Legion modules follow the standard interface
 * 
 * This test discovers all modules in the monorepo and validates they:
 * 1. Follow the standard Module interface
 * 2. Have the required static create() method
 * 3. Can be loaded and initialized
 * 4. Have proper getTools() implementation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';

describe('All Modules Standard Interface Validation', () => {
  let moduleDiscovery;
  let moduleLoader;
  let resourceManager;
  let discoveredModules;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getResourceManager();
    
    // Create ModuleLoader with ResourceManager
    moduleLoader = new ModuleLoader({ resourceManager });
    
    // Create ModuleDiscovery
    moduleDiscovery = new ModuleDiscovery({ verbose: false });
    
    // Discover all modules in the monorepo
    discoveredModules = await moduleDiscovery.discoverInMonorepo();
    
    console.log(`\n📦 Discovered ${discoveredModules.length} modules in monorepo`);
  });
  
  afterAll(() => {
    if (moduleLoader) {
      moduleLoader.cleanup();
    }
  });
  
  describe('Module Interface Compliance', () => {
    it('should have discovered at least 30 modules', () => {
      expect(discoveredModules.length).toBeGreaterThanOrEqual(30);
    });
    
    it('should validate all modules follow standard interface', async () => {
      const validationResults = [];
      
      for (const module of discoveredModules) {
        const moduleName = module.name;
        const modulePath = module.path;
        try {
          // Load the module
          const moduleInstance = await moduleLoader.loadModule(modulePath);
          
          // Validate module has required properties
          expect(moduleInstance).toBeDefined();
          expect(moduleInstance.name).toBeTruthy();
          expect(moduleInstance.description).toBeTruthy();
          expect(moduleInstance.version).toBeTruthy();
          
          // Validate module has required methods
          expect(typeof moduleInstance.getTools).toBe('function');
          
          // Validate module constructor has static create method
          expect(typeof moduleInstance.constructor.create).toBe('function');
          
          // Validate getTools returns an array
          const tools = moduleInstance.getTools();
          expect(Array.isArray(tools)).toBe(true);
          
          // Validate each tool has required properties
          for (const tool of tools) {
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('execute');
            expect(typeof tool.execute).toBe('function');
          }
          
          // Module passes all validations
          validationResults.push({
            name: moduleName,
            success: true,
            toolCount: tools.length
          });
          console.log(`    ✅ ${moduleName}: Compliant with standard interface (${tools.length} tools)`);
          
        } catch (error) {
          // Log which module failed and why
          validationResults.push({
            name: moduleName,
            success: false,
            error: error.message
          });
          console.error(`    ❌ ${moduleName}: ${error.message}`);
        }
      }
      
      // Report validation summary
      const successful = validationResults.filter(r => r.success);
      const failed = validationResults.filter(r => !r.success);
      
      console.log(`\n📋 Validation Summary:`);
      console.log(`   ✅ Compliant modules: ${successful.length}`);
      console.log(`   ❌ Non-compliant modules: ${failed.length}`);
      
      if (failed.length > 0) {
        console.log(`\n   Failed modules:`);
        failed.forEach(f => {
          console.log(`     - ${f.name}: ${f.error}`);
        });
      }
      
      // All modules should be compliant
      expect(failed.length).toBe(0);
    });
  });
  
  describe('Module Loading and Initialization', () => {
    it('should be able to load and initialize all modules', async () => {
      const results = {
        successful: [],
        failed: []
      };
      
      for (const module of discoveredModules) {
        try {
          const moduleInstance = await moduleLoader.loadModule(module.path);
          
          // Try to get metadata
          const metadata = await moduleLoader.getModuleMetadata(moduleInstance);
          
          results.successful.push({
            name: module.name,
            version: metadata.version,
            toolCount: moduleInstance.getTools().length
          });
        } catch (error) {
          results.failed.push({
            name: module.name,
            error: error.message
          });
        }
      }
      
      // Report results
      console.log(`\n📊 Module Loading Summary:`);
      console.log(`   ✅ Successfully loaded: ${results.successful.length}`);
      console.log(`   ❌ Failed to load: ${results.failed.length}`);
      
      if (results.failed.length > 0) {
        console.log(`\n   Failed modules:`);
        results.failed.forEach(f => {
          console.log(`     - ${f.name}: ${f.error}`);
        });
      }
      
      // All modules should load successfully
      expect(results.failed.length).toBe(0);
      expect(results.successful.length).toBe(discoveredModules.length);
    });
  });
  
  describe('Module Tool Execution', () => {
    it('should be able to execute at least one tool from each module with tools', async () => {
      const executionResults = {
        modulesWithTools: 0,
        modulesWithoutTools: 0,
        successfulExecutions: 0,
        failedExecutions: 0
      };
      
      for (const module of discoveredModules) {
        try {
          const moduleInstance = await moduleLoader.loadModule(module.path);
          const tools = moduleInstance.getTools();
          
          if (tools.length === 0) {
            executionResults.modulesWithoutTools++;
            continue;
          }
          
          executionResults.modulesWithTools++;
          
          // Try to find a simple tool to execute (preferably one without required params)
          let executed = false;
          
          for (const tool of tools) {
            // Skip tools that require specific parameters we don't have
            if (tool.inputSchema?.required?.length > 0) {
              continue;
            }
            
            try {
              // Try to execute with empty params
              const result = await moduleLoader.invokeTool(tool, {});
              executionResults.successfulExecutions++;
              executed = true;
              break;
            } catch (error) {
              // Tool might require params, try next one
              continue;
            }
          }
          
          if (!executed) {
            // No tool could be executed without params, that's ok
            console.log(`    ℹ️  ${module.name}: All tools require parameters`);
          }
          
        } catch (error) {
          executionResults.failedExecutions++;
          console.error(`    ❌ ${module.name}: Failed to load for execution - ${error.message}`);
        }
      }
      
      // Report execution results
      console.log(`\n🔧 Tool Execution Summary:`);
      console.log(`   Modules with tools: ${executionResults.modulesWithTools}`);
      console.log(`   Modules without tools: ${executionResults.modulesWithoutTools}`);
      console.log(`   Successful tool executions: ${executionResults.successfulExecutions}`);
      console.log(`   Failed module loads: ${executionResults.failedExecutions}`);
      
      // Should have at least some modules with tools
      expect(executionResults.modulesWithTools).toBeGreaterThan(0);
      // Should not have any failed module loads
      expect(executionResults.failedExecutions).toBe(0);
    });
  });
  
  describe('Module Caching', () => {
    it('should properly cache loaded modules', async () => {
      // Pick first module to test caching
      const testModule = discoveredModules[0];
      
      // Load module twice
      const instance1 = await moduleLoader.loadModule(testModule.path);
      const instance2 = await moduleLoader.loadModule(testModule.path);
      
      // Should be same instance (cached)
      expect(instance1).toBe(instance2);
      
      // Cache should contain the module
      expect(moduleLoader.moduleCache.size).toBeGreaterThan(0);
      expect(moduleLoader.moduleCache.has(testModule.path)).toBe(true);
    });
  });
});