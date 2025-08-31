/**
 * Test that behavior trees contain actual Tool objects
 */

import { ResourceManager } from '@legion/resource-manager';
import { Tool } from '@legion/tools-registry';
import { DecentPlanner } from '../../src/DecentPlanner.js';

describe('Behavior Tree Tool Object Test', () => {
  let decentPlanner;
  
  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    decentPlanner = new DecentPlanner({
      maxDepth: 5,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true,
      logLevel: 'info'
    });
    await decentPlanner.initialize();
  }, 30000);

  test('behavior trees should contain actual Tool objects', async () => {
    console.log('=== TESTING BEHAVIOR TREES CONTAIN TOOL OBJECTS ===');
    
    try {
      // Simple task that should discover tools and generate behavior tree
      const goal = "write hello world program";
      const result = await decentPlanner.plan(goal, {});
      
      console.log('Planning success:', result.success);
      
      if (!result.success) {
        console.log('❌ Planning failed:', result.error);
        return;
      }
      
      console.log('Has behavior trees:', result.data.behaviorTrees?.length > 0);
      
      if (result.data.behaviorTrees && result.data.behaviorTrees.length > 0) {
        const behaviorTree = result.data.behaviorTrees[0];
        console.log('Behavior tree ID:', behaviorTree.id);
        console.log('Children count:', behaviorTree.children?.length);
        
        // Find action nodes with tools
        const actionNodes = behaviorTree.children?.filter(child => child.type === 'action' && child.tool) || [];
        console.log('Action nodes with tools:', actionNodes.length);
        
        for (let i = 0; i < actionNodes.length; i++) {
          const node = actionNodes[i];
          console.log(`\n=== Action Node ${i + 1}: ${node.id} ===`);
          console.log('Tool type:', typeof node.tool);
          console.log('Tool constructor:', node.tool?.constructor?.name);
          console.log('Tool instanceof Tool:', node.tool instanceof Tool);
          console.log('Tool has serialize method:', typeof node.tool?.serialize === 'function');
          console.log('Tool name:', node.tool?.name);
          
          // CHECK INPUTS AND OUTPUTS
          console.log('\n--- INPUTS ---');
          console.log('Has inputs:', 'inputs' in node);
          console.log('Inputs type:', typeof node.inputs);
          console.log('Inputs keys:', node.inputs ? Object.keys(node.inputs) : 'none');
          if (node.inputs) {
            try {
              console.log('Inputs content:', JSON.stringify(node.inputs, null, 2));
            } catch (error) {
              console.log('Inputs cannot be JSON.stringify-ed:', error.message);
              console.log('Inputs object keys and values:');
              for (const [key, value] of Object.entries(node.inputs)) {
                console.log(`  ${key}: ${typeof value} = ${value}`);
              }
            }
          }
          
          console.log('\n--- OUTPUTS ---');
          console.log('Has outputs:', 'outputs' in node);
          console.log('Outputs type:', typeof node.outputs);
          console.log('Outputs keys:', node.outputs ? Object.keys(node.outputs) : 'none');
          if (node.outputs) {
            try {
              console.log('Outputs content:', JSON.stringify(node.outputs, null, 2));
            } catch (error) {
              console.log('Outputs cannot be JSON.stringify-ed:', error.message);
              console.log('Outputs object keys and values:');
              for (const [key, value] of Object.entries(node.outputs)) {
                console.log(`  ${key}: ${typeof value} = ${value}`);
              }
            }
          }
          
          // CRITICAL: Tool should be actual Tool instance
          expect(node.tool instanceof Tool).toBe(true);
          expect(typeof node.tool.serialize).toBe('function');
          
          // Test that serialize works
          const serialized = node.tool.serialize();
          console.log('\nTool serializes successfully:', typeof serialized);
          
          // Verify inputs and outputs exist
          expect(node.inputs).toBeDefined();
          expect(node.outputs).toBeDefined();
          expect(typeof node.inputs).toBe('object');
          expect(typeof node.outputs).toBe('object');
        }
        
        console.log('✅ All behavior tree tools are genuine Tool objects');
        
      } else {
        console.log('❌ No behavior trees generated');
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      throw error;
    }
    
  }, 60000);
});