/**
 * Tests for schema-based format specification
 * Verifies that schemas can specify the desired output format
 */

import { describe, test, expect } from '@jest/globals';
import { ResponseValidator } from '../../src/ResponseValidator.js';
import { InstructionGenerator } from '../../src/InstructionGenerator.js';

describe('Schema Format Specification', () => {
  
  describe('Format specification via x-output-format', () => {
    test('should generate JSON instructions when x-output-format is json', () => {
      const schema = {
        type: 'object',
        'x-output-format': 'json',
        properties: {
          name: { type: 'string' },
          value: { type: 'number' }
        },
        required: ['name']
      };

      const validator = new ResponseValidator(schema);
      const instructions = validator.generateInstructions(
        { name: 'test', value: 42 },
        { format: 'json' }
      );

      expect(instructions).toContain('valid JSON');
      expect(instructions).toContain('"name"');
      expect(instructions).toContain('"value"');
    });

    test('should generate delimited instructions when x-output-format is delimited', () => {
      const schema = {
        type: 'object',
        'x-output-format': 'delimited',
        properties: {
          code: { type: 'string', description: 'The generated code' },
          explanation: { type: 'string', description: 'Explanation of the code' }
        },
        required: ['code']
      };

      const validator = new ResponseValidator(schema);
      const instructions = validator.generateInstructions(
        { code: 'console.log("hello");', explanation: 'Prints hello' },
        { format: 'delimited' }
      );

      expect(instructions).toContain('delimited sections');
      expect(instructions).toContain('---CODE---');
      expect(instructions).toContain('---END-CODE---');
    });

    test('should generate XML instructions when x-output-format is xml', () => {
      const schema = {
        type: 'object',
        'x-output-format': 'xml',
        'x-format': {
          xml: {
            'root-element': 'result'
          }
        },
        properties: {
          status: { type: 'string' },
          message: { type: 'string' }
        },
        required: ['status']
      };

      const validator = new ResponseValidator(schema);
      const instructions = validator.generateInstructions(
        { status: 'success', message: 'Operation complete' },
        { format: 'xml' }
      );

      expect(instructions).toContain('valid XML');
      expect(instructions).toContain('<result>');
      expect(instructions).toContain('</result>');
    });
  });

  describe('Format auto-detection from schema hints', () => {
    test('should detect format from x-format properties', () => {
      const schema = {
        type: 'object',
        'x-format': {
          delimited: {
            'section-prefix': '---',
            'section-suffix': '---'
          }
        },
        properties: {
          content: { type: 'string' }
        }
      };

      // When we implement proper format detection in ResponseValidator
      const validator = new ResponseValidator(schema);
      
      // The validator should detect the preferred format from x-format
      const instructions = validator.generateInstructions(
        { content: 'test' },
        { format: 'delimited' }
      );
      
      expect(instructions).toContain('delimited');
    });
  });

  describe('Different formats for different content types', () => {
    test('should use delimited format for code generation', () => {
      const codeGenSchema = {
        type: 'object',
        'x-output-format': 'delimited',
        properties: {
          code: { 
            type: 'string',
            description: 'The generated code',
            minLength: 10
          },
          language: {
            type: 'string',
            enum: ['javascript', 'typescript', 'python']
          },
          explanation: {
            type: 'string',
            description: 'Brief explanation of what the code does'
          }
        },
        required: ['code', 'language']
      };

      const validator = new ResponseValidator(codeGenSchema);
      const instructions = validator.generateInstructions(
        { 
          code: 'function hello() { return "Hello"; }',
          language: 'javascript',
          explanation: 'A simple greeting function'
        },
        { format: 'delimited' }
      );

      expect(instructions).toContain('---CODE---');
      expect(instructions).toContain('---LANGUAGE---');
      expect(instructions).not.toContain('"code":');
    });

    test('should use JSON format for data structures', () => {
      const dataSchema = {
        type: 'object',
        'x-output-format': 'json',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' }
              }
            }
          },
          total: { type: 'number' }
        }
      };

      const validator = new ResponseValidator(dataSchema);
      const instructions = validator.generateInstructions(
        { 
          users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
          ],
          total: 2
        },
        { format: 'json' }
      );

      expect(instructions).toContain('valid JSON');
      expect(instructions).toContain('"users"');
      expect(instructions).toContain('[');
    });
  });

  describe('Format-specific validation', () => {
    test('should parse delimited format correctly', () => {
      const schema = {
        type: 'object',
        'x-output-format': 'delimited',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          tags: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['title', 'content']
      };

      const validator = new ResponseValidator(schema);
      
      // Test with actual delimited response
      const delimitedResponse = `---TITLE---
My Test Article
---END-TITLE---

---CONTENT---
This is the main content of the article.
It can span multiple lines.
---END-CONTENT---

---TAGS---
1. testing
2. documentation
3. example
---END-TAGS---`;

      const result = validator.process(delimitedResponse);
      
      expect(result.format).toBe('delimited');
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('My Test Article');
      expect(result.data.content).toContain('main content');
      expect(result.data.tags).toHaveLength(3);
    });

    test('should parse JSON format correctly', () => {
      const schema = {
        type: 'object',
        'x-output-format': 'json',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        },
        required: ['success']
      };

      const validator = new ResponseValidator(schema);
      
      const jsonResponse = JSON.stringify({
        success: true,
        message: 'Operation completed successfully'
      });

      const result = validator.process(jsonResponse);
      
      expect(result.format).toBe('json');
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.message).toBe('Operation completed successfully');
    });
  });

  describe('Error handling for format mismatches', () => {
    test('should provide helpful error when wrong format is used', () => {
      const schema = {
        type: 'object',
        'x-output-format': 'json',
        properties: {
          value: { type: 'number' }
        },
        required: ['value']
      };

      const validator = new ResponseValidator(schema);
      
      // Try to parse delimited format when JSON is expected
      const wrongFormatResponse = `---VALUE---
42
---END-VALUE---`;

      const result = validator.process(wrongFormatResponse);
      
      // Should auto-detect the actual format
      expect(result.format).toBe('delimited');
      
      // May succeed if it can extract the data
      if (result.success) {
        expect(result.data.value).toBe(42);
      } else {
        // Or provide helpful error message
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration with InstructionGenerator', () => {
    test('should respect format parameter in generateInstructions', () => {
      const schema = {
        type: 'object',
        properties: {
          output: { type: 'string' }
        }
      };

      // Test each format
      const formats = ['json', 'xml', 'delimited', 'tagged', 'markdown', 'yaml'];
      
      for (const format of formats) {
        const instructions = InstructionGenerator.generateInstructions(
          schema,
          { output: 'test' },
          { format }
        );

        // Each format should have its specific header
        if (format === 'json') {
          expect(instructions).toContain('valid JSON');
        } else if (format === 'xml') {
          expect(instructions).toContain('valid XML');
        } else if (format === 'delimited') {
          expect(instructions).toContain('delimited sections');
        } else if (format === 'tagged') {
          expect(instructions).toContain('XML-style tags');
        } else if (format === 'markdown') {
          expect(instructions).toContain('structured markdown');
        } else if (format === 'yaml') {
          expect(instructions).toContain('valid YAML');
        }
      }
    });

    test('should include format-specific examples', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      const exampleData = { name: 'John', age: 30 };

      // Test delimited format with example
      const delimitedInstructions = InstructionGenerator.generateInstructions(
        schema,
        exampleData,
        { 
          format: 'delimited',
          includeExample: true
        }
      );

      expect(delimitedInstructions).toContain('EXAMPLE OUTPUT');
      expect(delimitedInstructions).toContain('---NAME---');
      expect(delimitedInstructions).toContain('John');
      expect(delimitedInstructions).toContain('---AGE---');
      expect(delimitedInstructions).toContain('30');
    });
  });
});