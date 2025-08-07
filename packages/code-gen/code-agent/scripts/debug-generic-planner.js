#!/usr/bin/env node

/**
 * Debug script to isolate GenericPlanner hanging issue
 */

import { ResourceManager } from '@legion/tool-system';
import { GenericPlanner } from '../../llm-planner/src/GenericPlanner.js';

async function debugGenericPlanner() {
  console.log('🔍 Debug GenericPlanner Direct Call\n');
  
  try {
    // Setup ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Get LLM client
    const llmClient = resourceManager.llm-client;
    if (!llmClient) {
      throw new Error('LLM client not available');
    }
    
    console.log('✅ LLM client obtained');
    
    // Create GenericPlanner
    const planner = new GenericPlanner({ llmClient });
    console.log('✅ GenericPlanner created');
    
    // Create a very simple planning request
    const request = {
      description: "Create a simple plan to say hello world",
      inputs: ['input1'],
      requiredOutputs: ['output1'],
      allowableActions: [
        {
          type: 'say_hello',
          description: 'Say hello to the world',
          inputs: ['input1'],
          outputs: ['output1'],
          parameters: {
            message: {
              type: 'string',
              description: 'The hello message'
            }
          }
        }
      ],
      maxSteps: 2
    };
    
    console.log('📝 About to call GenericPlanner.createPlan...');
    console.log('⏰ Start time:', new Date().toISOString());
    
    // Add timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT: GenericPlanner took longer than 30 seconds')), 30000);
    });
    
    const planPromise = planner.createPlan(request);
    
    const result = await Promise.race([planPromise, timeoutPromise]);
    
    console.log('✅ GenericPlanner completed at:', new Date().toISOString());
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ GenericPlanner Debug Error at:', new Date().toISOString());
    console.error('Error message:', error.message);
    
    if (error.message.includes('TIMEOUT')) {
      console.error('🚨 CONFIRMED: GenericPlanner is hanging');
    } else {
      console.error('Stack:', error.stack);
    }
  }
}

// Run it
debugGenericPlanner();