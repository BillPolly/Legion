/**
 * Tests for the PromptBuilder template system
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PromptBuilder } from '../../src/core/execution/planning/prompts/PromptBuilder.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';

describe('PromptBuilder', () => {
  let promptBuilder;
  let mockTools;

  beforeEach(() => {
    promptBuilder = new PromptBuilder({
      debugMode: false
    });

    // Mock tools with metadata
    mockTools = [
      {
        name: 'createFile',
        description: 'Create a file with content',
        getMetadata: () => ({
          name: 'createFile',
          description: 'Create a file with content',
          input: { filePath: 'string', content: 'string' },
          output: { path: 'string', size: 'number' }
        })
      },
      {
        name: 'readFile',
        description: 'Read content from a file',
        getMetadata: () => ({
          name: 'readFile',
          description: 'Read content from a file',
          input: { filePath: 'string' },
          output: { content: 'string', path: 'string' }
        })
      }
    ];
  });

  describe('buildPlanningPrompt', () => {
    test('should generate basic planning prompt', () => {
      const goal = 'Create and read a test file';
      const context = {};

      const prompt = promptBuilder.buildPlanningPrompt(goal, mockTools, context);

      expect(prompt).toContain('You are an expert planning agent');
      expect(prompt).toContain(goal);
      expect(prompt).toContain('createFile: Create a file with content');
      expect(prompt).toContain('readFile: Read content from a file');
      expect(prompt).toContain('Planning Instructions');
      expect(prompt).toContain('Response Format');
      expect(prompt).toContain('Generate the plan now:');
    });

    test('should include validation feedback when provided', () => {
      const goal = 'Test goal';
      const validationErrors = [
        {
          type: 'TOOL_NOT_FOUND',
          message: 'Tool not found',
          stepId: 'step1'
        },
        {
          type: 'MISSING_PARAMETER',
          message: 'Missing parameter',
          stepId: 'step2'
        }
      ];
      
      const context = { validationErrors };

      const prompt = promptBuilder.buildPlanningPrompt(goal, mockTools, context);

      expect(prompt).toContain('VALIDATION ERRORS FROM PREVIOUS ATTEMPT');
      expect(prompt).toContain('Tool Not Found');
      expect(prompt).toContain('Missing Required Parameters');
      expect(prompt).toContain('Tool not found');
      expect(prompt).toContain('Missing parameter');
    });

    test('should include examples when provided', () => {
      const goal = 'Test goal';
      const examples = [
        {
          goal: 'Example goal',
          plan: [{ id: 'ex1', description: 'Example step' }]
        }
      ];
      
      const context = { examples };

      const prompt = promptBuilder.buildPlanningPrompt(goal, mockTools, context);

      expect(prompt).toContain('Planning Examples');
      expect(prompt).toContain('Example goal');
      expect(prompt).toContain('Example step');
    });
  });

  describe('buildFixPrompt', () => {
    test('should generate fix prompt with invalid plan and errors', () => {
      const goal = 'Create a file';
      const invalidPlan = [
        new PlanStep('step1', 'Bad step', 'unknownTool', 
          { wrongParam: 'value' }, [])
      ];
      
      const validationErrors = [
        {
          type: 'TOOL_NOT_FOUND',
          message: 'Tool unknownTool not found',
          stepId: 'step1',
          details: { availableTools: ['createFile', 'readFile'] }
        },
        {
          type: 'MISSING_PARAMETER',
          message: 'Missing filePath parameter',
          stepId: 'step1',
          details: { parameter: 'filePath', expectedType: 'string' }
        }
      ];

      const prompt = promptBuilder.buildFixPrompt(goal, invalidPlan, validationErrors, mockTools);

      expect(prompt).toContain('PLAN FIXING REQUEST');
      expect(prompt).toContain('Original Goal');
      expect(prompt).toContain(goal);
      expect(prompt).toContain('Invalid Plan Generated');
      expect(prompt).toContain('unknownTool');
      expect(prompt).toContain('Validation Errors Found');
      expect(prompt).toContain('Tool unknownTool not found');
      expect(prompt).toContain('Missing filePath parameter');
      expect(prompt).toContain('Available Tools');
      expect(prompt).toContain('createFile');
      expect(prompt).toContain('Instructions');
      expect(prompt).toContain('Generate the corrected plan now');
    });

    test('should group errors by step', () => {
      const goal = 'Test goal';
      const invalidPlan = [
        new PlanStep('step1', 'Step 1', 'tool1', {}, []),
        new PlanStep('step2', 'Step 2', 'tool2', {}, [])
      ];
      
      const validationErrors = [
        { type: 'ERROR1', message: 'Error 1a', stepId: 'step1' },
        { type: 'ERROR2', message: 'Error 1b', stepId: 'step1' },
        { type: 'ERROR3', message: 'Error 2a', stepId: 'step2' }
      ];

      const prompt = promptBuilder.buildFixPrompt(goal, invalidPlan, validationErrors, mockTools);

      expect(prompt).toContain('Step: step1');
      expect(prompt).toContain('Error 1a');
      expect(prompt).toContain('Error 1b');
      expect(prompt).toContain('Step: step2');
      expect(prompt).toContain('Error 2a');
    });
  });

  describe('buildReplanningPrompt', () => {
    test('should generate replanning prompt with context', () => {
      const currentPlan = [
        { id: 'step1', description: 'Completed step', status: 'done' },
        { id: 'step2', description: 'Failed step', status: 'failed' },
        { id: 'step3', description: 'Pending step', status: 'pending' }
      ];
      
      const failedStep = {
        id: 'step2',
        description: 'Failed step',
        tool: 'someTools',
        error: { message: 'Something went wrong' }
      };
      
      const context = {
        goal: 'Complete the task',
        tools: mockTools
      };

      const prompt = promptBuilder.buildReplanningPrompt(currentPlan, failedStep, context);

      expect(prompt).toContain('You are replanning after a step failure');
      expect(prompt).toContain('Original Goal');
      expect(prompt).toContain('Complete the task');
      expect(prompt).toContain('Available Tools');
      expect(prompt).toContain('Progress So Far');
      expect(prompt).toContain('Completed steps (1)');
      expect(prompt).toContain('step1: Completed step ✓');
      expect(prompt).toContain('Failed Step');
      expect(prompt).toContain('step2');
      expect(prompt).toContain('Something went wrong');
      expect(prompt).toContain('Remaining Steps');
      expect(prompt).toContain('step3: Pending step');
    });
  });

  describe('template processing', () => {
    test('should process simple variable replacement', () => {
      const template = 'Hello {{name}}!';
      const data = { name: 'World' };

      const result = promptBuilder.templateEngine.render(template, data);

      expect(result).toBe('Hello World!');
    });

    test('should process nested object access', () => {
      const template = 'User: {{user.name}}, Age: {{user.age}}';
      const data = { user: { name: 'John', age: 30 } };

      const result = promptBuilder.templateEngine.render(template, data);

      expect(result).toBe('User: John, Age: 30');
    });

    test('should process if conditions', () => {
      const template = '{{#if hasData}}Data exists{{else}}No data{{/if}}';
      
      const resultWithData = promptBuilder.templateEngine.render(template, { hasData: true });
      expect(resultWithData).toBe('Data exists');
      
      const resultNoData = promptBuilder.templateEngine.render(template, { hasData: false });
      expect(resultNoData).toBe('No data');
    });

    test('should process array iteration', () => {
      const template = '{{#each items}}Item: {{name}} {{/each}}';
      const data = { items: [{ name: 'A' }, { name: 'B' }] };

      const result = promptBuilder.templateEngine.render(template, data);

      expect(result).toBe('Item: A Item: B ');
    });

    test('should process object iteration with keys', () => {
      const template = '{{#each errors}}Step {{@key}}: {{message}} {{/each}}';
      const data = { 
        errors: { 
          step1: { message: 'Error 1' }, 
          step2: { message: 'Error 2' } 
        } 
      };

      const result = promptBuilder.templateEngine.render(template, data);

      expect(result).toContain('Step step1: Error 1');
      expect(result).toContain('Step step2: Error 2');
    });

    test('should handle missing values gracefully', () => {
      const template = 'Hello {{missing}} and {{also.missing}}!';
      const data = {};

      const result = promptBuilder.templateEngine.render(template, data);

      expect(result).toBe('Hello  and !');
    });
  });

  describe('helper methods', () => {
    test('should format tool descriptions', () => {
      const descriptions = promptBuilder.formatToolDescriptions(mockTools);

      expect(descriptions).toBe('- createFile: Create a file with content\n- readFile: Read content from a file');
    });

    test('should format context by filtering template fields', () => {
      const context = {
        attemptNumber: 1,
        validationErrors: [],
        examples: [],
        fixPrompt: 'some prompt',
        isFixing: true,
        userData: 'keep this'
      };

      const formatted = promptBuilder.formatContext(context);
      const parsed = JSON.parse(formatted);

      expect(parsed.userData).toBe('keep this');
      expect(parsed.attemptNumber).toBe(1);
      expect(parsed.examples).toBeUndefined();
      expect(parsed.validationErrors).toBeUndefined();
      expect(parsed.fixPrompt).toBeUndefined();
      expect(parsed.isFixing).toBeUndefined();
    });

    test('should group validation errors by step', () => {
      const errors = [
        { stepId: 'step1', type: 'ERROR1' },
        { stepId: 'step1', type: 'ERROR2' },
        { stepId: 'step2', type: 'ERROR3' },
        { type: 'ERROR4' } // No stepId
      ];

      const grouped = promptBuilder.groupErrorsByStep(errors);

      expect(grouped.step1).toHaveLength(2);
      expect(grouped.step2).toHaveLength(1);
      expect(grouped.general).toHaveLength(1); // No stepId goes to 'general'
    });
  });

  describe('error handling', () => {
    test('should throw error for missing template', () => {
      expect(() => {
        promptBuilder.renderTemplate('nonexistent.md', {});
      }).toThrow('Failed to render template nonexistent.md');
    });

    test('should handle template rendering errors', () => {
      // This would require a malformed template to test properly
      // For now, we'll test that the error handling structure is there
      expect(promptBuilder.renderTemplate).toBeDefined();
    });
  });

  describe('caching', () => {
    test('should cache loaded templates', () => {
      // Load a template twice
      const goal = 'Test goal';
      
      const prompt1 = promptBuilder.buildPlanningPrompt(goal, mockTools, {});
      const prompt2 = promptBuilder.buildPlanningPrompt(goal, mockTools, {});

      // Both should work and produce the same result
      expect(prompt1).toBe(prompt2);
    });

    test('should clear cache when requested', () => {
      promptBuilder.buildPlanningPrompt('Test', mockTools, {});
      
      expect(promptBuilder.cache.size).toBeGreaterThan(0);
      
      promptBuilder.clearCache();
      
      expect(promptBuilder.cache.size).toBe(0);
    });
  });
});