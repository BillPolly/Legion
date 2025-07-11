/**
 * Integration tests for Serper Tool with live API calls
 */

import { jest } from '@jest/globals';
import Serper from '../../src/serper/index.js';
import { createMockToolCall, validateToolResult, skipIfMissingEnv } from '../utils/test-helpers.js';
import { canRunIntegrationTests } from '../utils/env-setup.js';

describe('Serper Live Integration Tests', () => {
  let serper;

  beforeAll(() => {
    if (skipIfMissingEnv(['SERPER'])) {
      return;
    }
  });

  beforeEach(() => {
    if (!canRunIntegrationTests()) {
      return;
    }
    serper = new Serper();
  });

  describe('live API calls', () => {
    test('should perform real Google search', async () => {
      if (skipIfMissingEnv(['SERPER'])) return;

      await serper.initialize({ apiKey: process.env.SERPER });

      const toolCall = createMockToolCall('google_search_search', { 
        query: 'OpenAI GPT',
        num: 5
      });
      const result = await serper.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.query).toBe('OpenAI GPT');
      expect(Array.isArray(result.data.organic)).toBe(true);
      expect(result.data.organic.length).toBeGreaterThan(0);
      
      // Check that results have required fields
      const firstResult = result.data.organic[0];
      expect(firstResult).toHaveProperty('title');
      expect(firstResult).toHaveProperty('link');
      expect(firstResult).toHaveProperty('snippet');
    }, 15000);

    test('should handle date range filtering', async () => {
      if (skipIfMissingEnv(['SERPER'])) return;

      await serper.initialize({ apiKey: process.env.SERPER });

      const toolCall = createMockToolCall('google_search_search', { 
        query: 'JavaScript tutorial',
        dateRange: 'month',
        num: 3
      });
      const result = await serper.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.organic.length).toBeLessThanOrEqual(3);
    }, 15000);

    test('should handle search with no results gracefully', async () => {
      if (skipIfMissingEnv(['SERPER'])) return;

      await serper.initialize({ apiKey: process.env.SERPER });

      const toolCall = createMockToolCall('google_search_search', { 
        query: 'xkqwjdlaskjdlaksjdlkajsdlkajsldk', // Very unlikely to have results
        num: 5
      });
      const result = await serper.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.organic)).toBe(true);
      // May have 0 results, which is fine
    }, 15000);

    test('should handle API rate limiting gracefully', async () => {
      if (skipIfMissingEnv(['SERPER'])) return;

      await serper.initialize({ apiKey: process.env.SERPER });

      // Make multiple rapid requests to potentially trigger rate limiting
      const promises = [];\n      for (let i = 0; i < 3; i++) {\n        const toolCall = createMockToolCall('google_search_search', { \n          query: `test query ${i}`,\n          num: 2\n        });\n        promises.push(serper.invoke(toolCall));\n      }\n\n      const results = await Promise.all(promises);\n      \n      // At least some should succeed, even if rate limited\n      const successCount = results.filter(r => r.success).length;\n      expect(successCount).toBeGreaterThan(0);\n    }, 30000);\n\n    test('should fail gracefully with invalid API key', async () => {\n      const invalidSerper = new Serper();\n      await invalidSerper.initialize({ apiKey: 'invalid-key-12345' });\n\n      const toolCall = createMockToolCall('google_search_search', { \n        query: 'test query'\n      });\n      const result = await invalidSerper.invoke(toolCall);\n\n      validateToolResult(result);\n      expect(result.success).toBe(false);\n      expect(result.data.errorType).toBe('api_error');\n      expect(result.data.statusCode).toBe(401);\n    }, 15000);\n  });\n});