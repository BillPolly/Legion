/**
 * Module Loading Debug Test
 * Identify which specific modules are causing syntax errors
 */

import { getToolManager } from '../../src/index.js';

describe('Module Loading Debug', () => {
  let toolManager;

  beforeAll(async () => {
    toolManager = await getToolManager();
  }, 30000);

  afterAll(async () => {
    if (toolManager) await toolManager.cleanup();
  });

  test('should identify failing modules', async () => {
    console.log('\n🔍 DEBUG: Identifying failing modules');
    
    // Clear and discover
    await toolManager.clearAllData();
    const discovery = await toolManager.discoverModules([
      'packages/modules'  // Use relative path instead of absolute
    ]);
    
    console.log(`Discovered ${discovery.discovered} modules`);
    
    // Try loading each module individually to isolate failures
    const failedModules = [];
    const successfulModules = [];
    
    for (const module of discovery.modules.slice(10, 25)) {
      try {
        console.log(`\nTesting module: ${module.name} (${module.path.split('/').pop()})`);
        const result = await toolManager.loadModule(module.name, { path: module.path });
        
        if (result.success) {
          successfulModules.push(module.name);
          console.log(`✅ ${module.name}: loaded successfully, ${result.toolCount} tools`);
        } else {
          failedModules.push({ name: module.name, error: result.error });
          console.log(`❌ ${module.name}: ${result.error}`);
        }
      } catch (error) {
        failedModules.push({ name: module.name, error: error.message });
        console.log(`❌ ${module.name}: EXCEPTION - ${error.message}`);
        
        // Check if it's the syntax error we're looking for
        if (error.message.includes('Unexpected token')) {
          console.log(`🔍 SYNTAX ERROR FOUND in ${module.name}:`);
          console.log(`   File: ${module.path}`);
          console.log(`   Error: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Results: ${successfulModules.length} successful, ${failedModules.length} failed`);
    console.log('Failed modules:', failedModules.map(f => `${f.name}: ${f.error}`));
    
    expect(successfulModules.length).toBeGreaterThan(5);
  }, 90000);
});