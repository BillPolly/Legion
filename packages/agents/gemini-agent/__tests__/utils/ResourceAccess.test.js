/**
 * Integration tests for ResourceAccess utilities
 * Uses real ResourceManager - no mocks to avoid jest.fn() issues
 */

import { getResourceManager, getEnvVar, getLLMClient } from '../../src/utils/ResourceAccess.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ResourceAccess', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  describe('getResourceManager', () => {
    test('should return ResourceManager singleton instance', async () => {
      const result = await getResourceManager();
      
      expect(result).toBe(resourceManager);
      expect(typeof result.get).toBe('function');
    });
  });

  describe('getEnvVar', () => {
    test('should get environment variable through ResourceManager', async () => {
      // Test with a real environment variable that should exist
      const result = await getEnvVar('NODE_ENV', 'test');
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle non-existent environment variables', async () => {
      const defaultValue = 'default-test-value';
      const result = await getEnvVar('NON_EXISTENT_TEST_VAR_12345', defaultValue);
      
      // ResourceManager may return undefined or the default value
      expect(result === defaultValue || result === undefined).toBe(true);
    });
  });

  describe('getLLMClient', () => {
    test('should get LLM client through ResourceManager', async () => {
      const result = await getLLMClient();
      
      // Should return the LLM client from ResourceManager
      expect(result).toBeDefined();
      // The result should be whatever ResourceManager provides
    });
  });
});