/**
 * Tests for configuration management
 */

import { jest } from '@jest/globals';

// Mock fs module
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync
}));

// Import after mocking
const { loadConfig, getConfigValue, validateConfig } = await import('../../../src/utils/config.js');

describe('Configuration Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    // Clear test-specific env vars that might interfere  
    delete process.env.DEBUG_UI_PORT;
    delete process.env.MCP_SERVER_URL;
    delete process.env.UI_THEME;
    delete process.env.LOG_LEVEL;
    delete process.env.CONFIG_FILE;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default configuration', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = loadConfig();
      
      expect(config.server.port).toBe(3001);
      expect(config.server.host).toBe('localhost');
      expect(config.mcp.defaultUrl).toBe('ws://localhost:8080/ws');
      expect(config.ui.theme).toBe('dark');
      expect(config.logging.level).toBe('info');
    });

    it('should override with environment variables', () => {
      mockExistsSync.mockReturnValue(false);
      
      process.env.DEBUG_UI_PORT = '4000';
      process.env.MCP_SERVER_URL = 'ws://custom:9000/ws';
      process.env.UI_THEME = 'light';
      process.env.LOG_LEVEL = 'debug';
      
      const config = loadConfig();
      
      expect(config.server.port).toBe(4000);
      expect(config.mcp.defaultUrl).toBe('ws://custom:9000/ws');
      expect(config.ui.theme).toBe('light');
      expect(config.logging.level).toBe('debug');
    });

    it('should load and merge config file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        server: { port: 5000 },
        ui: { theme: 'custom', newOption: true }
      }));
      
      const config = loadConfig();
      
      expect(config.server.port).toBe(5000);
      expect(config.ui.theme).toBe('custom');
      expect(config.ui.newOption).toBe(true);
      expect(config.ui.autoConnect).toBe(true); // Default preserved
    });

    it('should handle invalid config file gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');
      
      const config = loadConfig();
      
      // Should fall back to defaults
      expect(config.server.port).toBe(3001);
    });

    it('should respect CONFIG_FILE environment variable', () => {
      process.env.CONFIG_FILE = '/custom/path/config.json';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        server: { port: 6000 }
      }));
      
      loadConfig();
      
      expect(mockExistsSync).toHaveBeenCalledWith('/custom/path/config.json');
    });
  });

  describe('getConfigValue', () => {
    const testConfig = {
      server: {
        port: 3001,
        host: 'localhost'
      },
      ui: {
        theme: 'dark',
        nested: {
          deep: {
            value: 'found'
          }
        }
      }
    };

    it('should get top-level values', () => {
      expect(getConfigValue(testConfig, 'server')).toEqual({
        port: 3001,
        host: 'localhost'
      });
    });

    it('should get nested values with dot notation', () => {
      expect(getConfigValue(testConfig, 'server.port')).toBe(3001);
      expect(getConfigValue(testConfig, 'ui.theme')).toBe('dark');
      expect(getConfigValue(testConfig, 'ui.nested.deep.value')).toBe('found');
    });

    it('should return default value for missing paths', () => {
      expect(getConfigValue(testConfig, 'missing')).toBeUndefined();
      expect(getConfigValue(testConfig, 'missing', 'default')).toBe('default');
      expect(getConfigValue(testConfig, 'server.missing', 'default')).toBe('default');
    });

    it('should handle null/undefined config', () => {
      expect(getConfigValue(null, 'any.path', 'default')).toBe('default');
      expect(getConfigValue(undefined, 'any.path', 'default')).toBe('default');
    });
  });

  describe('validateConfig', () => {
    it('should return empty array for valid config', () => {
      const config = {
        server: { port: 3001 },
        mcp: {
          defaultUrl: 'ws://localhost:8080/ws',
          reconnectInterval: 1000,
          maxReconnectAttempts: 5
        }
      };
      
      const errors = validateConfig(config);
      expect(errors).toEqual([]);
    });

    it('should validate port range', () => {
      const config1 = { server: { port: 0 } };
      const config2 = { server: { port: 70000 } };
      const config3 = { server: { port: 8080 } };
      
      expect(validateConfig(config1)).toContain('Invalid server port');
      expect(validateConfig(config2)).toContain('Invalid server port');
      expect(validateConfig(config3)).toEqual([]);
    });

    it('should validate WebSocket URL format', () => {
      const config1 = { 
        server: { port: 3001 },
        mcp: { defaultUrl: 'http://localhost:8080' }
      };
      const config2 = { 
        server: { port: 3001 },
        mcp: { defaultUrl: 'ws://localhost:8080/ws' }
      };
      const config3 = { 
        server: { port: 3001 },
        mcp: { defaultUrl: 'wss://localhost:8080/ws' }
      };
      
      expect(validateConfig(config1)).toContain('MCP server URL must start with ws:// or wss://');
      expect(validateConfig(config2)).toEqual([]);
      expect(validateConfig(config3)).toEqual([]);
    });

    it('should validate numeric constraints', () => {
      const config = {
        server: { port: 3001 },
        mcp: {
          defaultUrl: 'ws://localhost:8080/ws',
          reconnectInterval: 50, // Too low
          maxReconnectAttempts: -1 // Negative
        }
      };
      
      const errors = validateConfig(config);
      expect(errors).toContain('Reconnect interval must be at least 100ms');
      expect(errors).toContain('Max reconnect attempts must be non-negative');
    });

    it('should collect all validation errors', () => {
      const config = {
        server: { port: 0 },
        mcp: {
          defaultUrl: 'invalid',
          reconnectInterval: 50,
          maxReconnectAttempts: -1
        }
      };
      
      const errors = validateConfig(config);
      expect(errors.length).toBe(4);
    });
  });
});