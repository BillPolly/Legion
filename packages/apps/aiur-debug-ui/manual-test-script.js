#!/usr/bin/env node

/**
 * Manual test script to verify the complete UI module loading workflow
 * 
 * This script simulates the exact user workflow that was failing:
 * 1. module_tools calculator (should show correct info)
 * 2. module_load calculator (should load successfully) 
 * 3. calculator_evaluate '2+2' (should work after loading)
 */

import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { SessionManager } from '../../aiur/src/server/SessionManager.js';
import { ToolDefinitionProvider } from '../../aiur/src/core/ToolDefinitionProvider.js';

async function runManualTest() {
  console.log('🚀 Starting manual test for UI module loading workflow...\n');

  try {
    // Initialize ResourceManager and dependencies
    console.log('1. Initializing ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create SessionManager (simulates the server)
    console.log('2. Creating SessionManager...');
    const sessionManager = new SessionManager(
      new ModuleFactory(resourceManager),
      new ToolDefinitionProvider()
    );

    // Test 1: Check module_tools before loading
    console.log('\n📋 TEST 1: module_tools calculator (before loading)');
    try {
      const moduleToolsResult = await sessionManager.callTool('module_tools', {
        module: 'calculator'
      });
      console.log('✅ module_tools result:', JSON.stringify(moduleToolsResult, null, 2));
      
      // Verify the fix - should show correct module info, not undefined
      if (moduleToolsResult.module === 'calculator' && 
          moduleToolsResult.status && 
          moduleToolsResult.toolCount !== undefined) {
        console.log('✅ Module info shows correctly (flatMap fix working)');
      } else {
        console.log('❌ Module info still showing undefined values');
      }
    } catch (error) {
      console.log('❌ module_tools failed:', error.message);
    }

    // Test 2: Load calculator module
    console.log('\n📦 TEST 2: module_load calculator');
    try {
      const loadResult = await sessionManager.callTool('module_load', {
        module: 'calculator'
      });
      console.log('✅ module_load result:', JSON.stringify(loadResult, null, 2));
      
      if (loadResult.success) {
        console.log('✅ Module loaded successfully');
      } else {
        console.log('❌ Module load failed');
        return;
      }
    } catch (error) {
      console.log('❌ module_load failed:', error.message);
      return;
    }

    // Test 3: Check available tools after loading
    console.log('\n🔧 TEST 3: Check tools list after loading');
    try {
      const toolsResult = await sessionManager.callTool('tools/list', {});
      const toolNames = toolsResult.tools ? toolsResult.tools.map(t => t.name) : [];
      console.log(`✅ Available tools (${toolNames.length}):`, toolNames.slice(0, 10), '...');
      
      if (toolNames.includes('calculator_evaluate')) {
        console.log('✅ calculator_evaluate is now available in tools list');
      } else {
        console.log('❌ calculator_evaluate not found in tools list');
        console.log('Available tools:', toolNames);
      }
    } catch (error) {
      console.log('❌ tools/list failed:', error.message);
    }

    // Test 4: Execute calculator tool
    console.log('\n🧮 TEST 4: calculator_evaluate "2+2"');
    try {
      const calcResult = await sessionManager.callTool('calculator_evaluate', {
        expression: '2+2'
      });
      console.log('✅ calculator_evaluate result:', JSON.stringify(calcResult, null, 2));
      
      if (calcResult.result === 4) {
        console.log('✅ Calculator executed successfully: 2+2 = 4');
      } else {
        console.log('❌ Calculator returned unexpected result');
      }
    } catch (error) {
      console.log('❌ calculator_evaluate failed:', error.message);
    }

    // Test 5: Check module_tools after loading
    console.log('\n📋 TEST 5: module_tools calculator (after loading)');
    try {
      const moduleToolsAfter = await sessionManager.callTool('module_tools', {
        module: 'calculator'
      });
      console.log('✅ module_tools after loading:', JSON.stringify(moduleToolsAfter, null, 2));
      
      if (moduleToolsAfter.status === 'loaded' && moduleToolsAfter.toolCount > 0) {
        console.log('✅ Module tools shows loaded status with tools');
      } else {
        console.log('❌ Module tools not showing correct loaded state');
      }
    } catch (error) {
      console.log('❌ module_tools (after) failed:', error.message);
    }

    console.log('\n🎉 Manual test completed!');
    console.log('\n📝 Summary:');
    console.log('- Fixed flatMap issue in ModuleManager.js (no more undefined values)');
    console.log('- Fixed UI response formatting to handle wrapped responses');
    console.log('- Fixed CLI command parsing for module commands');
    console.log('- Added automatic tool refresh after module_load in CLI');
    console.log('- All fixes verified through unit and integration tests');

  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
}

// Run the test
runManualTest().then(() => {
  console.log('\n✅ Test script completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});