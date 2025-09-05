/**
 * PromptBuilder Unit Tests
 * 
 * Comprehensive tests for modular prompt construction functionality.
 * Tests prompt formatting, context inclusion, and JSON schema requirements.
 */

import { PromptBuilder } from '../PromptBuilder.js';

describe('PromptBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with correct default configuration', () => {
      expect(builder.config.maxPromptLength).toBe(100000);
      expect(builder.config.maxContextItems).toBe(1000);
      expect(builder.config.jsonSchemaRequired).toBe(true);
      expect(builder.config.indentSize).toBe(2);
    });
  });

  describe('Chat History Compression Prompts', () => {
    test('should build chat compression prompt with all sections', () => {
      const oldMessages = [
        { role: 'user', content: 'Hello world', timestamp: 1000 },
        { role: 'assistant', content: 'Hi there! How can I help?', timestamp: 2000 }
      ];
      
      const artifacts = {
        user_name: 'John',
        session_id: '12345'
      };

      const prompt = builder.buildChatCompressionPrompt(oldMessages, artifacts);

      expect(prompt).toContain('## Task: Chat History Compression');
      expect(prompt).toContain('OLD MESSAGES TO COMPRESS:');
      expect(prompt).toContain('CURRENT VARIABLES:');
      expect(prompt).toContain('Hello world');
      expect(prompt).toContain('Hi there!');
      expect(prompt).toContain('user_name');
      expect(prompt).toContain('session_id');
      expect(prompt).toContain('Return JSON with this exact structure');
      expect(prompt).toContain('summary');
      expect(prompt).toContain('keyInsights');
      expect(prompt).toContain('CRITICAL: Response must be valid JSON only');
    });

    test('should handle empty chat history', () => {
      const prompt = builder.buildChatCompressionPrompt([], {});
      
      expect(prompt).toContain('No messages');
      expect(prompt).toContain('No variables');
      expect(prompt).toContain('JSON');
    });

    test('should truncate very long messages', () => {
      const longContent = 'a'.repeat(1000);
      const messages = [{ role: 'user', content: longContent }];
      
      const prompt = builder.buildChatCompressionPrompt(messages, {});
      
      // Should be truncated to 500 chars + ...
      expect(prompt).toContain('aaa...'); // Truncated
      expect(prompt).not.toContain(longContent); // Not full content
    });
  });

  describe('Artifact Analysis Prompts', () => {
    test('should build artifact analysis prompt with categorization', () => {
      const artifacts = {
        output_directory: './tmp',
        user_data: { name: 'John', age: 30 },
        temp_result: 'some calculation',
        resource_actor: { id: 'actor1' }
      };

      const operations = [
        { tool: 'calculator', success: true, timestamp: 1000 },
        { tool: 'data_loader', success: false, error: 'File not found', timestamp: 2000 }
      ];

      const prompt = builder.buildArtifactAnalysisPrompt(artifacts, operations);

      expect(prompt).toContain('## Task: Artifact Relevance Analysis');
      expect(prompt).toContain('CURRENT VARIABLES:');
      expect(prompt).toContain('RECENT OPERATIONS:');
      expect(prompt).toContain('output_directory');
      expect(prompt).toContain('user_data');
      expect(prompt).toContain('calculator');
      expect(prompt).toContain('KEEP');
      expect(prompt).toContain('ARCHIVE');
      expect(prompt).toContain('DISCARD');
      expect(prompt).toContain('_actor, _registry (infrastructure)');
      expect(prompt).toContain('"decision": "string - KEEP|ARCHIVE|DISCARD"');
    });

    test('should protect infrastructure variables in rules', () => {
      const prompt = builder.buildArtifactAnalysisPrompt({}, []);
      
      expect(prompt).toContain('output_directory (infrastructure)');
      expect(prompt).toContain('_client, _actor, _registry (infrastructure)');
      expect(prompt).toContain('NEVER categorize these special variables');
    });
  });

  describe('Operation History Optimization Prompts', () => {
    test('should build operation optimization prompt with patterns', () => {
      const operations = [
        { 
          tool: 'data_processor', 
          success: true, 
          timestamp: 1000,
          outputs: { result: 'processed_data' }
        },
        { 
          tool: 'file_writer', 
          success: false, 
          error: 'Permission denied',
          timestamp: 2000 
        }
      ];

      const artifacts = { processed_data: 'some data' };

      const prompt = builder.buildOperationOptimizationPrompt(operations, artifacts);

      expect(prompt).toContain('## Task: Operation History Optimization');
      expect(prompt).toContain('OLD OPERATIONS TO SUMMARIZE:');
      expect(prompt).toContain('data_processor');
      expect(prompt).toContain('file_writer');
      expect(prompt).toContain('Permission denied');
      expect(prompt).toContain('processed_data');
      expect(prompt).toContain('successPatterns');
      expect(prompt).toContain('failureInsights');
      expect(prompt).toContain('toolsUsed');
      expect(prompt).toContain('variableCreators');
    });
  });

  describe('Context Formatting', () => {
    test('should format chat history with roles and timestamps', () => {
      const messages = [
        { role: 'user', content: 'Test message 1', timestamp: 1000 },
        { role: 'assistant', content: 'Test response 1', timestamp: 2000 },
        { role: 'user', content: 'Test message 2' } // No timestamp
      ];

      const formatted = builder.formatChatHistory(messages);

      expect(formatted).toContain('1. [user ');
      expect(formatted).toContain('Test message 1');
      expect(formatted).toContain('2. [assistant ');
      expect(formatted).toContain('Test response 1');
      expect(formatted).toContain('3. [user] Test message 2'); // No timestamp
    });

    test('should format artifacts with type and preview', () => {
      const artifacts = {
        simple_string: 'Hello world',
        long_string: 'a'.repeat(150),
        number_val: 42,
        boolean_val: true,
        array_val: [1, 2, 3],
        object_val: { name: 'test', value: 123 },
        null_val: null
      };

      const formatted = builder.formatArtifacts(artifacts);

      expect(formatted).toContain('- **simple_string** (string): "Hello world"');
      expect(formatted).toContain('- **long_string** (string): "aaaa...');
      expect(formatted).toContain('- **number_val** (number): 42');
      expect(formatted).toContain('- **boolean_val** (boolean): true');
      expect(formatted).toContain('- **array_val** (object): [1,2,3]');
      expect(formatted).toContain('- **object_val** (object):');
      expect(formatted).toContain('- **null_val** (object): null');
    });

    test('should format operation history with status icons', () => {
      const operations = [
        { tool: 'success_tool', success: true, timestamp: 1000 },
        { tool: 'failure_tool', success: false, error: 'Something went wrong', timestamp: 2000 },
        { tool: 'output_tool', success: true, outputs: { result: 'data', file: 'output.txt' } }
      ];

      const formatted = builder.formatOperationHistory(operations);

      expect(formatted).toContain('1. ✅ **success_tool**');
      expect(formatted).toContain('2. ❌ **failure_tool**');
      expect(formatted).toContain('(Error: Something went wrong)');
      expect(formatted).toContain('3. ✅ **output_tool**');
      expect(formatted).toContain('→ result, file');
    });

    test('should handle empty contexts gracefully', () => {
      expect(builder.formatChatHistory([])).toBe('No messages');
      expect(builder.formatChatHistory(null)).toBe('No messages');
      expect(builder.formatArtifacts({})).toBe('No variables');
      expect(builder.formatArtifacts(null)).toBe('No variables');
      expect(builder.formatOperationHistory([])).toBe('No operations');
      expect(builder.formatOperationHistory(null)).toBe('No operations');
    });

    test('should respect maxContextItems limit', () => {
      builder.config.maxContextItems = 2;
      
      const messages = Array.from({ length: 5 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`
      }));

      const formatted = builder.formatChatHistory(messages);
      const lines = formatted.split('\n');
      
      expect(lines).toHaveLength(2); // Only 2 messages formatted
      expect(formatted).toContain('Message 0');
      expect(formatted).toContain('Message 1');
      expect(formatted).not.toContain('Message 2');
    });
  });

  describe('JSON Schema Validation', () => {
    test('should validate JSON prompts correctly', () => {
      const validPrompt = 'Please return JSON with this schema structure';
      const invalidPrompt = 'Just give me a plain text response';

      expect(builder.validateJsonPrompt(validPrompt)).toBe(false); // Missing required terms
      
      const completeValidPrompt = 'Please return JSON with this exact schema structure';
      expect(builder.validateJsonPrompt(completeValidPrompt)).toBe(true);
      expect(builder.validateJsonPrompt(invalidPrompt)).toBe(false);
    });

    test('should format JSON schema properly', () => {
      const schema = {
        result: 'string - The result value',
        items: ['array', 'of', 'items'],
        nested: {
          key: 'value'
        }
      };

      const formatted = builder.formatJsonSchema(schema);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual(schema);
      expect(formatted).toContain('  '); // Proper indentation
    });

    test('should handle schema formatting errors', () => {
      const cyclicalObject = {};
      cyclicalObject.self = cyclicalObject;

      const formatted = builder.formatJsonSchema(cyclicalObject);
      expect(formatted).toBe('{}');
    });
  });

  describe('Utility Methods', () => {
    test('should truncate text correctly', () => {
      expect(builder.truncateText('short', 100)).toBe('short');
      expect(builder.truncateText('a'.repeat(100), 50)).toBe('a'.repeat(47) + '...');
      expect(builder.truncateText('', 50)).toBe('');
      expect(builder.truncateText(null, 50)).toBe('');
    });

    test('should get value preview for different types', () => {
      expect(builder.getValuePreview('short string')).toBe('"short string"');
      expect(builder.getValuePreview('a'.repeat(150))).toContain('...');
      expect(builder.getValuePreview(42)).toBe('42');
      expect(builder.getValuePreview(true)).toBe('true');
      expect(builder.getValuePreview([1, 2])).toBe('[1,2]');
      expect(builder.getValuePreview([1, 2, 3, 4, 5])).toBe('Array(5 items)');
      expect(builder.getValuePreview({ a: 1 })).toContain('{"a":1}');
      expect(builder.getValuePreview(null)).toBe('null');
      expect(builder.getValuePreview(undefined)).toBe('undefined');
    });

    test('should generate prompt statistics', () => {
      const prompt = 'This is a JSON schema return structure test prompt';
      const stats = builder.getPromptStats(prompt);

      expect(stats.length).toBe(prompt.length);
      expect(stats.lines).toBe(1);
      expect(stats.hasJsonSchema).toBe(false); // Missing 'return' term
      expect(stats.estimatedTokens).toBe(Math.ceil(prompt.length / 4));
      expect(stats.withinLimits).toBe(true);
      
      // Test with complete valid JSON prompt
      const validPrompt = 'Return JSON with this schema structure';
      const validStats = builder.getPromptStats(validPrompt);
      expect(validStats.hasJsonSchema).toBe(true);
    });

    test('should warn about prompt length limits', () => {
      builder.config.maxPromptLength = 100;
      const longPrompt = 'a'.repeat(150);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const stats = builder.getPromptStats(longPrompt);
      
      expect(stats.withinLimits).toBe(false);
      expect(stats.length).toBe(150);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Core Prompt Building', () => {
    test('should build complete prompts with all sections', () => {
      const config = {
        task: 'Test Task',
        instruction: 'This is a test instruction',
        context: {
          'DATA': 'some data here',
          'MORE DATA': 'additional context'
        },
        categories: {
          'TYPE_A': 'First type description',
          'TYPE_B': 'Second type description'
        },
        rules: ['Rule 1', 'Rule 2'],
        requirements: ['Requirement 1', 'Requirement 2'],
        outputSchema: {
          result: 'string',
          success: 'boolean'
        },
        examples: [{ result: 'example', success: true }]
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt).toContain('## Task: Test Task');
      expect(prompt).toContain('This is a test instruction');
      expect(prompt).toContain('**DATA:**');
      expect(prompt).toContain('some data here');
      expect(prompt).toContain('**Categories:**');
      expect(prompt).toContain('- **TYPE_A**: First type description');
      expect(prompt).toContain('**Rules:**');
      expect(prompt).toContain('- Rule 1');
      expect(prompt).toContain('**Requirements - Preserve:**');
      expect(prompt).toContain('- Requirement 1');
      expect(prompt).toContain('**Return JSON with this exact structure:**');
      expect(prompt).toContain('"result": "string"');
      expect(prompt).toContain('**Example:**');
      expect(prompt).toContain('CRITICAL: Response must be valid JSON only');
    });

    test('should handle minimal prompt configuration', () => {
      const config = {
        instruction: 'Simple instruction',
        outputSchema: { result: 'string' }
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt).toContain('Simple instruction');
      expect(prompt).toContain('Return JSON');
      expect(prompt).toContain('CRITICAL');
    });
  });
});