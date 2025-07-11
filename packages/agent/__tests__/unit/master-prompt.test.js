/**
 * Unit tests for master-prompt functionality
 */

import { jest } from '@jest/globals';
import { getMasterPrompt } from '../../src/lib/master-prompt.js';

describe('master-prompt', () => {
  describe('getCurrentTimeInTimeZone', () => {
    // Note: This function is not exported, so we test it indirectly through getMasterPrompt
    it('should include current date and time in master prompt', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      // Should contain a date pattern (month name, numbers, AM/PM)
      expect(prompt).toMatch(/Current date and time is \w+ \d+, \d{4} at \d+:\d+:\d+ (AM|PM)/);
    });
  });

  describe('serializeTools', () => {
    it('should handle empty tools array', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('No tools available!');
    });

    it('should serialize single tool correctly', () => {
      const tool = {
        name: 'Test Tool',
        identifier: 'test_tool',
        abilities: ['test', 'demo'],
        instructions: ['Do something', 'Do it well'],
        functions: [
          {
            name: 'testFunction',
            purpose: 'Test purpose',
            arguments: ['arg1'],
            response: 'string'
          }
        ]
      };

      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [tool],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('<tool>');
      expect(prompt).toContain('### Test Tool');
      expect(prompt).toContain('- name: Test Tool');
      expect(prompt).toContain('- identifier: test_tool');
      expect(prompt).toContain('- abilities: test,demo');
      expect(prompt).toContain('Tool instructions');
      expect(prompt).toContain('Do something,Do it well');
      expect(prompt).toContain('Available functions:');
      expect(prompt).toContain('"name":"testFunction"');
      expect(prompt).toContain('</tool>');
    });

    it('should serialize multiple tools correctly', () => {
      const tools = [
        {
          name: 'Tool One',
          identifier: 'tool_one',
          abilities: ['ability1'],
          instructions: ['instruction1'],
          functions: []
        },
        {
          name: 'Tool Two',
          identifier: 'tool_two',
          abilities: ['ability2'],
          instructions: ['instruction2'],
          functions: []
        }
      ];

      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools,
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('### Tool One');
      expect(prompt).toContain('### Tool Two');
      expect(prompt).toContain('tool_one');
      expect(prompt).toContain('tool_two');
    });
  });

  describe('serializeFunctions', () => {
    it('should serialize functions as JSON', () => {
      const tool = {
        name: 'Test Tool',
        identifier: 'test_tool',
        abilities: ['test'],
        instructions: ['test'],
        functions: [
          {
            name: 'func1',
            purpose: 'First function',
            arguments: ['arg1', 'arg2'],
            response: 'object'
          },
          {
            name: 'func2',
            purpose: 'Second function',
            arguments: [],
            response: 'string'
          }
        ]
      };

      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [tool],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      // Functions should be serialized as JSON
      expect(prompt).toContain('"name":"func1"');
      expect(prompt).toContain('"name":"func2"');
      expect(prompt).toContain('"purpose":"First function"');
      expect(prompt).toContain('"arguments":["arg1","arg2"]');
    });

    it('should handle empty functions array', () => {
      const tool = {
        name: 'Test Tool',
        identifier: 'test_tool',
        abilities: ['test'],
        instructions: ['test'],
        functions: []
      };

      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [tool],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('Available functions:');
      expect(prompt).toContain('[]'); // Empty array serialized
    });
  });

  describe('getMasterPrompt', () => {
    it('should include agent name and bio', () => {
      const config = {
        name: 'MyAgent',
        bio: 'I am a helpful assistant',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('Your name is MyAgent');
      expect(prompt).toContain('Your have expertise as described in your bio as I am a helpful assistant');
    });

    it('should handle undefined bio', () => {
      const config = {
        name: 'MyAgent',
        bio: undefined,
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('Your name is MyAgent');
      expect(prompt).toContain('Your have expertise as described in your bio as undefined');
    });

    it('should include all required sections', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: ['Step 1', 'Step 2']
      };

      const prompt = getMasterPrompt(config);

      // Check for main sections
      expect(prompt).toContain('You are an AI Agent');
      expect(prompt).toContain('<response_format>');
      expect(prompt).toContain('task_completed');
      expect(prompt).toContain('response');
      expect(prompt).toContain('use_tool');
      expect(prompt).toContain('<tools>');
      expect(prompt).toContain('<instructions>');
    });

    it('should include steps in instructions', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: ['First step', 'Second step', 'Third step']
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('First step');
      expect(prompt).toContain('Second step');
      expect(prompt).toContain('Third step');
    });

    it('should handle empty steps array', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('<instructions>');
      // Should still have default instructions even with empty steps
      expect(prompt).toContain('Current date and time is');
    });

    it('should configure response format based on responseStructure', () => {
      const responseStructure = {
        toJson: () => '{"result": "value"}'
      };

      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: [],
        responseStructure
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('For the final task output use JSON format');
      expect(prompt).toContain('For the final task output use {"result": "value"}');
    });

    it('should use string format when no responseStructure provided', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('For the final task output use string format');
      expect(prompt).toContain('For the final task output use plain text');
    });

    it('should include all standard instructions', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      // Check for key instructions
      expect(prompt).toContain('Current date and time is');
      expect(prompt).toContain('check the current date and confirm whether the event');
      expect(prompt).toContain('Read all the steps carefully');
      expect(prompt).toContain('You cannot send a message and wait for confirmation');
      expect(prompt).toContain('You cannot use any other tools');
      expect(prompt).toContain('Read the abilities of available tools carefully');
    });

    it('should include JSON format explanation', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('You always interact with a system program');
      expect(prompt).toContain('you must always respond in JSON format');
      expect(prompt).toContain('No other text before or after the JSON');
      expect(prompt).toContain('At a time, output only one JSON');
    });

    it('should include field explanations', () => {
      const config = {
        name: 'TestAgent',
        bio: 'Test bio',
        tools: [],
        steps: []
      };

      const prompt = getMasterPrompt(config);

      expect(prompt).toContain('## Explanation of the fields:');
      expect(prompt).toContain('task_completed - This is a boolean field');
      expect(prompt).toContain('response - The response object');
      expect(prompt).toContain('use_tool - If you want to instruct the system program');
    });

    it('should format complete example with complex tool', () => {
      const complexTool = {
        name: 'Calculator',
        identifier: 'calc',
        abilities: ['arithmetic', 'complex math'],
        instructions: ['Perform calculations accurately', 'Handle edge cases'],
        functions: [
          {
            name: 'add',
            purpose: 'Add two numbers',
            arguments: ['number1', 'number2'],
            response: 'number'
          },
          {
            name: 'factorial',
            purpose: 'Calculate factorial',
            arguments: ['number'],
            response: 'number'
          }
        ]
      };

      const config = {
        name: 'MathAgent',
        bio: 'Mathematical problem solver',
        tools: [complexTool],
        steps: [
          'Analyze the mathematical problem',
          'Choose appropriate calculation method',
          'Execute calculations step by step'
        ],
        responseStructure: {
          toJson: () => '{"calculation": "result", "steps": ["step1", "step2"]}'
        }
      };

      const prompt = getMasterPrompt(config);

      // Should contain all elements properly formatted
      expect(prompt).toContain('Your name is MathAgent');
      expect(prompt).toContain('Mathematical problem solver');
      expect(prompt).toContain('### Calculator');
      expect(prompt).toContain('- identifier: calc');
      expect(prompt).toContain('arithmetic,complex math');
      expect(prompt).toContain('Perform calculations accurately,Handle edge cases');
      expect(prompt).toContain('"name":"add"');
      expect(prompt).toContain('"name":"factorial"');
      expect(prompt).toContain('Analyze the mathematical problem');
      expect(prompt).toContain('Choose appropriate calculation method');
      expect(prompt).toContain('Execute calculations step by step');
      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('{"calculation": "result", "steps": ["step1", "step2"]}');
    });
  });
});