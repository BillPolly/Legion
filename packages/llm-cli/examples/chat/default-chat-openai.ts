#!/usr/bin/env node

import * as readline from 'readline';
import { LLMCLIFramework } from '../../src/core/framework/LLMCLIFramework';
import { LLMProvider } from '../../src/core/providers/types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// OpenAI provider implementation
class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
  }

  async complete(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async completeStructured<T>(prompt: string, schema: object): Promise<T> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are a JSON-only response bot. Always respond with valid JSON that matches the provided schema.'
          },
          { 
            role: 'user', 
            content: `${prompt}\n\nRespond with JSON matching this schema: ${JSON.stringify(schema)}` 
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{.*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error('Failed to parse structured response');
    }
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  getModelName(): string {
    return 'gpt-3.5-turbo';
  }
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

// Initialize the OpenAI provider
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
  console.error('Make sure you have a .env file in the monorepo root with OPENAI_API_KEY=your-key');
  process.exit(1);
}

const llmProvider = new OpenAIProvider(apiKey);

// Create framework - default chat will be automatically registered
const framework = new LLMCLIFramework({
  llmProvider,
  commands: {
    // Add a few example commands to show how chat works as fallback
    weather: {
      description: 'Get weather information',
      parameters: [
        { name: 'location', type: 'string', required: true, description: 'City or location' }
      ],
      handler: async ({ location }) => ({
        success: true,
        output: `Weather information for ${location} would be displayed here (this is a demo command)`
      })
    },
    calculate: {
      description: 'Perform a calculation',
      parameters: [
        { name: 'expression', type: 'string', required: true, description: 'Math expression to evaluate' }
      ],
      handler: async ({ expression }) => {
        try {
          // Simple eval for demo - in production use a proper math parser
          const result = eval(expression);
          return {
            success: true,
            output: `${expression} = ${result}`
          };
        } catch (error) {
          return {
            success: false,
            error: 'Invalid expression'
          };
        }
      }
    }
  }
});

// Debug logging
console.log('\n=== DEBUG: Framework initialized ===');
console.log('Commands registered:', framework.listCommands());
console.log('Chat command exists:', framework.getCommandInfo('chat') ? 'YES' : 'NO');
if (framework.getCommandInfo('chat')) {
  console.log('Chat command info:', {
    description: framework.getCommandInfo('chat')?.description,
    hasHandler: typeof framework.getCommandInfo('chat')?.handler === 'function'
  });
}
console.log('=== END DEBUG ===\n');

console.log('💬 Default Chat Demo with OpenAI');
console.log('Using real OpenAI API for natural language understanding\n');
console.log('Available commands:', framework.listCommands().join(', '));
console.log('\nTry:');
console.log('- "What\'s the weather in Paris?" (will use weather command)');
console.log('- "Calculate 25 * 4" (will use calculate command)');
console.log('- "Hello, how are you?" (will use default chat)');
console.log('- "Tell me a joke" (will use default chat)');
console.log('\nType "exit" to quit\n');

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
      console.log('\nProcessing...');
      const result = await framework.processInput(input);
      console.log('\n' + result.message + '\n');
      
      // Show which command was used
      console.log(`(Command used: ${result.command})\n`);
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