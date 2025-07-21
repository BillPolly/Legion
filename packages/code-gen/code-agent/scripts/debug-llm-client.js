#!/usr/bin/env node

/**
 * Debug script to isolate LLM client hanging issue
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClientManager } from '../src/integration/LLMClientManager.js';

async function debugLLMClient() {
  console.log('🔍 Debug LLM Client Direct Call\n');
  
  try {
    // Setup ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Get API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }
    
    console.log('✅ API key obtained');
    
    // Create LLM client directly
    const llmClient = new LLMClientManager({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229'
    });
    
    await llmClient.initialize();
    console.log('✅ LLM client initialized');
    
    // Test a very simple LLM call
    const prompt = "Say hello in exactly 3 words.";
    
    console.log('📝 About to call LLM with simple prompt...');
    console.log('⏰ Start time:', new Date().toISOString());
    
    // Add timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT: LLM call took longer than 30 seconds')), 30000);
    });
    
    const llmPromise = llmClient.llmClient.complete(prompt);
    
    const result = await Promise.race([llmPromise, timeoutPromise]);
    
    console.log('✅ LLM call completed at:', new Date().toISOString());
    console.log('Result:', result);
    
  } catch (error) {
    console.error('\n❌ LLM Client Debug Error at:', new Date().toISOString());
    console.error('Error message:', error.message);
    
    if (error.message.includes('TIMEOUT')) {
      console.error('🚨 CONFIRMED: LLM client is hanging');
    } else {
      console.error('Stack:', error.stack);
    }
  }
}

// Run it
debugLLMClient();