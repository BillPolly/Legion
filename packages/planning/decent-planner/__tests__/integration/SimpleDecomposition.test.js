/**
 * Simple test to debug decomposition issues
 */

import { describe, it, expect } from '@jest/globals';
import { TaskDecomposer } from '../../src/core/TaskDecomposer.js';
import { ResourceManager } from '@legion/tools';
import { Anthropic } from '@anthropic-ai/sdk';

describe('Simple Decomposition Test', () => {
  it('should test basic decomposition', async () => {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    console.log('API Key available:', !!apiKey);
    
    if (!apiKey) {
      console.log('Skipping - no API key');
      return;
    }
    
    // Create Anthropic client
    const anthropic = new Anthropic({ apiKey });
    
    // Create simple LLM client wrapper
    const llmClient = {
      generateResponse: async (options) => {
        console.log('Calling Anthropic with:', {
          model: options.model,
          messageCount: options.messages.length,
          systemPrompt: options.messages[0].content.substring(0, 100)
        });
        
        const response = await anthropic.messages.create({
          model: options.model || 'claude-3-5-sonnet-20241022',
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.3,
          messages: options.messages
        });
        
        console.log('Anthropic response:', {
          contentType: response.content[0].type,
          contentLength: response.content[0].text.length,
          firstChars: response.content[0].text.substring(0, 200)
        });
        
        return {
          content: response.content[0].text,
          usage: response.usage
        };
      }
    };
    
    // Create decomposer
    const decomposer = new TaskDecomposer(llmClient);
    
    // Test simple decomposition
    const result = await decomposer.decompose('Write a hello world program');
    
    console.log('Decomposition result:', {
      success: result.success,
      error: result.error,
      subtaskCount: result.subtasks?.length || 0
    });
    
    if (result.success) {
      console.log('Subtasks:', result.subtasks.map(st => ({
        description: st.description,
        complexity: st.complexity
      })));
    }
    
    expect(result.success).toBe(true);
    expect(result.subtasks).toBeDefined();
    expect(result.subtasks.length).toBeGreaterThan(0);
  });
});