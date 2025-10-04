import { ProgramGenerator } from '../../../src/reasoning/ProgramGenerator.js';

describe('ProgramGenerator - Retry Logic', () => {
  describe('regenerate()', () => {
    test('should retry with error feedback', async () => {
      let attempt = 0;
      const llmClient = {
        complete: async (prompt) => {
          attempt++;
          if (attempt === 1) {
            // First attempt: invalid JSON
            return '{ invalid }';
          } else {
            // Second attempt: valid program
            return JSON.stringify({
              variables: [{ name: 'x', sort: 'Int' }],
              constraints: [],
              query: { type: 'check-sat' }
            });
          }
        }
      };

      const generator = new ProgramGenerator(llmClient);

      const firstResult = await generator.generate('test');
      expect(firstResult.success).toBe(false);

      const retryResult = await generator.regenerate('test', firstResult.error);
      expect(retryResult.success).toBe(true);
      expect(attempt).toBe(2);
    });

    test('should include error feedback in retry prompt', async () => {
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
      await generator.regenerate('test', 'Previous error: invalid JSON');

      expect(capturedPrompt).toContain('Previous error');
      expect(capturedPrompt).toContain('invalid JSON');
    });

    test('should pass context to regenerate', async () => {
      const llmClient = {
        complete: async () => JSON.stringify({
          variables: [],
          constraints: [],
          query: { type: 'check-sat' }
        })
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.regenerate('test', 'error', { extra: 'data' });

      expect(result.success).toBe(true);
    });
  });

  describe('generateWithRetry()', () => {
    test('should retry automatically on failure', async () => {
      let attempt = 0;
      const llmClient = {
        complete: async () => {
          attempt++;
          if (attempt === 1) {
            return '{ invalid }';
          } else {
            return JSON.stringify({
              variables: [],
              constraints: [],
              query: { type: 'check-sat' }
            });
          }
        }
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generateWithRetry('test', {}, 3);

      expect(result.success).toBe(true);
      expect(attempt).toBe(2);
    });

    test('should respect max retries', async () => {
      let attempt = 0;
      const llmClient = {
        complete: async () => {
          attempt++;
          return '{ invalid }';
        }
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generateWithRetry('test', {}, 3);

      expect(result.success).toBe(false);
      expect(attempt).toBe(3); // Initial + 2 retries
    });

    test('should succeed on first try if valid', async () => {
      let attempt = 0;
      const llmClient = {
        complete: async () => {
          attempt++;
          return JSON.stringify({
            variables: [],
            constraints: [],
            query: { type: 'check-sat' }
          });
        }
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generateWithRetry('test', {}, 3);

      expect(result.success).toBe(true);
      expect(attempt).toBe(1);
    });

    test('should include retry count in result', async () => {
      let attempt = 0;
      const llmClient = {
        complete: async () => {
          attempt++;
          if (attempt < 3) {
            return '{ invalid }';
          }
          return JSON.stringify({
            variables: [],
            constraints: [],
            query: { type: 'check-sat' }
          });
        }
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generateWithRetry('test', {}, 5);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    test('should use default max retries if not specified', async () => {
      let attempt = 0;
      const llmClient = {
        complete: async () => {
          attempt++;
          return '{ invalid }';
        }
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generateWithRetry('test');

      expect(result.success).toBe(false);
      expect(attempt).toBeGreaterThan(0);
    });
  });

  describe('Error Aggregation', () => {
    test('should collect all errors from retries', async () => {
      const llmClient = {
        complete: async () => '{ invalid }'
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generateWithRetry('test', {}, 3);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBe(3);
    });

    test('should show progression of errors', async () => {
      let attempt = 0;
      const llmClient = {
        complete: async () => {
          attempt++;
          if (attempt === 1) return '{ invalid }';
          if (attempt === 2) return JSON.stringify({ variables: [] }); // Missing fields
          return '{ also invalid }';
        }
      };

      const generator = new ProgramGenerator(llmClient);
      const result = await generator.generateWithRetry('test', {}, 3);

      expect(result.errors.length).toBe(3);
      expect(result.errors[0]).toContain('JSON');
      expect(result.errors[1]).toContain('validation');
    });
  });
});
