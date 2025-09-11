/**
 * Demo: Consumer Experience with Unified Prompting System
 * 
 * This shows how simple it is for consumers to use rich LLM features
 * across any provider without knowing anything about provider differences.
 */

import { LLMClient } from './src/LLMClient.js';
import { PromptManager } from '../prompt-manager/src/PromptManager.js';

console.log('🚀 Demo: Consumer Experience with Unified Prompting System\\n');

// Setup (consumer would get this from ResourceManager)
const llmClient = new LLMClient({
  provider: 'mock', // Could be 'openai', 'anthropic', etc.
  maxRetries: 2
});

const promptManager = new PromptManager({
  llmClient: llmClient,
  objectQuery: { bindingRules: [] },
  promptBuilder: { template: "{{prompt}}" },
  outputSchema: false,
  retryConfig: { maxAttempts: 2 }
});

// DEMO 1: Simple Chat
console.log('📋 Demo 1: Simple Chat Bot');
console.log('Consumer code:');
console.log(`
await promptManager.request({
  systemPrompt: "You are a friendly chatbot named Alice",
  chatHistory: [
    {role: 'user', content: 'Hi there!'},
    {role: 'assistant', content: 'Hello! Nice to meet you.'}
  ],
  prompt: "What's your favorite color?"
});
`);

try {
  const chatResponse = await promptManager.request({
    systemPrompt: "You are a friendly chatbot named Alice",
    chatHistory: [
      {role: 'user', content: 'Hi there!'},
      {role: 'assistant', content: 'Hello! Nice to meet you.'}
    ],
    prompt: "What's your favorite color?"
  });

  console.log('✅ Response:', chatResponse.success ? 'SUCCESS' : 'FAILED');
  console.log('📝 Content preview:', (chatResponse.content || '').substring(0, 100) + '...');
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\\n' + '='.repeat(60) + '\\n');

// DEMO 2: Tool-Using Agent
console.log('🔧 Demo 2: Tool-Using Agent');
console.log('Consumer code:');
console.log(`
await promptManager.request({
  systemPrompt: "You are a helpful coding assistant with access to tools",
  tools: [
    {
      name: 'execute_code',
      description: 'Execute JavaScript code and return the result',
      parameters: {
        type: 'object',
        properties: { code: {type: 'string'} }
      }
    },
    {
      name: 'search_docs', 
      description: 'Search documentation for information',
      parameters: {
        type: 'object',
        properties: { query: {type: 'string'} }
      }
    }
  ],
  files: [{
    name: 'user-script.js',
    content: 'function calculateSum(a, b) { return a + b; }',
    type: 'text'
  }],
  prompt: "Help me test this function with the value 5 and 10"
});
`);

try {
  const toolResponse = await promptManager.request({
    systemPrompt: "You are a helpful coding assistant with access to tools",
    tools: [
      {
        name: 'execute_code',
        description: 'Execute JavaScript code and return the result',
        parameters: {
          type: 'object',
          properties: { code: {type: 'string'} }
        }
      },
      {
        name: 'search_docs', 
        description: 'Search documentation for information',
        parameters: {
          type: 'object',
          properties: { query: {type: 'string'} }
        }
      }
    ],
    files: [{
      name: 'user-script.js',
      content: 'function calculateSum(a, b) { return a + b; }',
      type: 'text'
    }],
    prompt: "Help me test this function with the values 5 and 10",
    temperature: 0.3
  });

  console.log('✅ Response:', toolResponse.success ? 'SUCCESS' : 'FAILED');
  console.log('🔧 Tool calls detected:', toolResponse.toolCalls ? toolResponse.toolCalls.length : 0);
  console.log('⚙️  Provider adaptations:', toolResponse.metadata?.llmCall?.adaptations?.join(', ') || 'none');
  console.log('📝 Content preview:', (toolResponse.content || '').substring(0, 150) + '...');
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\\n' + '='.repeat(60) + '\\n');

// DEMO 3: Show Provider Adaptation Transparency
console.log('🎯 Demo 3: Provider Adaptation (Transparent to Consumer)');
console.log('Same consumer code, different providers:');

const providers = [
  { name: 'mock', description: 'Basic text-only provider' },
  { name: 'openai', description: 'Full-featured provider' },
  { name: 'anthropic', description: 'Advanced provider with adaptations' }
];

const demoRequest = {
  systemPrompt: "You are helpful",
  tools: [{ name: 'calculator', description: 'Do math', parameters: {type: 'object'} }],
  prompt: "Calculate 2 + 2",
  temperature: 0.5
};

providers.forEach(provider => {
  console.log(`\\n${provider.name.toUpperCase()} (${provider.description}):`);
  
  // Simulate different provider
  const tempClient = new LLMClient({provider: provider.name, maxRetries: 1});
  const capabilities = tempClient.getProviderCapabilities();
  const adapted = tempClient.adaptRequestToProvider(demoRequest, capabilities);
  
  console.log(`  🎛️  Capabilities: tools=${capabilities.tools}, chat=${capabilities.chatHistory}`);
  console.log(`  🔄 Adaptations: ${adapted.adaptations.join(', ') || 'none needed'}`);
  
  if (provider.name === 'openai') {
    console.log(`  ⚡ Native tools: ${adapted.tools ? 'YES' : 'NO'}`);
  }
  if (provider.name === 'anthropic') {
    console.log(`  📝 XML tools in system prompt: ${adapted.system?.includes('<tool') ? 'YES' : 'NO'}`);
  }
  if (provider.name === 'mock') {
    console.log(`  📄 Flattened to single prompt: ${adapted.prompt ? 'YES' : 'NO'}`);
  }
});

console.log('\\n' + '🌟'.repeat(30));
console.log('\\n🎉 DEMO COMPLETE!\\n');
console.log('💡 Key Benefits for Consumers:');
console.log('   • Write rich, feature-complete code ONCE');
console.log('   • Works optimally across ALL providers automatically'); 
console.log('   • No provider-specific knowledge needed');
console.log('   • Automatic error handling and retry with smart prompts');
console.log('   • Tool calls, files, chat history - all just work');
console.log('\\n🏗️  Architecture:');
console.log('   • PromptManager: High-level orchestration & validation');
console.log('   • LLMClient: Provider adaptation & abstraction');
console.log('   • Fully transparent to consumers');
console.log('\\n✨ The same simple interface unlocks the full power of any LLM provider!');