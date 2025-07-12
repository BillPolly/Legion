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

// Initialize the LLM provider
const llmProvider = new MockLLMProvider();

// Configure the mock provider to handle different types of prompts
// For intent recognition prompts
llmProvider.addResponse('Determine the intent', JSON.stringify({
  command: 'chat',
  parameters: { message: 'user input' },
  confidence: 1.0,
  reasoning: 'User wants to chat'
}));

// For natural language generation prompts
llmProvider.addResponse('natural, conversational response', 'I understand you want to chat! This is a mock response. To have real conversations, configure an OpenAI or Anthropic provider.');

// Create framework with a simple chat command
const framework = new LLMCLIFramework({
  llmProvider,
  commands: {
    chat: {
      description: 'Have a conversation',
      parameters: [
        { name: 'message', type: 'string', required: false, description: 'The message from the user' }
      ],
      handler: async (params) => ({
        success: true,
        output: `Chat response: ${params.message || 'Hello!'}`
      })
    }
  }
});

console.log('💬 Simple Chat CLI');
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
      console.log('\n' + result.message + '\n');
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