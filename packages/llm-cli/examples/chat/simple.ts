#!/usr/bin/env node

import * as readline from 'readline';
import { LLMCLIFramework } from '../../src/core/framework/LLMCLIFramework';
import { MockLLMProvider } from '../../src/core/providers/MockLLMProvider';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

// Initialize the LLM provider and configure it to handle any input as chat
const llmProvider = new MockLLMProvider();

// Add specific responses for intent recognition
llmProvider.addResponse('Determine the intent', JSON.stringify({
  command: 'chat',
  parameters: { message: 'user message' },
  confidence: 1.0
}));

// Create framework with no commands - just let it handle everything as chat
const framework = new LLMCLIFramework({
  llmProvider,
  commands: {}  // No commands - everything should fail and hopefully default to something
});

console.log('💬 Minimal Chat CLI');
console.log('Type your message or "exit" to quit\n');

// Show prompt
rl.prompt();

// Handle line input
rl.on('line', async (line) => {
  const input = line.trim();
  
  if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
    console.log('Goodbye! 👋');
    rl.close();
    process.exit(0);
  }
  
  if (input) {
    try {
      const result = await framework.processInput(input);
      console.log('\nResponse:', result.message);
      console.log('Success:', result.success);
      console.log('Command:', result.command, '\n');
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error\n');
    }
  }
  
  rl.prompt();
});

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\nGoodbye! 👋');
  rl.close();
  process.exit(0);
});