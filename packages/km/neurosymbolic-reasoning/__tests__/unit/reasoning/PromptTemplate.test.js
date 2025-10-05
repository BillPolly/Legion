import { PromptTemplate } from '../../../src/reasoning/PromptTemplate.js';

describe('PromptTemplate', () => {
  describe('Constructor', () => {
    test('should create instance with template string', () => {
      const template = new PromptTemplate('Hello {{name}}');
      expect(template).toBeInstanceOf(PromptTemplate);
    });

    test('should create instance with examples', () => {
      const examples = [
        { input: 'test', output: 'result' }
      ];
      const template = new PromptTemplate('Template', examples);
      expect(template.examples).toEqual(examples);
    });
  });

  describe('render()', () => {
    test('should render template with single variable', () => {
      const template = new PromptTemplate('Hello {{name}}!');
      const result = template.render({ name: 'World' });
      expect(result).toBe('Hello World!');
    });

    test('should render template with multiple variables', () => {
      const template = new PromptTemplate('{{greeting}} {{name}}, you are {{age}} years old.');
      const result = template.render({
        greeting: 'Hello',
        name: 'Alice',
        age: 30
      });
      expect(result).toBe('Hello Alice, you are 30 years old.');
    });

    test('should handle missing variables', () => {
      const template = new PromptTemplate('Hello {{name}}!');
      const result = template.render({});
      expect(result).toBe('Hello {{name}}!'); // Unchanged
    });

    test('should render with no variables', () => {
      const template = new PromptTemplate('Static text');
      const result = template.render({});
      expect(result).toBe('Static text');
    });

    test('should preserve whitespace', () => {
      const template = new PromptTemplate('Line 1\n\nLine 2\n  Indented');
      const result = template.render({});
      expect(result).toBe('Line 1\n\nLine 2\n  Indented');
    });

    test('should handle special characters in variables', () => {
      const template = new PromptTemplate('Value: {{value}}');
      const result = template.render({ value: 'x > 5 && y < 10' });
      expect(result).toBe('Value: x > 5 && y < 10');
    });

    test('should handle JSON in variables', () => {
      const template = new PromptTemplate('Data: {{json}}');
      const result = template.render({
        json: JSON.stringify({ x: 5, y: 10 })
      });
      expect(result).toContain('"x":5');
    });
  });

  describe('addExample()', () => {
    test('should add single example', () => {
      const template = new PromptTemplate('Template');
      template.addExample({ input: 'test', output: 'result' });
      expect(template.examples.length).toBe(1);
      expect(template.examples[0]).toEqual({ input: 'test', output: 'result' });
    });

    test('should add multiple examples', () => {
      const template = new PromptTemplate('Template');
      template.addExample({ input: 'test1', output: 'result1' });
      template.addExample({ input: 'test2', output: 'result2' });
      expect(template.examples.length).toBe(2);
    });

    test('should allow method chaining', () => {
      const template = new PromptTemplate('Template');
      const result = template
        .addExample({ input: 'test1', output: 'result1' })
        .addExample({ input: 'test2', output: 'result2' });
      expect(result).toBe(template);
      expect(template.examples.length).toBe(2);
    });
  });

  describe('renderWithExamples()', () => {
    test('should render template with examples', () => {
      const template = new PromptTemplate(
        'Generate output for: {{input}}\n\nExamples:\n{{examples}}'
      );
      template.addExample({ input: 'test1', output: 'result1' });
      template.addExample({ input: 'test2', output: 'result2' });

      const result = template.renderWithExamples({ input: 'test3' });

      expect(result).toContain('test1');
      expect(result).toContain('result1');
      expect(result).toContain('test2');
      expect(result).toContain('result2');
      expect(result).toContain('test3');
    });

    test('should format examples as Q/A pairs', () => {
      const template = new PromptTemplate('{{examples}}\nQuestion: {{question}}');
      template.addExample({ question: 'Q1', answer: 'A1' });

      const result = template.renderWithExamples({ question: 'Q2' });

      expect(result).toContain('Q1');
      expect(result).toContain('A1');
    });

    test('should handle no examples', () => {
      const template = new PromptTemplate('Question: {{question}}');
      const result = template.renderWithExamples({ question: 'Q1' });

      expect(result).toBe('Question: Q1');
    });
  });

  describe('formatExample()', () => {
    test('should format example with custom formatter', () => {
      const template = new PromptTemplate('Template');
      template.setExampleFormatter((example, index) => {
        return `Example ${index + 1}:\nInput: ${example.input}\nOutput: ${example.output}`;
      });

      const formatted = template.formatExample({ input: 'test', output: 'result' }, 0);

      expect(formatted).toBe('Example 1:\nInput: test\nOutput: result');
    });

    test('should use default formatter if none set', () => {
      const template = new PromptTemplate('Template');
      const formatted = template.formatExample({ input: 'test', output: 'result' }, 0);

      expect(formatted).toContain('test');
      expect(formatted).toContain('result');
    });
  });

  describe('Error Handling', () => {
    test('should throw on null template', () => {
      expect(() => new PromptTemplate(null)).toThrow();
    });

    test('should throw on non-string template', () => {
      expect(() => new PromptTemplate(123)).toThrow();
    });

    test('should throw on invalid examples array', () => {
      expect(() => new PromptTemplate('Test', 'not-an-array')).toThrow();
    });
  });
});
