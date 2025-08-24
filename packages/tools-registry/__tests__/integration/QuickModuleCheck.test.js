/**
 * Quick check to see which modules can be loaded
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Quick Module Loading Check', () => {
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
  
  it('should quickly check module loading', async () => {
    console.log(`\n📦 Found ${discoveredModules.length} modules\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const module of discoveredModules) { // Test all modules
      try {
        console.log(`Testing: ${module.name}...`);
        const moduleInstance = await moduleLoader.loadModule(module.path);
        console.log(`  ✅ ${module.name}: Loaded successfully`);
        successCount++;
      } catch (error) {
        console.log(`  ❌ ${module.name}: ${error.message}`);
        failCount++;
      }
    }
    
    console.log(`\n📊 Results: ${successCount} succeeded, ${failCount} failed`);
    expect(successCount).toBeGreaterThan(0);
  });
});