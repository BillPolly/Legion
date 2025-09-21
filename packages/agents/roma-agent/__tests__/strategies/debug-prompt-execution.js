#!/usr/bin/env node

/**
 * Debug prompt execution in strategies
 */

import { ResourceManager } from '@legion/resource-manager';
import PromptFactory from '../../src/utils/PromptFactory.js';

async function debugPromptExecution() {
  console.log('🔍 Debugging prompt execution\n');
  
  try {
    // Get LLM client
    const resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    console.log('✅ Got LLM client');
    
    // Test a simple prompt directly
    const testPromptDef = {
      template: `Analyze this task: "{{task}}"
      
Return a JSON object with:
- type: "simple" or "complex"
- reason: brief explanation`,
      responseSchema: PromptFactory.createJsonSchema({
        type: { type: 'string', enum: ['simple', 'complex'] },
        reason: { type: 'string' }
      }, ['type', 'reason'])
    };
    
    console.log('\n📝 Testing prompt creation...');
    const prompt = PromptFactory.createPrompt(testPromptDef, llmClient);
    console.log('✅ Prompt created');
    
    console.log('\n🚀 Executing prompt...');
    const result = await PromptFactory.executePrompt(prompt, {
      task: 'Create a simple HTTP server'
    });
    
    console.log('\n📊 Result:');
    console.log('  Success:', result.success);
    console.log('  Response:', JSON.stringify(result.response, null, 2));
    
    if (result.error) {
      console.log('  Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugPromptExecution().catch(console.error);