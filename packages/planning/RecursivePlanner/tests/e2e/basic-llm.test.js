/**
 * Basic LLM integration test
 */

import { describe, test, expect } from '@jest/globals';
import { createLLMProvider } from '../../src/factories/AgentFactory.js';
import { config } from '../../src/runtime/config/index.js';

describe('Basic LLM Integration', () => {
  test('should connect to LLM and get a response', async () => {
    // Check if API keys are available
    const availableProviders = config.getAvailableLLMProviders();
    expect(availableProviders.length).toBeGreaterThan(0);
    
    // Create LLM provider
    const llm = createLLMProvider();
    expect(llm).toBeDefined();
    expect(llm.provider).toBeTruthy();
    expect(llm.model).toBeTruthy();
    
    // Simple test prompt
    const prompt = "Say 'Hello! I'm working!' and nothing else.";
    
    // Make the request
    const response = await llm.complete(prompt);
    
    // Verify response
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.toLowerCase()).toContain('hello');
    expect(response.toLowerCase()).toContain('working');
    
    // Verify token tracking
    const usage = llm.getTokenUsage();
    expect(usage).toBeDefined();
    expect(usage.input).toBeGreaterThan(0);
    expect(usage.output).toBeGreaterThan(0);
    expect(usage.total).toBe(usage.input + usage.output);
  });
  
  test('should execute a simple planning task', async () => {
    const llm = createLLMProvider();
    
    const planningPrompt = `Create a simple 2-step plan to make coffee. 
    Return ONLY a JSON array with this exact format:
    [
      {"id": "step1", "description": "First step", "tool": "doTask", "params": {}, "dependencies": []},
      {"id": "step2", "description": "Second step", "tool": "doTask", "params": {}, "dependencies": ["step1"]}
    ]`;
    
    const response = await llm.complete(planningPrompt);
    
    // Verify we got JSON back
    expect(response).toBeDefined();
    
    // Try to parse it
    let plan;
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      plan = JSON.parse(jsonStr);
    } catch (error) {
      console.log('Failed to parse response:', response);
      throw error;
    }
    
    // Verify plan structure
    expect(Array.isArray(plan)).toBe(true);
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan[0]).toHaveProperty('id');
    expect(plan[0]).toHaveProperty('description');
    expect(plan[0]).toHaveProperty('tool');
  });
});