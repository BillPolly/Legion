/**
 * Unit tests for ComputerUseAgent
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseAgent } from '../../src/ComputerUseAgent.js';

describe('ComputerUseAgent', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  describe('Constructor', () => {
    test('should create agent with default options', () => {
      const agent = new ComputerUseAgent(resourceManager);

      expect(agent.options.headless).toBe(false);
      expect(agent.options.width).toBe(1440);
      expect(agent.options.height).toBe(900);
      expect(agent.options.maxTurns).toBe(30);
    });

    test('should create agent with custom options', () => {
      const agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        width: 1024,
        height: 768,
        maxTurns: 10,
      });

      expect(agent.options.headless).toBe(true);
      expect(agent.options.width).toBe(1024);
      expect(agent.options.height).toBe(768);
      expect(agent.options.maxTurns).toBe(10);
    });

    test('should validate options with schema', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, {
          width: 'invalid',
        });
      }).toThrow();
    });

    test('should generate unique session ID', () => {
      const agent1 = new ComputerUseAgent(resourceManager);
      const agent2 = new ComputerUseAgent(resourceManager);

      expect(agent1.sessionId).not.toBe(agent2.sessionId);
    });

    test('should set output directory', () => {
      const agent = new ComputerUseAgent(resourceManager, {
        outDir: 'test_output',
      });

      expect(agent.outDir).toContain('test_output');
      expect(agent.outDir).toContain(agent.sessionId);
    });
  });

  describe('Options Validation', () => {
    test('should accept valid headless option', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, { headless: true });
      }).not.toThrow();

      expect(() => {
        new ComputerUseAgent(resourceManager, { headless: false });
      }).not.toThrow();
    });

    test('should accept valid dimension options', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, { width: 1920, height: 1080 });
      }).not.toThrow();
    });

    test('should accept valid start URL', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, { startUrl: 'https://example.com' });
      }).not.toThrow();
    });

    test('should accept valid maxTurns', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, { maxTurns: 50 });
      }).not.toThrow();
    });

    test('should accept excluded actions array', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, { excludedActions: ['drag_and_drop'] });
      }).not.toThrow();
    });

    test('should accept allowlist hosts array', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, { allowlistHosts: ['example.com'] });
      }).not.toThrow();
    });

    test('should accept time budget options', () => {
      expect(() => {
        new ComputerUseAgent(resourceManager, {
          stepTimeBudgetMs: 30000,
          totalTimeBudgetMs: 300000,
        });
      }).not.toThrow();
    });
  });

  describe('Function Call Extraction', () => {
    test('should extract function calls from response', () => {
      const agent = new ComputerUseAgent(resourceManager);

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'click_at',
                    args: { x: 500, y: 500 },
                  },
                },
                {
                  functionCall: {
                    name: 'type_text_at',
                    args: { x: 100, y: 200, text: 'hello' },
                  },
                },
              ],
            },
          },
        ],
      };

      const calls = agent.extractFunctionCalls(mockResponse);

      expect(calls).toHaveLength(2);
      expect(calls[0].name).toBe('click_at');
      expect(calls[1].name).toBe('type_text_at');
    });

    test('should return empty array if no function calls', () => {
      const agent = new ComputerUseAgent(resourceManager);

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Task completed' }],
            },
          },
        ],
      };

      const calls = agent.extractFunctionCalls(mockResponse);

      expect(calls).toHaveLength(0);
    });

    test('should handle missing candidates', () => {
      const agent = new ComputerUseAgent(resourceManager);

      const mockResponse = {
        candidates: [],
      };

      const calls = agent.extractFunctionCalls(mockResponse);

      expect(calls).toHaveLength(0);
    });
  });

  describe('Safety Confirmation Check', () => {
    test('should detect safety confirmation requirement', () => {
      const agent = new ComputerUseAgent(resourceManager);

      const mockResponse = {
        safetyDecision: {
          requireConfirmation: true,
        },
      };

      const result = agent.hasSafetyRequireConfirmation(mockResponse);

      expect(result).toBe(true);
    });

    test('should return false if no safety confirmation needed', () => {
      const agent = new ComputerUseAgent(resourceManager);

      const mockResponse = {
        safetyDecision: {
          requireConfirmation: false,
        },
      };

      const result = agent.hasSafetyRequireConfirmation(mockResponse);

      expect(result).toBe(false);
    });

    test('should check candidate safety decision', () => {
      const agent = new ComputerUseAgent(resourceManager);

      const mockResponse = {
        candidates: [
          {
            safetyDecision: {
              requireConfirmation: true,
            },
          },
        ],
      };

      const result = agent.hasSafetyRequireConfirmation(mockResponse);

      expect(result).toBe(true);
    });
  });

  describe('Logger', () => {
    test('should have logger methods', () => {
      const agent = new ComputerUseAgent(resourceManager);

      expect(agent.logger).toBeDefined();
      expect(typeof agent.logger.log).toBe('function');
    });
  });

  describe('Redaction', () => {
    test('should use default redaction (no-op)', () => {
      const agent = new ComputerUseAgent(resourceManager);

      // redact is optional, check if it exists
      if (agent.options.redact) {
        const redact = agent.options.redact;
        expect(redact('sensitive data')).toBe('sensitive data');
      } else {
        // If not provided, that's also valid
        expect(agent.options.redact).toBeUndefined();
      }
    });

    test('should use custom redaction function', () => {
      const agent = new ComputerUseAgent(resourceManager, {
        redact: (s) => s.replace(/secret/g, '***'),
      });

      const redact = agent.options.redact;
      expect(redact('my secret password')).toBe('my *** password');
    });
  });
});
