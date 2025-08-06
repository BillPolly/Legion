#!/usr/bin/env node

/**
 * Live integration test for TaskOrchestrator with real LLM and tools
 * Tests the complete flow: plan generation → validation → execution
 */

import { TaskOrchestrator } from '../../src/agents/task-orchestrator/TaskOrchestrator.js';
import { ResourceManager, ModuleLoader } from '../../../module-loader/src/index.js';
import { ProfilePlannerModule } from '../../../planning/profile-planner/src/ProfilePlannerModule.js';
import { PlanExecutorToolsModule } from '../../../planning/plan-executor-tools/src/PlanExecutorToolsModule.js';
import FileModule from '../../../general-tools/src/file/FileModule.js';
import CommandExecutor from '../../../general-tools/src/command-executor/index.js';
import NodeRunnerModule from '../../../node-runner/src/NodeRunner.js';
import JSGeneratorModule from '../../../code-gen/js-generator/src/JSGeneratorModule.js';
import { GenericPlanner } from '../../../llm-planner/src/GenericPlanner.js';
import { AnthropicProvider as AnthropicClient } from '../../../llm/src/providers/AnthropicProvider.js';

// Test configuration
const TEST_PROMPT = "please write a node server that has an endpoint that can add 2 numbers";
const TEST_DIR = "/tmp/test-calculator-api";

console.log('🚀 Starting Live TaskOrchestrator Test');
console.log('📝 Test Prompt:', TEST_PROMPT);
console.log('📁 Test Directory:', TEST_DIR);
console.log('=' . repeat(60));

async function runTest() {
  let orchestrator;
  let resourceManager;
  
  try {
    // 1. Initialize ResourceManager and ModuleLoader
    console.log('\n1️⃣ Initializing ResourceManager and ModuleLoader...');
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Register ResourceManager and ModuleLoader
    resourceManager.register('moduleLoader', moduleLoader);
    
    // 2. Load required modules
    console.log('\n2️⃣ Loading required modules...');
    
    // Load core modules
    console.log('   Loading file module...');
    await moduleLoader.loadModule('file', new FileModule(resourceManager));
    
    console.log('   Loading command-executor module...');
    await moduleLoader.loadModule('command-executor', new CommandExecutor(resourceManager));
    
    console.log('   Loading node-runner module...');
    await moduleLoader.loadModule('node-runner', new NodeRunnerModule(resourceManager));
    
    console.log('   Loading js-generator module...');
    await moduleLoader.loadModule('js-generator', new JSGeneratorModule(resourceManager));
    
    // Load planning modules
    console.log('   Loading profile-planner module...');
    const profilePlanner = new ProfilePlannerModule(resourceManager);
    await profilePlanner.initialize();
    await moduleLoader.loadModule('profile-planner', profilePlanner);
    
    console.log('   Loading plan-executor-tools module...');
    const planExecutorTools = new PlanExecutorToolsModule(resourceManager);
    await planExecutorTools.initialize();
    await moduleLoader.loadModule('plan-executor-tools', planExecutorTools);
    
    // 3. Create LLM client
    console.log('\n3️⃣ Creating LLM client...');
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }
    
    const llmClient = new AnthropicClient({
      apiKey,
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 8000,
      temperature: 0.3
    });
    
    // Register LLM client
    resourceManager.register('llmClient', llmClient);
    resourceManager.register('AnthropicClient', llmClient);
    
    // 4. Create TaskOrchestrator
    console.log('\n4️⃣ Creating TaskOrchestrator...');
    orchestrator = new TaskOrchestrator({
      resourceManager,
      moduleLoader,
      profileName: 'javascript-development',
      llmClient,
      workspaceDir: TEST_DIR
    });
    
    // Create mock agent context for progress updates
    const mockAgentContext = {
      updateThoughts: (thought) => {
        console.log('💭', thought);
      },
      speakToUser: (message) => {
        console.log('🔊', message);
      }
    };
    
    // Set the agent context
    orchestrator.setAgentContext(mockAgentContext);
    
    // 5. Initialize orchestrator
    console.log('\n5️⃣ Initializing TaskOrchestrator...');
    await orchestrator.initialize();
    
    // 6. Process the user request
    console.log('\n6️⃣ Processing user request...');
    console.log('   Request:', TEST_PROMPT);
    
    // Add event listeners for progress
    orchestrator.on('stateChange', (state) => {
      console.log(`   📊 State changed: ${state.previousState} → ${state.currentState}`);
    });
    
    orchestrator.on('planGenerated', (plan) => {
      console.log(`   ✅ Plan generated: ${plan.name}`);
      console.log(`      Steps: ${plan.steps.length}`);
    });
    
    orchestrator.on('planValidated', (validation) => {
      console.log(`   ✅ Plan validated: ${validation.isValid ? 'VALID' : 'INVALID'}`);
      if (!validation.isValid) {
        console.log(`      Errors: ${validation.errors.join(', ')}`);
      }
    });
    
    orchestrator.on('executionStarted', () => {
      console.log('   🏃 Execution started');
    });
    
    orchestrator.on('stepCompleted', (step) => {
      console.log(`   ✅ Step completed: ${step.name}`);
    });
    
    orchestrator.on('stepFailed', (step) => {
      console.log(`   ❌ Step failed: ${step.name} - ${step.error}`);
    });
    
    orchestrator.on('executionCompleted', (result) => {
      console.log(`   🎉 Execution completed: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
    });
    
    // Process the request
    const result = await orchestrator.processRequest(TEST_PROMPT);
    
    // 7. Display results
    console.log('\n7️⃣ Results:');
    console.log('=' . repeat(60));
    
    if (result.success) {
      console.log('✅ SUCCESS!');
      console.log('\nPlan:', result.plan?.name || 'Unknown');
      console.log('Execution:', result.execution ? 'Completed' : 'Not executed');
      
      if (result.execution) {
        console.log('\nExecution Summary:');
        console.log(`  Completed Steps: ${result.execution.completedSteps?.length || 0}`);
        console.log(`  Failed Steps: ${result.execution.failedSteps?.length || 0}`);
        console.log(`  Skipped Steps: ${result.execution.skippedSteps?.length || 0}`);
        
        if (result.execution.failedSteps?.length > 0) {
          console.log('\nFailed Steps:');
          result.execution.failedSteps.forEach(step => {
            console.log(`  - ${step}`);
          });
        }
      }
      
      // Check if files were created
      console.log('\n8️⃣ Checking created files...');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync(`ls -la ${TEST_DIR}`);
        console.log('Files created:');
        console.log(stdout);
        
        // Check if package.json exists
        const { stdout: pkgContent } = await execAsync(`cat ${TEST_DIR}/package.json 2>/dev/null || echo "No package.json"`);
        console.log('\npackage.json content:');
        console.log(pkgContent);
        
        // Check if server file exists
        const { stdout: serverFiles } = await execAsync(`find ${TEST_DIR} -name "*.js" -type f`);
        console.log('\nJavaScript files created:');
        console.log(serverFiles);
        
        if (serverFiles) {
          const files = serverFiles.trim().split('\n').filter(f => f);
          if (files.length > 0) {
            console.log(`\nContent of ${files[0]}:`);
            const { stdout: fileContent } = await execAsync(`head -50 ${files[0]}`);
            console.log(fileContent);
          }
        }
      } catch (error) {
        console.log('Could not list files:', error.message);
      }
      
    } else {
      console.log('❌ FAILURE!');
      console.log('Error:', result.error);
      
      if (result.plan) {
        console.log('\nPlan was generated but execution failed');
        console.log('Plan steps:', result.plan.steps?.length || 0);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\n9️⃣ Cleaning up...');
    
    if (orchestrator) {
      orchestrator.removeAllListeners();
    }
    
    // Clean up test directory
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`rm -rf ${TEST_DIR}`);
      console.log('Test directory cleaned up');
    } catch (error) {
      console.log('Could not clean up test directory:', error.message);
    }
    
    console.log('\n✅ Test complete!');
  }
}

// Run the test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});