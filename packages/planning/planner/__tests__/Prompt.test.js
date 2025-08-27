/**
 * Unit tests for Prompt class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Prompt } from '../src/core/Prompt.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Prompt', () => {
  let prompt;

  beforeEach(() => {
    prompt = new Prompt();
  });

  describe('constructor', () => {
    it('should load templates on construction', () => {
      expect(prompt.createPlanTemplate).toBeDefined();
      expect(prompt.fixPlanTemplate).toBeDefined();
      expect(typeof prompt.createPlanTemplate).toBe('string');
      expect(typeof prompt.fixPlanTemplate).toBe('string');
    });

    it('should load templates that contain expected variables', () => {
      expect(prompt.createPlanTemplate).toContain('{{TASK_DESCRIPTION}}');
      expect(prompt.createPlanTemplate).toContain('{{TOOLS}}');
      expect(prompt.fixPlanTemplate).toContain('{{TASK_DESCRIPTION}}');
      expect(prompt.fixPlanTemplate).toContain('{{TOOLS}}');
      expect(prompt.fixPlanTemplate).toContain('{{FAILED_PLAN}}');
      expect(prompt.fixPlanTemplate).toContain('{{ERRORS}}');
    });
  });

  describe('getInitialPrompt', () => {
    it('should fill task description', () => {
      const requirements = 'Create a simple web server';
      const tools = [];
      
      const result = prompt.getInitialPrompt(requirements, tools);
      
      expect(result).toContain('Create a simple web server');
      expect(result).not.toContain('{{TASK_DESCRIPTION}}');
    });

    it('should format tools array as markdown list', () => {
      const requirements = 'Test task';
      const tools = [
        { name: 'file_write', description: 'Write a file' },
        { name: 'file_read', description: 'Read a file' }
      ];
      
      const result = prompt.getInitialPrompt(requirements, tools);
      
      expect(result).toContain('### file_write');
      expect(result).toContain('Description: Write a file');
      expect(result).toContain('### file_read');
      expect(result).toContain('Description: Read a file');
      expect(result).not.toContain('{{TOOLS}}');
    });

    it('should handle tools with schemas', () => {
      const requirements = 'Test task';
      const tools = [
        {
          name: 'file_write',
          description: 'Write a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            }
          }
        }
      ];
      
      const result = prompt.getInitialPrompt(requirements, tools);
      
      expect(result).toContain('file_write');
      expect(result).toContain('Write a file');
      expect(result).toContain('Inputs:');
      expect(result).toContain('path (string)');
    });

    it('should handle tools with getMetadata method', () => {
      const requirements = 'Test task';
      const tools = [
        {
          name: 'calculator',
          description: 'Perform calculations', // Description must be on the tool itself
          getMetadata: () => ({
            name: 'calculator',
            description: 'Perform calculations',
            input: { type: 'object' }
          })
        }
      ];
      
      const result = prompt.getInitialPrompt(requirements, tools);
      
      expect(result).toContain('calculator');
      expect(result).toContain('Perform calculations');
    });

    it('should handle empty tools array', () => {
      const requirements = 'Test task';
      const tools = [];
      
      const result = prompt.getInitialPrompt(requirements, tools);
      
      // When no tools, the tools section should still be there but empty
      expect(result).toContain('## Available Tools');
      expect(result).not.toContain('{{TOOLS}}');
    });
  });

  describe('getFixPrompt', () => {
    it('should include all required fields', () => {
      const requirements = 'Create a web server';
      const tools = [{ name: 'file_write', description: 'Write files' }];
      const failedPlan = {
        type: 'sequence',
        id: 'root',
        children: []
      };
      const validation = {
        valid: false,
        errors: [
          {
            type: 'MISSING_TOOL',
            message: 'Tool not found: file_read',
            nodeId: 'node-1'
          }
        ]
      };
      
      const result = prompt.getFixPrompt(requirements, tools, failedPlan, validation);
      
      expect(result).toContain('Create a web server');
      expect(result).toContain('file_write');
      expect(result).toContain('"type": "sequence"');
      expect(result).toContain('Tool not found: file_read');
      expect(result).not.toContain('{{TASK_DESCRIPTION}}');
      expect(result).not.toContain('{{FAILED_PLAN}}');
      expect(result).not.toContain('{{ERRORS}}');
    });

    it('should format validation errors as list', () => {
      const requirements = 'Test';
      const tools = [];
      const failedPlan = { type: 'sequence' };
      const validation = {
        valid: false,
        errors: [
          { type: 'ERROR1', message: 'First error', nodeId: 'node-1' },
          { type: 'ERROR2', message: 'Second error', nodeId: 'node-2' }
        ]
      };
      
      const result = prompt.getFixPrompt(requirements, tools, failedPlan, validation);
      
      expect(result).toContain('- **ERROR1** in node `node-1`: First error');
      expect(result).toContain('- **ERROR2** in node `node-2`: Second error');
    });

    it('should handle errors without nodeId', () => {
      const requirements = 'Test';
      const tools = [];
      const failedPlan = { type: 'sequence' };
      const validation = {
        valid: false,
        errors: [
          { type: 'GENERAL', message: 'General error' }
        ]
      };
      
      const result = prompt.getFixPrompt(requirements, tools, failedPlan, validation);
      
      expect(result).toContain('- **GENERAL** in node `unknown`: General error');
      expect(result).not.toContain('(node:');
    });

    it('should handle empty errors array', () => {
      const requirements = 'Test';
      const tools = [];
      const failedPlan = { type: 'sequence' };
      const validation = {
        valid: false,
        errors: []
      };
      
      const result = prompt.getFixPrompt(requirements, tools, failedPlan, validation);
      
      // Empty errors array just results in empty content in that section
      expect(result).toContain('## Validation Errors');
      expect(result).toContain('Fix these specific issues:');
      // The actual formatting logic doesn't add "No specific errors" for empty arrays
      expect(result).not.toContain('{{ERRORS}}');
    });
  });

  describe('_fillTemplate', () => {
    it('should replace simple string values', () => {
      const template = 'Hello {{NAME}}, welcome to {{PLACE}}';
      const values = { NAME: 'Alice', PLACE: 'Wonderland' };
      
      const result = prompt._fillTemplate(template, values);
      
      expect(result).toBe('Hello Alice, welcome to Wonderland');
    });

    it('should handle missing values gracefully', () => {
      const template = 'Hello {{NAME}}';
      const values = {};
      
      const result = prompt._fillTemplate(template, values);
      
      // Template variable remains if no value provided
      expect(result).toBe('Hello {{NAME}}');
    });

    it('should format objects as JSON', () => {
      const template = 'Config: {{CONFIG}}';
      const values = { CONFIG: { key: 'value', num: 123 } };
      
      const result = prompt._fillTemplate(template, values);
      
      expect(result).toContain('"key": "value"');
      expect(result).toContain('"num": 123');
    });

    it('should handle null and undefined', () => {
      const template = '{{NULL}} and {{UNDEFINED}}';
      const values = { NULL: null, UNDEFINED: undefined };
      
      const result = prompt._fillTemplate(template, values);
      
      expect(result).toBe('null and undefined');
    });
  });
});