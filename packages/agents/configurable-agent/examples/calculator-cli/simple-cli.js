#!/usr/bin/env node

/**
 * Simple Calculator CLI using BehaviorTree System
 * 
 * This demonstrates how to run the BT system interactively from the command line.
 * 
 * Usage:
 *   node simple-cli.js
 *   
 * Then type commands like:
 *   add 10 5
 *   multiply 3 7
 *   subtract 100 42
 *   divide 84 12
 */

import readline from 'readline';
import { ConfigurableAgent } from '../../src/core/ConfigurableAgent.js';
import { createAgentToolNodeConfig } from '../../src/bt/AgentBTConfig.js';

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

// Simple agent configuration with calculator capability
const agentConfig = {
  agent: {
    id: 'calculator-cli-agent',
    name: 'CalculatorAgent',
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
      systemPrompt: 'You are a calculator assistant.'
    },
    state: {
      maxHistorySize: 10,
      contextVariables: {}
    }
  }
};

async function runCLI() {
  console.log('🧮 BehaviorTree Calculator CLI');
  console.log('================================');
  console.log('Initializing agent...\n');

  // Initialize ResourceManager and Agent
  const { resourceManager, toolRegistry } = await getResourcesForAgent();
  const agent = new ConfigurableAgent(agentConfig, resourceManager);
  await agent.initialize();

  console.log('✅ Agent initialized successfully');
  console.log('\nAvailable commands:');
  console.log('  add <a> <b>       - Add two numbers');
  console.log('  subtract <a> <b>  - Subtract b from a');
  console.log('  multiply <a> <b>  - Multiply two numbers');
  console.log('  divide <a> <b>    - Divide a by b');
  console.log('  help              - Show this help');
  console.log('  exit              - Exit the program');
  console.log('\nType a command:');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const parts = input.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();

    if (command === 'exit' || command === 'quit') {
      console.log('Goodbye! 👋');
      rl.close();
      process.exit(0);
    }

    if (command === 'help') {
      console.log('\nAvailable commands:');
      console.log('  add <a> <b>       - Add two numbers');
      console.log('  subtract <a> <b>  - Subtract b from a');
      console.log('  multiply <a> <b>  - Multiply two numbers');
      console.log('  divide <a> <b>    - Divide a by b');
      console.log('  help              - Show this help');
      console.log('  exit              - Exit the program\n');
      rl.prompt();
      return;
    }

    // Check if it's a valid calculator operation
    const validOps = ['add', 'subtract', 'multiply', 'divide'];
    if (!validOps.includes(command)) {
      console.log(`❌ Unknown command: ${command}. Type 'help' for available commands.`);
      rl.prompt();
      return;
    }

    // Parse numbers
    const a = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);

    if (isNaN(a) || isNaN(b)) {
      console.log(`❌ Invalid numbers. Usage: ${command} <number> <number>`);
      rl.prompt();
      return;
    }

    try {
      // Create BT configuration for the calculator operation
      const btConfig = createAgentToolNodeConfig({
        id: `calc-${Date.now()}`,
        name: `Calculator ${command}`,
        tool: 'add',
        operation: command,
        params: { a, b },
        outputVariable: 'calculationResult'
      });

      console.log(`\n🔄 Executing: ${command}(${a}, ${b})`);

      // Execute through the agent
      const result = await agent.receive({
        type: 'execute_bt',
        from: 'cli',
        sessionId: 'cli-session',
        btConfig: btConfig
      });

      if (result.success) {
        const calcResult = result.artifacts?.calculationResult?.result;
        console.log(`✅ Result: ${calcResult}`);
        
        // Show execution details
        if (result.executionTime) {
          console.log(`   Execution time: ${result.executionTime}ms`);
        }
      } else {
        console.log(`❌ Calculation failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    console.log('');
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nShutting down agent...');
    agent.receive({ type: 'shutdown', from: 'cli' }).then(() => {
      console.log('Agent shutdown complete.');
      process.exit(0);
    });
  });
}

// Run the CLI
runCLI().catch(error => {
  console.error('Failed to start CLI:', error);
  process.exit(1);
});