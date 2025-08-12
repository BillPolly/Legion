/**
 * Unit tests for Sidewinder class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Sidewinder } from '../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Sidewinder Class', () => {
  let sidewinder;

  afterEach(() => {
    sidewinder = null;
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      sidewinder = new Sidewinder();
      
      expect(sidewinder.config.wsPort).toBe(9898);
      expect(sidewinder.config.wsHost).toBe('localhost');
      expect(sidewinder.config.profile).toBe('standard');
      expect(sidewinder.config.debug).toBe(false);
    });

    it('should accept custom configuration', () => {
      sidewinder = new Sidewinder({
        wsPort: 8888,
        wsHost: '127.0.0.1',
        sessionId: 'test-session',
        profile: 'minimal',
        debug: true
      });
      
      expect(sidewinder.config.wsPort).toBe(8888);
      expect(sidewinder.config.wsHost).toBe('127.0.0.1');
      expect(sidewinder.config.sessionId).toBe('test-session');
      expect(sidewinder.config.profile).toBe('minimal');
      expect(sidewinder.config.debug).toBe(true);
    });

    it('should generate sessionId if not provided', () => {
      sidewinder = new Sidewinder();
      
      expect(sidewinder.config.sessionId).toMatch(/^sw-\d+$/);
    });
  });

  describe('Profiles', () => {
    it('should have predefined profiles', () => {
      sidewinder = new Sidewinder();
      
      expect(sidewinder.profiles.minimal).toEqual(['console', 'errors']);
      expect(sidewinder.profiles.standard).toEqual(['console', 'errors', 'http', 'async']);
      expect(sidewinder.profiles.full).toEqual(['console', 'errors', 'http', 'async', 'memory', 'modules', 'eventloop']);
    });

    it('should use custom hooks when provided', () => {
      sidewinder = new Sidewinder({
        hooks: ['console', 'custom-hook']
      });
      
      expect(sidewinder.profiles.custom).toEqual(['console', 'custom-hook']);
    });
  });

  describe('Path Methods', () => {
    it('should return inject script path', () => {
      sidewinder = new Sidewinder();
      const injectPath = sidewinder.getInjectPath();
      
      expect(injectPath).toContain('inject.cjs');
      expect(path.isAbsolute(injectPath)).toBe(true);
    });

    it('should return loader script path', () => {
      sidewinder = new Sidewinder();
      const loaderPath = sidewinder.getLoaderPath();
      
      expect(loaderPath).toContain('loader.mjs');
      expect(path.isAbsolute(loaderPath)).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should generate environment variables for standard profile', () => {
      sidewinder = new Sidewinder({
        wsPort: 7777,
        wsHost: 'test-host',
        sessionId: 'env-test',
        profile: 'standard'
      });
      
      const env = sidewinder.getEnvironmentVariables();
      
      expect(env.SIDEWINDER_WS_PORT).toBe('7777');
      expect(env.SIDEWINDER_WS_HOST).toBe('test-host');
      expect(env.SIDEWINDER_SESSION_ID).toBe('env-test');
      expect(env.SIDEWINDER_PROFILE).toBe('standard');
      expect(env.SIDEWINDER_HOOKS).toBe('console,errors,http,async');
      expect(env.SIDEWINDER_DEBUG).toBe('false');
    });

    it('should include optional configuration in environment', () => {
      sidewinder = new Sidewinder({
        captureBody: true,
        captureHeaders: false,
        maxBodySize: 5000,
        trackResources: true,
        trackErrorCreation: true,
        trackPromises: true
      });
      
      const env = sidewinder.getEnvironmentVariables();
      
      expect(env.SIDEWINDER_CAPTURE_BODY).toBe('true');
      expect(env.SIDEWINDER_CAPTURE_HEADERS).toBe('false');
      expect(env.SIDEWINDER_MAX_BODY_SIZE).toBe('5000');
      expect(env.SIDEWINDER_TRACK_RESOURCES).toBe('true');
      expect(env.SIDEWINDER_TRACK_ERROR_CREATION).toBe('true');
      expect(env.SIDEWINDER_TRACK_PROMISES).toBe('true');
    });

    it('should handle custom hooks array', () => {
      sidewinder = new Sidewinder({
        hooks: ['console', 'errors', 'custom']
      });
      
      const env = sidewinder.getEnvironmentVariables();
      
      expect(env.SIDEWINDER_HOOKS).toBe('console,errors,custom');
    });
  });

  describe('Hook Validation', () => {
    it('should validate standard hooks exist', async () => {
      sidewinder = new Sidewinder({
        profile: 'minimal'
      });
      
      const result = await sidewinder.validateHooks();
      expect(result).toBe(true);
    });

    it('should throw error for non-existent hooks', async () => {
      sidewinder = new Sidewinder({
        hooks: ['console', 'non-existent-hook']
      });
      
      await expect(sidewinder.validateHooks()).rejects.toThrow(/Hook validation failed/);
    });
  });

  describe('Additional Configuration', () => {
    it('should generate additional config for capture options', () => {
      sidewinder = new Sidewinder({
        captureBody: true,
        captureHeaders: false,
        maxBodySize: 10000
      });
      
      const config = sidewinder.generateAdditionalConfig();
      
      expect(config).toContain("process.env.SIDEWINDER_CAPTURE_BODY = 'true'");
      expect(config).toContain("process.env.SIDEWINDER_CAPTURE_HEADERS = 'false'");
      expect(config).toContain("process.env.SIDEWINDER_MAX_BODY_SIZE = '10000'");
    });

    it('should generate additional config for tracking options', () => {
      sidewinder = new Sidewinder({
        trackResources: true,
        trackErrorCreation: true,
        trackPromises: true
      });
      
      const config = sidewinder.generateAdditionalConfig();
      
      expect(config).toContain("process.env.SIDEWINDER_TRACK_RESOURCES = 'true'");
      expect(config).toContain("process.env.SIDEWINDER_TRACK_ERROR_CREATION = 'true'");
      expect(config).toContain("process.env.SIDEWINDER_TRACK_PROMISES = 'true'");
    });

    it('should return empty string for no additional config', () => {
      sidewinder = new Sidewinder();
      
      const config = sidewinder.generateAdditionalConfig();
      
      expect(config).toBe('');
    });
  });
});