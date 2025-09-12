import { jest } from '@jest/globals';
import { LLMClient } from '../src/LLMClient.js';

describe('LLMClient Unified Request Interface', () => {
  let client;
  let originalConsoleLog;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();
    
    client = new LLMClient({
      provider: 'mock',
      maxRetries: 1,
      baseDelay: 10
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Provider Capability Detection', () => {
    it('should detect mock provider capabilities', () => {
      const capabilities = client.getProviderCapabilities();
      
      expect(capabilities).toEqual({
        tools: false,
        chatHistory: false,
        systemPrompts: false,
        files: { text: false, images: false, documents: false },
        parameters: ['maxTokens'],
        responseFormats: ['text']
      });
    });

    it('should detect OpenAI capabilities for openai provider', () => {
      client.provider.getProviderName = () => 'openai';
      const capabilities = client.getProviderCapabilities();
      
      expect(capabilities.tools).toBe(true);
      expect(capabilities.chatHistory).toBe(true);
      expect(capabilities.systemPrompts).toBe(true);
      expect(capabilities.files.text).toBe(true);
      expect(capabilities.parameters).toContain('temperature');
    });

    it('should detect Anthropic capabilities for anthropic provider', () => {
      client.provider.getProviderName = () => 'anthropic';
      const capabilities = client.getProviderCapabilities();
      
      expect(capabilities.tools).toBe(true); // Converted to XML format
      expect(capabilities.chatHistory).toBe(true);
      expect(capabilities.systemPrompts).toBe(true);
      expect(capabilities.parameters).toEqual(['temperature', 'maxTokens']);
    });
  });

  describe('Request Adaptation', () => {
    describe('Mock Provider (Basic Fallback)', () => {
      it('should adapt rich request to simple prompt for mock provider', () => {
        const requestObj = {
          systemPrompt: "You are a helpful assistant",
          chatHistory: [
            {role: 'user', content: 'Hello'},
            {role: 'assistant', content: 'Hi there!'}
          ],
          tools: [{
            name: 'calculator',
            description: 'Performs calculations',
            parameters: {type: 'object'}
          }],
          files: [{
            name: 'data.txt',
            content: 'Important data',
            type: 'text'
          }],
          prompt: 'Help me with this task',
          temperature: 0.7
        };

        const capabilities = client.getProviderCapabilities();
        const adapted = client.adaptRequestToProvider(requestObj, capabilities);

        expect(adapted.prompt).toContain('You are a helpful assistant');
        expect(adapted.prompt).toContain('Previous conversation:');
        expect(adapted.prompt).toContain('User: Hello');
        expect(adapted.prompt).toContain('Assistant: Hi there!');
        expect(adapted.prompt).toContain('Files:');
        expect(adapted.prompt).toContain('data.txt');
        expect(adapted.prompt).toContain('Available tools:');
        expect(adapted.prompt).toContain('calculator: Performs calculations');
        expect(adapted.prompt).toContain('Help me with this task');
        expect(adapted.adaptations).toEqual([
          'chat_history_as_text',
          'files_as_text', 
          'tools_as_descriptions'
        ]);
      });
    });

    describe('OpenAI Provider Adaptation', () => {
      beforeEach(() => {
        client.provider.getProviderName = () => 'openai';
      });

      it('should adapt rich request to OpenAI format', () => {
        const requestObj = {
          systemPrompt: "You are a helpful assistant",
          chatHistory: [
            {role: 'user', content: 'Hello'},
            {role: 'assistant', content: 'Hi there!'}
          ],
          tools: [{
            name: 'calculator',
            description: 'Performs calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: {type: 'string'}
              }
            }
          }],
          prompt: 'Calculate 2+2',
          temperature: 0.7,
          topP: 0.9
        };

        const capabilities = client.getProviderCapabilities();
        const adapted = client.adaptRequestToProvider(requestObj, capabilities);

        expect(adapted.messages).toHaveLength(4); // system + history (2 msgs) + user
        expect(adapted.messages[0]).toEqual({
          role: 'system',
          content: 'You are a helpful assistant'
        });
        expect(adapted.messages[1]).toEqual({
          role: 'user',
          content: 'Hello'
        });
        expect(adapted.messages[2]).toEqual({
          role: 'assistant',
          content: 'Hi there!'
        });
        expect(adapted.messages[3].content).toBe('Calculate 2+2');
        
        expect(adapted.tools).toHaveLength(1);
        expect(adapted.tools[0]).toEqual({
          type: 'function',
          function: {
            name: 'calculator',
            description: 'Performs calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: {type: 'string'}
              }
            }
          }
        });
        
        expect(adapted.temperature).toBe(0.7);
        expect(adapted.top_p).toBe(0.9);
        expect(adapted.tool_choice).toBe('auto');
      });
    });

    describe('Anthropic Provider Adaptation', () => {
      beforeEach(() => {
        client.provider.getProviderName = () => 'anthropic';
      });

      it('should adapt rich request to Anthropic format with XML tools', () => {
        const requestObj = {
          systemPrompt: "You are a helpful assistant",
          tools: [{
            name: 'calculator',
            description: 'Performs calculations',
            parameters: {type: 'object', properties: {expr: {type: 'string'}}}
          }],
          prompt: 'Help me calculate',
          temperature: 0.5
        };

        const capabilities = client.getProviderCapabilities();
        const adapted = client.adaptRequestToProvider(requestObj, capabilities);

        expect(adapted.system).toContain('You are a helpful assistant');
        expect(adapted.system).toContain('Available tools:');
        expect(adapted.system).toContain('<tool name="calculator">');
        expect(adapted.system).toContain('<description>Performs calculations</description>');
        expect(adapted.system).toContain('<tool_use name="tool_name"');
        expect(adapted.adaptations).toContain('tools_as_xml');
        expect(adapted.temperature).toBe(0.5);
        expect(adapted.max_tokens).toBe(1000);
      });
    });
  });

  describe('Unified Request Method', () => {
    it('should execute unified request and return normalized response', async () => {
      const requestObj = {
        systemPrompt: "You are helpful",
        prompt: "Hello world",
        maxTokens: 100
      };

      const response = await client.request(requestObj);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata).toHaveProperty('provider', 'mock');
      expect(response.metadata).toHaveProperty('model');
      expect(response.metadata).toHaveProperty('adaptations');
      expect(typeof response.content).toBe('string');
    });

    it('should handle complex request with all features', async () => {
      const requestObj = {
        systemPrompt: "You are a coding assistant",
        chatHistory: [
          {role: 'user', content: 'I need help'},
          {role: 'assistant', content: 'Sure, I can help'}
        ],
        tools: [
          {
            name: 'execute_code',
            description: 'Execute JavaScript code',
            parameters: {
              type: 'object',
              properties: {
                code: {type: 'string'}
              }
            }
          }
        ],
        files: [
          {name: 'script.js', content: 'console.log("hello");', type: 'text'}
        ],
        prompt: 'Run this code',
        temperature: 0.3,
        maxTokens: 500
      };

      const response = await client.request(requestObj);

      expect(response.content).toBeDefined();
      expect(response.metadata.adaptations).toEqual(
        expect.arrayContaining(['chat_history_as_text', 'files_as_text', 'tools_as_descriptions'])
      );
    });
  });

  describe('Tool Call Extraction', () => {
    it('should extract Anthropic-style tool calls from response', () => {
      const response = `Here's the result: <tool_use name="calculator" parameters='{"expression": "2+2"}'></tool_use> The answer is 4.`;
      
      const toolCalls = client.extractToolCalls(response);
      
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        name: 'calculator',
        args: {expression: '2+2'},
        id: expect.stringMatching(/^tool_\d+_[a-z0-9]+$/)
      });
    });

    it('should return undefined for responses without tool calls', () => {
      const response = "Just a regular response without any tool usage.";
      
      const toolCalls = client.extractToolCalls(response);
      
      expect(toolCalls).toBeUndefined();
    });

    it('should handle multiple tool calls in response', () => {
      const response = `First: <tool_use name="calc" parameters='{"expr": "1+1"}'></tool_use> Then: <tool_use name="search" parameters='{"query": "test"}'></tool_use>`;
      
      const toolCalls = client.extractToolCalls(response);
      
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].name).toBe('calc');
      expect(toolCalls[1].name).toBe('search');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing complete() method functionality', async () => {
      const response = await client.complete('Test prompt', 100);
      
      expect(typeof response).toBe('string');
      expect(response).toContain('Test prompt');
    });

    it('should maintain existing completeWithValidation() method', async () => {
      const validator = (response) => response.includes('valid');
      
      // Mock provider returns predictable responses
      const response = await client.completeWithValidation('Return "valid response"', validator, 100);
      
      expect(typeof response).toBe('string');
    });
  });
});