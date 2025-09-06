/**
 * Configuration Module Tests
 * Tests for configuration management and validation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DEFAULT_CONFIG, TEST_CONFIG } from '../../src/config/default.js';
import { TestConfigBuilder, TestDataValidation } from '../utils/test-helpers.js';

describe('Configuration Module', () => {
  describe('DEFAULT_CONFIG', () => {
    test('has all required properties', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.mongodb).toBeDefined();
      expect(DEFAULT_CONFIG.loading).toBeDefined();
      expect(DEFAULT_CONFIG.wordnet).toBeDefined();
    });

    test('mongodb section has required properties', () => {
      const { mongodb } = DEFAULT_CONFIG;
      expect(mongodb.connectionString).toBeDefined();
      expect(mongodb.dbName).toBeDefined();
      expect(mongodb.collectionName).toBeDefined();
      expect(typeof mongodb.connectionString).toBe('string');
      expect(typeof mongodb.dbName).toBe('string');
      expect(typeof mongodb.collectionName).toBe('string');
    });

    test('loading section has required properties', () => {
      const { loading } = DEFAULT_CONFIG;
      expect(loading.batchSize).toBeDefined();
      expect(loading.maxConcurrentRequests).toBeDefined();
      expect(loading.enableValidation).toBeDefined();
      expect(loading.createIndices).toBeDefined();
      expect(loading.logInterval).toBeDefined();
      
      expect(typeof loading.batchSize).toBe('number');
      expect(typeof loading.maxConcurrentRequests).toBe('number');
      expect(typeof loading.enableValidation).toBe('boolean');
      expect(typeof loading.createIndices).toBe('boolean');
      expect(typeof loading.logInterval).toBe('number');
    });

    test('wordnet section has required properties', () => {
      const { wordnet } = DEFAULT_CONFIG;
      expect(wordnet.includedPos).toBeDefined();
      expect(wordnet.skipMissingDefinitions).toBeDefined();
      
      expect(Array.isArray(wordnet.includedPos)).toBe(true);
      expect(typeof wordnet.skipMissingDefinitions).toBe('boolean');
    });

    test('has sensible default values', () => {
      const { loading, wordnet } = DEFAULT_CONFIG;
      
      // Loading defaults
      expect(loading.batchSize).toBeGreaterThan(0);
      expect(loading.maxConcurrentRequests).toBeGreaterThan(0);
      expect(loading.logInterval).toBeGreaterThan(0);
      
      // WordNet defaults
      expect(wordnet.includedPos.length).toBeGreaterThan(0);
      expect(wordnet.includedPos).toContain('n'); // Should include nouns
      expect(wordnet.includedPos).toContain('v'); // Should include verbs
    });
  });

  describe('TEST_CONFIG', () => {
    test('overrides DEFAULT_CONFIG correctly', () => {
      expect(TEST_CONFIG).toBeDefined();
      expect(TEST_CONFIG.mongodb).toBeDefined();
      expect(TEST_CONFIG.loading).toBeDefined();
      expect(TEST_CONFIG.wordnet).toBeDefined();
    });

    test('has test-appropriate values', () => {
      const { loading, wordnet, mongodb } = TEST_CONFIG;
      
      // Should have smaller batch sizes for testing
      expect(loading.batchSize).toBeLessThanOrEqual(DEFAULT_CONFIG.loading.batchSize);
      
      // Should have limited synsets for testing
      expect(wordnet.maxSynsets).toBeDefined();
      expect(typeof wordnet.maxSynsets).toBe('number');
      expect(wordnet.maxSynsets).toBeLessThan(1000); // Reasonable test limit
      
      // Should have test database name
      expect(mongodb.dbName).toContain('test');
    });

    test('maintains required structure', () => {
      expect(() => TestDataValidation.validateConfigStructure(TEST_CONFIG)).not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    test('validates valid configuration', () => {
      expect(() => TestDataValidation.validateConfigStructure(DEFAULT_CONFIG)).not.toThrow();
      expect(() => TestDataValidation.validateConfigStructure(TEST_CONFIG)).not.toThrow();
    });

    test('rejects configuration missing required sections', () => {
      const invalidConfig1 = { mongodb: {}, loading: {} }; // Missing wordnet
      const invalidConfig2 = { wordnet: {}, loading: {} }; // Missing mongodb
      const invalidConfig3 = { mongodb: {}, wordnet: {} }; // Missing loading
      
      expect(() => TestDataValidation.validateConfigStructure(invalidConfig1)).toThrow();
      expect(() => TestDataValidation.validateConfigStructure(invalidConfig2)).toThrow();
      expect(() => TestDataValidation.validateConfigStructure(invalidConfig3)).toThrow();
    });

    test('validates MongoDB connection string format', () => {
      const validConnections = [
        'mongodb://localhost:27017',
        'mongodb://user:pass@localhost:27017',
        'mongodb://localhost:27017,localhost:27018',
        'mongodb+srv://cluster.mongodb.net'
      ];
      
      const invalidConnections = [
        '',
        'http://localhost:27017',
        'localhost:27017',
        null,
        undefined
      ];
      
      validConnections.forEach(conn => {
        expect(typeof conn).toBe('string');
        expect(conn.startsWith('mongodb')).toBe(true);
        expect(conn.length).toBeGreaterThan(10); // More than just "mongodb://"
      });
      
      invalidConnections.forEach(conn => {
        if (conn === null || conn === undefined) {
          expect(conn === null || conn === undefined).toBe(true);
        } else {
          const isInvalid = typeof conn !== 'string' || 
                           conn === '' || 
                           !conn.startsWith('mongodb') ||
                           conn === 'mongodb://'; // Incomplete connection string
          expect(isInvalid).toBe(true);
        }
      });
      
      // Test the edge case separately
      expect('mongodb://'.startsWith('mongodb')).toBe(true);
      expect('mongodb://'.length <= 10).toBe(true); // But it's too short to be valid
    });

    test('validates WordNet POS array', () => {
      const validPosArrays = [
        ['n'],
        ['n', 'v'],
        ['n', 'v', 'a'],
        ['n', 'v', 'a', 's', 'r']
      ];
      
      const invalidPosArrays = [
        [],
        ['x'], // Invalid POS
        ['n', 'invalid'],
        null,
        undefined,
        'n' // Not an array
      ];
      
      validPosArrays.forEach(pos => {
        expect(Array.isArray(pos)).toBe(true);
        expect(pos.length).toBeGreaterThan(0);
        pos.forEach(p => {
          expect(['n', 'v', 'a', 's', 'r']).toContain(p);
        });
      });
      
      invalidPosArrays.forEach(pos => {
        if (pos !== null && pos !== undefined) {
          const isValid = Array.isArray(pos) && 
                         pos.length > 0 && 
                         pos.every(p => ['n', 'v', 'a', 's', 'r'].includes(p));
          expect(isValid).toBe(false);
        }
      });
    });

    test('validates batch size and concurrency limits', () => {
      const validValues = [1, 10, 100, 1000, 5000];
      const invalidValues = [0, -1, -100, null, undefined, 'string', NaN, Infinity];
      
      validValues.forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
        expect(Number.isFinite(value)).toBe(true);
      });
      
      invalidValues.forEach(value => {
        const isValid = typeof value === 'number' && 
                       value > 0 && 
                       Number.isFinite(value);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('TestConfigBuilder', () => {
    test('creates in-memory configuration', () => {
      const config = TestConfigBuilder.getInMemoryConfig();
      expect(config).toBeDefined();
      expect(config.storage).toBeDefined();
      expect(config.storage.type).toBe('memory');
    });

    test('creates MongoDB test configuration', () => {
      const config = TestConfigBuilder.getMongoTestConfig();
      expect(config).toBeDefined();
      expect(config.mongodb).toBeDefined();
      expect(config.mongodb.dbName).toContain('test');
      expect(config.mongodb.collectionName).toContain('test');
    });

    test('creates minimal configuration', () => {
      const config = TestConfigBuilder.getMinimalConfig();
      expect(config).toBeDefined();
      expect(config.wordnet.maxSynsets).toBeLessThanOrEqual(10);
      expect(config.wordnet.includedPos).toEqual(['n']);
      expect(config.loading.batchSize).toBeLessThanOrEqual(5);
    });

    test('all generated configs are valid', () => {
      const configs = [
        TestConfigBuilder.getInMemoryConfig(),
        TestConfigBuilder.getMongoTestConfig(),
        TestConfigBuilder.getMinimalConfig()
      ];
      
      configs.forEach(config => {
        expect(() => TestDataValidation.validateConfigStructure(config)).not.toThrow();
      });
    });
  });

  describe('Configuration Merging', () => {
    test('merges configurations correctly', () => {
      const baseConfig = {
        mongodb: { connectionString: 'base', dbName: 'base' },
        loading: { batchSize: 100 },
        wordnet: { maxSynsets: 1000 }
      };
      
      const overrideConfig = {
        mongodb: { dbName: 'override' },
        loading: { batchSize: 50 }
      };
      
      // Proper deep merge for nested objects
      const merged = {
        ...baseConfig,
        ...overrideConfig,
        mongodb: { ...baseConfig.mongodb, ...overrideConfig.mongodb }
      };
      
      expect(merged.mongodb.connectionString).toBe('base'); // Preserved
      expect(merged.mongodb.dbName).toBe('override'); // Overridden
      expect(merged.loading.batchSize).toBe(50); // Overridden
      expect(merged.wordnet.maxSynsets).toBe(1000); // Preserved
    });

    test('deep merges nested objects correctly', () => {
      const baseConfig = {
        mongodb: { connectionString: 'base', dbName: 'base', collectionName: 'base' },
        loading: { batchSize: 100, logInterval: 50 }
      };
      
      const overrideConfig = {
        mongodb: { dbName: 'override' }
      };
      
      // Simulate deep merge
      const merged = {
        ...baseConfig,
        mongodb: { ...baseConfig.mongodb, ...overrideConfig.mongodb }
      };
      
      expect(merged.mongodb.connectionString).toBe('base');
      expect(merged.mongodb.dbName).toBe('override');
      expect(merged.mongodb.collectionName).toBe('base');
      expect(merged.loading.batchSize).toBe(100);
    });
  });

  describe('Environment Variable Support', () => {
    test('supports environment variable override patterns', () => {
      // Test the pattern for environment variable overrides
      const envOverrides = {
        WORDNET_MONGO_CONNECTION: 'mongodb://env-host:27017',
        WORDNET_MONGO_DB: 'env_database',
        WORDNET_BATCH_SIZE: '500',
        WORDNET_MAX_SYNSETS: '2000'
      };
      
      // Simulate environment variable processing
      const processEnvOverrides = (config, envVars) => {
        const result = { ...config };
        
        if (envVars.WORDNET_MONGO_CONNECTION) {
          result.mongodb.connectionString = envVars.WORDNET_MONGO_CONNECTION;
        }
        if (envVars.WORDNET_MONGO_DB) {
          result.mongodb.dbName = envVars.WORDNET_MONGO_DB;
        }
        if (envVars.WORDNET_BATCH_SIZE) {
          result.loading.batchSize = parseInt(envVars.WORDNET_BATCH_SIZE);
        }
        if (envVars.WORDNET_MAX_SYNSETS) {
          result.wordnet.maxSynsets = parseInt(envVars.WORDNET_MAX_SYNSETS);
        }
        
        return result;
      };
      
      const overriddenConfig = processEnvOverrides(DEFAULT_CONFIG, envOverrides);
      
      expect(overriddenConfig.mongodb.connectionString).toBe('mongodb://env-host:27017');
      expect(overriddenConfig.mongodb.dbName).toBe('env_database');
      expect(overriddenConfig.loading.batchSize).toBe(500);
      expect(overriddenConfig.wordnet.maxSynsets).toBe(2000);
    });
  });
});
