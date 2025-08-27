/**
 * Debug test to trace tool schemas and formal planner behavior
 * Consolidated from SimpleToolSchemaDebug and ToolSchemaDebug
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('Tool Schema Debug', () => {
  let decentPlanner;
  let resourceManager;
  let toolRegistry;

  beforeAll(async () => {
    // Get singletons once in beforeAll with proper timeout
    console.log('Initializing ResourceManager...');
    resourceManager = await ResourceManager.getInstance();
    console.log('Initializing ToolRegistry...');
    toolRegistry = await ToolRegistry.getInstance();
    console.log('Both singletons initialized');

    // Create planner with configuration
    decentPlanner = new DecentPlanner({
      maxDepth: 3,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true
    });
    await decentPlanner.initialize();
  }, 120000); // 2 minute timeout for initialization

  test('Simple hook into formal planner to see tools', async () => {
    const goal = "please write a hello world program in javascript";

    console.log('\n=== HOOKING INTO FORMAL PLANNER ===\n');

    // With refactored architecture, hook into the behavior tree planner if available
    if (decentPlanner.dependencies && decentPlanner.dependencies.behaviorTreePlanner) {
      const originalMakePlan = decentPlanner.dependencies.behaviorTreePlanner.makePlan.bind(
        decentPlanner.dependencies.behaviorTreePlanner
      );
      
      decentPlanner.dependencies.behaviorTreePlanner.makePlan = function(requirements, tools, options) {
        console.log('\n🚨 FORMAL PLANNER MAKEPLAN CALLED:');
        console.log('Requirements:', requirements);
        console.log('Number of tools:', tools.length);
        
        console.log('\n📋 TOOLS RECEIVED BY FORMAL PLANNER:');
        tools.forEach((tool, index) => {
          console.log(`\n--- Tool ${index + 1}: ${tool.name} ---`);
          console.log('Full tool object:', JSON.stringify(tool, null, 2));
        });
        
        return originalMakePlan(requirements, tools, options);
      };
    } else {
      console.log('Note: Formal planner not enabled or not accessible for hooking');
    }

    // Run the full planning process
    const result = await decentPlanner.plan(goal);
    
    console.log('\n✅ Planning completed');
    console.log('Result success:', result.success);

    expect(result.success).toBe(true);
  }, 60000);

  test('Debug tool schema flow from registry to formal planner', async () => {
    const goal = "please write a hello world program in javascript";

    console.log('\n=== DEBUGGING TOOL SCHEMA FLOW ===\n');

    // Step 1: Check what tools are in the registry
    console.log('🔧 STEP 1: Raw tools from ToolRegistry');
    const toolRegistry = decentPlanner.dependencies.toolRegistry;
    console.log('ToolRegistry methods:', Object.getOwnPropertyNames(toolRegistry.constructor.prototype));
    
    // Get tools from registry
    let allTools = [];
    if (toolRegistry.listTools) {
      allTools = await toolRegistry.listTools();
    } else if (toolRegistry.getAllTools) {
      allTools = await toolRegistry.getAllTools();
    } else if (toolRegistry.getTools) {
      allTools = await toolRegistry.getTools();
    }
    
    console.log('allTools type:', typeof allTools);
    console.log('allTools:', allTools);
    
    // Find specific tools we care about
    let directoryCreateTool, fileWriteTool, runNodeTool;
    if (Array.isArray(allTools)) {
      directoryCreateTool = allTools.find(t => t.name === 'directory_create');
      fileWriteTool = allTools.find(t => t.name === 'file_write');
      runNodeTool = allTools.find(t => t.name === 'run_node');
      
      console.log('directory_create from registry:', JSON.stringify(directoryCreateTool, null, 2));
      console.log('file_write from registry:', JSON.stringify(fileWriteTool, null, 2));
      console.log('run_node from registry:', JSON.stringify(runNodeTool, null, 2));
    } else {
      console.log('allTools is not an array, trying to get specific tools...');
      
      // Try to get specific tools directly
      if (decentPlanner.toolRegistry.getTool) {
        directoryCreateTool = decentPlanner.toolRegistry.getTool('directory_create');
        fileWriteTool = decentPlanner.toolRegistry.getTool('file_write');
        runNodeTool = decentPlanner.toolRegistry.getTool('run_node');
        
        console.log('directory_create from registry:', JSON.stringify(directoryCreateTool, null, 2));
        console.log('file_write from registry:', JSON.stringify(fileWriteTool, null, 2));
        console.log('run_node from registry:', JSON.stringify(runNodeTool, null, 2));
      } else {
        console.log('Cannot get tools from registry');
      }
    }

    // Step 2: Run informal planning and check what tools are discovered
    console.log('\n🔍 STEP 2: Running informal planning...');
    const informalResult = await decentPlanner.planInformalOnly(goal);
    
    console.log('Informal planning result:', JSON.stringify(informalResult.data.rootTask, null, 2));
    
    if (informalResult.data.rootTask.tools) {
      console.log('\nTools after discovery:');
      informalResult.data.rootTask.tools.forEach(tool => {
        console.log(`  - ${tool.name} (confidence: ${tool.confidence})`);
      });
    }

    // Step 3: Check what tools are passed to formal planner
    console.log('\n🏗️ STEP 3: Checking tools passed to formal planner...');
    
    // Hook into the formal planner to see exactly what tools it receives
    if (decentPlanner.dependencies && decentPlanner.dependencies.behaviorTreePlanner) {
      const originalMakePlan = decentPlanner.dependencies.behaviorTreePlanner.makePlan.bind(
        decentPlanner.dependencies.behaviorTreePlanner
      );
      
      let capturedTools = null;
      decentPlanner.dependencies.behaviorTreePlanner.makePlan = function(requirements, tools, options) {
        console.log('\n📋 FORMAL PLANNER RECEIVED:');
        console.log('Requirements:', requirements);
        console.log('Tools count:', tools.length);
        console.log('Tools received by formal planner:', JSON.stringify(tools, null, 2));
        capturedTools = tools;
        
        return originalMakePlan(requirements, tools, options);
      };

      // Step 4: Run formal planning
      console.log('\n🚀 STEP 4: Running formal planning...');
      const formalResult = await decentPlanner.plan(goal);
      
      console.log('Formal planning result:', JSON.stringify(formalResult.data.behaviorTrees[0], null, 2));

      // Step 5: Analyze what went wrong
      console.log('\n❌ STEP 5: Analysis of what went wrong:');
      
      if (capturedTools) {
        console.log(`\nFormal planner received ${capturedTools.length} tools:`);
        capturedTools.forEach(tool => {
          console.log(`\nTool: ${tool.name}`);
          console.log(`  - description: "${tool.description || 'EMPTY!'}"`);
          console.log(`  - has inputSchema: ${tool.inputSchema ? 'YES' : 'NO'}`);
          console.log(`  - has outputSchema: ${tool.outputSchema ? 'YES' : 'NO'}`);
          
          if (tool.inputSchema) {
            console.log(`  - inputSchema:`, JSON.stringify(tool.inputSchema, null, 4));
          }
          if (tool.outputSchema) {
            console.log(`  - outputSchema:`, JSON.stringify(tool.outputSchema, null, 4));
          }
        });
      }

      // Compare with registry tools
      console.log('\n🔍 COMPARISON: Registry vs Formal Planner tools:');
      const registryDirectoryCreate = allTools.find(t => t.name === 'directory_create');
      const formalDirectoryCreate = capturedTools?.find(t => t.name === 'directory_create');
      
      console.log('\nRegistry directory_create:');
      console.log('  - description:', registryDirectoryCreate?.description);
      console.log('  - inputSchema:', JSON.stringify(registryDirectoryCreate?.inputSchema, null, 2));
      console.log('  - outputSchema:', JSON.stringify(registryDirectoryCreate?.outputSchema, null, 2));
      
      console.log('\nFormal planner directory_create:');
      console.log('  - description:', formalDirectoryCreate?.description);
      console.log('  - inputSchema:', JSON.stringify(formalDirectoryCreate?.inputSchema, null, 2));
      console.log('  - outputSchema:', JSON.stringify(formalDirectoryCreate?.outputSchema, null, 2));
    }

    expect(informalResult.success).toBe(true);
  }, 120000);
});