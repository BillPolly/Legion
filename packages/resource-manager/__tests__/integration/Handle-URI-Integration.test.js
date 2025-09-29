/**
 * Integration tests for Handle/URI system
 * 
 * Tests the complete integration between ResourceManager, URIs, DataSources, and Handles.
 * Covers the full workflow from URI parsing to Handle operations and caching.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('Handle/URI Integration Tests', () => {
  let resourceManager;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  afterEach(() => {
    // Clean up any handles created during tests
    if (resourceManager._handleCache) {
      for (const handle of resourceManager._handleCache.values()) {
        if (handle && !handle.isDestroyed()) {
          handle.destroy();
        }
      }
    }
  });

  describe('URI Parsing and Handle Creation', () => {
    it('should create ConfigHandle from environment variable URI', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      const handle = await resourceManager.createHandleFromURI(uri);
      
      expect(handle).toBeDefined();
      expect(handle.constructor.name).toBe('ConfigHandle');
      expect(handle.configKey).toBe('ANTHROPIC_API_KEY');
      expect(handle.server).toBe('local');
      expect(handle.resourceType).toBe('env');
      expect(handle.toURI()).toBe(uri);
    });

    it('should create MongoHandle from MongoDB URI', async () => {
      const uri = 'legion://local/mongodb/testdb/users';
      const handle = await resourceManager.createHandleFromURI(uri);
      
      expect(handle).toBeDefined();
      expect(handle.constructor.name).toBe('MongoHandle');
      expect(handle.toURI()).toBe(uri);
    });

    it('should create FileHandle from filesystem URI', async () => {
      const uri = 'legion://local/filesystem/tmp/test.txt';
      const handle = await resourceManager.createHandleFromURI(uri);
      
      expect(handle).toBeDefined();
      expect(handle.constructor.name).toBe('FileHandle');
      expect(handle.toURI()).toBe(uri);
    });

    it('should throw error for unsupported resource type', async () => {
      const uri = 'legion://local/unsupported/test';
      
      await expect(resourceManager.createHandleFromURI(uri))
        .rejects
        .toThrow('No Handle class registered for resource type: unsupported');
    });

    it('should throw error for malformed URI', async () => {
      const malformedURIs = [
        '',
        'not-a-uri',
        'http://example.com',
        'legion://',
        'legion://local',
        'legion://local/',
        'legion://local/env'
      ];

      for (const uri of malformedURIs) {
        await expect(resourceManager.createHandleFromURI(uri))
          .rejects
          .toThrow();
      }
    });
  });

  describe('Handle Caching', () => {
    it('should cache handles and return same instance for same URI', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      
      const handle1 = await resourceManager.createHandleFromURI(uri);
      const handle2 = await resourceManager.createHandleFromURI(uri);
      
      expect(handle1).toBe(handle2); // Same object reference
      expect(handle1.toURI()).toBe(handle2.toURI());
    });

    it('should create new handle when cached handle is destroyed', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      
      const handle1 = await resourceManager.createHandleFromURI(uri);
      const originalId = handle1.toString();
      
      // Destroy the handle
      handle1.destroy();
      expect(handle1.isDestroyed()).toBe(true);
      
      // Create new handle - should be different instance
      const handle2 = await resourceManager.createHandleFromURI(uri);
      expect(handle2.isDestroyed()).toBe(false);
      expect(handle2).not.toBe(handle1); // Different instances
      expect(handle2.toString()).toBe('[ConfigHandle: legion://local/env/ANTHROPIC_API_KEY]'); // Same URI representation
    });

    it('should remove handle from cache when destroyed', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      
      const handle = await resourceManager.createHandleFromURI(uri);
      expect(resourceManager._handleCache.get(uri)).toBe(handle);
      
      handle.destroy();
      expect(resourceManager._handleCache.get(uri)).toBeUndefined();
    });
  });

  describe('ConfigHandle Operations', () => {
    let configHandle;
    const testUri = 'legion://local/env/ANTHROPIC_API_KEY';

    beforeEach(async () => {
      configHandle = await resourceManager.createHandleFromURI(testUri);
    });

    it('should get environment variable value', () => {
      const value = configHandle.getValue();
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });

    it('should check if configuration key exists', () => {
      expect(configHandle.hasConfigKey('ANTHROPIC_API_KEY')).toBe(true);
      expect(configHandle.hasConfigKey('NON_EXISTENT_KEY')).toBe(false);
    });

    it('should get configuration metadata', () => {
      const metadata = configHandle.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.dataSourceType).toBe('ConfigDataSource');
      expect(metadata.totalKeys).toBeGreaterThan(0);
    });

    it('should get configuration schema', () => {
      const schema = configHandle.getSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('configuration');
      expect(schema.attributes).toBeDefined();
      expect(schema.attributes.ANTHROPIC_API_KEY).toBeDefined();
    });

    it('should validate configuration values', () => {
      const currentValue = configHandle.getValue();
      expect(configHandle.validate(currentValue)).toBe(true);
      expect(configHandle.validate('')).toBe(false); // Empty secret should be invalid
    });

    it('should create query builder', () => {
      const queryBuilder = configHandle.query();
      expect(queryBuilder).toBeDefined();
      expect(typeof queryBuilder.whereKey).toBe('function');
      expect(typeof queryBuilder.whereValue).toBe('function');
      expect(typeof queryBuilder.toArray).toBe('function');
    });

    it('should export configuration as object', () => {
      const config = configHandle.export({ includeSecrets: true });
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config.ANTHROPIC_API_KEY).toBeDefined();
    });

    it('should export configuration without secrets', () => {
      const config = configHandle.export({ includeSecrets: false });
      expect(config).toBeDefined();
      
      // ANTHROPIC_API_KEY should be excluded as it's a secret
      expect(config.ANTHROPIC_API_KEY).toBeUndefined();
      
      // But other non-secret vars should be included
      expect(Object.keys(config).length).toBeGreaterThan(0);
    });

    it('should clone handle', () => {
      const clonedHandle = configHandle.clone();
      expect(clonedHandle).toBeDefined();
      expect(clonedHandle).not.toBe(configHandle); // Different instance
      expect(clonedHandle.toURI()).toBe(configHandle.toURI()); // Same URI
      expect(clonedHandle.configKey).toBe(configHandle.configKey);
    });

    it('should handle proxy property access', () => {
      // Test proxy get behavior - accessing non-existent property should call getValue
      const nonExistentValue = configHandle.nonExistentProperty;
      expect(nonExistentValue).toBeUndefined();
      
      // Test proxy has behavior
      expect('getValue' in configHandle).toBe(true);
      expect('nonExistentProperty' in configHandle).toBe(false);
    });

    it('should throw error when operations called on destroyed handle', () => {
      configHandle.destroy();
      
      expect(() => configHandle.getValue()).toThrow('ConfigHandle has been destroyed');
      expect(() => configHandle.getMetadata()).toThrow('ConfigHandle has been destroyed');
      expect(() => configHandle.getSchema()).toThrow('ConfigHandle has been destroyed');
      expect(() => configHandle.validate()).toThrow('ConfigHandle has been destroyed');
      expect(() => configHandle.clone()).toThrow('ConfigHandle has been destroyed');
    });
  });

  describe('Handle Subscriptions', () => {
    let configHandle;

    beforeEach(async () => {
      configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
    });

    it('should create subscription for configuration changes', () => {
      const callback = jest.fn();
      const subscription = configHandle.subscribe(callback);
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Clean up
      subscription.unsubscribe();
    });

    it('should create subscription for all configuration changes', () => {
      const callback = jest.fn();
      const subscription = configHandle.subscribe(callback, { watchAll: true });
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Clean up
      subscription.unsubscribe();
    });

    it('should throw error for invalid subscription callback', () => {
      expect(() => configHandle.subscribe()).toThrow('Callback function is required');
      expect(() => configHandle.subscribe(null)).toThrow('Callback function is required');
      expect(() => configHandle.subscribe('not-a-function')).toThrow('Callback function is required');
    });
  });

  describe('Handle Parent/Child Relationships', () => {
    let configHandle;

    beforeEach(async () => {
      configHandle = await resourceManager.createHandleFromURI('legion://local/env/DATABASE');
    });

    it('should create child handle', () => {
      const childHandle = configHandle.child('URL');
      
      expect(childHandle).toBeDefined();
      expect(childHandle.configKey).toBe('DATABASE.URL');
      expect(childHandle.toURI()).toBe('legion://local/env/DATABASE.URL');
    });

    it('should get parent handle for nested configuration', () => {
      const childHandle = configHandle.child('URL');
      const parentHandle = childHandle.parent();
      
      expect(parentHandle).toBeDefined();
      expect(parentHandle.configKey).toBe('DATABASE');
      expect(parentHandle.toURI()).toBe(configHandle.toURI());
    });

    it('should return null for parent of root configuration', () => {
      const parentHandle = configHandle.parent();
      expect(parentHandle).toBeNull();
    });
  });

  describe('DataSource Integration', () => {
    it('should handle all DataSource query operations through Handle', async () => {
      const configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
      
      // Test that Handle delegates to DataSource correctly
      expect(configHandle.dataSource).toBeDefined();
      expect(configHandle.dataSource.constructor.name).toBe('ConfigDataSource');
      
      // Test query delegation
      const results = configHandle.dataSource.query({ find: 'all' });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Test specific query delegation  
      const specificResults = configHandle.dataSource.query({ find: 'ANTHROPIC_API_KEY' });
      expect(specificResults.length).toBe(1);
      expect(specificResults[0].key).toBe('ANTHROPIC_API_KEY');
    });

    it('should handle DataSource schema access through Handle', async () => {
      const configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
      
      const handleSchema = configHandle.getSchema();
      const dataSourceSchema = configHandle.dataSource.getSchema();
      
      expect(handleSchema).toEqual(dataSourceSchema);
    });

    it('should handle DataSource metadata access through Handle', async () => {
      const configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
      
      const handleMetadata = configHandle.getMetadata();
      const dataSourceMetadata = configHandle.dataSource.getMetadata();
      
      expect(handleMetadata).toEqual(dataSourceMetadata);
    });
  });

  describe('URI Utilities', () => {
    it('should create URI from components using toURI method', () => {
      const uri = resourceManager.toURI('env', 'ANTHROPIC_API_KEY', 'local');
      expect(uri).toBe('legion://local/env/ANTHROPIC_API_KEY');
      
      const uriWithDefaultServer = resourceManager.toURI('mongodb', 'testdb/users');
      expect(uriWithDefaultServer).toBe('legion://local/mongodb/testdb/users');
    });

    it('should parse URI components correctly', () => {
      const testCases = [
        {
          uri: 'legion://local/env/ANTHROPIC_API_KEY',
          expected: {
            server: 'local',
            resourceType: 'env', 
            path: 'ANTHROPIC_API_KEY',
            fullPath: ['ANTHROPIC_API_KEY']
          }
        },
        {
          uri: 'legion://remote/mongodb/mydb/users',
          expected: {
            server: 'remote',
            resourceType: 'mongodb',
            path: 'mydb/users', 
            fullPath: ['mydb', 'users']
          }
        },
        {
          uri: 'legion://local/filesystem/tmp/data/file.txt',
          expected: {
            server: 'local',
            resourceType: 'filesystem',
            path: 'tmp/data/file.txt',
            fullPath: ['tmp', 'data', 'file.txt']
          }
        }
      ];

      for (const testCase of testCases) {
        const parsed = resourceManager._parseURI(testCase.uri);
        expect(parsed.server).toBe(testCase.expected.server);
        expect(parsed.resourceType).toBe(testCase.expected.resourceType);
        expect(parsed.path).toBe(testCase.expected.path);
        expect(parsed.fullPath).toEqual(testCase.expected.fullPath);
        expect(parsed.original).toBe(testCase.uri);
      }
    });
  });

  describe('Handle Serialization', () => {
    let configHandle;

    beforeEach(async () => {
      configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
    });

    it('should provide string representation', () => {
      const stringRep = configHandle.toString();
      expect(stringRep).toBe('[ConfigHandle: legion://local/env/ANTHROPIC_API_KEY]');
    });

    it('should provide JSON representation', () => {
      const jsonRep = configHandle.toJSON();
      expect(jsonRep).toEqual({
        type: 'ConfigHandle',
        uri: 'legion://local/env/ANTHROPIC_API_KEY',
        configKey: 'ANTHROPIC_API_KEY',
        server: 'local',
        hasValue: true
      });
    });

    it('should handle serialization of destroyed handle', () => {
      configHandle.destroy();
      
      expect(configHandle.toString()).toBe('[ConfigHandle (destroyed)]');
      expect(configHandle.toJSON()).toEqual({ destroyed: true });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty or invalid URI paths gracefully', async () => {
      // Empty path after resource type should throw
      await expect(resourceManager.createHandleFromURI('legion://local/env/'))
        .rejects
        .toThrow();
    });

    it('should handle special characters in URI paths', async () => {
      const uri = 'legion://local/env/API_KEY_WITH_UNDERSCORES';
      const handle = await resourceManager.createHandleFromURI(uri);
      
      expect(handle.configKey).toBe('API_KEY_WITH_UNDERSCORES');
      expect(handle.toURI()).toBe(uri);
    });

    it('should handle Handle operations with non-existent configuration keys', async () => {
      const handle = await resourceManager.createHandleFromURI('legion://local/env/NON_EXISTENT_KEY');
      
      expect(handle.getValue()).toBeUndefined();
      expect(handle.hasConfigKey('NON_EXISTENT_KEY')).toBe(false);
      expect(handle.validate()).toBe(false);
    });

    it('should handle concurrent Handle creation for same URI', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      
      // Create multiple handles concurrently
      const promises = Array(5).fill(null).map(() => 
        resourceManager.createHandleFromURI(uri)
      );
      
      const handles = await Promise.all(promises);
      
      // All should be the same cached instance
      for (let i = 1; i < handles.length; i++) {
        expect(handles[i]).toBe(handles[0]);
      }
    });
  });
});