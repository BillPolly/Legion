/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { UnifiedPlanner } from '../../UnifiedPlanner.js';

describe('Working Real LLM Test', () => {
  let resourceManager;
  let llmClient;
  let unifiedPlanner;
  
  beforeAll(async () => {
    console.log('🚀 Setting up working real LLM test...');
    
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for real LLM tests');
    }
    
    // Create real LLM client
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 1
    });
    
    // Mock ResourceManager to return our LLM client
    resourceManager.get = (key) => {
      if (key === 'llm-client') return llmClient;
      if (key === 'env.ANTHROPIC_API_KEY') return apiKey;
      return null;
    };
    
    // Create UnifiedPlanner with real LLM
    unifiedPlanner = new UnifiedPlanner({
      provider: 'anthropic'
    });
    
    // Override ResourceManager for testing
    unifiedPlanner.resourceManager = resourceManager;
    await unifiedPlanner.initialize();
    
    console.log('✅ Working real LLM test initialized');
  });
  
  afterAll(async () => {
    console.log('🧹 Cleaning up working test resources...');
  });

  test('should successfully analyze requirements with real LLM', async () => {
    
    const requirements = {
      task: 'Create a simple todo list application',
      requirements: {
        frontend: 'Basic task list with add and delete functionality'
      }
    };
    
    console.log('🔍 Testing requirements analysis with real LLM...');
    console.log('📋 Requirements:', requirements);
    
    try {
      const analysis = await unifiedPlanner.analyzeRequirements(requirements);
      
      console.log('✅ Analysis completed successfully!');
      console.log('📊 Analysis result:', {
        task: analysis.task,
        projectType: analysis.projectType,
        complexity: analysis.complexity,
        hasComponents: !!analysis.components,
        hasMetadata: !!analysis.metadata
      });
      
      // Verify analysis structure  
      expect(analysis).toHaveProperty('task');
      expect(analysis).toHaveProperty('projectType');
      expect(analysis).toHaveProperty('components');
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('metadata');
      
      // Verify content makes sense
      expect(analysis.task).toBe(requirements.task);
      expect(['frontend', 'backend', 'fullstack']).toContain(analysis.projectType);
      expect(['low', 'medium', 'high']).toContain(analysis.complexity);
      expect(analysis.metadata.planner).toBe('UnifiedPlanner');
      
      console.log('🎉 Real LLM test passed successfully!');
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      throw error;
    }
    
  }, 120000); // 2 minute timeout
});