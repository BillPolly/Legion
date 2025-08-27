/**
 * Usage example for the Formal Planner
 * 
 * Demonstrates how to use the formal planner to synthesize
 * executable behavior trees from task hierarchies
 */

import { FormalPlanner } from '../FormalPlanner.js';
import { SyntheticToolFactory } from '../SyntheticToolFactory.js';
import { ArtifactMapping } from '../ArtifactMapping.js';
import { PlannerAdapter } from '../PlannerAdapter.js';
import { SyntheticToolExecutor } from '../SyntheticToolExecutor.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';
import { BehaviorTreeExecutor } from '@legion/shared/actor-BT';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  console.log('=== Formal Planner Usage Example ===\n');
  
  // Step 1: Initialize dependencies
  console.log('1. Initializing dependencies...');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  // Create LLM client
  const llmClient = {
    complete: async (prompt) => {
      // Your LLM integration here
      // For example, using Anthropic or OpenAI
    }
  };
  
  // Step 2: Set up components
  console.log('2. Setting up formal planner components...');
  
  const realPlanner = new Planner({ llmClient });
  const plannerAdapter = new PlannerAdapter(realPlanner);
  const validator = new BTValidator();
  const toolFactory = new SyntheticToolFactory();
  const artifactMapper = new ArtifactMapping();
  
  // Initialize tool registry (or use mock for example)
  const toolRegistry = {
    searchTools: async (query) => {
      // Return available tools
      return [
        { name: 'file_write', confidence: 0.9, description: 'Write to file' },
        { name: 'file_read', confidence: 0.8, description: 'Read from file' },
        { name: 'api_call', confidence: 0.7, description: 'Make API call' }
      ];
    },
    getTool: async (name) => ({
      name,
      execute: async (args) => {
        console.log(`Executing ${name} with args:`, args);
        return { success: true, output: `Result from ${name}` };
      }
    })
  };
  
  // Step 3: Create formal planner
  console.log('3. Creating formal planner...');
  
  const formalPlanner = new FormalPlanner({
    planner: plannerAdapter,
    validator,
    toolFactory,
    artifactMapper,
    toolRegistry
  });
  
  // Step 4: Define task hierarchy (from informal planner)
  console.log('4. Defining task hierarchy...\n');
  
  const taskHierarchy = {
    id: 'root',
    description: 'Build a web scraper',
    complexity: 'COMPLEX',
    level: 0,
    children: [
      {
        id: 'fetch-data',
        description: 'Fetch webpage content',
        complexity: 'SIMPLE',
        level: 1,
        tools: ['api_call'],
        suggestedInputs: ['url'],
        suggestedOutputs: ['html_content']
      },
      {
        id: 'parse-data',
        description: 'Parse and extract data',
        complexity: 'COMPLEX',
        level: 1,
        children: [
          {
            id: 'extract-text',
            description: 'Extract text from HTML',
            complexity: 'SIMPLE',
            level: 2,
            tools: ['data_process'],
            suggestedInputs: ['html_content'],
            suggestedOutputs: ['text_data']
          },
          {
            id: 'clean-data',
            description: 'Clean and format data',
            complexity: 'SIMPLE',
            level: 2,
            tools: ['data_transform'],
            suggestedInputs: ['text_data'],
            suggestedOutputs: ['clean_data']
          }
        ]
      },
      {
        id: 'save-results',
        description: 'Save extracted data to file',
        complexity: 'SIMPLE',
        level: 1,
        tools: ['file_write'],
        suggestedInputs: ['clean_data', 'filename'],
        suggestedOutputs: ['file_path']
      }
    ]
  };
  
  // Step 5: Synthesize behavior trees
  console.log('5. Synthesizing behavior trees...\n');
  
  const result = await formalPlanner.synthesize(taskHierarchy);
  
  if (result.success) {
    console.log('✅ Synthesis successful!');
    console.log(`   - Created ${Object.keys(result.syntheticTools).length} synthetic tools`);
    console.log(`   - Root BT type: ${result.rootBT.type}`);
    
    // Display synthetic tools created
    console.log('\n6. Synthetic tools created:');
    for (const [name, tool] of Object.entries(result.syntheticTools)) {
      console.log(`   - ${name}: ${tool.description}`);
      console.log(`     Inputs: ${Object.keys(tool.inputSchema).join(', ')}`);
      console.log(`     Outputs: ${Object.keys(tool.outputSchema).join(', ')}`);
    }
    
    // Step 6: Execute the synthesized plan
    console.log('\n7. Executing the synthesized plan...\n');
    
    // Create BT executor with augmented tool registry
    const btExecutor = new BehaviorTreeExecutor(toolRegistry);
    const syntheticToolExecutor = new SyntheticToolExecutor(btExecutor);
    
    // Execute root BT
    const executionContext = {
      inputs: {
        url: 'https://example.com',
        filename: 'output.json'
      },
      artifacts: {}
    };
    
    console.log('Executing root behavior tree...');
    const executionResult = await btExecutor.executeTree(
      result.rootBT,
      executionContext
    );
    
    if (executionResult.success) {
      console.log('✅ Execution successful!');
      console.log('   Output artifacts:', executionResult.artifacts);
    } else {
      console.log('❌ Execution failed:', executionResult.error);
    }
    
    // Step 7: Execute a synthetic tool directly
    console.log('\n8. Executing a synthetic tool directly...\n');
    
    const parseDataTool = result.syntheticTools['task_2_parse-data'];
    if (parseDataTool) {
      const toolResult = await syntheticToolExecutor.execute(
        parseDataTool,
        { html_content: '<html>Sample content</html>' }
      );
      
      console.log('Synthetic tool execution result:', {
        success: toolResult.success,
        outputs: toolResult.outputs
      });
    }
    
  } else {
    console.log('❌ Synthesis failed:');
    result.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  console.log('\n=== Example Complete ===');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as formalPlannerExample };