/**
 * Simple Debug Test - Find out what's happening with tool discovery
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';

describe('Simple Tool Discovery Debug', () => {
  test('Debug tool discovery step by step', async () => {
    console.log('🚀 Starting debug test...');
    
    const decentPlanner = new DecentPlanner({
      logLevel: 'debug'
    });
    
    await decentPlanner.initialize();
    console.log('✅ DecentPlanner initialized');
    
    // Step 1: Task decomposition
    const goal = 'write a hello world program';
    const informalResult = await decentPlanner.planTaskDecompositionOnly(goal);
    
    console.log('📊 Informal result success:', informalResult.success);
    console.log('📋 Root task complexity:', informalResult.data?.rootTask?.complexity);
    console.log('📋 Root task subtasks count:', informalResult.data?.rootTask?.subtasks?.length);
    console.log('📋 Full root task:', JSON.stringify(informalResult.data?.rootTask, null, 2));
    
    expect(informalResult.success).toBe(true);
    
    // Step 2: Tool discovery
    console.log('🔍 Starting tool discovery...');
    const toolsResult = await decentPlanner.discoverToolsForCurrentPlan();
    
    console.log('📊 Tools result success:', toolsResult.success);
    console.log('📋 Tools in root task:', toolsResult.data?.rootTask?.tools?.length || 'undefined');
    
    if (toolsResult.success) {
      console.log('🔧 Tools found:', toolsResult.data?.rootTask?.tools?.map(t => t.name) || []);
    } else {
      console.log('❌ Tool discovery failed:', toolsResult.error);
    }
    
    // This test just needs to complete without crashing
    expect(toolsResult).toBeDefined();
  }, 60000);
});