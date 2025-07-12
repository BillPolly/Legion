#!/usr/bin/env node

import * as readline from 'readline';
import { CalculatorCLI } from './calculator';
// import { OpenAIProvider } from '../../src/core/providers/OpenAIProvider';
import { MockLLMProvider } from '../../src/core/providers/MockLLMProvider';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'calc> '
});

// Initialize the calculator CLI
// For now, always use MockLLMProvider
// TODO: Add OpenAIProvider when implemented
const llmProvider = new MockLLMProvider();

const calculator = new CalculatorCLI({ llmProvider });

console.log('🧮 Calculator CLI - Natural Language Calculator');
console.log('Type "help" for available commands or "exit" to quit\n');

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
      const result = await calculator.process(input);
      console.log('\n' + result.response + '\n');
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