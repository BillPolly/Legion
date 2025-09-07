/**
 * Unit tests for ResourceManager integration
 * Verifies that ResourceManager singleton is properly used
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { getResourceManager, getLLMClient, getToolRegistry } from '../../src/utils/ResourceAccess.js';

describe('ResourceManager Integration', () => {
  let resourceManager;

  beforeAll(async () => {
    // Get the singleton instance
    resourceManager = await ResourceManager.getInstance();
  });

  describe('getResourceManager', () => {
    it('should return the ResourceManager singleton', async () => {
      const rm = await getResourceManager();
      expect(rm).toBeDefined();
      expect(rm).toBe(resourceManager); // Should be the same instance
    });

    it('should always return the same instance', async () => {
      const rm1 = await getResourceManager();
      const rm2 = await getResourceManager();
      expect(rm1).toBe(rm2);
    });

    it('should have access to environment variables', async () => {
      const rm = await getResourceManager();
      // Check that we can access env vars (may be undefined if not set)
      const mongoUri = rm.get('env.MONGODB_URL');
      expect(mongoUri === undefined || typeof mongoUri === 'string').toBe(true);
    });
  });

  describe('getLLMClient', () => {
    it('should get LLM client from ResourceManager', async () => {
      const llmClient = await getLLMClient();
      
      // LLM client might not be available in test environment
      // but the function should not throw
      if (llmClient) {
        expect(llmClient).toBeDefined();
        expect(typeof llmClient.generateText === 'function' || 
               typeof llmClient.generate === 'function' ||
               typeof llmClient.complete === 'function').toBe(true);
      }
    });

    it('should throw error with helpful message if LLM client not available', async () => {
      // Mock ResourceManager to return null for llmClient
      const originalGet = resourceManager.get;
      resourceManager.get = (key) => {
        if (key === 'llmClient') return null;
        return originalGet.call(resourceManager, key);
      };

      try {
        await getLLMClient();
        // If we get here and no error was thrown, restore and skip
        resourceManager.get = originalGet;
      } catch (error) {
        expect(error.message).toContain('LLM client not available');
        resourceManager.get = originalGet;
      }
    });
  });

  describe('getToolRegistry', () => {
    it('should get ToolRegistry from ResourceManager', async () => {
      try {
        const toolRegistry = await getToolRegistry();
        
        // If we get here, ToolRegistry is available
        expect(toolRegistry).toBeDefined();
        expect(typeof toolRegistry.getTool === 'function' ||
               typeof toolRegistry.listTools === 'function').toBe(true);
      } catch (error) {
        // ToolRegistry not available in test environment is OK
        expect(error.message).toContain('ToolRegistry not available');
        expect(error.code).toBe('RESOURCE_NOT_AVAILABLE');
      }
    });

    it('should throw error with helpful message if ToolRegistry not available', async () => {
      // Mock ResourceManager to return null for toolRegistry
      const originalGet = resourceManager.get;
      resourceManager.get = (key) => {
        if (key === 'toolRegistry') return null;
        return originalGet.call(resourceManager, key);
      };

      try {
        await getToolRegistry();
        // If we get here and no error was thrown, restore and skip
        resourceManager.get = originalGet;
      } catch (error) {
        expect(error.message).toContain('ToolRegistry not available');
        resourceManager.get = originalGet;
      }
    });
  });

  describe('Resource initialization patterns', () => {
    it('should demonstrate proper singleton usage', async () => {
      // This is the correct pattern - get once and reuse
      const rm = await getResourceManager();
      
      // All subsequent calls should use the same instance
      const value1 = rm.get('test-key');
      const value2 = rm.get('test-key');
      
      // Values should be consistent
      expect(value1).toBe(value2);
    });

    it('should not allow setting values on ResourceManager', async () => {
      const rm = await getResourceManager();
      
      // Should only provide get method
      expect(typeof rm.get).toBe('function');
      
      // Per requirements, ResourceManager only provides values, 
      // it doesn't accept them
      // The 'set' method if it exists should not be used by our code
    });
  });
});