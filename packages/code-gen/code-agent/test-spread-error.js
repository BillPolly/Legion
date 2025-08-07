#!/usr/bin/env node

/**
 * Find the spread syntax error
 */

import { ResourceManager } from '@legion/tools';
import { UnifiedPlanner } from './src/planning/llm/UnifiedPlanner.js';

async function testSpreadError() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create a mock LLM client that returns bad data
    const mockLLMClient = {
      generateCompletion: async () => {
        console.log('Mock LLM called - returning bad data to trigger error');
        // Return something that will cause spread syntax error
        return {
          cssStyles: "not-an-array", // This should be an array
          jsComponents: 123, // This should be an array
          components: null
        };
      }
    };
    
    const planner = new UnifiedPlanner({ llmClient: mockLLMClient });
    await planner.initialize();
    
    // Try frontend planning which should trigger the error
    const result = await planner.planFrontendArchitecture({
      projectType: 'fullstack',
      projectName: 'Test'
    });
    
    console.log('Result:', result);
    console.log('cssStyles type:', typeof result.cssStyles);
    console.log('cssStyles is array:', Array.isArray(result.cssStyles));
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSpreadError();