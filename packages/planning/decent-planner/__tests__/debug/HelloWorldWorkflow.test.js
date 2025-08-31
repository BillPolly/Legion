/**
 * HelloWorldWorkflow Integration Test
 * Tests the complete workflow: informal planning -> tool discovery -> formal planning
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';

describe('DecentPlanner Hello World Workflow', () => {
  let decentPlanner;
  
  beforeAll(async () => {
    decentPlanner = new DecentPlanner({
      maxDepth: 5,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true,
      logLevel: 'info'
    });
    
    await decentPlanner.initialize();
  }, 30000);

  test('Step 1: Task decomposition only (informal planning)', async () => {
    const goal = 'please write a hello world program in javascript';
    
    console.log('🧪 Testing task decomposition only...');
    
    const result = await decentPlanner.planTaskDecompositionOnly(goal, {}, (message) => {
      console.log('📝 Progress:', message);
    });
    
    console.log('📊 Task decomposition result:', JSON.stringify(result, null, 2));
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.goal).toBe(goal);
    expect(result.data.rootTask).toBeDefined();
    expect(result.data.rootTask.description).toBe(goal);
    expect(result.stage).toBe('informal_only');
    
    // Should NOT have tools yet (only task decomposition)
    expect(result.data.rootTask.tools).toEqual([]);
    
    console.log('✅ Task decomposition completed successfully');
    console.log('📋 Root task:', result.data.rootTask.description);
    console.log('🎯 Complexity:', result.data.rootTask.complexity);
  }, 30000);

  test('Step 2: Tool discovery on existing plan', async () => {
    console.log('🧪 Testing tool discovery...');
    
    // Debug: Check current plan state before tool discovery
    console.log('📋 Current plan before tool discovery:', JSON.stringify(decentPlanner.currentPlan?.rootTask, null, 2));
    
    // Should use the plan from step 1
    const result = await decentPlanner.discoverToolsForCurrentPlan((message) => {
      console.log('🔍 Tool discovery progress:', message);
    });
    
    console.log('🔧 Tool discovery result:', JSON.stringify(result, null, 2));
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.stage).toBe('tools_discovered');
    
    // Should now have tools
    expect(result.data.rootTask.tools).toBeDefined();
    expect(result.data.rootTask.tools.length).toBeGreaterThan(0);
    
    console.log('✅ Tool discovery completed successfully');
    console.log('🔧 Found', result.data.rootTask.tools.length, 'tools:');
    
    result.data.rootTask.tools.forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool.name} (confidence: ${tool.confidence})`);
      console.log(`     ${tool.reasoning}`);
      
      // Verify tool structure
      expect(tool.name).toBeDefined();
      expect(tool.confidence).toBeGreaterThan(0);
      expect(tool.reasoning).toBeDefined();
    });
    
    // Verify specific tools for hello world
    const toolNames = result.data.rootTask.tools.map(t => t.name);
    console.log('🎯 Tool names found:', toolNames);
    
    // Should find JavaScript-related tools
    expect(toolNames.some(name => name.includes('javascript') || name.includes('Write'))).toBe(true);
    
  }, 30000);

  test('Step 3: Verify plan state is maintained between steps', async () => {
    console.log('🧪 Testing plan state persistence...');
    
    const currentPlan = decentPlanner.currentPlan;
    
    expect(currentPlan).toBeDefined();
    expect(currentPlan.goal).toBe('please write a hello world program in javascript');
    expect(currentPlan.rootTask.tools.length).toBeGreaterThan(0);
    expect(currentPlan.status).toBe('VALIDATED');
    
    console.log('✅ Plan state maintained correctly');
    console.log('📋 Plan ID:', currentPlan.id);
    console.log('🎯 Goal:', currentPlan.goal);
    console.log('📊 Status:', currentPlan.status);
    console.log('🔧 Tools count:', currentPlan.rootTask.tools.length);
  });
});