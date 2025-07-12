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

// Configure mock responses for demonstration
llmProvider.completeStructured = async <T>(): Promise<T> => {
  // Always map to chat command for this demo
  return {
    command: 'chat',
    parameters: { message: 'user input' },
    confidence: 0.9,
    reasoning: 'User wants to chat'
  } as T;
};

// Mock chat responses
const chatResponses = [
  'Hello! I\'m the default chat assistant. How can I help you today?',
  'That\'s an interesting question! Let me think about that...',
  'I understand. Is there anything else you\'d like to know?',
  'Great! I\'m here to help with any questions you have.',
  'Thanks for chatting with me! Feel free to ask anything.'
];
let responseIndex = 0;

llmProvider.complete = async (prompt: string) => {
  const response = chatResponses[responseIndex % chatResponses.length];
  responseIndex++;
  return response;
};

// Create framework - default chat will be automatically registered
const framework = new LLMCLIFramework({
  llmProvider,
  commands: {} // No custom commands - will use default chat
});

console.log('💬 Default Chat Demo (Mock LLM)');
console.log('This demo uses a mock LLM provider with pre-defined responses.');
console.log('To use a real LLM, run: npm run cli:chat-openai');
console.log('Make sure you have OPENAI_API_KEY in your .env file\n');
console.log('The framework automatically provides a chat command');
console.log('Type anything to chat, or "exit" to quit\n');

// Show available commands
console.log('Available commands:', framework.listCommands().join(', '));
console.log();

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

// Example of disabling default chat:
// const frameworkNoChat = new LLMCLIFramework({
//   llmProvider,
//   commands: {},
//   disableDefaultChat: true
// });

// Example of overriding default chat:
// framework.registerCommand('chat', {
//   description: 'My custom chat handler',
//   handler: async (params) => ({
//     success: true,
//     output: 'Custom response!'
//   })
// });