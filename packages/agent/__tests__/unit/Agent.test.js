/**
 * Comprehensive unit tests for Agent class
 */

import { jest } from '@jest/globals';

// Mock dependencies before importing
jest.mock('@jsenvoy/llm');
jest.mock('../../src/RetryManager.js');
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  appendFile: jest.fn()
}));
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn()
  }));
});

// Import after mocking
import { Agent } from '../../src/Agent.js';
import { RetryManager } from '../../src/RetryManager.js';
import { ToolResult } from '@jsenvoy/modules';
import { LLMClient } from '@jsenvoy/llm';

describe('Agent', () => {
  let mockLLMClient;
  let mockRetryManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock LLM client
    mockLLMClient = {
      sendAndReceiveResponse: jest.fn()
    };
    LLMClient.mockImplementation(() => mockLLMClient);
    
    // Setup mock retry manager
    mockRetryManager = {
      processResponse: jest.fn()
    };
    RetryManager.mockImplementation(() => mockRetryManager);
  });
  
  describe('constructor', () => {
    it('should initialize with default values', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio'
      };
      
      const agent = new Agent(config);
      
      expect(agent.name).toBe('TestAgent');
      expect(agent.bio).toBe('Test bio');
      expect(agent.tools).toEqual([]);
      expect(agent.maxRetries).toBe(3);
      expect(agent.retryBackoff).toBe(1000);
      expect(agent.showToolUsage).toBe(false);
      expect(agent._debugMode).toBe(false);
    });
    
    it('should accept custom configuration', () => {
      const config = {
        name: 'CustomAgent',
        bio: 'Custom bio',
        tools: [],
        steps: ['step1', 'step2'],
        modelConfig: { provider: 'openai', model: 'gpt-4' },
        showToolUsage: true,
        maxRetries: 5,
        retryBackoff: 2000,
        _debugMode: true,
        responseStructure: { type: 'json' },
        metaData: { key: 'value' }
      };
      
      const agent = new Agent(config);
      
      expect(agent.name).toBe('CustomAgent');
      expect(agent.showToolUsage).toBe(true);
      expect(agent.maxRetries).toBe(5);
      expect(agent.retryBackoff).toBe(2000);
      expect(agent._debugMode).toBe(true);
      expect(agent.metaData).toEqual({ key: 'value' });
    });
    
    it('should initialize model and retry manager', () => {
      const config = {
        name: 'TestAgent',
        modelConfig: { provider: 'openai' }
      };
      
      const agent = new Agent(config);
      
      expect(Model).toHaveBeenCalledWith({ modelConfig: config.modelConfig });
      expect(mockModel.initializeModel).toHaveBeenCalled();
      expect(RetryManager).toHaveBeenCalledWith({
        maxRetries: 3,
        backoffMultiplier: 1000,
        tools: []
      });
    });
    
    it('should set executing agent on tools', () => {
      const mockTool = {
        setExecutingAgent: jest.fn()
      };
      
      const config = {
        name: 'TestAgent',
        tools: [mockTool]
      };
      
      const agent = new Agent(config);
      
      expect(mockTool.setExecutingAgent).toHaveBeenCalledWith(agent);
    });
  });
  
  describe('preparePrompt', () => {
    it('should prepare prompt with agent configuration', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: ['Do something', 'Do something else']
      };
      
      const agent = new Agent(config);
      const prompt = agent.preparePrompt();
      
      expect(prompt).toContain('TestAgent');
      expect(prompt).toContain('Test bio');
      expect(prompt).toContain('Do something');
      expect(prompt).toContain('Do something else');
    });
  });
  
  describe('addMessage', () => {
    it('should add text message', () => {
      const agent = new Agent({ name: 'TestAgent' });
      
      agent.addMessage('Hello world');
      
      expect(agent.messages).toHaveLength(2); // System prompt + user message
      expect(agent.messages[1]).toEqual({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello world'
          }
        ]
      });
    });
    
    it('should add message with image', () => {
      const agent = new Agent({ name: 'TestAgent' });
      const imageBase64 = 'data:image/png;base64,abc123';
      
      agent.addMessage('Describe this image', imageBase64);
      
      expect(agent.messages[1].content).toHaveLength(2);
      expect(agent.messages[1].content[0]).toEqual({
        type: 'text',
        text: 'Describe this image'
      });
      expect(agent.messages[1].content[1]).toEqual({
        type: 'image_url',
        image_url: {
          url: imageBase64
        }
      });
    });
  });
  
  describe('prompt', () => {
    it('should process successful response', async () => {
      const agent = new Agent({ name: 'TestAgent' });
      
      mockRetryManager.processResponse.mockResolvedValue({
        success: true,
        data: { response: 'Test response' },
        retries: 0
      });
      
      const result = await agent.prompt('Test prompt');
      
      expect(result).toEqual({ response: 'Test response' });
      expect(agent.messages).toHaveLength(3); // System + user + assistant
      expect(agent.messages[2]).toEqual({
        role: 'assistant',
        content: JSON.stringify({ response: 'Test response' })
      });
    });
    
    it('should throw error on failed response', async () => {
      const agent = new Agent({ name: 'TestAgent' });
      
      mockRetryManager.processResponse.mockResolvedValue({
        success: false,
        error: 'Invalid response format'
      });
      
      await expect(agent.prompt('Test prompt')).rejects.toThrow(
        'Failed to get valid response: Invalid response format'
      );
    });
  });
  
  describe('getTool', () => {
    it('should find tool by identifier', () => {
      const tool1 = { identifier: 'tool1', name: 'Tool 1' };
      const tool2 = { identifier: 'tool2', name: 'Tool 2' };
      
      const agent = new Agent({
        name: 'TestAgent',
        tools: [tool1, tool2]
      });
      
      expect(agent.getTool('tool1')).toBe(tool1);
      expect(agent.getTool('tool2')).toBe(tool2);
      expect(agent.getTool('tool3')).toBe(false);
    });
  });
  
  describe('newProcess', () => {
    let agent;
    let mockTool;
    
    beforeEach(() => {
      mockTool = {
        identifier: 'test_tool',
        invoke: jest.fn(),
        safeInvoke: jest.fn()
      };
      
      agent = new Agent({
        name: 'TestAgent',
        tools: [mockTool]
      });
    });
    
    it('should execute tool with safeInvoke', async () => {
      const toolResult = ToolResult.success({ result: 42 });
      mockTool.safeInvoke.mockResolvedValue(toolResult);
      
      const response = {
        use_tool: {
          identifier: 'test_tool',
          function_name: 'calculate',
          args: [1, 2]
        },
        task_completed: false
      };
      
      const result = await agent.newProcess(response);
      
      expect(mockTool.safeInvoke).toHaveBeenCalledWith({
        id: expect.stringContaining('agent-'),
        type: 'function',
        function: {
          name: 'calculate',
          arguments: JSON.stringify([1, 2])
        }
      });
      
      expect(result).toEqual({
        taskCompleted: false,
        nextPrompt: '<tool_response>{"result":42}</tool_response>. Give me the next one step in JSON format.'
      });
    });
    
    it('should handle tool errors', async () => {
      const toolResult = ToolResult.failure('Tool error', { code: 'ERR_001' });
      mockTool.safeInvoke.mockResolvedValue(toolResult);
      
      const response = {
        use_tool: {
          identifier: 'test_tool',
          function_name: 'calculate',
          args: []
        },
        task_completed: false
      };
      
      const result = await agent.newProcess(response);
      
      expect(result).toEqual({
        taskCompleted: false,
        nextPrompt: '<tool_error>Tool error</tool_error>\n<tool_data>{"code":"ERR_001"}</tool_data>'
      });
    });
    
    it('should handle missing tool', async () => {
      const response = {
        use_tool: {
          identifier: 'missing_tool',
          function_name: 'doSomething',
          args: []
        }
      };
      
      const result = await agent.newProcess(response);
      
      expect(result).toEqual({
        taskCompleted: false,
        nextPrompt: "Error: Tool 'missing_tool' not found. Please check the tool identifier and try again."
      });
    });
    
    it('should handle legacy tool with functionMap', async () => {
      const legacyTool = {
        identifier: 'legacy_tool',
        functionMap: {
          oldFunction: jest.fn().mockResolvedValue('legacy result')
        }
      };
      
      agent.tools.push(legacyTool);
      
      const response = {
        use_tool: {
          identifier: 'legacy_tool',
          function_name: 'oldFunction',
          args: ['arg1']
        },
        task_completed: true
      };
      
      const result = await agent.newProcess(response);
      
      expect(legacyTool.functionMap.oldFunction).toHaveBeenCalledWith('arg1');
      expect(result).toEqual({
        taskCompleted: true,
        nextPrompt: '<tool_response>legacy result</tool_response>. Give me the next one step in JSON format.'
      });
    });
    
    it('should handle image responses', async () => {
      const toolResult = ToolResult.success({
        isImage: true,
        image: 'base64-image-data'
      });
      mockTool.safeInvoke.mockResolvedValue(toolResult);
      
      const response = {
        use_tool: {
          identifier: 'test_tool',
          function_name: 'screenshot',
          args: []
        },
        task_completed: true
      };
      
      const result = await agent.newProcess(response);
      
      expect(result).toEqual({
        taskCompleted: true,
        nextPrompt: 'Here is the image',
        image: 'base64-image-data'
      });
    });
    
    it('should handle completed task without tool', async () => {
      const response = {
        task_completed: true
      };
      
      const result = await agent.newProcess(response);
      
      expect(result).toEqual({
        taskCompleted: true,
        nextPrompt: ''
      });
    });
    
    it('should handle incomplete task without tool', async () => {
      const response = {
        task_completed: false
      };
      
      const result = await agent.newProcess(response);
      
      expect(result).toEqual({
        taskCompleted: false,
        nextPrompt: 'Continue with whatever data available. If impossible to continue, mark task_completed to true with a failure message. '
      });
    });
  });
  
  describe('autoPrompt', () => {
    let agent;
    
    beforeEach(() => {
      agent = new Agent({ name: 'TestAgent' });
      agent.prompt = jest.fn();
      agent.newProcess = jest.fn();
    });
    
    it('should process until task is completed', async () => {
      agent.prompt
        .mockResolvedValueOnce({
          use_tool: { identifier: 'tool1' },
          task_completed: false,
          response: { type: 'string', message: 'Working...' }
        })
        .mockResolvedValueOnce({
          task_completed: true,
          response: { type: 'string', message: 'Done!' }
        });
        
      agent.newProcess
        .mockResolvedValueOnce({
          taskCompleted: false,
          nextPrompt: 'Continue'
        })
        .mockResolvedValueOnce({
          taskCompleted: true,
          nextPrompt: ''
        });
      
      const result = await agent.autoPrompt('Initial prompt');
      
      expect(result).toEqual({ type: 'string', message: 'Done!' });
      expect(agent.prompt).toHaveBeenCalledTimes(2);
      expect(agent.prompt).toHaveBeenCalledWith('Initial prompt', undefined);
      expect(agent.prompt).toHaveBeenCalledWith('Continue', undefined);
    });
    
    it('should handle errors during processing', async () => {
      agent.prompt.mockRejectedValue(new Error('API error'));
      
      const result = await agent.autoPrompt('Test prompt');
      
      expect(result).toEqual({
        type: 'string',
        message: 'Error: API error'
      });
    });
    
    it('should pass images through the loop', async () => {
      agent.prompt.mockResolvedValue({
        task_completed: true,
        response: { type: 'string', message: 'Processed image' }
      });
      
      agent.newProcess.mockResolvedValue({
        taskCompleted: true,
        nextPrompt: ''
      });
      
      const result = await agent.autoPrompt('Process this', 'image-base64');
      
      expect(agent.prompt).toHaveBeenCalledWith('Process this', 'image-base64');
      expect(result).toEqual({ type: 'string', message: 'Processed image' });
    });
  });
  
  describe('run', () => {
    it('should execute autoPrompt', async () => {
      const agent = new Agent({ name: 'TestAgent' });
      agent.autoPrompt = jest.fn().mockResolvedValue({
        type: 'string',
        message: 'Result'
      });
      
      const result = await agent.run('Test prompt');
      
      expect(agent.autoPrompt).toHaveBeenCalledWith('Test prompt', undefined);
      expect(result).toEqual({ type: 'string', message: 'Result' });
    });
  });
  
  describe('printResponse', () => {
    let consoleLogSpy;
    
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });
    
    afterEach(() => {
      consoleLogSpy.mockRestore();
    });
    
    it('should print response message', async () => {
      const agent = new Agent({ name: 'TestAgent' });
      agent.run = jest.fn().mockResolvedValue({
        message: 'Hello from agent!'
      });
      
      await agent.printResponse('Test prompt');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Hello from agent!');
    });
    
    it('should handle undefined response', async () => {
      const agent = new Agent({ name: 'TestAgent' });
      agent.run = jest.fn().mockResolvedValue(undefined);
      
      await agent.printResponse('Test prompt');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(undefined);
    });
  });
});