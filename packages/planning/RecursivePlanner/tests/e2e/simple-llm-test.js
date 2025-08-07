/**
 * Simple LLM connection test
 */

import { createLLMProvider } from '../../src/factories/AgentFactory.js';
import { config } from '../../src/runtime/config/index.js';

async function testLLMConnection() {
  console.log('🧪 Testing LLM Connection...\n');
  
  try {
    // Check if API keys are available
    const availableProviders = config.getAvailableLLMProviders();
    console.log('Available providers:', availableProviders);
    
    if (availableProviders.length === 0) {
      console.error('❌ No LLM providers configured with API keys');
      return;
    }
    
    // Create LLM provider
    const llm = createLLMProvider();
    console.log(`Using provider: ${llm.provider}`);
    console.log(`Model: ${llm.model}\n`);
    
    // Simple test prompt
    const prompt = "Say 'Hello! I'm working!' and nothing else.";
    console.log('Sending prompt:', prompt);
    
    // Make the request
    const response = await llm.complete(prompt);
    console.log('Response:', response);
    
    // Check if response contains expected content
    if (response.toLowerCase().includes('hello') && response.toLowerCase().includes('working')) {
      console.log('\n✅ LLM connection test PASSED!');
      console.log('Token usage:', llm.getTokenUsage());
    } else {
      console.log('\n⚠️  Unexpected response from LLM');
    }
    
  } catch (error) {
    console.error('\n❌ LLM connection test FAILED!');
    console.error('Error:', error.message);
  }
}

// Run the test
testLLMConnection();