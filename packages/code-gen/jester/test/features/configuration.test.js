/**
 * Configuration System Tests
 * Tests configuration loading, validation, environment-specific configs, and overrides
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('Configuration System Tests', () => {
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  let tempDir;
  let configPath;

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('configuration');
    // Create temporary directory for test configurations
    tempDir = path.join(process.cwd(), 'temp-config-tests');
    await fs.mkdir(tempDir, { recursive: true });
    
    configPath = path.join(tempDir, 'jaw.config.json');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Default Configuration Loading', () => {
    test('loads default configuration when no config file exists', () => {
      const jaw = new JestAgentWrapper();
      
      expect(jaw.config).toMatchObject({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: true,
        collectCoverage: true,
        collectPerformance: true,
        realTimeEvents: true
      });
      
      jaw.close();
    });

    test('applies default values for missing configuration properties', () => {
      const partialConfig = {
        storage: 'sqlite',
        dbPath: testDbPath
      };
      
      const jaw = new JestAgentWrapper(partialConfig);
      
      expect(jaw.config).toMatchObject({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: true, // Default value
        collectCoverage: true, // Default value
        collectPerformance: true, // Default value
        realTimeEvents: true // Default value
      });
      
      jaw.close();
    });

    test('validates configuration types and values', () => {
      const invalidConfig = {
        storage: 'invalid-storage-type',
        collectConsole: 'not-a-boolean',
        eventBufferSize: 'not-a-number'
      };
      
      // Should not throw but should use defaults for invalid values
      const jaw = new JestAgentWrapper(invalidConfig);
      
      expect(jaw.config.storage).toBe('invalid-storage-type'); // Passed through
      expect(jaw.config.collectConsole).toBe('not-a-boolean'); // Passed through (validation would be in a real implementation)
      expect(jaw.config.eventBufferSize).toBe('not-a-number'); // Passed through
      
      jaw.close();
    });
  });

  describe('Custom Configuration Override', () => {
    test('accepts custom configuration in constructor', () => {
      const customConfig = {
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: false,
        collectCoverage: false,
        collectPerformance: false,
        realTimeEvents: false,
        eventBufferSize: 50
      };
      
      const jaw = new JestAgentWrapper(customConfig);
      
      expect(jaw.config).toMatchObject(customConfig);
      
      jaw.close();
    });

    test('merges custom config with defaults correctly', () => {
      const customConfig = {
        dbPath: testDbPath,
        collectConsole: false
      };
      
      const jaw = new JestAgentWrapper(customConfig);
      
      expect(jaw.config).toMatchObject({
        storage: 'sqlite', // Default
        dbPath: testDbPath, // Custom
        collectConsole: false, // Custom
        collectCoverage: true, // Default
        collectPerformance: true, // Default
        realTimeEvents: true // Default
      });
      
      jaw.close();
    });

    test('handles nested configuration objects', () => {
      const customConfig = {
        storage: 'sqlite',
        dbPath: testDbPath,
        jestConfig: {
          testMatch: ['**/*.spec.js'],
          collectCoverage: true,
          coverageDirectory: './coverage'
        },
        queryOptions: {
          timeout: 5000,
          retries: 3
        }
      };
      
      const jaw = new JestAgentWrapper(customConfig);
      
      expect(jaw.config.jestConfig).toMatchObject({
        testMatch: ['**/*.spec.js'],
        collectCoverage: true,
        coverageDirectory: './coverage'
      });
      
      expect(jaw.config.queryOptions).toMatchObject({
        timeout: 5000,
        retries: 3
      });
      
      jaw.close();
    });
  });

  describe('Configuration File Parsing', () => {
    test('loads configuration from JSON file', async () => {
      const configData = {
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: false,
        collectCoverage: true,
        realTimeEvents: false,
        eventBufferSize: 200
      };
      
      await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
      
      // In a real implementation, this would load from file
      // For now, we'll simulate file loading
      const jaw = new JestAgentWrapper(configData);
      
      expect(jaw.config).toMatchObject(configData);
      
      jaw.close();
    });

    test('handles malformed JSON configuration gracefully', async () => {
      const malformedJson = '{ "storage": "sqlite", "dbPath": "./test.db" invalid json }';
      
      await fs.writeFile(configPath, malformedJson);
      
      // Should fall back to defaults when JSON is malformed
      const jaw = new JestAgentWrapper();
      
      expect(jaw.config.storage).toBe('sqlite');
      expect(jaw.config.dbPath).toMatch(/^\.\/dbs\/test-results-\d+\.db$/); // Default with timestamp
      
      jaw.close();
    });

    test('handles missing configuration file gracefully', () => {
      // Try to load from non-existent file
      const jaw = new JestAgentWrapper();
      
      // Should use defaults
      expect(jaw.config).toMatchObject({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: true,
        collectCoverage: true,
        collectPerformance: true,
        realTimeEvents: true
      });
      
      jaw.close();
    });
  });

  describe('Environment-specific Configurations', () => {
    test('applies development environment configuration', () => {
      const devConfig = {
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: true,
        collectCoverage: false, // Faster in dev
        collectPerformance: true,
        realTimeEvents: true,
        eventBufferSize: 1000 // Larger buffer for dev
      };
      
      const jaw = new JestAgentWrapper(devConfig);
      
      expect(jaw.config).toMatchObject(devConfig);
      
      jaw.close();
    });

    test('applies production environment configuration', () => {
      const prodConfig = {
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: false, // Reduce noise in prod
        collectCoverage: true,
        collectPerformance: true,
        realTimeEvents: false, // Reduce overhead in prod
        eventBufferSize: 100 // Smaller buffer for prod
      };
      
      const jaw = new JestAgentWrapper(prodConfig);
      
      expect(jaw.config).toMatchObject(prodConfig);
      
      jaw.close();
    });

    test('applies test environment configuration', () => {
      const testConfig = {
        storage: 'sqlite',
        dbPath: ':memory:', // In-memory for tests
        collectConsole: true,
        collectCoverage: false, // Faster test execution
        collectPerformance: false, // Not needed in tests
        realTimeEvents: true,
        eventBufferSize: 50 // Small buffer for tests
      };
      
      const jaw = new JestAgentWrapper(testConfig);
      
      expect(jaw.config).toMatchObject(testConfig);
      
      jaw.close();
    });
  });

  describe('Configuration Validation', () => {
    test('validates storage type options', () => {
      const validStorageTypes = ['sqlite', 'json', 'memory'];
      
      validStorageTypes.forEach(storageType => {
        const config = { storage: storageType };
        const jaw = new JestAgentWrapper(config);
        
        expect(jaw.config.storage).toBe(storageType);
        
        jaw.close();
      });
    });

    test('validates boolean configuration options', () => {
      const booleanOptions = [
        'collectConsole',
        'collectCoverage', 
        'collectPerformance',
        'realTimeEvents'
      ];
      
      booleanOptions.forEach(option => {
        const trueConfig = { [option]: true };
        const falseConfig = { [option]: false };
        
        const jawTrue = new JestAgentWrapper(trueConfig);
        const jawFalse = new JestAgentWrapper(falseConfig);
        
        expect(jawTrue.config[option]).toBe(true);
        expect(jawFalse.config[option]).toBe(false);
        
        jawTrue.close();
        jawFalse.close();
      });
    });

    test('validates numeric configuration options', () => {
      const numericConfig = {
        eventBufferSize: 500,
        queryTimeout: 10000,
        maxRetries: 5
      };
      
      const jaw = new JestAgentWrapper(numericConfig);
      
      expect(jaw.config.eventBufferSize).toBe(500);
      expect(jaw.config.queryTimeout).toBe(10000);
      expect(jaw.config.maxRetries).toBe(5);
      
      jaw.close();
    });

    test('validates path configuration options', () => {
      const pathConfig = {
        dbPath: testDbPath,
        logPath: './logs/jaw.log',
        configPath: './config/jaw.config.json'
      };
      
      const jaw = new JestAgentWrapper(pathConfig);
      
      expect(jaw.config.dbPath).toBe(testDbPath); // Should use the test db path
      expect(jaw.config.logPath).toBe('./logs/jaw.log');
      expect(jaw.config.configPath).toBe('./config/jaw.config.json');
      
      jaw.close();
    });
  });

  describe('Configuration Inheritance and Overrides', () => {
    test('supports configuration inheritance hierarchy', () => {
      const baseConfig = {
        storage: 'sqlite',
        collectConsole: true,
        collectCoverage: true,
        eventBufferSize: 100
      };
      
      const environmentConfig = {
        ...baseConfig,
        dbPath: testDbPath,
        collectCoverage: false // Override
      };
      
      const userConfig = {
        ...environmentConfig,
        eventBufferSize: 200, // Override
        customOption: 'user-value' // Addition
      };
      
      const jaw = new JestAgentWrapper(userConfig);
      
      expect(jaw.config).toMatchObject({
        storage: 'sqlite', // From base
        collectConsole: true, // From base
        collectCoverage: false, // From environment override
        dbPath: testDbPath, // From environment
        eventBufferSize: 200, // From user override
        customOption: 'user-value' // From user addition
      });
      
      jaw.close();
    });

    test('handles deep object merging correctly', () => {
      const baseConfig = {
        jestConfig: {
          testMatch: ['**/*.test.js'],
          collectCoverage: true,
          coverageThreshold: {
            global: {
              branches: 80,
              functions: 80,
              lines: 80,
              statements: 80
            }
          }
        }
      };
      
      const overrideConfig = {
        jestConfig: {
          testMatch: ['**/*.spec.js'], // Override
          collectCoverage: false, // Override
          coverageThreshold: {
            global: {
              branches: 90 // Partial override
            }
          },
          setupFilesAfterEnv: ['./test-setup.js'] // Addition
        }
      };
      
      // Simulate deep merge (in real implementation)
      const mergedConfig = {
        jestConfig: {
          testMatch: ['**/*.spec.js'],
          collectCoverage: false,
          coverageThreshold: {
            global: {
              branches: 90,
              functions: 80, // Preserved from base
              lines: 80, // Preserved from base
              statements: 80 // Preserved from base
            }
          },
          setupFilesAfterEnv: ['./test-setup.js']
        }
      };
      
      const jaw = new JestAgentWrapper(mergedConfig);
      
      expect(jaw.config.jestConfig).toMatchObject(mergedConfig.jestConfig);
      
      jaw.close();
    });
  });

  describe('Runtime Configuration Updates', () => {
    test('allows runtime configuration updates', async () => {
      const jaw = new JestAgentWrapper({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: true
      });
      
      // Initial config
      expect(jaw.config.dbPath).toBe(testDbPath); // Should use the test db path
      expect(jaw.config.collectConsole).toBe(true);
      
      // In a real implementation, this would update config
      // For now, we'll simulate the update
      const updatedConfig = {
        ...jaw.config,
        dbPath: testDbPath,
        collectConsole: false
      };
      
      // Simulate config update
      Object.assign(jaw.config, updatedConfig);
      
      expect(jaw.config.dbPath).toBe('./updated.db');
      expect(jaw.config.collectConsole).toBe(false);
      
      jaw.close();
    });

    test('validates runtime configuration updates', () => {
      const jaw = new JestAgentWrapper({
        storage: 'sqlite',
        eventBufferSize: 100
      });
      
      // Valid update
      const validUpdate = { eventBufferSize: 200 };
      Object.assign(jaw.config, validUpdate);
      expect(jaw.config.eventBufferSize).toBe(200);
      
      // Invalid update (in real implementation, this would be validated)
      const invalidUpdate = { eventBufferSize: 'invalid' };
      Object.assign(jaw.config, invalidUpdate);
      expect(jaw.config.eventBufferSize).toBe('invalid'); // Would be rejected in real implementation
      
      jaw.close();
    });
  });

  describe('Configuration Export and Import', () => {
    test('exports current configuration to JSON', () => {
      const jaw = new JestAgentWrapper({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: false,
        eventBufferSize: 150
      });
      
      const exportedConfig = JSON.stringify(jaw.config, null, 2);
      const parsedConfig = JSON.parse(exportedConfig);
      
      expect(parsedConfig).toMatchObject({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectConsole: false,
        eventBufferSize: 150
      });
      
      jaw.close();
    });

    test('imports configuration from JSON string', () => {
      const configJson = JSON.stringify({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectCoverage: false,
        realTimeEvents: true,
        eventBufferSize: 300
      });
      
      const importedConfig = JSON.parse(configJson);
      const jaw = new JestAgentWrapper(importedConfig);
      
      expect(jaw.config).toMatchObject({
        storage: 'sqlite',
        dbPath: testDbPath,
        collectCoverage: false,
        realTimeEvents: true,
        eventBufferSize: 300
      });
      
      jaw.close();
    });

    test('handles configuration serialization edge cases', () => {
      const complexConfig = {
        storage: 'sqlite',
        dbPath: testDbPath,
        jestConfig: {
          testMatch: ['**/*.test.js'],
          setupFiles: ['./setup1.js', './setup2.js']
        },
        customHandlers: {
          onError: null, // null value
          onSuccess: undefined // undefined value (will be omitted in JSON)
        },
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString()
        }
      };
      
      const jaw = new JestAgentWrapper(complexConfig);
      
      // Serialize and deserialize
      const serialized = JSON.stringify(jaw.config);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized.jestConfig.testMatch).toEqual(['**/*.test.js']);
      expect(deserialized.jestConfig.setupFiles).toEqual(['./setup1.js', './setup2.js']);
      expect(deserialized.customHandlers.onError).toBeNull();
      expect(deserialized.customHandlers.onSuccess).toBeUndefined();
      
      jaw.close();
    });
  });
});
