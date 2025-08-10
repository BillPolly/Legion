/**
 * Unit tests for TaskDecomposer
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskDecomposer } from '../../src/core/TaskDecomposer.js';

describe('TaskDecomposer', () => {
  let decomposer;
  let mockLLMClient;
  
  beforeEach(() => {
    mockLLMClient = {
      generateResponse: jest.fn()
    };
    
    decomposer = new TaskDecomposer(mockLLMClient, {
      maxDepth: 3,
      maxWidth: 5,
      temperature: 0.3
    });
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const decomposer = new TaskDecomposer(mockLLMClient);
      expect(decomposer.llmClient).toBe(mockLLMClient);
      expect(decomposer.options.maxDepth).toBe(5);
      expect(decomposer.options.maxWidth).toBe(10);
      expect(decomposer.options.temperature).toBe(0.3);
    });
    
    it('should override default options', () => {
      const customOptions = {
        maxDepth: 2,
        maxWidth: 3,
        temperature: 0.5,
        model: 'custom-model'
      };
      const decomposer = new TaskDecomposer(mockLLMClient, customOptions);
      expect(decomposer.options.maxDepth).toBe(2);
      expect(decomposer.options.maxWidth).toBe(3);
      expect(decomposer.options.temperature).toBe(0.5);
      expect(decomposer.options.model).toBe('custom-model');
    });
  });
  
  describe('decompose', () => {
    it('should handle valid decomposition response', async () => {
      const mockResponse = {
        content: JSON.stringify({
          task: 'Build API',
          subtasks: [
            {
              id: 'sub-1',
              description: 'Set up server',
              complexity: 'SIMPLE',
              reasoning: 'Basic setup',
              suggestedInputs: ['config'],
              suggestedOutputs: ['server']
            },
            {
              id: 'sub-2',
              description: 'Create routes',
              complexity: 'SIMPLE',
              reasoning: 'Route definition',
              suggestedInputs: ['server'],
              suggestedOutputs: ['routes']
            }
          ]
        })
      };
      
      mockLLMClient.generateResponse.mockResolvedValue(mockResponse);
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(true);
      expect(result.task).toBe('Build API');
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].description).toBe('Set up server');
      expect(result.subtasks[0].complexity).toBe('SIMPLE');
      expect(result.subtasks[0].suggestedInputs).toEqual(['config']);
      expect(result.subtasks[0].suggestedOutputs).toEqual(['server']);
    });
    
    it('should validate and reject empty task descriptions', async () => {
      const result = await decomposer.decompose('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty string');
      expect(result.subtasks).toEqual([]);
    });
    
    it('should validate and reject null task descriptions', async () => {
      const result = await decomposer.decompose(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty string');
      expect(result.subtasks).toEqual([]);
    });
    
    it('should handle width limit violations', async () => {
      const result = await decomposer.decompose('Test task', {
        currentWidth: 5
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum width');
    });
    
    it('should handle LLM client errors gracefully', async () => {
      mockLLMClient.generateResponse.mockRejectedValue(new Error('LLM error'));
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Decomposition failed: LLM error');
      expect(result.subtasks).toEqual([]);
    });
    
    it('should handle invalid JSON responses', async () => {
      mockLLMClient.generateResponse.mockResolvedValue({
        content: 'Invalid JSON response'
      });
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse');
    });
    
    it('should auto-generate missing subtask IDs', async () => {
      const mockResponse = {
        content: JSON.stringify({
          task: 'Build API',
          subtasks: [
            {
              description: 'Set up server',
              complexity: 'SIMPLE',
              reasoning: 'Basic setup'
            }
          ]
        })
      };
      
      mockLLMClient.generateResponse.mockResolvedValue(mockResponse);
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(true);
      expect(result.subtasks[0].id).toMatch(/^subtask-\d+-\d+$/);
    });
    
    it('should default to COMPLEX for invalid complexity values', async () => {
      const mockResponse = {
        content: JSON.stringify({
          task: 'Build API',
          subtasks: [
            {
              id: 'sub-1',
              description: 'Set up server',
              complexity: 'UNKNOWN',
              reasoning: 'Basic setup'
            }
          ]
        })
      };
      
      mockLLMClient.generateResponse.mockResolvedValue(mockResponse);
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(true);
      expect(result.subtasks[0].complexity).toBe('COMPLEX');
    });
    
    it('should limit number of subtasks to maxWidth', async () => {
      const subtasks = Array.from({ length: 10 }, (_, i) => ({
        id: `sub-${i}`,
        description: `Task ${i}`,
        complexity: 'SIMPLE',
        reasoning: 'Test'
      }));
      
      const mockResponse = {
        content: JSON.stringify({
          task: 'Build API',
          subtasks: subtasks
        })
      };
      
      mockLLMClient.generateResponse.mockResolvedValue(mockResponse);
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(true);
      expect(result.subtasks).toHaveLength(5); // maxWidth is 5
    });
    
    it('should handle missing LLM client', async () => {
      const decomposer = new TaskDecomposer(null);
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM client not properly initialized');
    });
    
    it('should provide default values for missing optional fields', async () => {
      const mockResponse = {
        content: JSON.stringify({
          task: 'Build API',
          subtasks: [
            {
              id: 'sub-1',
              description: 'Set up server',
              complexity: 'SIMPLE'
              // Missing: reasoning, suggestedInputs, suggestedOutputs
            }
          ]
        })
      };
      
      mockLLMClient.generateResponse.mockResolvedValue(mockResponse);
      
      const result = await decomposer.decompose('Build API');
      
      expect(result.success).toBe(true);
      expect(result.subtasks[0].reasoning).toBe('No reasoning provided');
      expect(result.subtasks[0].suggestedInputs).toEqual([]);
      expect(result.subtasks[0].suggestedOutputs).toEqual([]);
    });
  });
  
  describe('_buildDecompositionPrompt', () => {
    it('should build prompt with parent outputs', () => {
      const prompt = decomposer._buildDecompositionPrompt('Build API', {
        parentOutputs: ['database', 'config'],
        domain: 'web-development',
        level: 2
      });
      
      expect(prompt).toContain('Build API');
      expect(prompt).toContain('Parent outputs available: [database, config]');
      expect(prompt).toContain('Domain: web-development');
      expect(prompt).toContain('Current decomposition level: 2');
    });
    
    it('should build prompt without parent outputs', () => {
      const prompt = decomposer._buildDecompositionPrompt('Build API', {});
      
      expect(prompt).toContain('Build API');
      expect(prompt).not.toContain('Parent outputs available');
      expect(prompt).toContain('Domain: general');
      expect(prompt).toContain('Current decomposition level: 0');
    });
  });
  
  describe('_parseResponse', () => {
    it('should parse direct JSON response', () => {
      const response = { content: '{"test": "value"}' };
      const result = decomposer._parseResponse(response);
      expect(result).toEqual({ test: 'value' });
    });
    
    it('should extract JSON from wrapped response', () => {
      const response = { 
        content: 'Here is the JSON: {"test": "value"} and some other text' 
      };
      const result = decomposer._parseResponse(response);
      expect(result).toEqual({ test: 'value' });
    });
    
    it('should handle string responses', () => {
      const response = '{"test": "value"}';
      const result = decomposer._parseResponse(response);
      expect(result).toEqual({ test: 'value' });
    });
    
    it('should throw on invalid JSON', () => {
      const response = { content: 'Not JSON at all' };
      expect(() => decomposer._parseResponse(response)).toThrow('Failed to parse');
    });
  });
});