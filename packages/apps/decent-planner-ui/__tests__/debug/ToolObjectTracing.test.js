/**
 * Test to trace exactly where Tool objects are transformed from genuine Tool instances
 * to plain metadata objects during the planning process
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { Tool } from '@legion/tools-registry';

describe('Tool Object Tracing Through Planning Process', () => {
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

  test('should trace Tool objects from tool registry through entire planning process', async () => {
    console.log('=== TRACING TOOL OBJECTS THROUGH PLANNING PROCESS ===\n');
    
    // STEP 1: Skip listTools - focus on semantic search only
    
    // STEP 2: Check semantic search results
    console.log('\n\nSTEP 2: Checking Semantic Search Results');
    const searchResults = await toolRegistry.searchTools("write hello world program", { limit: 5 });
    console.log('Search results count:', searchResults.length);
    
    for (let i = 0; i < Math.min(searchResults.length, 2); i++) {
      const tool = searchResults[i];
      console.log(`\nSearch Result Tool ${i + 1}:`);
      console.log('  Type:', typeof tool);
      console.log('  Constructor:', tool?.constructor?.name);
      console.log('  instanceof Tool:', tool instanceof Tool);
      console.log('  Has serialize method:', typeof tool?.serialize === 'function');
      console.log('  Tool name:', tool?.name);
      console.log('  Keys:', Object.keys(tool || {}));
    }
    
    // STEP 3: Test DiscoverToolsUseCase directly
    console.log('\n\nSTEP 3: Testing DiscoverToolsUseCase Direct Execution');
    const discoverResult = await decentPlanner.discoverToolsForCurrentPlan();
    
    if (discoverResult.success && discoverResult.data.toolDiscovery) {
      const taskResults = discoverResult.data.toolDiscovery;
      console.log('Tool discovery task results:', taskResults.length);
      
      for (const taskResult of taskResults) {
        if (taskResult.discoveryResult && taskResult.discoveryResult.tools) {
          console.log(`\nTask "${taskResult.description}" found ${taskResult.discoveryResult.tools.length} tools:`);
          
          for (let i = 0; i < Math.min(taskResult.discoveryResult.tools.length, 2); i++) {
            const tool = taskResult.discoveryResult.tools[i];
            console.log(`\nDiscovered Tool ${i + 1}:`);
            console.log('  Type:', typeof tool);
            console.log('  Constructor:', tool?.constructor?.name);
            console.log('  instanceof Tool:', tool instanceof Tool);
            console.log('  Has serialize method:', typeof tool?.serialize === 'function');
            console.log('  Tool name:', tool?.name);
            console.log('  Keys:', Object.keys(tool || {}));
          }
        }
      }
    }
    
    // STEP 4: Test full planning process
    console.log('\n\nSTEP 4: Testing Full Planning Process');
    const goal = "please write a hello world program";
    const fullResult = await decentPlanner.plan(goal, {});
    
    expect(fullResult.success).toBe(true);
    
    // STEP 4a: Check tools in rootTask
    console.log('\nSTEP 4a: Tools in Root Task');
    const rootTask = fullResult.data.rootTask;
    if (rootTask && rootTask.tools) {
      console.log('Root task tools count:', rootTask.tools.length);
      
      for (let i = 0; i < Math.min(rootTask.tools.length, 2); i++) {
        const tool = rootTask.tools[i];
        console.log(`\nRoot Task Tool ${i + 1}:`);
        console.log('  Type:', typeof tool);
        console.log('  Constructor:', tool?.constructor?.name);
        console.log('  instanceof Tool:', tool instanceof Tool);
        console.log('  Has serialize method:', typeof tool?.serialize === 'function');
        console.log('  Tool name:', tool?.name);
        console.log('  Keys:', Object.keys(tool || {}));
      }
    }
    
    // STEP 4b: Check tools in behavior tree
    console.log('\n\nSTEP 4b: Tools in Behavior Tree');
    if (fullResult.data.behaviorTrees && fullResult.data.behaviorTrees.length > 0) {
      const behaviorTree = fullResult.data.behaviorTrees[0];
      console.log('Behavior tree children count:', behaviorTree.children?.length);
      
      const actionNodes = behaviorTree.children?.filter(child => child.type === 'action' && child.tool) || [];
      console.log('Action nodes with tools:', actionNodes.length);
      
      for (let i = 0; i < actionNodes.length; i++) {
        const node = actionNodes[i];
        console.log(`\nBehavior Tree Action Node ${i + 1} (${node.id}):`);
        console.log('  Tool type:', typeof node.tool);
        console.log('  Tool constructor:', node.tool?.constructor?.name);
        console.log('  Tool instanceof Tool:', node.tool instanceof Tool);
        console.log('  Tool has serialize method:', typeof node.tool?.serialize === 'function');
        console.log('  Tool name:', node.tool?.name);
        console.log('  Tool keys:', Object.keys(node.tool || {}));
        
        // CRITICAL: Test if we can get the actual Tool instance from registry
        if (node.tool?.name) {
          console.log('  Checking registry for this tool...');
          try {
            const registryTool = await toolRegistry.getTool(node.tool.name);
            console.log('  Registry tool type:', typeof registryTool);
            console.log('  Registry tool constructor:', registryTool?.constructor?.name);
            console.log('  Registry tool instanceof Tool:', registryTool instanceof Tool);
            console.log('  Registry tool has serialize:', typeof registryTool?.serialize === 'function');
          } catch (error) {
            console.log('  Registry lookup failed:', error.message);
          }
        }
      }
    }
    
    console.log('\n=== TRACE COMPLETE ===');
    
  }, 60000);
});