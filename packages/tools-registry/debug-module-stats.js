/**
 * Debug script to test module statistics behavior
 */

import { getToolManager } from './src/index.js';

async function debugModuleStats() {
  console.log('🔍 DEBUGGING MODULE STATISTICS ISSUE\n');
  
  const toolManager = await getToolManager();
  
  const TEST_CONFIG = {
    searchPaths: ['packages/modules'],
    targetModules: ['ClaudeToolsModule', 'CalculatorModule', 'JsonModule']
  };
  
  console.log('📋 Step 1: Clear all data');
  await toolManager.clearAllData({ force: true });
  
  console.log('📋 Step 2: Get stats after clearing');
  const statsAfterClear = await toolManager.getStatistics();
  console.log('Stats after clear:', {
    discovered: statsAfterClear.modules.totalDiscovered,
    loaded: statsAfterClear.modules.totalLoaded,
    tools: statsAfterClear.tools.total
  });
  
  console.log('📋 Step 3: Discover modules');
  const discovery = await toolManager.discoverModules(TEST_CONFIG.searchPaths);
  console.log('Discovery result:', {
    discovered: discovery.discovered,
    modules: discovery.modules.map(m => m.name)
  });
  
  console.log('📋 Step 4: Get stats after discovery');
  const statsAfterDiscovery = await toolManager.getStatistics();
  console.log('Stats after discovery:', {
    discovered: statsAfterDiscovery.modules.totalDiscovered,
    loaded: statsAfterDiscovery.modules.totalLoaded,
    discoveredModules: statsAfterDiscovery.modules.discoveredModules,
    loadedModules: statsAfterDiscovery.modules.loadedModules
  });
  
  console.log('📋 Step 5: Load target modules');
  for (const targetName of TEST_CONFIG.targetModules) {
    const moduleConfig = discovery.modules.find(m => m.name === targetName);
    if (moduleConfig) {
      try {
        console.log(`Loading ${targetName}...`);
        const result = await toolManager.loadModule(moduleConfig.name, moduleConfig);
        console.log(`  Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.log(`  Error: ${error.message}`);
      }
    }
  }
  
  console.log('📋 Step 6: Get final stats');
  const finalStats = await toolManager.getStatistics();
  console.log('Final stats:', {
    discovered: finalStats.modules.totalDiscovered,
    loaded: finalStats.modules.totalLoaded,
    discoveredModules: finalStats.modules.discoveredModules,
    loadedModules: finalStats.modules.loadedModules,
    tools: finalStats.tools.total
  });
  
  await toolManager.cleanup();
}

debugModuleStats().catch(console.error);