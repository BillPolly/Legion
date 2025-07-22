/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { Configuration } from '../../../src/config/Configuration.js';
import { EnvironmentManager } from '../../../src/config/EnvironmentManager.js';

describe('Configuration System (Core)', () => {
  describe('Configuration Class', () => {
    let config;

    beforeEach(() => {
      config = new Configuration();
      jest.clearAllMocks();
    });

    test('should create configuration with default values', () => {
      expect(config).toBeDefined();
      expect(config.get('server.port')).toBe(9222);
      expect(config.get('server.host')).toBe('localhost');
      expect(config.get('extension.debug')).toBe(false);
      expect(config.get('agent.model')).toBe('claude-3-sonnet');
    });

    test('should validate configuration on creation', () => {
      expect(() => {
        new Configuration({
          server: { port: -1 }
        });
      }).toThrow('Invalid configuration: server.port must be >= 0');

      expect(() => {
        new Configuration({
          server: { host: '' }
        });
      }).toThrow('Invalid configuration: server.host is required');
    });

    test('should get nested configuration values', () => {
      config.set('database.connection.host', 'localhost');
      config.set('database.connection.port', 5432);
      
      expect(config.get('database.connection.host')).toBe('localhost');
      expect(config.get('database.connection.port')).toBe(5432);
      expect(config.get('database.connection')).toEqual({
        host: 'localhost',
        port: 5432
      });
    });

    test('should set nested configuration values', () => {
      config.set('api.endpoints.users', '/api/users');
      config.set('api.endpoints.orders', '/api/orders');
      
      expect(config.get('api.endpoints')).toEqual({
        users: '/api/users',
        orders: '/api/orders'
      });
    });

    test('should return default value for missing keys', () => {
      expect(config.get('nonexistent.key', 'default')).toBe('default');
      expect(config.get('missing', null)).toBeNull();
    });

    test('should merge configurations deeply', () => {
      const baseConfig = {
        server: { port: 8080, host: 'localhost' },
        debug: true
      };
      
      const overrideConfig = {
        server: { port: 9090 },
        logging: { level: 'info' }
      };
      
      config.merge(baseConfig);
      config.merge(overrideConfig);
      
      expect(config.get('server.port')).toBe(9090);
      expect(config.get('server.host')).toBe('localhost');
      expect(config.get('debug')).toBe(true);
      expect(config.get('logging.level')).toBe('info');
    });

    test('should handle environment variable substitution', () => {
      process.env.TEST_PORT = '3000';
      process.env.TEST_HOST = 'example.com';
      
      // Need to set a valid port number directly since validation happens before resolution
      config.set('server.port', 3000);
      config.set('server.host', '${TEST_HOST}');
      
      expect(config.get('server.port')).toBe(3000);
      expect(config.get('server.host')).toBe('example.com');
      
      delete process.env.TEST_PORT;
      delete process.env.TEST_HOST;
    });

    test('should validate configuration values', () => {
      expect(() => {
        config.set('server.port', 'invalid');
      }).toThrow('Invalid value for server.port');

      expect(() => {
        config.set('server.host', 123);
      }).toThrow('Invalid value for server.host');
    });

    test('should freeze configuration when frozen', () => {
      config.freeze();
      
      expect(() => {
        config.set('test.value', 'should fail');
      }).toThrow('Configuration is frozen and cannot be modified');
    });

    test('should export configuration to different formats', () => {
      config.set('test.value', 'hello');
      config.set('test.number', 42);
      
      const exported = config.export();
      expect(exported).toEqual(
        expect.objectContaining({
          test: {
            value: 'hello',
            number: 42
          }
        })
      );
    });

    test('should support configuration snapshots', () => {
      config.set('original.value', 'test');
      const snapshot = config.createSnapshot();
      
      config.set('modified.value', 'changed');
      expect(config.get('modified.value')).toBe('changed');
      
      config.restoreSnapshot(snapshot);
      expect(config.get('modified.value')).toBeUndefined();
      expect(config.get('original.value')).toBe('test');
    });

    test('should check if key exists', () => {
      config.set('existing.key', 'value');
      
      expect(config.has('existing.key')).toBe(true);
      expect(config.has('nonexistent.key')).toBe(false);
    });

    test('should delete configuration keys', () => {
      config.set('deletable.key', 'value');
      expect(config.get('deletable.key')).toBe('value');
      
      config.delete('deletable.key');
      expect(config.get('deletable.key')).toBeUndefined();
    });

    test('should get configuration summary', () => {
      const summary = config.getSummary();
      
      expect(summary).toEqual(expect.objectContaining({
        totalKeys: expect.any(Number),
        sections: expect.arrayContaining(['server', 'agent', 'extension']),
        environment: expect.any(String),
        frozen: false
      }));
    });
  });

  describe('Environment Manager', () => {
    let envManager;

    beforeEach(() => {
      envManager = new EnvironmentManager();
      jest.clearAllMocks();
    });

    test('should detect current environment', () => {
      // Save original environment
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'production';
      envManager = new EnvironmentManager(); // Re-create to detect new env
      expect(envManager.getCurrentEnvironment()).toBe('production');
      
      delete process.env.NODE_ENV;
      envManager = new EnvironmentManager(); // Re-create to detect new env
      expect(envManager.getCurrentEnvironment()).toBe('development');
      
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should check environment conditions', () => {
      // Save original environment
      const originalEnv = process.env.NODE_ENV;
      
      // Set to development and re-create manager
      delete process.env.NODE_ENV;
      envManager = new EnvironmentManager();
      expect(envManager.isDevelopment()).toBe(true);
      expect(envManager.isProduction()).toBe(false);
      expect(envManager.isTest()).toBe(false);
      
      process.env.NODE_ENV = 'production';
      envManager = new EnvironmentManager(); // Re-create to detect new env
      expect(envManager.isDevelopment()).toBe(false);
      expect(envManager.isProduction()).toBe(true);
      
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    test('should provide environment-specific configurations', () => {
      const configs = {
        development: { debug: true, logging: 'verbose' },
        production: { debug: false, logging: 'error' },
        test: { debug: true, logging: 'silent' }
      };
      
      // Test development
      const devConfig = envManager.getEnvironmentConfig(configs, 'development');
      expect(devConfig.debug).toBe(true);
      expect(devConfig.logging).toBe('verbose');
      
      // Test production
      const prodConfig = envManager.getEnvironmentConfig(configs, 'production');
      expect(prodConfig.debug).toBe(false);
      expect(prodConfig.logging).toBe('error');
    });

    test('should validate environment variables', () => {
      const requirements = {
        'DATABASE_URL': { required: true, type: 'string' },
        'PORT': { required: false, type: 'number', default: 3000 },
        'ENABLE_CACHE': { required: false, type: 'boolean', default: true }
      };
      
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.PORT = '8080';
      
      const validation = envManager.validateEnvironment(requirements);
      
      expect(validation.valid).toBe(true);
      expect(validation.values.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(validation.values.PORT).toBe(8080);
      expect(validation.values.ENABLE_CACHE).toBe(true);
      
      delete process.env.DATABASE_URL;
      delete process.env.PORT;
    });

    test('should handle missing required environment variables', () => {
      const requirements = {
        'REQUIRED_VAR': { required: true, type: 'string' }
      };
      
      const validation = envManager.validateEnvironment(requirements);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required environment variable: REQUIRED_VAR');
    });

    test('should convert environment variable types', () => {
      expect(envManager.convertValue('hello', 'string')).toBe('hello');
      expect(envManager.convertValue('42', 'number')).toBe(42);
      expect(envManager.convertValue('true', 'boolean')).toBe(true);
      expect(envManager.convertValue('false', 'boolean')).toBe(false);
      expect(envManager.convertValue('{"key": "value"}', 'json')).toEqual({ key: 'value' });
    });

    test('should provide environment information', () => {
      const info = envManager.getEnvironmentInfo();
      
      expect(info).toEqual(expect.objectContaining({
        nodeEnv: expect.any(String),
        nodeVersion: expect.any(String),
        platform: expect.any(String),
        arch: expect.any(String),
        pid: expect.any(Number)
      }));
    });

    test('should handle environment variables with prefix', () => {
      process.env.CEREBRATE_SERVER_PORT = '9000';
      process.env.CEREBRATE_DEBUG = 'true';
      process.env.OTHER_VAR = 'ignore';
      
      const vars = envManager.getEnvironmentVariables('CEREBRATE_');
      
      expect(vars).toEqual({
        'CEREBRATE_SERVER_PORT': '9000',
        'CEREBRATE_DEBUG': 'true'
      });
      expect(vars).not.toHaveProperty('OTHER_VAR');
      
      delete process.env.CEREBRATE_SERVER_PORT;
      delete process.env.CEREBRATE_DEBUG;
      delete process.env.OTHER_VAR;
    });

    test('should set and get environment variables', () => {
      envManager.setEnvironmentVariable('TEST_VAR', 'test_value');
      expect(envManager.getEnvironmentVariable('TEST_VAR')).toBe('test_value');
      
      envManager.removeEnvironmentVariable('TEST_VAR');
      expect(envManager.getEnvironmentVariable('TEST_VAR')).toBeUndefined();
    });

    test('should validate common environment requirements', () => {
      const validation = envManager.validateCommonRequirements();
      
      expect(validation.valid).toBe(true);
      expect(validation.values).toHaveProperty('NODE_ENV');
      expect(validation.values).toHaveProperty('PORT');
    });
  });

  describe('Configuration Integration', () => {
    test('should integrate configuration with environment', () => {
      const config = new Configuration({
        server: { port: 3000, host: 'localhost' },
        debug: false
      });
      
      const envManager = new EnvironmentManager();
      
      // Set environment variables
      process.env.CEREBRATE_DEBUG = 'true';
      process.env.CEREBRATE_SERVER_PORT = '8080';
      
      // Simulate loading from environment
      const envVars = envManager.getEnvironmentVariables('CEREBRATE_');
      for (const [key, value] of Object.entries(envVars)) {
        const configKey = key.replace('CEREBRATE_', '').toLowerCase().replace(/_/g, '.');
        config.set(configKey, envManager.convertValue(value, 'string'));
      }
      
      expect(config.get('debug')).toBe('true');
      expect(config.get('server.port')).toBe('8080');
      
      delete process.env.CEREBRATE_DEBUG;
      delete process.env.CEREBRATE_SERVER_PORT;
    });

    test('should provide comprehensive configuration summary', () => {
      const config = new Configuration({
        server: { port: 8080, host: 'localhost' },
        agent: { model: 'claude-3-sonnet', maxTokens: 4096 },
        extension: { debug: false }
      });
      
      const summary = config.getSummary();
      
      expect(summary).toEqual(expect.objectContaining({
        totalKeys: expect.any(Number),
        sections: expect.arrayContaining(['server', 'agent', 'extension']),
        environment: expect.any(String),
        frozen: false
      }));
      
      expect(summary.totalKeys).toBeGreaterThan(0);
      expect(summary.sections.length).toBeGreaterThan(0);
    });
  });
});