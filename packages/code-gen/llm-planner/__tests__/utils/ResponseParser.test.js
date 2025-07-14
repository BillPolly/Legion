/**
 * Tests for ResponseParser utility
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ResponseParser } from '../../src/utils/ResponseParser.js';

describe('ResponseParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ResponseParser();
  });

  describe('Basic Parsing', () => {
    test('should parse JSON response', () => {
      const response = '{"name": "Test Plan", "steps": [{"id": "1", "name": "Step 1"}]}';
      const parsed = parser.parse(response);

      expect(parsed.name).toBe('Test Plan');
      expect(parsed.steps).toHaveLength(1);
      expect(parsed.steps[0].name).toBe('Step 1');
    });

    test('should parse JSON with markdown code blocks', () => {
      const response = `Here is the plan:
\`\`\`json
{
  "name": "My Plan",
  "version": "1.0.0"
}
\`\`\``;
      
      const parsed = parser.parse(response);
      expect(parsed.name).toBe('My Plan');
      expect(parsed.version).toBe('1.0.0');
    });

    test('should handle multiple JSON blocks', () => {
      const response = `First block:
\`\`\`json
{"type": "plan"}
\`\`\`
Second block:
\`\`\`json
{"type": "step"}
\`\`\``;

      const parsed = parser.parseAll(response);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe('plan');
      expect(parsed[1].type).toBe('step');
    });

    test('should parse with custom delimiters', () => {
      const response = '<<START>>{"data": "test"}<<END>>';
      const parsed = parser.parse(response, {
        startDelimiter: '<<START>>',
        endDelimiter: '<<END>>'
      });

      expect(parsed.data).toBe('test');
    });
  });

  describe('Plan-Specific Parsing', () => {
    test('should parse plan structure', () => {
      const response = `{
        "name": "Todo App",
        "steps": [
          {
            "id": "step-1",
            "name": "Initialize",
            "type": "setup",
            "actions": [
              {"type": "create-directory", "path": "src"}
            ]
          }
        ]
      }`;

      const plan = parser.parsePlan(response);
      
      expect(plan.name).toBe('Todo App');
      expect(plan.steps[0].id).toBe('step-1');
      expect(plan.steps[0].actions[0].type).toBe('create-directory');
    });

    test('should extract steps from mixed content', () => {
      const response = `Let me create a plan for you:

Here are the steps:
1. **Setup Project** - Initialize the project structure
   - Create package.json
   - Install dependencies
   
2. **Create Components** - Build the UI components
   - Header component
   - Todo list component
   - Form component`;

      const steps = parser.extractSteps(response);
      
      expect(steps).toHaveLength(2);
      expect(steps[0].name).toBe('Setup Project');
      expect(steps[0].description).toBe('Initialize the project structure');
      expect(steps[1].name).toBe('Create Components');
    });

    test('should parse structured lists', () => {
      const response = `## Project Structure
- /src
  - /components
    - Header.js
    - TodoList.js
  - /styles
    - main.css
- /public
  - index.html`;

      const structure = parser.parseStructure(response);
      
      expect(structure).toHaveLength(2);
      expect(structure[0].name).toBe('/src');
      expect(structure[0].children).toHaveLength(2);
      expect(structure[0].children[0].name).toBe('/components');
    });
  });

  describe('Validation', () => {
    test('should validate required fields', () => {
      const schema = {
        name: { required: true, type: 'string' },
        steps: { required: true, type: 'array' }
      };

      const validData = { name: 'Test', steps: [] };
      const invalidData = { name: 'Test' };

      expect(parser.validate(validData, schema)).toBe(true);
      expect(parser.validate(invalidData, schema)).toBe(false);
    });

    test('should validate with custom validators', () => {
      const schema = {
        steps: {
          required: true,
          type: 'array',
          validator: (value) => value.length > 0
        }
      };

      expect(parser.validate({ steps: ['step1'] }, schema)).toBe(true);
      expect(parser.validate({ steps: [] }, schema)).toBe(false);
    });

    test('should return validation errors', () => {
      const schema = {
        name: { required: true },
        version: { required: true, pattern: /^\d+\.\d+\.\d+$/ }
      };

      const errors = parser.getValidationErrors(
        { version: '1.0' },
        schema
      );

      expect(errors).toHaveLength(2);
      expect(errors[0].field).toBe('name');
      expect(errors[0].error).toContain('required');
      expect(errors[1].field).toBe('version');
      expect(errors[1].error).toContain('pattern');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON', () => {
      const response = '{invalid json}';
      
      expect(() => {
        parser.parse(response, { throwOnError: true });
      }).toThrow();

      const result = parser.parse(response, { throwOnError: false });
      expect(result).toBeNull();
    });

    test('should handle empty responses', () => {
      expect(parser.parse('')).toBeNull();
      expect(parser.parse(null)).toBeNull();
      expect(parser.parse(undefined)).toBeNull();
    });

    test('should provide error details', () => {
      const response = '{"unclosed": ';
      const result = parser.parseWithErrors(response);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('JSON');
    });
  });

  describe('Transformation', () => {
    test('should transform parsed data', () => {
      const response = '{"firstName": "John", "lastName": "Doe"}';
      const transformed = parser.parse(response, {
        transform: (data) => ({
          fullName: `${data.firstName} ${data.lastName}`
        })
      });

      expect(transformed.fullName).toBe('John Doe');
    });

    test('should apply field mappings', () => {
      const response = '{"title": "My Plan", "tasks": [{"name": "Task 1"}]}';
      const mapped = parser.parse(response, {
        fieldMap: {
          title: 'name',
          tasks: 'steps'
        }
      });

      expect(mapped.name).toBe('My Plan');
      expect(mapped.steps).toHaveLength(1);
    });

    test('should normalize data', () => {
      const response = `{
        "name": "  Test Plan  ",
        "steps": [
          {"id": "STEP-1", "name": "step one"}
        ]
      }`;

      const normalized = parser.parse(response, {
        normalize: true
      });

      expect(normalized.name).toBe('Test Plan');
      expect(normalized.steps[0].id).toBe('step-1');
      expect(normalized.steps[0].name).toBe('Step One');
    });
  });

  describe('Advanced Parsing', () => {
    test('should parse nested structures', () => {
      const response = `{
        "plan": {
          "metadata": {
            "version": "1.0",
            "author": "AI"
          },
          "phases": [
            {
              "name": "Phase 1",
              "steps": [{"id": "1.1"}, {"id": "1.2"}]
            }
          ]
        }
      }`;

      const parsed = parser.parse(response);
      
      expect(parsed.plan.metadata.version).toBe('1.0');
      expect(parsed.plan.phases[0].steps).toHaveLength(2);
    });

    test('should merge multiple response formats', () => {
      const jsonPart = '{"name": "Plan", "version": "1.0"}';
      const textPart = `
Steps:
1. First step
2. Second step`;

      const merged = parser.mergeResponses([jsonPart, textPart]);
      
      expect(merged.name).toBe('Plan');
      expect(merged.steps).toHaveLength(2);
    });

    test('should extract code blocks', () => {
      const response = `Here's the implementation:

\`\`\`javascript
function add(a, b) {
  return a + b;
}
\`\`\`

And the test:

\`\`\`javascript
test('add function', () => {
  expect(add(1, 2)).toBe(3);
});
\`\`\``;

      const codeBlocks = parser.extractCodeBlocks(response);
      
      expect(codeBlocks).toHaveLength(2);
      expect(codeBlocks[0].language).toBe('javascript');
      expect(codeBlocks[0].code).toContain('function add');
      expect(codeBlocks[1].code).toContain('test(');
    });
  });

  describe('Streaming Support', () => {
    test('should parse streaming responses', async () => {
      const chunks = [
        '{"name": "Test',
        ' Plan", "steps": [',
        '{"id": "1"}]}'
      ];

      const stream = parser.createStreamParser();
      let result;

      for (const chunk of chunks) {
        result = await stream.parse(chunk);
      }

      expect(result.name).toBe('Test Plan');
      expect(result.steps).toHaveLength(1);
    });

    test('should handle partial JSON in stream', async () => {
      const stream = parser.createStreamParser();
      
      const partial1 = await stream.parse('{"name": "Plan"');
      expect(partial1).toBeNull(); // Not complete yet

      const partial2 = await stream.parse(', "version": "1.0"}');
      expect(partial2.name).toBe('Plan');
      expect(partial2.version).toBe('1.0');
    });
  });

  describe('Format Detection', () => {
    test('should detect response format', () => {
      expect(parser.detectFormat('{"test": true}')).toBe('json');
      expect(parser.detectFormat('# Markdown Title')).toBe('markdown');
      expect(parser.detectFormat('<plan><name>Test</name></plan>')).toBe('xml');
      expect(parser.detectFormat('name: Test\nversion: 1.0')).toBe('yaml');
      expect(parser.detectFormat('Plain text response')).toBe('text');
    });

    test('should parse based on detected format', () => {
      const jsonResponse = '{"name": "JSON Plan"}';
      const yamlResponse = 'name: YAML Plan\nversion: 1.0.0';

      const jsonParsed = parser.parseAuto(jsonResponse);
      const yamlParsed = parser.parseAuto(yamlResponse);

      expect(jsonParsed.name).toBe('JSON Plan');
      expect(yamlParsed.name).toBe('YAML Plan');
    });
  });

  describe('Custom Parsers', () => {
    test('should register custom parser', () => {
      parser.registerParser('custom', (text) => {
        const lines = text.split('\n');
        return {
          title: lines[0],
          content: lines.slice(1).join('\n')
        };
      });

      const result = parser.parse('My Title\nLine 1\nLine 2', {
        format: 'custom'
      });

      expect(result.title).toBe('My Title');
      expect(result.content).toBe('Line 1\nLine 2');
    });

    test('should chain parsers', () => {
      const response = `\`\`\`json
{"data": "  test data  "}
\`\`\``;

      const result = parser.parse(response, {
        parsers: ['markdown', 'json'],
        transform: (data) => ({
          ...data,
          data: data.data.trim()
        })
      });

      expect(result.data).toBe('test data');
    });
  });
});