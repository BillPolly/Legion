/**
 * Integration tests for Agent with actual LLM
 * 
 * These tests require a valid OPENAI_API_KEY to run
 * They are skipped if the API key is not available
 */

import { Agent } from '../../src/Agent.js';
import { ToolResult } from '@jsenvoy/modules';

const hasApiKey = !!process.env.OPENAI_API_KEY;
const describeIfApiKey = hasApiKey ? describe : describe.skip;

// Simple test tools
const createTestTools = () => {
  const calculatorTool = {
    name: 'calculator',
    identifier: 'calc',
    abilities: ['perform arithmetic calculations'],
    instructions: ['Use this to calculate mathematical expressions'],
    functions: [
      {
        name: 'evaluate',
        purpose: 'Evaluate a mathematical expression',
        arguments: ['expression'],
        response: 'number'
      }
    ],
    safeInvoke: async (toolCall) => {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const expression = args.expression;
        
        // Simple safe evaluation (only numbers and basic operators)
        if (!/^[\d\s+\-*/().]+$/.test(expression)) {
          return ToolResult.failure('Invalid expression - only numbers and +,-,*,/,(,) allowed');
        }
        
        const result = Function(`"use strict"; return (${expression})`)();
        return ToolResult.success({ result, expression });
      } catch (error) {
        return ToolResult.failure(`Calculation error: ${error.message}`);
      }
    },
    setExecutingAgent: () => {} // Required by Agent
  };
  
  const stringTool = {
    name: 'string_operations',
    identifier: 'string_ops',
    abilities: ['manipulate strings'],
    instructions: ['Use this for string operations like uppercase, lowercase, reverse'],
    functions: [
      {
        name: 'uppercase',
        purpose: 'Convert string to uppercase',
        arguments: ['text'],
        response: 'string'
      },
      {
        name: 'reverse',
        purpose: 'Reverse a string',
        arguments: ['text'],
        response: 'string'
      }
    ],
    safeInvoke: async (toolCall) => {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const functionName = toolCall.function.name;
        
        switch (functionName) {
          case 'uppercase':
            return ToolResult.success({ result: args.text.toUpperCase() });
          case 'reverse':
            return ToolResult.success({ result: args.text.split('').reverse().join('') });
          default:
            return ToolResult.failure(`Unknown function: ${functionName}`);
        }
      } catch (error) {
        return ToolResult.failure(`String operation error: ${error.message}`);
      }
    },
    setExecutingAgent: () => {} // Required by Agent
  };
  
  return [calculatorTool, stringTool];
};

describeIfApiKey('Agent LLM Integration Tests', () => {
  let agent;
  
  beforeEach(() => {
    const config = {
      name: 'TestAgent',
      bio: 'A helpful AI assistant for testing',
      tools: createTestTools(),
      modelConfig: {
        provider: 'OPEN_AI',
        model: process.env.TEST_MODEL || 'gpt-3.5-turbo',
        apiKey: process.env.OPENAI_API_KEY
      },
      showToolUsage: true,
      steps: [
        'Understand the user request',
        'Use appropriate tools if needed',
        'Provide a clear response'
      ],
      maxRetries: 2,
      retryBackoff: 500
    };
    
    agent = new Agent(config);
  });
  
  describe('Basic interactions', () => {
    it('should respond to simple questions without tools', async () => {
      const response = await agent.run('What is the capital of France?');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      expect(response.message.toLowerCase()).toContain('paris');
    }, 30000);
    
    it('should handle greeting appropriately', async () => {
      const response = await agent.run('Hello! How are you?');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      expect(response.message).toBeTruthy();
      // Should be a friendly response
      expect(response.message.length).toBeGreaterThan(10);
    }, 30000);
  });
  
  describe('Tool usage', () => {
    it('should use calculator tool for math', async () => {
      const response = await agent.run('Calculate 15 * 8 + 32');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      expect(response.message).toContain('152'); // 15 * 8 + 32 = 152
    }, 30000);
    
    it('should use string tool for text manipulation', async () => {
      const response = await agent.run('Convert "hello world" to uppercase');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      expect(response.message).toContain('HELLO WORLD');
    }, 30000);
    
    it('should handle tool errors gracefully', async () => {
      const response = await agent.run('Calculate the value of "invalid expression"');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      // Should explain it cannot calculate non-numeric expressions
      expect(response.message.toLowerCase()).toMatch(/cannot|unable|invalid|error/);
    }, 30000);
    
    it('should chain multiple tool calls', async () => {
      const response = await agent.run('First calculate 10 + 5, then reverse the string "test"');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      expect(response.message).toContain('15'); // 10 + 5
      expect(response.message).toContain('tset'); // "test" reversed
    }, 30000);
  });
  
  describe('Complex scenarios', () => {
    it('should handle multi-step problems', async () => {
      const response = await agent.run(
        'Calculate 100 / 4, then multiply the result by 3, and tell me if the final result is greater than 50'
      );
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      expect(response.message).toContain('75'); // (100/4) * 3 = 75
      expect(response.message.toLowerCase()).toMatch(/greater|more|above|yes/);
    }, 30000);
    
    it('should handle ambiguous requests intelligently', async () => {
      const response = await agent.run('Process the text "123" - should I calculate or reverse it?');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('string');
      // Agent should ask for clarification or explain both options
      expect(response.message.length).toBeGreaterThan(20);
    }, 30000);
  });
  
  describe('Error handling and retries', () => {
    it('should handle and recover from malformed responses', async () => {
      // Create an agent with very low temperature to test retry logic
      const strictAgent = new Agent({
        name: 'StrictAgent',
        bio: 'Test agent',
        tools: createTestTools(),
        modelConfig: {
          provider: 'OPEN_AI',
          model: 'gpt-3.5-turbo',
          apiKey: process.env.OPENAI_API_KEY,
          temperature: 0
        },
        maxRetries: 3
      });
      
      const response = await strictAgent.run('What is 2+2?');
      
      expect(response).toBeDefined();
      expect(response.message).toContain('4');
    }, 30000);
  });
  
  describe('Response structure', () => {
    it('should support custom response structure', async () => {
      const customAgent = new Agent({
        name: 'CustomAgent',
        bio: 'Agent with custom response format',
        tools: [],
        modelConfig: {
          provider: 'OPEN_AI',
          model: 'gpt-3.5-turbo',
          apiKey: process.env.OPENAI_API_KEY
        },
        responseStructure: {
          toJson: () => '{"answer": "string", "confidence": "number"}'
        }
      });
      
      const response = await customAgent.run('What color is the sky?');
      
      expect(response).toBeDefined();
      expect(response.type).toBe('JSON');
      
      // Parse the JSON response
      const parsed = JSON.parse(response.message);
      expect(parsed).toHaveProperty('answer');
      expect(parsed).toHaveProperty('confidence');
      expect(parsed.answer.toLowerCase()).toMatch(/blue|sky/);
      expect(typeof parsed.confidence).toBe('number');
    }, 30000);
  });
  
  describe('Conversation history', () => {
    it('should maintain context across multiple interactions', async () => {
      // First interaction
      const response1 = await agent.run('My name is TestUser');
      expect(response1).toBeDefined();
      
      // Second interaction should remember the name
      const response2 = await agent.run('What is my name?');
      expect(response2).toBeDefined();
      expect(response2.message).toContain('TestUser');
    }, 30000);
    
    it('should handle follow-up questions about calculations', async () => {
      // First calculation
      const response1 = await agent.run('Calculate 50 * 3');
      expect(response1.message).toContain('150');
      
      // Follow-up
      const response2 = await agent.run('Now add 25 to that result');
      expect(response2).toBeDefined();
      expect(response2.message).toContain('175'); // 150 + 25
    }, 30000);
  });
});

// Test with different models if specified
const testModel = process.env.TEST_ALTERNATIVE_MODEL;
if (testModel && hasApiKey) {
  describe(`Agent LLM Integration Tests with ${testModel}`, () => {
    it('should work with alternative model', async () => {
      const agent = new Agent({
        name: 'AltModelAgent',
        bio: 'Testing alternative model',
        tools: createTestTools(),
        modelConfig: {
          provider: 'OPEN_AI',
          model: testModel,
          apiKey: process.env.OPENAI_API_KEY
        }
      });
      
      const response = await agent.run('Calculate 7 * 6');
      expect(response).toBeDefined();
      expect(response.message).toContain('42');
    }, 30000);
  });
}