#!/usr/bin/env node

/**
 * Direct test of TaskOrchestrator without ChatAgent
 */

import { TaskOrchestrator } from '../../src/agents/task-orchestrator/TaskOrchestrator.js';
import { ResourceManager, ModuleLoader } from '../../../module-loader/src/index.js';
import FileModule from '../../../general-tools/src/file/FileModule.js';
import CommandExecutor from '../../../general-tools/src/command-executor/index.js';
import NodeRunner from '../../../node-runner/src/NodeRunner.js';
import JSGeneratorModule from '../../../code-gen/js-generator/src/JSGeneratorModule.js';
import { AnthropicProvider } from '../../../llm/src/providers/AnthropicProvider.js';

const TEST_PROMPT = "please write a node server that has an endpoint that can add 2 numbers";
const TEST_DIR = "/tmp/test-calculator-api";

async function runTest() {
  console.log('🚀 Starting Direct TaskOrchestrator Test');
  console.log('📝 Test Prompt:', TEST_PROMPT);
  console.log('📁 Test Directory:', TEST_DIR);
  console.log('='.repeat(60));
  
  try {
    // 1. Initialize ResourceManager
    console.log('\n1️⃣ Initializing ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // 2. Initialize ModuleLoader
    console.log('\n2️⃣ Initializing ModuleLoader...');
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Register moduleLoader with ResourceManager
    resourceManager.register('moduleLoader', moduleLoader);
    
    // 3. Load required modules by name
    console.log('\n3️⃣ Loading modules...');
    
    // The ModuleLoader loads modules from the file system
    console.log('   Loading file module...');
    await moduleLoader.loadModuleByName('file', FileModule);
    
    console.log('   Loading command-executor module...');
    await moduleLoader.loadModuleByName('command-executor', CommandExecutor);
    
    console.log('   Loading node-runner module...');
    await moduleLoader.loadModuleByName('node-runner', NodeRunner);
    
    console.log('   Loading js-generator module...');
    await moduleLoader.loadModuleByName('js-generator', JSGeneratorModule);
    
    // Check what tools are available
    console.log('\n   Available tools:');
    const tools = await moduleLoader.getAllToolNames();
    tools.forEach(tool => console.log(`     - ${tool}`));
    
    // 4. Create mock LLM client for testing
    console.log('\n4️⃣ Setting up mock LLM client...');
    
    const mockLLMClient = {
      async complete(prompt, model, maxTokens) {
        console.log(`🤖 Mock LLM called with prompt (${prompt.length} chars) - generating mock plan`);
        
        // Return a realistic JavaScript development plan
        return JSON.stringify({
          name: "Node.js Addition API Server",
          description: "Create a Node.js server with an endpoint that adds two numbers",
          steps: [
            {
              id: "step-1",
              name: "Create Project Directory",
              description: "Set up project directory structure",
              type: "setup",
              dependencies: [],
              actions: [
                {
                  type: "directory_create",
                  parameters: {
                    dirpath: "/tmp/test-calculator-api"
                  }
                }
              ]
            },
            {
              id: "step-2", 
              name: "Create Package.json",
              description: "Initialize Node.js project with package.json",
              type: "setup",
              dependencies: ["step-1"],
              actions: [
                {
                  type: "file_write",
                  parameters: {
                    filepath: "/tmp/test-calculator-api/package.json",
                    content: JSON.stringify({
                      name: "calculator-api",
                      version: "1.0.0",
                      description: "API server for adding two numbers",
                      main: "server.js",
                      scripts: {
                        start: "node server.js",
                        test: "jest"
                      },
                      dependencies: {
                        express: "^4.18.0"
                      }
                    }, null, 2)
                  }
                }
              ]
            },
            {
              id: "step-3",
              name: "Create Server File", 
              description: "Implement the Express server with addition endpoint",
              type: "implementation",
              dependencies: ["step-2"],
              actions: [
                {
                  type: "file_write",
                  parameters: {
                    filepath: "/tmp/test-calculator-api/server.js",
                    content: "const express = require('express');\nconst app = express();\nconst port = 3000;\n\napp.get('/add', (req, res) => {\n  const a = parseFloat(req.query.a) || 0;\n  const b = parseFloat(req.query.b) || 0;\n  const sum = a + b;\n  res.json({ result: sum, a, b });\n});\n\napp.listen(port, () => {\n  console.log(`Calculator API listening at http://localhost:${port}`);\n});\n"
                  }
                }
              ]
            }
          ]
        }, null, 2);
      }
    };
    
    // Register LLM client
    resourceManager.register('llmClient', mockLLMClient);
    resourceManager.register('AnthropicClient', mockLLMClient);
    
    // 5. Create TaskOrchestrator
    console.log('\n5️⃣ Creating TaskOrchestrator...');
    const orchestrator = new TaskOrchestrator({
      resourceManager,
      moduleLoader,
      profileName: 'javascript-development-dynamic',
      llmClient: mockLLMClient,
      workspaceDir: TEST_DIR
    });
    
    // Mock agent context that collects all outputs
    const testResults = {
      responses: [],
      thoughts: [],
      messages: [],
      planGenerated: false,
      planValidated: false,
      executionStarted: false,
      stepsCompleted: []
    };
    
    const mockAgentContext = {
      sessionId: 'test-session-123',
      conversationHistory: [],
      emit: (eventType, message) => {
        console.log(`📨 ${eventType}:`, message.content || message.thought || JSON.stringify(message, null, 2).substring(0, 200));
        testResults.messages.push({ eventType, message });
      }
    };
    
    // 6. Initialize
    console.log('\n6️⃣ Initializing orchestrator...');
    await orchestrator.initialize();
    
    // 7. Start task using actor protocol
    console.log('\n7️⃣ Starting task...\n');
    
    // Note: TaskOrchestrator components don't extend EventEmitter
    // Progress will be shown through the mockAgentContext.emit calls
    
    // Start the task using the actor protocol - this will complete the full workflow
    console.log('   🚀 Starting task processing (this may take a while)...');
    await orchestrator.startTask({
      description: TEST_PROMPT,
      agentContext: mockAgentContext
    });
    
    // The startTask method should handle the full workflow:
    // 1. Plan generation
    // 2. Plan validation  
    // 3. Present plan to user
    // 4. Wait for execution confirmation (our mockAgent should handle this)
    // 5. Execute the plan
    
    console.log('\n   ✅ Task processing initiated');
    
    // Wait a moment to let the task complete
    console.log('   ⏳ Waiting for task to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if we have a validated plan available
    const validatedPlan = orchestrator.lastValidatedPlan;
    if (validatedPlan) {
      console.log(`\n   📋 Plan was generated: ${validatedPlan.name}`);
      console.log(`   📋 Steps: ${validatedPlan.steps?.length || 0}`);
      testResults.planGenerated = true;
      testResults.planValidated = true;
    } else {
      console.log('\n   ❌ No validated plan found');
    }
    
    // Create result summary
    const result = {
      success: testResults.planGenerated && testResults.planValidated,
      plan: validatedPlan,
      execution: {
        started: testResults.executionStarted,
        completed: orchestrator.planExecutionEngine.state === 'complete',
        state: orchestrator.planExecutionEngine.state,
        completedSteps: testResults.stepsCompleted
      },
      messages: testResults.messages
    };
    
    // 8. Show results
    console.log('\n8️⃣ Results:');
    console.log('='.repeat(60));
    
    if (result.success) {
      console.log('✅ SUCCESS!');
      
      // Check created files
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync(`ls -la ${TEST_DIR} 2>/dev/null || echo "No files created"`);
        console.log('\nFiles created:');
        console.log(stdout);
      } catch (error) {
        console.log('Could not list files');
      }
    } else {
      console.log('❌ FAILURE!');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack:');
      console.error(error.stack);
    }
  }
  
  console.log('\n✅ Test complete!');
}

// Run with timeout
const timeout = setTimeout(() => {
  console.error('\n⏱️ Test timed out after 120 seconds');
  process.exit(1);
}, 120000);

runTest().then(() => {
  clearTimeout(timeout);
  process.exit(0);
}).catch(error => {
  clearTimeout(timeout);
  console.error('Fatal error:', error);
  process.exit(1);
});