#!/usr/bin/env node

import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from './src/integration/ToolRegistry.js';

async function debugToolRegistry() {
  console.log('🔍 Debug ToolRegistry initialization step by step...');
  
  try {
    // Step 1: ResourceManager
    console.log('\n📋 Step 1: Initialize ResourceManager');
    const resourceManager = await ResourceManager.getResourceManager();
    console.log('✅ ResourceManager initialized');

    // Step 2: Create ToolRegistry (no features)
    console.log('\n📋 Step 2: Create ToolRegistry (minimal)');
    const toolRegistry = new ToolRegistry({ 
      resourceManager,
      enablePerspectives: false,
      enableVectorSearch: false,
      maxConnections: 1  // Reduce connections
    });
    console.log('✅ ToolRegistry created');

    // Step 3: Initialize ToolRegistry with debug output
    console.log('\n📋 Step 3: Initialize ToolRegistry (starting...)');
    console.time('ToolRegistry.initialize');
    
    // Let's add some debug logging to track where it hangs
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      originalConsoleLog(new Date().toISOString(), ...args);
    };
    
    await toolRegistry.initialize();
    console.timeEnd('ToolRegistry.initialize');
    console.log('✅ ToolRegistry initialized successfully');

    // Step 4: Test basic functionality
    console.log('\n📋 Step 4: Test basic functionality');
    const health = await toolRegistry.healthCheck();
    console.log('Health check result:', health);

    // Step 5: Cleanup
    console.log('\n📋 Step 5: Cleanup');
    await toolRegistry.cleanup();
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All steps completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Add timeout to prevent hanging indefinitely
setTimeout(() => {
  console.error('\n⏰ TIMEOUT: ToolRegistry initialization took too long');
  process.exit(1);
}, 10000); // 10 second timeout

debugToolRegistry().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});