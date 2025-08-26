/**
 * Debug test to trace exactly what happens to tool schemas 
 * from ToolRegistry -> Tool Discovery -> Formal Planner
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Tool Schema Debug - Live DecentPlanner', () => {
  let decentPlanner;
  let llmClient;

  beforeAll(async () => {
    // Get the REAL LLM client and ResourceManager
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client not available');
    }

    // Create DecentPlanner with REAL LLM
    decentPlanner = new DecentPlanner(llmClient);
    await decentPlanner.initialize();
  });

  test('Debug tool schema flow from registry to formal planner', async () => {
    const goal = "please write a hello world program in javascript";

    console.log('\n=== DEBUGGING TOOL SCHEMA FLOW ===\n');

    // Step 1: Check what tools are in the registry
    console.log('🔧 STEP 1: Raw tools from ToolRegistry');
    console.log('ToolRegistry methods:', Object.getOwnPropertyNames(decentPlanner.toolRegistry.constructor.prototype));
    
    // Try different methods to get tools
    let allTools;
    if (decentPlanner.toolRegistry.getAllTools) {
      allTools = decentPlanner.toolRegistry.getAllTools();
    } else if (decentPlanner.toolRegistry.getTools) {
      allTools = decentPlanner.toolRegistry.getTools();
    } else if (decentPlanner.toolRegistry.listTools) {
      allTools = decentPlanner.toolRegistry.listTools();
    } else {
      console.log('Available methods:', Object.getOwnPropertyNames(decentPlanner.toolRegistry));
      // Try to get tools directly
      allTools = [];
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
    const informalResult = await decentPlanner.planInformal(goal);
    
    console.log('Informal planning result:', JSON.stringify(informalResult.informal.hierarchy, null, 2));
    
    if (informalResult.informal.hierarchy.tools) {
      console.log('\nTools after discovery:');
      informalResult.informal.hierarchy.tools.forEach(tool => {
        console.log(`  - ${tool.name} (confidence: ${tool.confidence})`);
      });
    }

    // Step 3: Check what tools are passed to formal planner
    console.log('\n🏗️ STEP 3: Checking tools passed to formal planner...');
    
    // Hook into the formal planner to see exactly what tools it receives
    const originalMakePlan = decentPlanner.formalPlanner.makePlan.bind(decentPlanner.formalPlanner);
    
    let capturedTools = null;
    decentPlanner.formalPlanner.makePlan = function(requirements, tools, options) {
      console.log('\n📋 FORMAL PLANNER RECEIVED:');
      console.log('Requirements:', requirements);
      console.log('Tools count:', tools.length);
      console.log('Tools received by formal planner:', JSON.stringify(tools, null, 2));
      capturedTools = tools;
      
      return originalMakePlan(requirements, tools, options);
    };

    // Step 4: Run formal planning
    console.log('\n🚀 STEP 4: Running formal planning...');
    const formalResult = await decentPlanner.planFormal(informalResult);
    
    console.log('Formal planning result:', JSON.stringify(formalResult.formal.behaviorTrees[0], null, 2));

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

    expect(informalResult.success).toBe(true);
    expect(formalResult.success).toBe(true);
  });
});