/**
 * Quick test to verify that the outputs format is now correct
 * Tests prompt generation to ensure LLM sees actual tool fields
 */

import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';

describe('Outputs Format Test', () => {
  let toolRegistry;
  let planner;

  beforeAll(async () => {
    // Initialize components we need
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    const llmClient = resourceManager.getLLMClient();
    planner = new Planner({ llmClient });
  });

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  test('should generate prompt with correct tool output fields', async () => {
    console.log('=== TESTING PROMPT GENERATION ===');
    
    // Get some tools
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const dirCreateTool = tools.find(t => t.name === 'directory_create');
    
    expect(fileWriteTool).toBeDefined();
    expect(dirCreateTool).toBeDefined();
    
    console.log('Found tools:', { fileWriteTool: fileWriteTool.name, dirCreateTool: dirCreateTool.name });
    
    // Generate prompt
    const testTools = [fileWriteTool, dirCreateTool];
    const prompt = planner.generatePrompt('Test task', testTools);
    
    console.log('=== GENERATED PROMPT EXCERPT ===');
    
    // Extract the tool sections from the prompt
    const lines = prompt.split('\n');
    let inToolSection = false;
    let currentTool = '';
    
    for (const line of lines) {
      if (line.includes('### file_write')) {
        inToolSection = true;
        currentTool = 'file_write';
        console.log('\n' + line);
      } else if (line.includes('### directory_create')) {
        inToolSection = true;
        currentTool = 'directory_create';
        console.log('\n' + line);
      } else if (line.startsWith('### ') && inToolSection) {
        inToolSection = false;
      } else if (inToolSection) {
        console.log(line);
      }
    }
    
    console.log('=== VERIFYING CORRECT FORMAT ===');
    
    // Verify the prompt contains the correct output field names
    expect(prompt).toContain('filepath, bytesWritten, created'); // file_write outputs
    expect(prompt).toContain('dirpath, created'); // directory_create outputs
    
    // Verify it does NOT contain the old wrapper format
    expect(prompt).not.toMatch(/success.*boolean.*Whether the operation succeeded/);
    expect(prompt).not.toMatch(/message.*string.*Result or error message/);
    expect(prompt).not.toMatch(/data.*object.*Additional result data/);
    
    console.log('✅ Prompt contains correct tool output field names');
    console.log('✅ Prompt does NOT contain old wrapper format');
    
    // Now let's run the JSON generation to see what format it produces
    console.log('=== TESTING WITH REAL LLM ===');
    
    const testGoal = 'Create a directory called test_dir and write a file hello.txt with content "test" inside it';
    
    try {
      const llmClient = ResourceManager.getInstance().getLLMClient();
      const result = await planner.generateBehaviorTree(testGoal, testTools, llmClient);
      
      if (result.success && result.plan) {
        console.log('Generated plan:', JSON.stringify(result.plan, null, 2));
        
        // Check if any actions use the correct outputs format
        const findActions = (node) => {
          const actions = [];
          if (node.type === 'action') actions.push(node);
          if (node.children) {
            for (const child of node.children) {
              actions.push(...findActions(child));
            }
          }
          if (node.child) actions.push(...findActions(node.child));
          return actions;
        };
        
        const actions = findActions(result.plan);
        
        for (const action of actions) {
          if (action.outputs) {
            console.log(`Action ${action.id} outputs:`, action.outputs);
            
            if (action.tool === 'file_write') {
              const outputKeys = Object.keys(action.outputs);
              const hasCorrectFields = outputKeys.some(key => ['filepath', 'bytesWritten', 'created'].includes(key));
              const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
              
              console.log(`file_write outputs: ${outputKeys.join(', ')}`);
              console.log(`Has correct fields: ${hasCorrectFields}, Has wrapper fields: ${hasWrapperFields}`);
              
              if (hasCorrectFields && !hasWrapperFields) {
                console.log('✅ file_write uses correct output format!');
              } else {
                console.log('❌ file_write still uses wrong format');
              }
            }
            
            if (action.tool === 'directory_create') {
              const outputKeys = Object.keys(action.outputs);
              const hasCorrectFields = outputKeys.some(key => ['dirpath', 'created'].includes(key));
              const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
              
              console.log(`directory_create outputs: ${outputKeys.join(', ')}`);
              console.log(`Has correct fields: ${hasCorrectFields}, Has wrapper fields: ${hasWrapperFields}`);
              
              if (hasCorrectFields && !hasWrapperFields) {
                console.log('✅ directory_create uses correct output format!');
              } else {
                console.log('❌ directory_create still uses wrong format');
              }
            }
          }
        }
      } else {
        console.log('Failed to generate plan:', result);
      }
    } catch (error) {
      console.log('LLM generation failed (expected in some test environments):', error.message);
    }
  }, 60000); // 1 minute timeout
});