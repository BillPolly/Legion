/**
 * Integration tests for configuration module with real ResourceManager
 * NO MOCKS - uses real ResourceManager and .env file
 */

import { initializeConfig, getConfig } from '../../config.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('Configuration Integration Tests', () => {
  // ResourceManager uses the main .env file, so we test with actual values
  // This is a true integration test - NO MOCKS

  beforeEach(() => {
    // Clear any singleton state
    const rm = ResourceManager.getInstance();
    if (rm._initialized) {
      rm._initialized = false;
      rm._config = {};
    }
  });

  describe('Full initialization with real ResourceManager', () => {
    it('should initialize with real ResourceManager singleton', async () => {
      const rm = await initializeConfig();
      
      expect(rm).toBe(ResourceManager.getInstance());
      expect(rm).toBeDefined();
    });

    it('should read configuration from real .env file', async () => {
      await initializeConfig();
      const config = getConfig();
      
      // Test with actual values from the real .env file
      expect(config.monorepoRoot).toBe('/Users/williampearson/Documents/p/agents/Legion-copy');
      expect(config.env).toBe('development'); // or whatever is in the actual .env
      expect(config.logLevel).toBe('info'); // default value
      expect(config.corsOrigins).toEqual(['http://localhost:3000']); // default value
      expect(config.host).toBe('localhost');
    });

    it('should get MONOREPO_ROOT from actual env', async () => {
      // In real integration test, we use the actual .env file
      await initializeConfig();
      const config = getConfig();
      
      // The actual .env has MONOREPO_ROOT set
      expect(config.monorepoRoot).toBeDefined();
      expect(config.monorepoRoot).toContain('Legion');
    });

    it('should use proper defaults for unset values', async () => {
      // Test that defaults work with real ResourceManager
      await initializeConfig();
      const config = getConfig();
      
      // These use defaults if not in .env
      expect(config.host).toBe('localhost');
      
      // If these aren't in .env, they get defaults
      if (!ResourceManager.getInstance().get('env.LOG_LEVEL')) {
        expect(config.logLevel).toBe('info');
      }
      if (!ResourceManager.getInstance().get('env.CORS_ORIGINS')) {
        expect(config.corsOrigins).toEqual(['http://localhost:3000']);
      }
    });

    it('should maintain singleton state across calls', async () => {
      const rm1 = await initializeConfig();
      const config1 = getConfig();
      
      const rm2 = await initializeConfig();
      const config2 = getConfig();
      
      expect(rm1).toBe(rm2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Error handling', () => {
    it('should handle ResourceManager initialization properly', async () => {
      // ResourceManager handles missing files gracefully
      const rm = await initializeConfig();
      expect(rm).toBeDefined();
      expect(rm).toBe(ResourceManager.getInstance());
    });
  });
});