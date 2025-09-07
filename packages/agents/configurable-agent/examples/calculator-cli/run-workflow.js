#!/usr/bin/env node

/**
 * Two-Step Calculation Workflow using BehaviorTree System
 * 
 * This demonstrates a sequential workflow that:
 * 1. Adds two numbers
 * 2. Multiplies the result by another number
 * 
 * It shows how the BT system can chain operations and pass results between steps.
 * 
 * Usage:
 *   node run-workflow.js [a] [b] [multiplier]
 *   
 * Example:
 *   node run-workflow.js 10 5 2
 *   # Calculates: (10 + 5) * 2 = 30
 */

import { ConfigurableAgent } from '../../src/core/ConfigurableAgent.js';
import { createWorkflowConfig } from '../../src/bt/AgentBTConfig.js';

// Get ResourceManager and ToolRegistry singletons
async function getResourcesForAgent() {
  const { ResourceManager } = await import('@legion/resource-manager');
  const { getToolRegistry } = await import('@legion/tools-registry');
  
  const resourceManager = await ResourceManager.getInstance();
  
  // Get ToolRegistry singleton using the correct function
  const toolRegistry = await getToolRegistry();
  
  // Register toolRegistry with ResourceManager so CapabilityManager can find it
  resourceManager.set('toolRegistry', toolRegistry);
  
  return { resourceManager, toolRegistry };
}

// Simple agent configuration
const agentConfig = {
  agent: {
    id: 'workflow-runner-agent',
    name: 'WorkflowAgent',
    type: 'task',
    version: '1.0.0',
    capabilities: [
      {
        module: 'calculator',
        tools: ['add', 'subtract', 'multiply', 'divide'],
        permissions: { read: true, write: true, execute: true }
      }
    ],
    llm: {
      provider: 'anthropic',
      model: 'claude-3-haiku',
      temperature: 0.1,
      maxTokens: 100,
      systemPrompt: 'You are a workflow execution assistant.'
    },
    state: {
      maxHistorySize: 10,
      contextVariables: {}
    }
  }
};

async function runWorkflow(a, b, multiplier) {
  console.log('🔄 BehaviorTree Workflow Runner');
  console.log('=================================');
  console.log(`\nCalculating: (${a} + ${b}) * ${multiplier}`);
  console.log('\nInitializing agent...');

  // Initialize ResourceManager and Agent
  const { resourceManager, toolRegistry } = await getResourcesForAgent();
  const agent = new ConfigurableAgent(agentConfig, resourceManager);
  await agent.initialize();

  console.log('✅ Agent initialized\n');

  // Create a workflow that performs two sequential calculations
  const workflow = createWorkflowConfig({
    sessionId: `workflow-${Date.now()}`,
    steps: [
      {
        type: 'tool',
        name: 'Addition Step',
        tool: 'add',
        operation: 'add',
        params: { a, b },
        outputVariable: 'sumResult'
      },
      {
        type: 'tool',
        name: 'Multiplication Step',
        tool: 'multiply',
        operation: 'multiply',
        params: { 
          a: '@sumResult.result',  // Use result from previous step
          b: multiplier 
        },
        outputVariable: 'finalResult'
      },
      {
        type: 'state',
        name: 'Save Calculation',
        action: 'update',
        updates: {
          lastCalculation: {
            formula: `(${a} + ${b}) * ${multiplier}`,
            result: '@finalResult.result',
            timestamp: Date.now()
          }
        },
        outputVariable: 'stateSaved'
      }
    ],
    rollbackOnFailure: false
  });

  console.log('📋 Workflow Steps:');
  console.log(`   1. Add ${a} + ${b}`);
  console.log(`   2. Multiply result by ${multiplier}`);
  console.log('   3. Save calculation to state\n');

  try {
    console.log('▶️  Starting workflow execution...\n');
    const startTime = Date.now();

    // Execute the workflow
    const result = await agent.receive({
      type: 'execute_bt',
      from: 'workflow-runner',
      sessionId: workflow.sessionId,
      btConfig: workflow,
      context: {
        description: `Calculate (${a} + ${b}) * ${multiplier}`
      }
    });

    const executionTime = Date.now() - startTime;

    if (result.success) {
      console.log('✅ Workflow completed successfully!\n');
      
      // Show step results
      console.log('📊 Step Results:');
      
      if (result.artifacts?.step1Result) {
        const sumResult = result.artifacts.step1Result.result;
        console.log(`   Step 1 (Addition): ${a} + ${b} = ${sumResult}`);
      }
      
      if (result.artifacts?.step2Result) {
        const finalResult = result.artifacts.step2Result.result;
        console.log(`   Step 2 (Multiplication): ${result.artifacts.step1Result.result} * ${multiplier} = ${finalResult}`);
      }
      
      if (result.artifacts?.step3Result) {
        console.log(`   Step 3 (State Save): ✅ Calculation saved to agent state`);
      }

      console.log(`\n🎯 Final Result: ${result.artifacts?.step2Result?.result}`);
      console.log(`⏱️  Execution time: ${executionTime}ms`);

      // Show node execution tracking
      if (result.nodeResults && Object.keys(result.nodeResults).length > 0) {
        console.log('\n📈 Execution Tracking:');
        console.log(`   Total nodes executed: ${Object.keys(result.nodeResults).length}`);
        
        let successCount = 0;
        Object.values(result.nodeResults).forEach(nodeResult => {
          if (nodeResult.status === 'SUCCESS') successCount++;
        });
        console.log(`   Successful nodes: ${successCount}`);
      }

    } else {
      console.log(`❌ Workflow failed: ${result.error || 'Unknown error'}`);
      
      // Show which step failed
      if (result.nodeResults) {
        Object.entries(result.nodeResults).forEach(([nodeId, nodeResult]) => {
          if (nodeResult.status === 'FAILURE') {
            console.log(`   Failed at: ${nodeId} - ${nodeResult.error}`);
          }
        });
      }
    }

    // Export final state to show what was saved
    console.log('\n📝 Checking saved state...');
    const stateExport = await agent.receive({
      type: 'export_state',
      from: 'workflow-runner'
    });

    if (stateExport.data?.state?.contextVariables?.lastCalculation) {
      const lastCalc = stateExport.data.state.contextVariables.lastCalculation;
      console.log(`   Formula: ${lastCalc.formula}`);
      console.log(`   Result: ${lastCalc.result}`);
    }

  } catch (error) {
    console.error('❌ Workflow execution error:', error.message);
  } finally {
    // Shutdown agent
    console.log('\n🔌 Shutting down agent...');
    await agent.receive({ type: 'shutdown', from: 'workflow-runner' });
    console.log('✅ Agent shutdown complete');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 3) {
  console.log('Usage: node run-workflow.js <a> <b> <multiplier>');
  console.log('Example: node run-workflow.js 10 5 2');
  console.log('\nThis will calculate: (10 + 5) * 2 = 30');
  process.exit(1);
}

const a = parseFloat(args[0]);
const b = parseFloat(args[1]);
const multiplier = parseFloat(args[2]);

if (isNaN(a) || isNaN(b) || isNaN(multiplier)) {
  console.error('❌ All arguments must be numbers');
  process.exit(1);
}

// Run the workflow
runWorkflow(a, b, multiplier).catch(error => {
  console.error('Failed to run workflow:', error);
  process.exit(1);
});