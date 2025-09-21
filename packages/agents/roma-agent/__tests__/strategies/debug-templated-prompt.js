#!/usr/bin/env node

/**
 * Debug TemplatedPrompt behavior
 */

import { ResourceManager } from '@legion/resource-manager';
import { TemplatedPrompt } from '@legion/prompting-manager';

async function debugTemplatedPrompt() {
  console.log('🔍 Debugging TemplatedPrompt behavior\n');
  
  try {
    // Get LLM client
    const resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    console.log('✅ Got LLM client');
    
    // Create a TemplatedPrompt directly
    const prompt = new TemplatedPrompt({
      prompt: `Analyze this task: "{{task}}"
      
Return a JSON object with:
- type: "simple" or "complex"  
- reason: brief explanation`,
      responseSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['simple', 'complex'] },
          reason: { type: 'string' }
        },
        required: ['type', 'reason'],
        format: 'json'
      },
      llmClient: llmClient
    });
    
    console.log('\n🚀 Executing TemplatedPrompt...');
    const result = await prompt.execute({
      task: 'Create a simple HTTP server'
    });
    
    console.log('\n📊 Full result structure:');
    console.log('Type:', typeof result);
    console.log('Keys:', Object.keys(result || {}));
    console.log('Full result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugTemplatedPrompt().catch(console.error);