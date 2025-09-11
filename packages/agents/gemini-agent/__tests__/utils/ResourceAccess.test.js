/**
 * Integration tests for ResourceAccess utilities
 */

import { jest } from '@jest/globals';
import { getResourceManager, getEnvVar, getSimplePromptClient, getLLMClient } from '../../src/utils/ResourceAccess.js';
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

  describe('getSimplePromptClient', () => {
    test('should get SimplePromptClient through ResourceManager', async () => {
      // Mock the ResourceManager to avoid dependency issues
      const mockSimpleClient = { request: () => Promise.resolve('mock') };
      resourceManager.get = jest.fn().mockImplementation((key) => {
        if (key === 'simplePromptClient') {
          return Promise.resolve(mockSimpleClient);
        }
        return Promise.resolve('mock-value');
      });
      
      const result = await getSimplePromptClient();
      expect(result).toBe(mockSimpleClient);
      expect(resourceManager.get).toHaveBeenCalledWith('simplePromptClient');
    });
  });

  describe('getLLMClient (deprecated)', () => {
    test('should still work but show deprecation warning', async () => {
      // Mock console.warn to capture deprecation warning
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      // Mock the ResourceManager
      resourceManager.get = jest.fn().mockResolvedValue({ request: () => {} });
      
      const result = await getLLMClient();
      
      expect(result).toBeDefined();
      expect(console.warn).toHaveBeenCalledWith('getLLMClient() is deprecated, use getSimplePromptClient() instead');
      
      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});