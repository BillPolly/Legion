/**
 * Tests for PromptTemplateLoader
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PromptTemplateLoader } from '../src/PromptTemplateLoader.js';
import fs from 'fs/promises';
import path from 'path';

describe('PromptTemplateLoader', () => {
  let templateLoader;

  beforeEach(() => {
    templateLoader = new PromptTemplateLoader();
  });

  describe('processTemplate', () => {
    test('should substitute template variables', () => {
      const template = 'Hello {{name}}, you have {{count}} messages.';
      const variables = { name: 'John', count: 5 };
      
      const result = templateLoader.processTemplate(template, variables);
      
      expect(result).toBe('Hello John, you have 5 messages.');
    });

    test('should handle array values', () => {
      const template = 'Available options: {{options}}';
      const variables = { options: ['option1', 'option2', 'option3'] };
      
      const result = templateLoader.processTemplate(template, variables);
      
      expect(result).toBe('Available options: option1, option2, option3');
    });

    test('should handle object values', () => {
      const template = 'Config: {{config}}';
      const variables = { config: { key: 'value', number: 42 } };
      
      const result = templateLoader.processTemplate(template, variables);
      
      expect(result).toContain('"key": "value"');
      expect(result).toContain('"number": 42');
    });

    test('should warn about unsubstituted placeholders', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const template = 'Hello {{name}}, you have {{missingVar}} items.';
      const variables = { name: 'John' };
      
      templateLoader.processTemplate(template, variables);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unsubstituted placeholders found: {{missingVar}}')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('formatAllowableActions', () => {
    test('should format actions with input/output schemas', () => {
      const actions = [{
        type: 'file_write',
        description: 'Write content to a file',
        inputSchema: {
          properties: {
            filepath: { type: 'string', description: 'Path to file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filepath', 'content']
        },
        outputSchema: {
          properties: {
            filepath: { type: 'string', description: 'Created file path' },
            created: { type: 'boolean', description: 'Whether file was created' }
          }
        }
      }];

      const result = templateLoader.formatAllowableActions(actions);

      expect(result).toContain('**file_write**: Write content to a file');
      expect(result).toContain('Inputs:');
      expect(result).toContain('filepath: string (required) - Path to file');
      expect(result).toContain('content: string (required) - Content to write');
      expect(result).toContain('Outputs:');
      expect(result).toContain('filepath: string - Created file path');
      expect(result).toContain('created: boolean - Whether file was created');
    });

    test('should handle actions with simple inputs/outputs arrays', () => {
      const actions = [{
        type: 'simple_action',
        description: 'A simple action',
        inputs: ['input1', 'input2'],
        outputs: ['output1']
      }];

      const result = templateLoader.formatAllowableActions(actions);

      expect(result).toContain('**simple_action**: A simple action');
      expect(result).toContain('Inputs: input1, input2');
      expect(result).toContain('Outputs: output1');
    });
  });

  describe('formatValidationErrors', () => {
    test('should format error list with numbers', () => {
      const errors = [
        'Missing required field: name',
        'Invalid step type: unknown',
        'Tool not found: invalid_tool'
      ];

      const result = templateLoader.formatValidationErrors(errors);

      expect(result).toBe(
        '1. Missing required field: name\n' +
        '2. Invalid step type: unknown\n' +
        '3. Tool not found: invalid_tool'
      );
    });

    test('should handle empty error list', () => {
      const result = templateLoader.formatValidationErrors([]);
      expect(result).toBe('');
    });
  });

  describe('template methods', () => {
    test('should load create-plan template with variables', async () => {
      const params = {
        description: 'Create a web application',
        inputs: ['requirements', 'config'],
        requiredOutputs: ['app_url', 'deployment_info'],
        allowableActions: [{
          type: 'deploy_app',
          description: 'Deploy application',
          inputs: ['app_config'],
          outputs: ['url', 'status']
        }],
        maxSteps: 15
      };

      const result = await templateLoader.loadCreatePlanTemplate(params);

      expect(result).toContain('Create a web application');
      expect(result).toContain('requirements, config');
      expect(result).toContain('app_url, deployment_info');
      expect(result).toContain('15');
      expect(result).toContain('**deploy_app**: Deploy application');
    });

    test('should load fix-plan template with validation errors', async () => {
      const params = {
        description: 'Fix a broken plan',
        inputs: ['data'],
        requiredOutputs: ['result'],
        allowableActions: [{
          type: 'fix_action',
          description: 'Fix something',
          inputs: ['problem'],
          outputs: ['solution']
        }],
        maxSteps: 10,
        failedPlan: { id: 'failed-plan', name: 'Failed Plan' },
        validationErrors: ['Tool not found', 'Invalid format']
      };

      const result = await templateLoader.loadFixPlanTemplate(params);

      expect(result).toContain('Fix a broken plan');
      expect(result).toContain('data');
      expect(result).toContain('result');
      expect(result).toContain('**fix_action**: Fix something');
      expect(result).toContain('FAILED VALIDATION');
      expect(result).toContain('"id": "failed-plan"');
      expect(result).toContain('1. Tool not found');
      expect(result).toContain('2. Invalid format');
    });
  });
});