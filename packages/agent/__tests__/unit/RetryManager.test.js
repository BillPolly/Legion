/**
 * Comprehensive unit tests for RetryManager
 */

import { jest } from '@jest/globals';

// Mock dependencies before importing
jest.mock('@jsenvoy/llm');

// Import after mocking
import { RetryManager } from '../../src/RetryManager.js';
import { RobustJsonParser } from '@jsenvoy/llm';

describe('RetryManager', () => {
  let mockParser;
  let mockModel;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock parser
    RobustJsonParser.parseFromText = jest.fn();
    
    // Setup mock model
    mockModel = {
      callModelTool: jest.fn()
    };
  });
  
  describe('constructor', () => {
    it('should initialize with default values', () => {
      const manager = new RetryManager({});
      
      expect(manager.maxRetries).toBe(3);
      expect(manager.backoffMultiplier).toBe(1.5);
      expect(manager.tools).toEqual([]);
    });
    
    it('should accept custom configuration', () => {
      const tools = [{ name: 'tool1' }, { name: 'tool2' }];
      const manager = new RetryManager({
        maxRetries: 5,
        backoffMultiplier: 2,
        tools
      });
      
      expect(manager.maxRetries).toBe(5);
      expect(manager.backoffMultiplier).toBe(2);
      expect(manager.tools).toBe(tools);
    });
    
    it('should initialize ResponseParser', () => {
      const manager = new RetryManager({});
      
      expect(ResponseParser).toHaveBeenCalledWith(undefined);
    });
  });
  
  describe('processResponse', () => {
    let manager;
    
    beforeEach(() => {
      manager = new RetryManager({ maxRetries: 3 });
    });
    
    it('should return successful response on first try', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"task_completed": true, "response": {"type": "string", "message": "Success"}}'
          }
        }]
      };
      
      const parsedData = {
        task_completed: true,
        response: { type: 'string', message: 'Success' }
      };
      
      mockModel.callModelTool.mockResolvedValue(mockResponse);
      mockParser.parse.mockReturnValue(parsedData);
      mockParser.validate.mockReturnValue({ isValid: true });
      
      const result = await manager.processResponse(mockModel, []);
      
      expect(result).toEqual({
        success: true,
        data: parsedData,
        retries: 0
      });
      
      expect(mockModel.callModelTool).toHaveBeenCalledTimes(1);
      expect(mockParser.parse).toHaveBeenCalledWith(mockResponse);
      expect(mockParser.validate).toHaveBeenCalledWith(parsedData);
    });
    
    it('should retry on parsing failure', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Invalid JSON' }
        }]
      };
      
      const validResponse = {
        choices: [{
          message: {
            content: '{"task_completed": true, "response": {"type": "string", "message": "Fixed"}}'
          }
        }]
      };
      
      const parsedData = {
        task_completed: true,
        response: { type: 'string', message: 'Fixed' }
      };
      
      mockModel.callModelTool
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(validResponse);
        
      mockParser.parse
        .mockImplementationOnce(() => { throw new Error('Parse error'); })
        .mockReturnValueOnce(parsedData);
        
      mockParser.validate.mockReturnValue({ isValid: true });
      
      const result = await manager.processResponse(mockModel, []);
      
      expect(result).toEqual({
        success: true,
        data: parsedData,
        retries: 1
      });
      
      expect(mockModel.callModelTool).toHaveBeenCalledTimes(2);
    });
    
    it('should retry on validation failure', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"incomplete": true}'
          }
        }]
      };
      
      const parsedData = { incomplete: true };
      
      mockModel.callModelTool.mockResolvedValue(mockResponse);
      mockParser.parse.mockReturnValue(parsedData);
      mockParser.validate
        .mockReturnValueOnce({ isValid: false, errors: ['Missing required fields'] })
        .mockReturnValueOnce({ isValid: false, errors: ['Still invalid'] })
        .mockReturnValueOnce({ isValid: false, errors: ['Third try failed'] });
      
      const result = await manager.processResponse(mockModel, []);
      
      expect(result).toEqual({
        success: false,
        error: 'Still invalid',
        retries: 3
      });
      
      expect(mockModel.callModelTool).toHaveBeenCalledTimes(3);
    });
    
    it('should add correction messages on retry', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      
      mockModel.callModelTool.mockResolvedValue({
        choices: [{ message: { content: 'Bad response' } }]
      });
      
      mockParser.parse.mockImplementation(() => { throw new Error('Parse error'); });
      
      await manager.processResponse(mockModel, messages);
      
      // Check that correction messages were added
      const secondCall = mockModel.callModelTool.mock.calls[1][0];
      expect(secondCall.messages).toHaveLength(4); // Original + response + correction
      expect(secondCall.messages[2].role).toBe('assistant');
      expect(secondCall.messages[3].role).toBe('user');
      expect(secondCall.messages[3].content).toContain('Parse error');
    });
    
    it('should handle model errors', async () => {
      mockModel.callModelTool.mockRejectedValue(new Error('API error'));
      
      const result = await manager.processResponse(mockModel, []);
      
      expect(result).toEqual({
        success: false,
        error: 'API error',
        retries: 0
      });
    });
    
    it('should apply exponential backoff', async () => {
      const manager = new RetryManager({
        maxRetries: 3,
        backoffMultiplier: 100 // 100ms for faster tests
      });
      
      const startTime = Date.now();
      
      mockModel.callModelTool.mockResolvedValue({
        choices: [{ message: { content: 'Invalid' } }]
      });
      
      mockParser.parse.mockImplementation(() => { throw new Error('Parse error'); });
      
      await manager.processResponse(mockModel, []);
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should have delays: 100ms, 200ms, 400ms = ~700ms total
      // Allow some margin for execution time
      expect(elapsed).toBeGreaterThan(600);
      expect(elapsed).toBeLessThan(1000);
    });
  });
  
  describe('sleep', () => {
    it('should delay execution', async () => {
      const manager = new RetryManager({});
      const startTime = Date.now();
      
      await manager.sleep(100);
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow small margin
      expect(elapsed).toBeLessThan(150);
    });
  });
  
  describe('error handling', () => {
    let manager;
    
    beforeEach(() => {
      manager = new RetryManager({ maxRetries: 2 });
    });
    
    it('should handle missing response content', async () => {
      mockModel.callModelTool.mockResolvedValue({
        choices: [{ message: {} }]
      });
      
      const result = await manager.processResponse(mockModel, []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot read properties');
    });
    
    it('should handle empty choices array', async () => {
      mockModel.callModelTool.mockResolvedValue({
        choices: []
      });
      
      const result = await manager.processResponse(mockModel, []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot read properties');
    });
    
    it('should handle complex validation errors', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"task_completed": "not-a-boolean"}'
          }
        }]
      };
      
      mockModel.callModelTool.mockResolvedValue(mockResponse);
      mockParser.parse.mockReturnValue({ task_completed: 'not-a-boolean' });
      mockParser.validate.mockReturnValue({
        isValid: false,
        errors: [
          'task_completed must be boolean',
          'response field is required'
        ]
      });
      
      const result = await manager.processResponse(mockModel, []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('task_completed must be boolean');
    });
  });
  
  describe('integration with messages', () => {
    let manager;
    
    beforeEach(() => {
      manager = new RetryManager({ maxRetries: 2 });
    });
    
    it('should preserve original message history', async () => {
      const originalMessages = [
        { role: 'system', content: 'You are an assistant' },
        { role: 'user', content: 'Hello' }
      ];
      
      mockModel.callModelTool.mockResolvedValue({
        choices: [{
          message: {
            content: '{"task_completed": true, "response": {"type": "string", "message": "Hi"}}'
          }
        }]
      });
      
      mockParser.parse.mockReturnValue({
        task_completed: true,
        response: { type: 'string', message: 'Hi' }
      });
      mockParser.validate.mockReturnValue({ isValid: true });
      
      await manager.processResponse(mockModel, originalMessages);
      
      // Original messages should not be modified
      expect(originalMessages).toHaveLength(2);
      expect(mockModel.callModelTool).toHaveBeenCalledWith({
        messages: originalMessages,
        temperature: 0.01
      });
    });
    
    it('should build correction history correctly', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      let callCount = 0;
      
      mockModel.callModelTool.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          choices: [{
            message: {
              content: callCount === 3 ? '{"task_completed": true}' : 'Invalid'
            }
          }]
        });
      });
      
      mockParser.parse.mockImplementation((response) => {
        const content = response.choices[0].message.content;
        if (content === 'Invalid') throw new Error('Parse error');
        return { task_completed: true };
      });
      
      mockParser.validate.mockImplementation((data) => {
        if (data.task_completed === true) {
          return { isValid: true };
        }
        return { isValid: false, errors: ['Invalid'] };
      });
      
      await manager.processResponse(mockModel, messages);
      
      // Check the final call's messages
      const finalCall = mockModel.callModelTool.mock.calls[2][0];
      expect(finalCall.messages.length).toBeGreaterThan(messages.length);
      
      // Should have pattern: original, response1, correction1, response2, correction2
      const messageRoles = finalCall.messages.map(m => m.role);
      expect(messageRoles).toEqual([
        'user',       // original
        'assistant',  // response1
        'user',       // correction1
        'assistant',  // response2
        'user'        // correction2
      ]);
    });
  });
});