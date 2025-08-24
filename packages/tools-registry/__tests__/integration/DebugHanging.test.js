/**
 * Debug test to find which module is causing the hang
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Debug Module Hanging', () => {
  let moduleDiscovery;
  let moduleLoader;
  let resourceManager;
  let discoveredModules;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    
    moduleLoader = new ModuleLoader({ resourceManager });
    moduleDiscovery = new ModuleDiscovery({ verbose: false });
    discoveredModules = await moduleDiscovery.discoverInMonorepo();
  });
  
  it('should find which module causes hanging', async () => {
    console.log(`\n📦 Found ${discoveredModules.length} modules\n`);
    
    for (const module of discoveredModules) {
      console.log(`\n⏳ Loading: ${module.name} from ${module.packageName}...`);
      
      // Set a timeout for each module load
      const loadPromise = moduleLoader.loadModule(module.path);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );
      
      try {
        const moduleInstance = await Promise.race([loadPromise, timeoutPromise]);
        console.log(`  ✅ ${module.name}: Loaded successfully`);
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          console.log(`  ⏱️  ${module.name}: HANGING - Module load timed out after 5 seconds`);
          console.log(`      Path: ${module.path}`);
        } else {
          console.log(`  ❌ ${module.name}: ${error.message}`);
        }
      }
    }
    
    expect(true).toBe(true); // Just complete the test
  });
});