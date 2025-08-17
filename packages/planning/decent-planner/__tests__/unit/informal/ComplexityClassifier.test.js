/**
 * Unit tests for ComplexityClassifier
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ComplexityClassifier } from '../../../src/core/informal/ComplexityClassifier.js';

describe('ComplexityClassifier', () => {
  let classifier;
  let mockLLMClient;

  beforeAll(() => {
    // Mock LLM client for unit tests
    mockLLMClient = {
      complete: async (prompt) => {
        // Extract the task from the prompt
        const taskMatch = prompt.match(/Task: ([^\n]+)/);
        const task = taskMatch ? taskMatch[1].toLowerCase() : '';
        
        // Check for SIMPLE tasks
        if (task.includes('write') && (task.includes('file') || task.includes('content')) ||
            task.includes('create database table') ||
            task.includes('parse json') ||
            task.includes('install package')) {
          return JSON.stringify({
            complexity: 'SIMPLE',
            reasoning: 'Can be accomplished with available tools'
          });
        }
        
        // Check for COMPLEX tasks - look in the actual task line
        if (task.includes('build') && 
            (task.includes('application') || 
             task.includes('system') || 
             task.includes('api'))) {
          return JSON.stringify({
            complexity: 'COMPLEX',
            reasoning: 'Requires multiple subsystems and coordination'
          });
        }
        
        // Default to SIMPLE for unrecognized tasks
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Task appears focused and tool-achievable'
        });
      }
    };

    classifier = new ComplexityClassifier(mockLLMClient);
  });

  describe('classification', () => {
    it('should classify simple file operation as SIMPLE', async () => {
      const result = await classifier.classify('Write content to a file');
      
      expect(result).toBeDefined();
      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toBeDefined();
    });

    it('should classify database table creation as SIMPLE', async () => {
      const result = await classifier.classify('Create database table with validation');
      
      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toContain('tools');
    });

    it('should classify JSON parsing as SIMPLE', async () => {
      const result = await classifier.classify('Parse JSON data and extract fields');
      
      expect(result.complexity).toBe('SIMPLE');
    });

    it('should classify web application as COMPLEX', async () => {
      const result = await classifier.classify('Build a web application with authentication');
      
      expect(result.complexity).toBe('COMPLEX');
      expect(result.reasoning).toContain('subsystems');
    });

    it('should classify API building as COMPLEX', async () => {
      const result = await classifier.classify('Build REST API for task management');
      
      expect(result.complexity).toBe('COMPLEX');
    });

    it('should classify system building as COMPLEX', async () => {
      const result = await classifier.classify('Build authentication system with JWT');
      
      expect(result.complexity).toBe('COMPLEX');
    });
  });

  describe('prompt generation', () => {
    it('should generate classification prompt with task', () => {
      const prompt = classifier.generateClassificationPrompt('Create a file');
      
      expect(prompt).toContain('Create a file');
      expect(prompt).toContain('SIMPLE');
      expect(prompt).toContain('COMPLEX');
    });

    it('should include domain context if provided', () => {
      const prompt = classifier.generateClassificationPrompt(
        'Create API endpoint',
        { domain: 'web-development' }
      );
      
      expect(prompt).toContain('web-development');
    });

    it('should include parent context if provided', () => {
      const prompt = classifier.generateClassificationPrompt(
        'Set up database',
        { parentTask: 'Build e-commerce platform' }
      );
      
      expect(prompt).toContain('Build e-commerce platform');
    });
  });

  describe('response parsing', () => {
    it('should parse valid JSON response', () => {
      const response = '{"complexity": "SIMPLE", "reasoning": "Test reason"}';
      const result = classifier.parseClassificationResponse(response);
      
      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toBe('Test reason');
    });

    it('should handle response with extra whitespace', () => {
      const response = '  \n  {"complexity": "COMPLEX", "reasoning": "Test"}  \n  ';
      const result = classifier.parseClassificationResponse(response);
      
      expect(result.complexity).toBe('COMPLEX');
    });

    it('should extract JSON from text response', () => {
      const response = 'Here is the classification: {"complexity": "SIMPLE", "reasoning": "Test"} Done.';
      const result = classifier.parseClassificationResponse(response);
      
      expect(result.complexity).toBe('SIMPLE');
    });

    it('should throw error for invalid JSON', () => {
      const response = 'Not valid JSON';
      
      expect(() => {
        classifier.parseClassificationResponse(response);
      }).toThrow('Failed to parse classification response');
    });

    it('should throw error for missing complexity field', () => {
      const response = '{"reasoning": "Test"}';
      
      expect(() => {
        classifier.parseClassificationResponse(response);
      }).toThrow('Invalid classification response: missing complexity');
    });

    it('should throw error for invalid complexity value', () => {
      const response = '{"complexity": "MEDIUM", "reasoning": "Test"}';
      
      expect(() => {
        classifier.parseClassificationResponse(response);
      }).toThrow('Invalid complexity value: MEDIUM');
    });
  });

  describe('error handling', () => {
    it('should throw error if LLM client not provided', () => {
      expect(() => {
        new ComplexityClassifier();
      }).toThrow('LLM client is required');
    });

    it('should throw error if classification fails', async () => {
      const failingLLM = {
        complete: async () => {
          throw new Error('LLM service unavailable');
        }
      };
      
      const failingClassifier = new ComplexityClassifier(failingLLM);
      
      await expect(failingClassifier.classify('Test task')).rejects.toThrow('LLM service unavailable');
    });

    it('should throw error for empty task description', async () => {
      await expect(classifier.classify('')).rejects.toThrow('Task description is required');
    });
  });
});