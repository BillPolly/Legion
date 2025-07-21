#!/usr/bin/env node

/**
 * Debug script to test GenericPlanner with simple actions
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClientManager } from '../src/integration/LLMClientManager.js';
import { GenericPlanner } from '../../llm-planner/src/GenericPlanner.js';

async function debugSimpleGenericPlanner() {
  console.log('🔍 Debug GenericPlanner with Simple Actions\n');
  
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
    const llmClientManager = new LLMClientManager({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229'
    });
    
    await llmClientManager.initialize();
    console.log('✅ LLM client initialized');
    
    // Create GenericPlanner
    const planner = new GenericPlanner({ llmClient: llmClientManager.llmClient });
    console.log('✅ GenericPlanner created');
    
    // Create a SIMPLE planning request with only 2 actions
    const request = {
      description: "Analyze simple project requirements",
      inputs: ['requirements'],
      requiredOutputs: ['analysis'],
      allowableActions: [
        {
          type: 'parse_requirements',
          description: 'Parse the requirements',
          inputs: ['requirements'],
          outputs: ['parsed_requirements'],
          parameters: {
            projectType: { type: 'string', description: 'The project type' }
          }
        },
        {
          type: 'generate_analysis',
          description: 'Generate analysis from parsed requirements',
          inputs: ['parsed_requirements'],
          outputs: ['analysis'],
          parameters: {
            complexity: { type: 'string', description: 'The complexity level' }
          }
        }
      ],
      maxSteps: 3
    };
    
    console.log('📝 About to call GenericPlanner.createPlan with SIMPLE request...');
    console.log('⏰ Start time:', new Date().toISOString());
    
    // Add timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT: Simple GenericPlanner took longer than 60 seconds')), 60000);
    });
    
    const planPromise = planner.createPlan(request);
    
    const result = await Promise.race([planPromise, timeoutPromise]);
    
    console.log('✅ Simple GenericPlanner completed at:', new Date().toISOString());
    console.log('Result name:', result.name);
    console.log('Steps count:', result.steps?.length);
    
  } catch (error) {
    console.error('\n❌ Simple GenericPlanner Debug Error at:', new Date().toISOString());
    console.error('Error message:', error.message);
    
    if (error.message.includes('TIMEOUT')) {
      console.error('🚨 CONFIRMED: Even simple GenericPlanner is hanging');
    } else {
      console.error('Stack:', error.stack);
    }
  }
}

// Run it
debugSimpleGenericPlanner();