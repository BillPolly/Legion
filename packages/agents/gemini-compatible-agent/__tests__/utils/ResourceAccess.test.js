/**
 * Unit tests for ResourceAccess utilities
 */

import { jest } from '@jest/globals';
import { getResourceManager, getEnvVar, getLLMClient } from '../../src/utils/ResourceAccess.js';

// Mock ResourceManager
const mockResourceManager = {
  get: jest.fn(),
};

jest.unstable_mockModule('@legion/resource-manager', () => ({
  ResourceManager: {
    getInstance: jest.fn().mockResolvedValue(mockResourceManager)
  }
}));

describe('ResourceAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getResourceManager', () => {
    test('should return ResourceManager singleton instance', async () => {
      const result = await getResourceManager();
      
      expect(result).toBe(mockResourceManager);
      expect(mockResourceManager.get).not.toHaveBeenCalled();
    });
  });

  describe('getEnvVar', () => {
    test('should get environment variable through ResourceManager', async () => {
      const testValue = 'test-value';
      mockResourceManager.get.mockResolvedValue(testValue);
      
      const result = await getEnvVar('TEST_KEY');
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.TEST_KEY', null);
      expect(result).toBe(testValue);
    });

    test('should use default value when provided', async () => {
      const defaultValue = 'default-value';
      mockResourceManager.get.mockResolvedValue(defaultValue);
      
      const result = await getEnvVar('TEST_KEY', defaultValue);
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.TEST_KEY', defaultValue);
      expect(result).toBe(defaultValue);
    });
  });

  describe('getLLMClient', () => {
    test('should get LLM client through ResourceManager', async () => {
      const mockLLMClient = { sendMessage: jest.fn() };
      mockResourceManager.get.mockResolvedValue(mockLLMClient);
      
      const result = await getLLMClient();
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('llmClient');
      expect(result).toBe(mockLLMClient);
    });
  });
});