/**
 * Tool Discovery and Module Integrity Test
 * 
 * Tests the comprehensive tool discovery system and validates that all modules
 * in the Legion codebase conform to proper interfaces and can be instantiated correctly.
 */

import { ComprehensiveToolDiscovery } from '../../src/discovery/ComprehensiveToolDiscovery.js';
import { DirectModuleDiscovery } from '../../src/discovery/DirectModuleDiscovery.js';
import { ModuleInstantiator } from '../../src/discovery/ModuleInstantiator.js';
import { getKnownModules } from '../../src/discovery/KnownModules.js';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('Tool Discovery and Module Integrity', () => {
  let resourceManager;
  let discovery;
  let moduleDiscovery;
  let instantiator;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    
    // Create discovery components
    discovery = new ComprehensiveToolDiscovery();
    await discovery.initialize();
    
    moduleDiscovery = new DirectModuleDiscovery({ verbose: false });
    instantiator = new ModuleInstantiator({
      resourceManager,
      verbose: false,
      fallbackStrategies: true
    });
  });

  describe('Known Modules Registry', () => {
    test('should have proper module definitions', () => {
      const knownModules = getKnownModules();
      
      expect(knownModules).toBeDefined();
      expect(Array.isArray(knownModules)).toBe(true);
      expect(knownModules.length).toBeGreaterThan(0);
      
      // Check each module has required fields
      knownModules.forEach((module, index) => {
        expect(module).toHaveProperty('name');
        expect(module).toHaveProperty('path');
        expect(module).toHaveProperty('className');
        expect(module).toHaveProperty('package');
        expect(module).toHaveProperty('description');
        
        expect(typeof module.name).toBe('string');
        expect(typeof module.path).toBe('string');
        expect(typeof module.className).toBe('string');
        expect(typeof module.package).toBe('string');
        expect(typeof module.description).toBe('string');
        
        expect(module.name.length).toBeGreaterThan(0);
        expect(module.path.length).toBeGreaterThan(0);
        expect(module.className.length).toBeGreaterThan(0);
        
        console.log(`✅ Module ${index + 1}: ${module.name} (${module.className})`);
      });
    });
    
    test('should have valid module paths', async () => {
      const knownModules = getKnownModules();
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const legionRoot = await discovery.findLegionRoot();
      
      for (const module of knownModules) {
        const fullPath = path.join(legionRoot, module.path);
        
        try {
          await fs.access(fullPath);
          console.log(`✅ ${module.name}: File exists at ${module.path}`);
        } catch (error) {
          console.error(`❌ ${module.name}: File NOT FOUND at ${module.path}`);
          expect(false).toBe(true); // Fail the test
        }
      }
    });
  });

  describe('Module Discovery', () => {
    test('should discover all known modules', async () => {
      const legionRoot = await discovery.findLegionRoot();
      const discoveredModules = await moduleDiscovery.discoverModules(legionRoot);
      
      expect(Array.isArray(discoveredModules)).toBe(true);
      expect(discoveredModules.length).toBeGreaterThan(0);
      
      const knownModules = getKnownModules();
      const discoveredNames = new Set(discoveredModules.map(m => m.name));
      
      console.log(`\n📊 Discovery Results:`);
      console.log(`   Known modules: ${knownModules.length}`);
      console.log(`   Discovered modules: ${discoveredModules.length}`);
      
      // Check that most known modules were discovered
      const foundCount = knownModules.filter(km => discoveredNames.has(km.name)).length;
      const coverage = (foundCount / knownModules.length) * 100;
      
      console.log(`   Coverage: ${foundCount}/${knownModules.length} (${coverage.toFixed(1)}%)`);
      
      // List missing modules
      const missing = knownModules.filter(km => !discoveredNames.has(km.name));
      if (missing.length > 0) {
        console.log(`\n❌ Missing modules:`);
        missing.forEach(m => {
          console.log(`   - ${m.name}: ${m.path}`);
        });
      }
      
      // We expect at least 80% coverage
      expect(coverage).toBeGreaterThanOrEqual(80);
    }, 10000);
    
    test('should extract module metadata correctly', async () => {
      const legionRoot = await discovery.findLegionRoot();
      const discoveredModules = await moduleDiscovery.discoverModules(legionRoot);
      
      // Check each discovered module has proper metadata
      discoveredModules.forEach(module => {
        expect(module).toHaveProperty('name');
        expect(module).toHaveProperty('type');
        expect(module).toHaveProperty('path');
        expect(module).toHaveProperty('className');
        expect(module).toHaveProperty('hasFactory');
        expect(module).toHaveProperty('hasGetTools');
        expect(module).toHaveProperty('needsResourceManager');
        expect(module).toHaveProperty('dependencies');
        
        expect(typeof module.hasFactory).toBe('boolean');
        expect(typeof module.hasGetTools).toBe('boolean');
        expect(typeof module.needsResourceManager).toBe('boolean');
        expect(Array.isArray(module.dependencies)).toBe(true);
      });
      
      // Log some statistics
      const stats = moduleDiscovery.getStats();
      console.log(`\n📈 Module Analysis:`);
      console.log(`   With factory method: ${stats.withFactory}`);
      console.log(`   With getTools method: ${stats.withTools}`);
      console.log(`   Needs ResourceManager: ${stats.needsResourceManager}`);
      console.log(`   By package:`, stats.byPackage);
    });
  });

  describe('Module Instantiation', () => {
    test('should instantiate File module correctly', async () => {
      const knownModules = getKnownModules();
      const fileModule = knownModules.find(m => m.name === 'File');
      
      expect(fileModule).toBeDefined();
      
      // Discover the module first
      const legionRoot = await discovery.findLegionRoot();
      const discoveredModules = await moduleDiscovery.discoverModules(legionRoot);
      const discoveredFileModule = discoveredModules.find(m => m.name === 'File');
      
      expect(discoveredFileModule).toBeDefined();
      
      // Try to instantiate it
      const instance = await instantiator.instantiate(discoveredFileModule);
      
      expect(instance).toBeDefined();
      expect(typeof instance.getTools).toBe('function');
      
      // Check tools
      const tools = instance.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      console.log(`✅ File module instantiated with ${tools.length} tools:`);
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(typeof tool.execute).toBe('function');
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
    }, 10000);
    
    test('should test module interface conformance', async () => {
      const legionRoot = await discovery.findLegionRoot();
      const discoveredModules = await moduleDiscovery.discoverModules(legionRoot);
      
      const results = {
        conforming: [],
        nonConforming: [],
        failed: []
      };
      
      // Test each module
      for (const moduleData of discoveredModules.slice(0, 5)) { // Test first 5 modules
        try {
          console.log(`\n🧪 Testing module: ${moduleData.name}`);
          
          const instance = await instantiator.instantiate(moduleData);
          
          if (!instance) {
            results.failed.push({
              name: moduleData.name,
              reason: 'Failed to instantiate'
            });
            continue;
          }
          
          // Check interface conformance
          const hasGetTools = typeof instance.getTools === 'function';
          const hasGetTool = typeof instance.getTool === 'function';
          
          if (hasGetTools) {
            try {
              const tools = instance.getTools();
              
              if (Array.isArray(tools)) {
                const allToolsValid = tools.every(tool => 
                  tool.name && 
                  tool.description && 
                  typeof tool.execute === 'function'
                );
                
                if (allToolsValid) {
                  results.conforming.push({
                    name: moduleData.name,
                    toolCount: tools.length,
                    hasGetTool,
                    tools: tools.map(t => t.name)
                  });
                  console.log(`   ✅ Conforming: ${tools.length} valid tools`);
                } else {
                  results.nonConforming.push({
                    name: moduleData.name,
                    reason: 'Tools missing required properties',
                    toolCount: tools.length
                  });
                  console.log(`   ❌ Non-conforming: Invalid tool properties`);
                }
              } else {
                results.nonConforming.push({
                  name: moduleData.name,
                  reason: 'getTools() does not return array'
                });
                console.log(`   ❌ Non-conforming: getTools() returns non-array`);
              }
            } catch (error) {
              results.nonConforming.push({
                name: moduleData.name,
                reason: `getTools() throws error: ${error.message}`
              });
              console.log(`   ❌ Non-conforming: getTools() throws error`);
            }
          } else {
            results.nonConforming.push({
              name: moduleData.name,
              reason: 'Missing getTools() method'
            });
            console.log(`   ❌ Non-conforming: No getTools() method`);
          }
          
        } catch (error) {
          results.failed.push({
            name: moduleData.name,
            reason: error.message
          });
          console.log(`   ❌ Failed: ${error.message}`);
        }
      }
      
      console.log(`\n📊 Interface Conformance Results:`);
      console.log(`   Conforming: ${results.conforming.length}`);
      console.log(`   Non-conforming: ${results.nonConforming.length}`);
      console.log(`   Failed: ${results.failed.length}`);
      
      if (results.nonConforming.length > 0) {
        console.log(`\n❌ Non-conforming modules:`);
        results.nonConforming.forEach(module => {
          console.log(`   - ${module.name}: ${module.reason}`);
        });
      }
      
      if (results.failed.length > 0) {
        console.log(`\n❌ Failed modules:`);
        results.failed.forEach(module => {
          console.log(`   - ${module.name}: ${module.reason}`);
        });
      }
      
      // Store results for later analysis
      expect(results.conforming.length).toBeGreaterThan(0);
      
      // We want most modules to be conforming
      const totalTested = results.conforming.length + results.nonConforming.length;
      const conformanceRate = totalTested > 0 ? (results.conforming.length / totalTested) * 100 : 0;
      
      console.log(`\nConformance rate: ${conformanceRate.toFixed(1)}%`);
      
      // Expect at least 60% conformance rate
      expect(conformanceRate).toBeGreaterThanOrEqual(60);
    }, 30000);
  });

  describe('Complete Discovery Process', () => {
    test('should run full discovery and populate database', async () => {
      const results = await discovery.populateDatabase({
        mode: 'clear',
        verbose: false,
        includeEmbeddings: false
      });
      
      expect(results).toBeDefined();
      expect(typeof results.modulesDiscovered).toBe('number');
      expect(typeof results.modulesAdded).toBe('number');
      expect(typeof results.toolsDiscovered).toBe('number');
      expect(typeof results.toolsAdded).toBe('number');
      
      console.log(`\n🎯 Full Discovery Results:`);
      console.log(`   Modules discovered: ${results.modulesDiscovered}`);
      console.log(`   Modules added: ${results.modulesAdded}`);
      console.log(`   Modules failed: ${results.modulesFailed}`);
      console.log(`   Tools discovered: ${results.toolsDiscovered}`);
      console.log(`   Tools added: ${results.toolsAdded}`);
      console.log(`   Tools failed: ${results.toolsFailed}`);
      console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);
      
      // Check that we found and processed modules successfully
      expect(results.modulesDiscovered).toBeGreaterThan(0);
      expect(results.modulesAdded).toBeGreaterThan(0);
      expect(results.toolsDiscovered).toBeGreaterThan(0);
      
      // We expect most operations to succeed
      const moduleSuccessRate = results.modulesDiscovered > 0 
        ? (results.modulesAdded / results.modulesDiscovered) * 100 
        : 0;
      const toolSuccessRate = results.toolsDiscovered > 0 
        ? (results.toolsAdded / results.toolsDiscovered) * 100 
        : 0;
        
      console.log(`   Module success rate: ${moduleSuccessRate.toFixed(1)}%`);
      console.log(`   Tool success rate: ${toolSuccessRate.toFixed(1)}%`);
      
      expect(moduleSuccessRate).toBeGreaterThanOrEqual(70);
      expect(toolSuccessRate).toBeGreaterThanOrEqual(60);
    }, 60000);
  });
});