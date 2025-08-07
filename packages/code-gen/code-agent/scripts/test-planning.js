#!/usr/bin/env node

/**
 * Test CodeAgent planning with real LLM
 */

import { ResourceManager } from '@legion/tools';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { LLMClient } from '@legion/llm';

async function test() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Register LLM factory
  resourceManager.registerFactory('llmClient', async (config, rm) => {
    const apiKey = rm.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not found');
    
    return new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });
  });
  
  const agent = new CodeAgent({
    workingDirectory: '/tmp/test-' + Date.now(),
    resourceManager: resourceManager,
    llmConfig: {
      provider: 'anthropic'  // This triggers the factory to be used
    }
  });
  
  await agent.initialize();
  console.log('✅ CodeAgent initialized successfully');
  
  // Test development (which includes planning)
  const result = await agent.develop({
    projectName: 'test-simple-server',
    description: 'A simple backend server',
    requirements: {
      backend: 'Simple Express server with one GET endpoint that returns {message: "Hello World"}'
    }
  });
  
  console.log('✅ Development completed:', result.success ? 'SUCCESS' : 'FAILED');
  if (result.plan) {
    console.log('Plan generated successfully');
    console.log('Plan type:', result.plan.task || result.plan.projectType);
    console.log('Complexity:', result.plan.complexity);
    console.log('Architecture pattern:', result.plan.suggestedArchitecture?.pattern);
  }
  if (result.files) {
    console.log('Files created:', Object.keys(result.files).length);
    console.log('File list:', Object.keys(result.files).join(', '));
  }
}

test().catch(console.error);