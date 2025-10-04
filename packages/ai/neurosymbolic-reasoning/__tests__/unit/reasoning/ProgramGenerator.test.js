import { ProgramGenerator } from '../../../src/reasoning/ProgramGenerator.js';
import { validateZ3Program } from '../../../src/schemas/z3-program-schema.js';

describe('ProgramGenerator', () => {
  // Mock LLM client
  const createMockLLM = (response) => ({
    complete: async () => response
  });

  describe('Constructor', () => {
    test('should create instance with LLM client', () => {
      const llmClient = createMockLLM('{}');
      const generator = new ProgramGenerator(llmClient);
      expect(generator).toBeInstanceOf(ProgramGenerator);
    });

    test('should throw without LLM client', () => {
      expect(() => new ProgramGenerator(null)).toThrow('LLM client is required');
    });

    test('should accept custom prompt template', () => {
      const llmClient = createMockLLM('{}');
      const customPrompt = { render: () => 'custom' };
      const generator = new ProgramGenerator(llmClient, customPrompt);
      expect(generator.promptTemplate).toBe(customPrompt);
    });
  });

  describe('generate()', () => {
    test('should generate program from simple question', async () => {
      const validProgram = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] }
        ],
        query: { type: 'check-sat' }
      };

      const llmClient = createMockLLM(JSON.stringify(validProgram));
      const generator = new ProgramGenerator(llmClient);

      const result = await generator.generate('Is x > 5?');

      expect(result.success).toBe(true);
      expect(result.program).toEqual(validProgram);
    });

    test('should strip markdown code fences from LLM output', async () => {
      const validProgram = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [],
        query: { type: 'check-sat' }
      };

      const llmResponse = `\`\`\`json\n${JSON.stringify(validProgram)}\n\`\`\``;
      const llmClient = createMockLLM(llmResponse);
      const generator = new ProgramGenerator(llmClient);

      const result = await generator.generate('test');

      expect(result.success).toBe(true);
      expect(result.program).toEqual(validProgram);
    });

    test('should handle LLM output with extra text', async () => {
      const validProgram = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [],
        query: { type: 'check-sat' }
      };

      const llmResponse = `Here is the program:\n\`\`\`json\n${JSON.stringify(validProgram)}\n\`\`\`\nHope this helps!`;
      const llmClient = createMockLLM(llmResponse);
      const generator = new ProgramGenerator(llmClient);

      const result = await generator.generate('test');

      expect(result.success).toBe(true);
    });

    test('should validate generated program', async () => {
      const invalidProgram = {
        // Missing required fields
        variables: []
      };

      const llmClient = createMockLLM(JSON.stringify(invalidProgram));
      const generator = new ProgramGenerator(llmClient);

      const result = await generator.generate('test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle malformed JSON', async () => {
      const llmClient = createMockLLM('{ invalid json }');
      const generator = new ProgramGenerator(llmClient);

      const result = await generator.generate('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    test('should include question in prompt', async () => {
      let capturedPrompt;
      const llmClient = {
        complete: async (prompt) => {
          capturedPrompt = prompt;
          return JSON.stringify({
            variables: [],
            constraints: [],
            query: { type: 'check-sat' }
          });
        }
      };

      const generator = new ProgramGenerator(llmClient);
      await generator.generate('Is x > 5?');

      expect(capturedPrompt).toContain('Is x > 5?');
    });

    test('should include context in prompt', async () => {
      let capturedPrompt;
      const llmClient = {
        complete: async (prompt) => {
          capturedPrompt = prompt;
          return JSON.stringify({
            variables: [],
            constraints: [],
            query: { type: 'check-sat' }
          });
        }
      };

      const generator = new ProgramGenerator(llmClient);
      await generator.generate('test', { additionalInfo: 'context data' });

      expect(capturedPrompt).toBeDefined();
    });
  });

  describe('_extractJSON()', () => {
    test('should extract JSON from plain response', () => {
      const generator = new ProgramGenerator(createMockLLM('{}'));
      const json = '{"test": "value"}';
      const extracted = generator._extractJSON(json);
      expect(extracted).toBe(json);
    });

    test('should extract JSON from markdown code fences', () => {
      const generator = new ProgramGenerator(createMockLLM('{}'));
      const json = '{"test": "value"}';
      const response = `\`\`\`json\n${json}\n\`\`\``;
      const extracted = generator._extractJSON(response);
      expect(extracted).toBe(json);
    });

    test('should extract JSON from generic code fences', () => {
      const generator = new ProgramGenerator(createMockLLM('{}'));
      const json = '{"test": "value"}';
      const response = `\`\`\`\n${json}\n\`\`\``;
      const extracted = generator._extractJSON(response);
      expect(extracted).toBe(json);
    });

    test('should handle multiple code fences', () => {
      const generator = new ProgramGenerator(createMockLLM('{}'));
      const json = '{"test": "value"}';
      const response = `First:\n\`\`\`json\n{"wrong": 1}\n\`\`\`\n\nActual:\n\`\`\`json\n${json}\n\`\`\``;
      const extracted = generator._extractJSON(response);
      // Should extract first JSON object found
      expect(extracted).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should handle LLM client error', async () => {
      const llmClient = {
        complete: async () => {
          throw new Error('LLM error');
        }
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generate('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM error');
    });

    test('should handle empty LLM response', async () => {
      const llmClient = createMockLLM('');
      const generator = new ProgramGenerator(llmClient);

      const result = await generator.generate('test');

      expect(result.success).toBe(false);
    });

    test('should handle null question', async () => {
      const generator = new ProgramGenerator(createMockLLM('{}'));

      await expect(generator.generate(null)).rejects.toThrow();
    });

    test('should handle empty question', async () => {
      const generator = new ProgramGenerator(createMockLLM('{}'));

      await expect(generator.generate('')).rejects.toThrow();
    });
  });
});
