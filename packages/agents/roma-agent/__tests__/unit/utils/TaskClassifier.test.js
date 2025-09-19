/**
 * Unit tests for TaskClassifier
 * Tests task classification logic with mocked LLM responses
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TaskClassifier from '../../../src/utils/TaskClassifier.js';
import { ResponseValidator } from '@legion/output-schema';

describe('TaskClassifier Unit Tests', () => {
  let classifier;
  let mockLLMClient;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      complete: jest.fn()
    };

    // Create classifier instance
    classifier = new TaskClassifier(mockLLMClient);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with LLM client and create ResponseValidator', () => {
      expect(classifier.llmClient).toBe(mockLLMClient);
      expect(classifier.responseValidator).toBeInstanceOf(ResponseValidator);
    });

    it('should create ResponseValidator with correct schema', () => {
      const validator = classifier.responseValidator;
      
      // Test that validator accepts valid classification responses
      const validResponse = {
        complexity: 'SIMPLE',
        reasoning: 'Can be done with file operations',
        suggestedApproach: 'Use file_write tool',
        estimatedSteps: 2
      };
      
      const result = validator.validateExample(validResponse);
      expect(result.success).toBe(true);
    });

    it('should create ResponseValidator that rejects invalid responses', () => {
      const validator = classifier.responseValidator;
      
      // Test invalid complexity value
      const invalidResponse = {
        complexity: 'MEDIUM', // Invalid - should be SIMPLE or COMPLEX
        reasoning: 'Test reasoning'
      };
      
      const result = validator.validateExample(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('Task Classification - SIMPLE Tasks', () => {
    it('should classify file operations as SIMPLE', async () => {
      const validSimpleResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'This is a straightforward file operation that can be done with file_write tool',
        suggestedApproach: 'Use file_write tool with specified content',
        estimatedSteps: 1
      });

      mockLLMClient.complete.mockResolvedValue(validSimpleResponse);

      const task = { description: 'create a text file with hello world' };
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toContain('file operation');
      expect(result.suggestedApproach).toContain('file_write');
      expect(result.estimatedSteps).toBe(1);
    });

    it('should classify calculations as SIMPLE', async () => {
      const validSimpleResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Direct calculation task that can use calculator tool',
        suggestedApproach: 'Use calculator tool with expression',
        estimatedSteps: 1
      });

      mockLLMClient.complete.mockResolvedValue(validSimpleResponse);

      const task = 'calculate 42 * 10';
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toContain('calculation');
      expect(result.estimatedSteps).toBe(1);
    });

    it('should classify code generation as SIMPLE', async () => {
      const validSimpleResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Single file creation with specific content can be done with code generation and file writing',
        suggestedApproach: 'Generate code content and write to file',
        estimatedSteps: 2
      });

      mockLLMClient.complete.mockResolvedValue(validSimpleResponse);

      const task = { description: 'create a Node.js server file with basic Express setup' };
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toContain('Single file creation');
      expect(result.estimatedSteps).toBe(2);
    });
  });

  describe('Task Classification - COMPLEX Tasks', () => {
    it('should classify multi-component applications as COMPLEX', async () => {
      const validComplexResponse = JSON.stringify({
        complexity: 'COMPLEX',
        reasoning: 'Building a complete web application requires multiple coordinated operations: HTML, CSS, JavaScript, project structure',
        suggestedApproach: 'Break down into subtasks for each component',
        estimatedSteps: 8
      });

      mockLLMClient.complete.mockResolvedValue(validComplexResponse);

      const task = { description: 'build a complete web application with multiple pages and database' };
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('COMPLEX');
      expect(result.reasoning).toContain('multiple coordinated operations');
      expect(result.suggestedApproach).toContain('Break down');
      expect(result.estimatedSteps).toBeGreaterThan(5);
    });

    it('should classify system-wide operations as COMPLEX', async () => {
      const validComplexResponse = JSON.stringify({
        complexity: 'COMPLEX',
        reasoning: 'Refactoring entire codebase involves analyzing multiple files, planning changes, and coordinated updates',
        suggestedApproach: 'Analyze codebase first, then plan refactoring steps',
        estimatedSteps: 12
      });

      mockLLMClient.complete.mockResolvedValue(validComplexResponse);

      const task = 'refactor the entire codebase to use TypeScript';
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('COMPLEX');
      expect(result.reasoning).toContain('multiple files');
      expect(result.estimatedSteps).toBeGreaterThan(10);
    });

    it('should classify multi-step workflows as COMPLEX', async () => {
      const validComplexResponse = JSON.stringify({
        complexity: 'COMPLEX',
        reasoning: 'API with authentication requires database setup, auth middleware, multiple endpoints, and testing',
        suggestedApproach: 'Break into subtasks: database, auth, endpoints, integration',
        estimatedSteps: 6
      });

      mockLLMClient.complete.mockResolvedValue(validComplexResponse);

      const task = { description: 'create a complete API with authentication and multiple endpoints' };
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('COMPLEX');
      expect(result.reasoning).toContain('multiple endpoints');
      expect(result.suggestedApproach).toContain('Break into subtasks');
    });
  });

  describe('Edge Cases and Input Validation', () => {
    it('should handle string task input', async () => {
      const validResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Simple string task'
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      const result = await classifier.classify('simple task string');
      
      expect(result.complexity).toBe('SIMPLE');
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.stringContaining('simple task string')
      );
    });

    it('should handle object task input with description', async () => {
      const validResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Task object with description'
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      const taskObj = { description: 'task in object form', metadata: 'extra data' };
      const result = await classifier.classify(taskObj);
      
      expect(result.complexity).toBe('SIMPLE');
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.stringContaining('task in object form')
      );
    });

    it('should handle object task input without description', async () => {
      const validResponse = JSON.stringify({
        complexity: 'COMPLEX',
        reasoning: 'Complex object structure'
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      const taskObj = { action: 'create', target: 'application', complexity: 'high' };
      const result = await classifier.classify(taskObj);
      
      expect(result.complexity).toBe('COMPLEX');
      // Should use JSON.stringify for objects without description
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(taskObj))
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM client failures gracefully', async () => {
      mockLLMClient.complete.mockRejectedValue(new Error('LLM service unavailable'));

      const task = 'any task';
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('COMPLEX'); // Default to COMPLEX on error
      expect(result.reasoning).toContain('Classification error');
      expect(result.suggestedApproach).toContain('Break down into subtasks');
      expect(result.estimatedSteps).toBe(5);
    });

    it('should handle invalid JSON responses', async () => {
      mockLLMClient.complete.mockResolvedValue('Invalid JSON response that cannot be parsed');

      const task = 'test task';
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('COMPLEX'); // Default to COMPLEX on parse error
      expect(result.reasoning).toContain('Could not parse LLM response');
    });

    it('should handle partial JSON responses', async () => {
      // JSON that's valid but missing required fields
      const partialResponse = JSON.stringify({
        complexity: 'SIMPLE'
        // Missing reasoning field
      });

      mockLLMClient.complete.mockResolvedValue(partialResponse);

      const task = 'test task';
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('COMPLEX'); // Default on validation failure
      expect(result.reasoning).toContain('Could not parse LLM response');
    });

    it('should handle invalid complexity values', async () => {
      const invalidComplexityResponse = JSON.stringify({
        complexity: 'MEDIUM', // Invalid - not SIMPLE or COMPLEX
        reasoning: 'This has invalid complexity'
      });

      mockLLMClient.complete.mockResolvedValue(invalidComplexityResponse);

      const task = 'test task';
      const result = await classifier.classify(task);

      expect(result.complexity).toBe('COMPLEX'); // Should default to COMPLEX
      expect(result.reasoning).toBe('Could not parse LLM response'); // ResponseValidator rejects invalid schema
    });
  });

  describe('ResponseValidator Integration', () => {
    it('should use ResponseValidator to generate format instructions', async () => {
      const validResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Test reasoning'
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      await classifier.classify('test task');

      // Verify that the prompt includes format instructions from ResponseValidator
      const capturedPrompt = mockLLMClient.complete.mock.calls[0][0];
      expect(capturedPrompt).toContain('JSON');
      expect(capturedPrompt).toContain('complexity');
      expect(capturedPrompt).toContain('reasoning');
    });

    it('should use ResponseValidator to process LLM responses', async () => {
      const validResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Valid response format',
        suggestedApproach: 'Use tools',
        estimatedSteps: 3
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      const result = await classifier.classify('test task');

      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toBe('Valid response format');
      expect(result.suggestedApproach).toBe('Use tools');
      expect(result.estimatedSteps).toBe(3);
    });

    it('should handle ResponseValidator parsing failures', async () => {
      // Mock ResponseValidator to return parse failure
      const originalProcess = classifier.responseValidator.process;
      classifier.responseValidator.process = jest.fn().mockReturnValue({
        success: false,
        errors: ['Invalid format'],
        data: null
      });

      mockLLMClient.complete.mockResolvedValue('{"complexity": "SIMPLE"}');

      const result = await classifier.classify('test task');

      expect(result.complexity).toBe('COMPLEX');
      expect(result.reasoning).toContain('Could not parse LLM response');

      // Restore original method
      classifier.responseValidator.process = originalProcess;
    });
  });

  describe('Batch Classification', () => {
    it('should classify multiple tasks in batch', async () => {
      // Mock different responses for different tasks
      mockLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'First task is simple'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Second task is complex'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Third task is simple'
        }));

      const tasks = [
        'calculate 2 + 2',
        'build a full web application',
        'read a file'
      ];

      const results = await classifier.classifyBatch(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].complexity).toBe('SIMPLE');
      expect(results[0].task).toBe('calculate 2 + 2');
      expect(results[1].complexity).toBe('COMPLEX');
      expect(results[1].task).toBe('build a full web application');
      expect(results[2].complexity).toBe('SIMPLE');
      expect(results[2].task).toBe('read a file');
    });

    it('should handle batch classification with some failures', async () => {
      // First call succeeds, second fails, third succeeds
      mockLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Success'
        }))
        .mockRejectedValueOnce(new Error('LLM failure'))
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Success again'
        }));

      const tasks = ['task1', 'task2', 'task3'];
      const results = await classifier.classifyBatch(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].complexity).toBe('SIMPLE');
      expect(results[1].complexity).toBe('COMPLEX'); // Default on error
      expect(results[1].reasoning).toContain('Classification error');
      expect(results[2].complexity).toBe('COMPLEX');
    });
  });

  describe('Prompt Building', () => {
    it('should build classification prompt with task description', async () => {
      const validResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Test'
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      await classifier.classify('test task description');

      const capturedPrompt = mockLLMClient.complete.mock.calls[0][0];
      expect(capturedPrompt).toContain('test task description');
      expect(capturedPrompt).toContain('task complexity analyzer');
      expect(capturedPrompt).toContain('Classification Framework');
    });

    it('should include classification examples in prompt', async () => {
      const validResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Test'
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      await classifier.classify('test task');

      const capturedPrompt = mockLLMClient.complete.mock.calls[0][0];
      expect(capturedPrompt).toContain('Examples:');
      expect(capturedPrompt).toContain('Read configuration from config.json');
      expect(capturedPrompt).toContain('Build a complete web application');
    });

    it('should include consideration points in prompt', async () => {
      const validResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Test'
      });

      mockLLMClient.complete.mockResolvedValue(validResponse);

      await classifier.classify('test task');

      const capturedPrompt = mockLLMClient.complete.mock.calls[0][0];
      expect(capturedPrompt).toContain('Decision Process');
      expect(capturedPrompt).toContain('Scope Analysis');
      expect(capturedPrompt).toContain('Tool Sufficiency');
    });
  });

  describe('Static Methods', () => {
    it('should build classification prompt with context', () => {
      const mockArtifactRegistry = {
        size: () => 2,
        list: () => [
          { name: 'test_data', type: 'string', description: 'Test data' },
          { name: 'count', type: 'number', description: 'A count value' }
        ]
      };

      const context = { artifactRegistry: mockArtifactRegistry };
      const prompt = TaskClassifier.buildClassificationPrompt('test task', context);

      expect(prompt).toContain('test task');
      expect(prompt).toContain('Available artifacts');
      expect(prompt).toContain('@test_data');
      expect(prompt).toContain('@count');
      expect(prompt).toContain('Classification criteria');
    });

    it('should build classification prompt without context', () => {
      const prompt = TaskClassifier.buildClassificationPrompt('simple task');

      expect(prompt).toContain('simple task');
      expect(prompt).not.toContain('Available artifacts');
      expect(prompt).toContain('Classification criteria');
      expect(prompt).toContain('SIMPLE or COMPLEX');
    });
  });
});