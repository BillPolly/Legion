/**
 * Test the tool registry directly to see what getTool() returns
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { Tool } from '@legion/tools-registry';

describe('Tool Registry Direct Test', () => {
  let decentPlanner;
  let toolRegistry;
  
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
    toolRegistry = decentPlanner.dependencies.toolRegistry;
  }, 30000);

  test('should check what toolRegistry.getTool() returns', async () => {
    console.log('=== TESTING TOOL REGISTRY GETTOOL() METHOD ===\n');
    
    // Test a few known tools
    const toolNames = ['Write', 'generate_javascript_function', 'run_node'];
    
    for (const toolName of toolNames) {
      console.log(`\n=== Testing getTool("${toolName}") ===`);
      
      try {
        const tool = await toolRegistry.getTool(toolName);
        
        console.log('Tool type:', typeof tool);
        console.log('Tool constructor:', tool?.constructor?.name);
        console.log('Tool instanceof Tool:', tool instanceof Tool);
        console.log('Tool has serialize method:', typeof tool?.serialize === 'function');
        console.log('Tool name property:', tool?.name);
        console.log('Tool keys:', Object.keys(tool || {}));
        
        if (tool instanceof Tool) {
          console.log('✅ getTool() returned genuine Tool instance');
          
          // Test serialize method
          const serialized = tool.serialize();
          console.log('Serialized result:', JSON.stringify(serialized, null, 2));
          
        } else {
          console.log('❌ getTool() returned plain object, not Tool instance');
        }
        
      } catch (error) {
        console.log('❌ getTool() failed:', error.message);
      }
    }
    
  }, 30000);
  
  test('should test DiscoverToolsUseCase with updated tool registry usage', async () => {
    console.log('\n=== TESTING UPDATED DISCOVERTOOLSUSECASE ===\n');
    
    // Test the updated use case directly
    const goal = "write hello world program";
    
    try {
      const result = await decentPlanner.plan(goal, {}, (msg) => {
        console.log('Progress:', msg);
      });
      
      console.log('Planning success:', result.success);
      
      if (result.success && result.data.rootTask && result.data.rootTask.tools) {
        console.log('Root task has tools:', result.data.rootTask.tools.length);
        
        for (let i = 0; i < Math.min(result.data.rootTask.tools.length, 2); i++) {
          const tool = result.data.rootTask.tools[i];
          console.log(`\nTask Tool ${i + 1}:`);
          console.log('  Type:', typeof tool);
          console.log('  Constructor:', tool?.constructor?.name);
          console.log('  instanceof Tool:', tool instanceof Tool);
          console.log('  Has serialize method:', typeof tool?.serialize === 'function');
          console.log('  Tool name:', tool?.name);
        }
        
        // Check behavior tree tools
        if (result.data.behaviorTrees && result.data.behaviorTrees.length > 0) {
          const behaviorTree = result.data.behaviorTrees[0];
          const actionNodes = behaviorTree.children?.filter(child => child.type === 'action' && child.tool) || [];
          
          console.log('\nBehavior tree action nodes:', actionNodes.length);
          
          for (let i = 0; i < actionNodes.length; i++) {
            const node = actionNodes[i];
            console.log(`\nBehavior Tree Tool ${i + 1} (${node.id}):`);
            console.log('  Type:', typeof node.tool);
            console.log('  Constructor:', node.tool?.constructor?.name);
            console.log('  instanceof Tool:', node.tool instanceof Tool);
            console.log('  Has serialize method:', typeof node.tool?.serialize === 'function');
            console.log('  Tool name:', node.tool?.name);
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Planning failed:', error.message);
    }
    
  }, 60000);
});