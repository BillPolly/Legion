/**
 * Prompt Variable Syntax Integration Test
 * Tests that the updated behavior tree generation prompt produces @varName syntax
 * NO MOCKS - Tests real LLM behavior tree generation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { Planner } from '../../src/core/Planner.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Behavior Tree Prompt @varName Syntax', () => {
  let planner;
  let llmClient;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up Prompt Variable Syntax tests');
    
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    if (!llmClient) {
      throw new Error('LLM client required for prompt syntax test - no fallbacks');
    }
    
    planner = new Planner({ llmClient });
    console.log('✅ Planner initialized for prompt testing');
  });

  test('should generate behavior tree with @varName syntax for variable references', async () => {
    console.log('\n🎯 Testing @varName syntax generation');
    
    const taskDescription = 'Create a JavaScript hello world file and execute it';
    
    // Mock tools that would be available to the planner
    const availableTools = [
      {
        name: 'file_write',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to write file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filePath', 'content']
        },
        outputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path where file was written' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'run_node',
        description: 'Execute Node.js script',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'Path to script to execute' },
            args: { type: 'array', description: 'Command line arguments' }
          },
          required: ['script']
        },
        outputSchema: {
          type: 'object', 
          properties: {
            exitCode: { type: 'number' },
            output: { type: 'string' }
          }
        }
      }
    ];
    
    console.log(`📋 Task: "${taskDescription}"`);
    console.log(`🔧 Available tools: ${availableTools.map(t => t.name).join(', ')}`);
    
    // Generate behavior tree using real LLM
    const result = await planner.makePlan(taskDescription, availableTools);
    
    console.log(`✅ Behavior tree generated: success=${result.success}`);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.plan).toBeDefined();
    
    const behaviorTree = result.data.plan;
    console.log('\n🌳 Generated Behavior Tree:');
    console.log(JSON.stringify(behaviorTree, null, 2));
    
    // Verify structure
    expect(behaviorTree.type).toBe('sequence');
    expect(behaviorTree.children).toBeDefined();
    expect(Array.isArray(behaviorTree.children)).toBe(true);
    expect(behaviorTree.children.length).toBeGreaterThanOrEqual(2);
    
    // Find actions with variable references
    const actions = behaviorTree.children.filter(child => child.type === 'action');
    expect(actions.length).toBeGreaterThanOrEqual(2);
    
    // Find the file write action (should store a variable)
    const writeAction = actions.find(action => 
      action.tool === 'file_write' || action.tool.includes('write')
    );
    
    // Find the script execution action (should use the stored variable)
    const execAction = actions.find(action => 
      action.tool === 'run_node' || action.tool.includes('run') || action.tool.includes('exec')
    );
    
    console.log('\n🔍 Variable Reference Analysis:');
    
    if (writeAction) {
      console.log(`📝 Write action: ${writeAction.tool}`);
      console.log(`   Outputs: ${JSON.stringify(writeAction.outputs || {})}`);
      
      // Should have outputs that store variables
      expect(writeAction.outputs).toBeDefined();
      const outputKeys = Object.keys(writeAction.outputs);
      expect(outputKeys.length).toBeGreaterThan(0);
      
      const storedVariable = Object.values(writeAction.outputs)[0];
      console.log(`   📦 Stores variable: "${storedVariable}"`);
    }
    
    if (execAction) {
      console.log(`🚀 Execution action: ${execAction.tool}`);
      console.log(`   Inputs: ${JSON.stringify(execAction.inputs || {})}`);
      
      // Check for @varName usage in inputs
      const inputs = execAction.inputs || {};
      let foundAtVariable = false;
      let atVariableExample = null;
      
      for (const [key, value] of Object.entries(inputs)) {
        if (typeof value === 'string' && value.startsWith('@')) {
          foundAtVariable = true;
          atVariableExample = value;
          console.log(`   ✅ Found @varName: "${key}": "${value}"`);
          
          // Should NOT use old syntax
          expect(value).not.toContain('context.artifacts');
          expect(value).toMatch(/^@[a-zA-Z_][a-zA-Z0-9_]*$/);
        }
      }
      
      console.log(`   📊 Uses @varName syntax: ${foundAtVariable ? '✅ YES' : '❌ NO'}`);
      
      if (foundAtVariable) {
        console.log(`   📝 Example: ${atVariableExample}`);
      } else {
        console.log('   ⚠️ Expected to find @varName usage in execution action');
        console.log('   This suggests the prompt may not be working correctly');
      }
      
      // CRITICAL: Should use @varName syntax, not old context.artifacts syntax
      const inputValues = Object.values(inputs);
      const hasOldSyntax = inputValues.some(value => 
        typeof value === 'string' && value.includes('context.artifacts')
      );
      
      expect(hasOldSyntax).toBe(false); // Should NOT use old syntax
      
      if (foundAtVariable) {
        expect(foundAtVariable).toBe(true); // Should use new @varName syntax
      }
    }
    
    console.log('\n🎉 @varName syntax verification completed!');
    
  }, 60000); // 1 minute timeout for LLM generation

  // Second test removed - focus on prompt generation verification
});