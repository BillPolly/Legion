#!/usr/bin/env node

/**
 * Debug script to test completeWithStructuredResponse method
 */

import { ResourceManager } from '@legion/tools-registry';
import { LLMClientManager } from '../src/integration/LLMClientManager.js';

async function debugStructuredResponse() {
  console.log('🔍 Debug LLM completeWithStructuredResponse\n');
  
  try {
    // Setup ResourceManager
    const resourceManager = await ResourceManager.getResourceManager();
    
    // Get API key
    const apiKey = resourceManager.env.ANTHROPIC_API_KEY;
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
    
    // Test a very simple structured response
    const prompt = `Create a simple plan with one step. Respond in JSON format:
{
  "name": "Simple Plan",
  "description": "A very simple plan",
  "steps": [
    {
      "name": "Step 1",
      "description": "Do something simple"
    }
  ]
}`;
    
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' }
            }
          }
        }
      }
    };
    
    console.log('📝 About to call completeWithStructuredResponse...');
    console.log('⏰ Start time:', new Date().toISOString());
    
    // Add timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT: Structured response took longer than 30 seconds')), 30000);
    });
    
    const structuredPromise = llmClient.llmClient.completeWithStructuredResponse(prompt, {
      schema: schema,
      expectedFields: ['name', 'description', 'steps'],
      maxTokens: 1000
    });
    
    const result = await Promise.race([structuredPromise, timeoutPromise]);
    
    console.log('✅ Structured response completed at:', new Date().toISOString());
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ Structured Response Debug Error at:', new Date().toISOString());
    console.error('Error message:', error.message);
    
    if (error.message.includes('TIMEOUT')) {
      console.error('🚨 CONFIRMED: completeWithStructuredResponse is hanging');
    } else {
      console.error('Stack:', error.stack);
    }
  }
}

// Run it
debugStructuredResponse();