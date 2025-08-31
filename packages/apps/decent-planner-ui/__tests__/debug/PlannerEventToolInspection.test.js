/**
 * Test to inspect the actual messages/events sent by DecentPlanner
 * and check the tool objects in behavior trees within those messages
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { Tool } from '@legion/tools-registry';

describe('Planner Event Tool Inspection', () => {
  let decentPlanner;
  let capturedEvents = [];
  
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

  test('should inspect tool objects in planner events and behavior trees', async () => {
    console.log('=== TESTING PLANNER EVENTS AND BEHAVIOR TREE TOOLS ===');
    
    capturedEvents = [];
    
    // Capture all progress events
    const progressCallback = (message) => {
      capturedEvents.push({
        type: 'progress',
        message,
        timestamp: new Date().toISOString()
      });
      console.log(`EVENT: ${message}`);
    };
    
    const goal = "please write a hello world program";
    console.log(`Starting planning for goal: "${goal}"`);
    
    // Run the planner and capture the result
    const result = await decentPlanner.plan(goal, {}, progressCallback);
    
    console.log('\n=== PLANNER RESULT ANALYSIS ===');
    console.log('Success:', result.success);
    console.log('Has behavior trees:', result.data.behaviorTrees?.length > 0);
    
    expect(result.success).toBe(true);
    expect(result.data.behaviorTrees).toBeDefined();
    expect(result.data.behaviorTrees.length).toBeGreaterThan(0);
    
    // Get the behavior tree from the result
    const behaviorTree = result.data.behaviorTrees[0];
    console.log('\n=== BEHAVIOR TREE STRUCTURE ===');
    console.log('Behavior tree ID:', behaviorTree.id);
    console.log('Behavior tree type:', behaviorTree.type);
    console.log('Number of children:', behaviorTree.children?.length);
    
    // Find action nodes with tools
    const actionNodes = behaviorTree.children?.filter(child => child.type === 'action' && child.tool) || [];
    console.log('Action nodes with tools:', actionNodes.length);
    
    // CRITICAL: Inspect each tool object in the behavior tree
    for (let i = 0; i < actionNodes.length; i++) {
      const node = actionNodes[i];
      console.log(`\n=== ACTION NODE ${i + 1}: ${node.id} ===`);
      console.log('Node tool type:', typeof node.tool);
      console.log('Node tool constructor:', node.tool?.constructor?.name);
      console.log('Node tool instanceof Tool:', node.tool instanceof Tool);
      console.log('Node tool instanceof Object:', node.tool instanceof Object);
      console.log('Node tool has serialize method:', typeof node.tool?.serialize === 'function');
      console.log('Node tool name:', node.tool?.name);
      console.log('Node tool keys:', Object.keys(node.tool || {}));
      
      // Check for circular references by trying to stringify
      try {
        const stringified = JSON.stringify(node.tool);
        console.log('✅ Tool can be JSON.stringify-ed, length:', stringified.length);
        console.log('Tool JSON preview:', stringified.substring(0, 100) + '...');
      } catch (error) {
        console.log('❌ Tool cannot be JSON.stringify-ed:', error.message);
      }
      
      // If it has serialize method, test it
      if (typeof node.tool?.serialize === 'function') {
        try {
          const serialized = node.tool.serialize();
          console.log('✅ Tool.serialize() works:', typeof serialized);
          console.log('Serialized tool name:', serialized.name);
        } catch (error) {
          console.log('❌ Tool.serialize() failed:', error.message);
        }
      }
    }
    
    // Test the entire behavior tree serialization
    console.log('\n=== TESTING BEHAVIOR TREE JSON SERIALIZATION ===');
    try {
      const treeString = JSON.stringify(behaviorTree);
      console.log('✅ Behavior tree can be JSON.stringify-ed');
      
      // Check for [Circular] in the stringified result
      if (treeString.includes('[Circular]')) {
        console.log('❌ Found [Circular] references in behavior tree JSON');
        
        // Find where the circular references are
        const parsed = JSON.parse(treeString);
        console.log('Parsed tree:', JSON.stringify(parsed, null, 2));
      } else {
        console.log('✅ No [Circular] references found in behavior tree JSON');
      }
    } catch (error) {
      console.log('❌ Behavior tree cannot be JSON.stringify-ed:', error.message);
    }
    
    console.log('\n=== EVENT SUMMARY ===');
    console.log('Total events captured:', capturedEvents.length);
    capturedEvents.forEach((event, i) => {
      console.log(`${i + 1}. ${event.message}`);
    });
    
  }, 60000);
});