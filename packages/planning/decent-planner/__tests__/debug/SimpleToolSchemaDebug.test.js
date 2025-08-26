/**
 * Simple debug test to hook into the formal planner and log tool schemas
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Simple Tool Schema Debug', () => {
  let decentPlanner;

  beforeAll(async () => {
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    const llmClient = await resourceManager.get('llmClient');
    decentPlanner = new DecentPlanner(llmClient);
    await decentPlanner.initialize();
  });

  test('Hook into formal planner to see what tools it receives', async () => {
    const goal = "please write a hello world program in javascript";

    console.log('\n=== HOOKING INTO FORMAL PLANNER ===\n');

    // Hook into the formal planner to see exactly what tools it receives
    const originalMakePlan = decentPlanner.formalPlanner.makePlan.bind(decentPlanner.formalPlanner);
    
    decentPlanner.formalPlanner.makePlan = function(requirements, tools, options) {
      console.log('\n🚨 FORMAL PLANNER MAKEEPLAN CALLED:');
      console.log('Requirements:', requirements);
      console.log('Number of tools:', tools.length);
      
      console.log('\n📋 TOOLS RECEIVED BY FORMAL PLANNER:');
      tools.forEach((tool, index) => {
        console.log(`\n--- Tool ${index + 1}: ${tool.name} ---`);
        console.log('Full tool object:', JSON.stringify(tool, null, 2));
      });
      
      return originalMakePlan(requirements, tools, options);
    };

    // Run the full planning process
    const result = await decentPlanner.plan(goal);
    
    console.log('\n✅ Planning completed');
    console.log('Result success:', result.success);

    expect(result.success).toBe(true);
  });
});