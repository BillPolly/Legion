/**
 * End-to-End tests for complete URI workflow
 * 
 * Tests realistic scenarios showing the complete flow from URI creation
 * through Handle operations to resource cleanup. These tests demonstrate
 * how the Handle/URI system would be used in real applications.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('Complete URI Workflow E2E Tests', () => {
  let resourceManager;

  beforeEach(async () => {
    // Clear singleton for each test
    ResourceManager._instance = null;
    ResourceManager._initPromise = null;
    
    // Get fresh ResourceManager instance
    resourceManager = await ResourceManager.getInstance();
  });

  afterEach(() => {
    // Clean up any handles and caches
    if (resourceManager && resourceManager.clearHandleCaches) {
      resourceManager.clearHandleCaches();
    }
    ResourceManager._instance = null;
    ResourceManager._initPromise = null;
  });

  describe('Configuration Management Workflow', () => {
    it('should demonstrate complete configuration access workflow', async () => {
      // Step 1: Create URI for configuration key
      const configUri = resourceManager.toURI('env', 'ANTHROPIC_API_KEY', 'local');
      expect(configUri).toBe('legion://local/env/ANTHROPIC_API_KEY');

      // Step 2: Create Handle from URI
      const configHandle = await resourceManager.createHandleFromURI(configUri);
      expect(configHandle.constructor.name).toBe('ConfigHandle');

      // Step 3: Verify Handle properties
      expect(configHandle.configKey).toBe('ANTHROPIC_API_KEY');
      expect(configHandle.server).toBe('local');
      expect(configHandle.resourceType).toBe('env');

      // Step 4: Access configuration value
      const apiKey = configHandle.getValue();
      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBeGreaterThan(0);

      // Step 5: Validate configuration
      expect(configHandle.validate(apiKey)).toBe(true);
      expect(configHandle.validate('')).toBe(false);

      // Step 6: Check metadata and schema
      const metadata = configHandle.getMetadata();
      expect(metadata.dataSourceType).toBe('ConfigDataSource');
      expect(metadata.totalKeys).toBeGreaterThan(0);

      const schema = configHandle.getSchema();
      expect(schema.type).toBe('configuration');
      expect(schema.attributes.ANTHROPIC_API_KEY).toBeDefined();

      // Step 7: Export configuration (without secrets for security)
      const publicConfig = configHandle.export({ includeSecrets: false });
      expect(publicConfig).toBeDefined();
      expect(publicConfig.ANTHROPIC_API_KEY).toBeUndefined(); // Should be filtered out

      // Step 8: Export with secrets (for admin operations)
      const fullConfig = configHandle.export({ includeSecrets: true });
      expect(fullConfig.ANTHROPIC_API_KEY).toBe(apiKey);

      // Step 9: Clean up
      configHandle.destroy();
      expect(configHandle.isDestroyed()).toBe(true);
    });

    it('should demonstrate configuration hierarchy navigation', async () => {
      // Step 1: Create parent configuration Handle
      const parentUri = resourceManager.toURI('env', 'DATABASE', 'local');
      const parentHandle = await resourceManager.createHandleFromURI(parentUri);

      // Step 2: Create child configuration Handle
      const childHandle = parentHandle.child('URL');
      expect(childHandle.configKey).toBe('DATABASE.URL');
      expect(childHandle.toURI()).toBe('legion://local/env/DATABASE.URL');

      // Step 3: Navigate back to parent
      const retrievedParent = childHandle.parent();
      expect(retrievedParent).toBeDefined();
      expect(retrievedParent.configKey).toBe('DATABASE');

      // Step 4: Verify URI roundtrip
      expect(retrievedParent.toURI()).toBe(parentHandle.toURI());

      // Step 5: Test root parent (should be null)
      const rootParent = parentHandle.parent();
      expect(rootParent).toBeNull();

      // Clean up
      parentHandle.destroy();
      childHandle.destroy();
    });
  });

  describe('MongoDB Resource Workflow', () => {
    it('should demonstrate MongoDB Handle lifecycle', async () => {
      // Step 1: Create MongoDB URI for a collection
      const mongoUri = resourceManager.toURI('mongodb', 'projectdb/users', 'local');
      expect(mongoUri).toBe('legion://local/mongodb/projectdb/users');

      // Step 2: Parse URI to verify structure
      const parsed = resourceManager._parseURI(mongoUri);
      expect(parsed.resourceType).toBe('mongodb');
      expect(parsed.path).toBe('projectdb/users');
      expect(parsed.fullPath).toEqual(['projectdb', 'users']);

      // Step 3: Create MongoHandle
      const mongoHandle = await resourceManager.createHandleFromURI(mongoUri);
      expect(mongoHandle.constructor.name).toBe('MongoHandle');

      // Step 4: Verify Handle URI methods
      expect(mongoHandle.toURI()).toBe(mongoUri);
      expect(mongoHandle.toString()).toContain('MongoHandle');

      // Step 5: Access DataSource through Handle
      expect(mongoHandle.dataSource).toBeDefined();
      expect(mongoHandle.dataSource.constructor.name).toBe('MongoDataSource');

      // Step 6: Get schema information
      const schema = mongoHandle.getSchema();
      expect(schema.type).toBe('mongodb');
      expect(schema.database).toBe('projectdb');
      expect(schema.collection).toBe('users');

      // Step 7: Test serialization
      const jsonRep = mongoHandle.toJSON();
      expect(jsonRep.type).toBe('MongoHandle');
      expect(jsonRep.uri).toBe(mongoUri);

      // Step 8: Clean up
      mongoHandle.destroy();
      expect(mongoHandle.isDestroyed()).toBe(true);
    });
  });

  describe('File System Resource Workflow', () => {
    it('should demonstrate FileHandle operations workflow', async () => {
      // Step 1: Create filesystem URI
      const fileUri = resourceManager.toURI('filesystem', 'workspace/config.json', 'local');
      expect(fileUri).toBe('legion://local/filesystem/workspace/config.json');

      // Step 2: Create FileHandle
      const fileHandle = await resourceManager.createHandleFromURI(fileUri);
      expect(fileHandle.constructor.name).toBe('FileHandle');

      // Step 3: Verify path handling
      const parsed = resourceManager._parseURI(fileUri);
      expect(parsed.fullPath).toEqual(['workspace', 'config.json']);

      // Step 4: Access file metadata through DataSource
      expect(fileHandle.dataSource).toBeDefined();
      expect(fileHandle.dataSource.constructor.name).toBe('FileDataSource');

      const schema = fileHandle.getSchema();
      expect(schema.type).toBe('filesystem');

      // Step 5: Test Handle identity
      expect(fileHandle.toURI()).toBe(fileUri);

      // Step 6: Clean up
      fileHandle.destroy();
    });
  });

  describe('Multi-Resource Application Workflow', () => {
    it('should demonstrate handling multiple resources in application context', async () => {
      const resources = [];

      try {
        // Step 1: Initialize multiple resource Handles for an application
        const configUri = resourceManager.toURI('env', 'ANTHROPIC_API_KEY');
        const dbUri = resourceManager.toURI('mongodb', 'appdb/sessions');
        const logUri = resourceManager.toURI('filesystem', 'logs/app.log');

        // Step 2: Create all Handles concurrently
        const [configHandle, dbHandle, logHandle] = await Promise.all([
          resourceManager.createHandleFromURI(configUri),
          resourceManager.createHandleFromURI(dbUri),
          resourceManager.createHandleFromURI(logUri)
        ]);

        resources.push(configHandle, dbHandle, logHandle);

        // Step 3: Verify all Handles are created correctly
        expect(configHandle.constructor.name).toBe('ConfigHandle');
        expect(dbHandle.constructor.name).toBe('MongoHandle');
        expect(logHandle.constructor.name).toBe('FileHandle');

        // Step 4: Test Handle caching - same URI should return cached instance
        const cachedConfigHandle = await resourceManager.createHandleFromURI(configUri);
        expect(cachedConfigHandle).toBe(configHandle); // Same object reference

        // Step 5: Verify cache statistics
        const cacheStats = resourceManager.getHandleCacheStats();
        expect(cacheStats.handles.currentSize).toBeGreaterThanOrEqual(3);

        // Step 6: Test cache invalidation pattern
        resourceManager.invalidateHandleCache('.*mongodb.*');
        
        // MongoDB Handle should be gone from cache, but others remain
        const newDbHandle = await resourceManager.createHandleFromURI(dbUri);
        expect(newDbHandle).not.toBe(dbHandle); // Different instance
        resources.push(newDbHandle);

        // Step 7: Verify the config handle is still cached
        const stillCachedConfig = await resourceManager.createHandleFromURI(configUri);
        expect(stillCachedConfig).toBe(configHandle); // Still same instance

      } finally {
        // Step 8: Clean up all resources
        resources.forEach(handle => {
          if (handle && !handle.isDestroyed()) {
            handle.destroy();
          }
        });
      }
    });
  });

  describe('Static Factory Method Workflow', () => {
    it('should demonstrate using static ResourceManager.fromURI method', async () => {
      // Step 1: Use static factory method (convenient for standalone usage)
      const handle = await ResourceManager.fromURI('legion://local/env/ANTHROPIC_API_KEY');
      
      // Step 2: Verify Handle creation
      expect(handle.constructor.name).toBe('ConfigHandle');
      expect(handle.configKey).toBe('ANTHROPIC_API_KEY');

      // Step 3: Use Handle normally
      const value = handle.getValue();
      expect(value).toBeDefined();

      // Step 4: Clean up
      handle.destroy();
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should demonstrate proper error handling throughout workflow', async () => {
      // Step 1: Test invalid URI handling
      const invalidUris = [
        'not-a-uri',
        'legion://',
        'legion://local',
        'legion://local/unsupported/test'
      ];

      for (const uri of invalidUris) {
        await expect(resourceManager.createHandleFromURI(uri))
          .rejects
          .toThrow();
      }

      // Step 2: Test Handle operations on destroyed Handle
      const validHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
      validHandle.destroy();

      expect(() => validHandle.getValue()).toThrow('ConfigHandle has been destroyed');
      expect(() => validHandle.getMetadata()).toThrow('ConfigHandle has been destroyed');

      // Step 3: Test operations on non-existent configuration
      const nonExistentHandle = await resourceManager.createHandleFromURI('legion://local/env/NON_EXISTENT');
      expect(nonExistentHandle.getValue()).toBeUndefined();
      expect(nonExistentHandle.hasConfigKey('NON_EXISTENT')).toBe(false);
      
      nonExistentHandle.destroy();
    });
  });

  describe('Resource Cleanup and Lifecycle Workflow', () => {
    it('should demonstrate proper resource lifecycle management', async () => {
      // Step 1: Create multiple Handles
      const handles = [];
      for (let i = 0; i < 3; i++) {
        const uri = resourceManager.toURI('env', `TEST_VAR_${i}`);
        const handle = await resourceManager.createHandleFromURI(uri);
        handles.push(handle);
      }

      // Step 2: Verify all Handles are active
      handles.forEach(handle => {
        expect(handle.isDestroyed()).toBe(false);
      });

      // Step 3: Verify cache contains all Handles
      expect(resourceManager._handleCache.size).toBeGreaterThanOrEqual(3);

      // Step 4: Destroy individual Handle
      handles[0].destroy();
      expect(handles[0].isDestroyed()).toBe(true);

      // Step 5: Verify destroyed Handle is removed from cache
      expect(resourceManager._handleCache.get(handles[0].toURI())).toBeUndefined();

      // Step 6: Clear all caches (should destroy remaining Handles)
      resourceManager.clearHandleCaches();
      
      // Step 7: Verify all remaining Handles are destroyed and cache is empty
      handles.slice(1).forEach(handle => {
        expect(handle.isDestroyed()).toBe(true);
      });
      expect(resourceManager._handleCache.size).toBe(0);
    });
  });

  describe('Concurrent Access Workflow', () => {
    it('should demonstrate safe concurrent access patterns', async () => {
      const uri = 'legion://local/env/ANTHROPIC_API_KEY';
      
      // Step 1: Create multiple concurrent requests for same URI
      const promises = Array(10).fill(null).map(() => 
        resourceManager.createHandleFromURI(uri)
      );

      // Step 2: Wait for all to complete
      const handles = await Promise.all(promises);

      // Step 3: Verify all are the same cached instance (no race conditions)
      const firstHandle = handles[0];
      handles.forEach(handle => {
        expect(handle).toBe(firstHandle);
      });

      // Step 4: Verify only one instance in cache
      expect(resourceManager._handleCache.size).toBe(1);

      // Step 5: Clean up
      firstHandle.destroy();
      
      // Step 6: Verify all references are destroyed
      handles.forEach(handle => {
        expect(handle.isDestroyed()).toBe(true);
      });
    });
  });

  describe('Subscription Workflow', () => {
    it('should demonstrate Handle subscription lifecycle', async () => {
      // Step 1: Create Handle
      const configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');

      // Step 2: Set up subscriptions
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const subscription1 = configHandle.subscribe(callback1);
      const subscription2 = configHandle.subscribe(callback2, { watchAll: true });

      // Step 3: Verify subscriptions are created
      expect(subscription1).toBeDefined();
      expect(subscription2).toBeDefined();
      expect(typeof subscription1.unsubscribe).toBe('function');
      expect(typeof subscription2.unsubscribe).toBe('function');

      // Step 4: Test subscription cleanup
      subscription1.unsubscribe();
      subscription2.unsubscribe();

      // Should not throw
      expect(() => subscription1.unsubscribe()).not.toThrow();
      expect(() => subscription2.unsubscribe()).not.toThrow();

      // Step 5: Clean up Handle
      configHandle.destroy();
    });
  });

  describe('Clone and Export Workflow', () => {
    it('should demonstrate Handle cloning and export operations', async () => {
      // Step 1: Create original Handle
      const originalHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');

      // Step 2: Clone Handle
      const clonedHandle = originalHandle.clone();
      
      // Step 3: Verify clone properties
      expect(clonedHandle).not.toBe(originalHandle); // Different instances
      expect(clonedHandle.toURI()).toBe(originalHandle.toURI()); // Same URI
      expect(clonedHandle.configKey).toBe(originalHandle.configKey);
      expect(clonedHandle.getValue()).toBe(originalHandle.getValue());

      // Step 4: Test independent lifecycle
      originalHandle.destroy();
      expect(originalHandle.isDestroyed()).toBe(true);
      expect(clonedHandle.isDestroyed()).toBe(false); // Clone still active

      // Step 5: Export configuration from clone
      const publicExport = clonedHandle.export({ includeSecrets: false });
      const fullExport = clonedHandle.export({ includeSecrets: true });

      expect(publicExport.ANTHROPIC_API_KEY).toBeUndefined();
      expect(fullExport.ANTHROPIC_API_KEY).toBeDefined();

      // Step 6: Clean up clone
      clonedHandle.destroy();
    });
  });

  describe('Real-World Application Integration Workflow', () => {
    it('should demonstrate complete application setup using Handle/URI system', async () => {
      // Simulate setting up an application that uses multiple resources
      const app = {
        config: null,
        database: null,
        logFile: null,
        isInitialized: false
      };

      try {
        // Step 1: Initialize application configuration
        app.config = await ResourceManager.fromURI('legion://local/env/ANTHROPIC_API_KEY');
        expect(app.config.getValue()).toBeDefined();

        // Step 2: Set up database connection Handle
        app.database = await resourceManager.createHandleFromURI('legion://local/mongodb/appdb/users');
        expect(app.database.constructor.name).toBe('MongoHandle');

        // Step 3: Set up logging Handle
        app.logFile = await resourceManager.createHandleFromURI('legion://local/filesystem/logs/app.log');
        expect(app.logFile.constructor.name).toBe('FileHandle');

        // Step 4: Verify all components are ready
        expect(app.config.getValue()).toBeDefined();
        expect(app.database.getSchema().database).toBe('appdb');
        expect(app.logFile.toURI()).toContain('logs/app.log');

        // Step 5: Mark application as initialized
        app.isInitialized = true;
        expect(app.isInitialized).toBe(true);

        // Step 6: Test application operations
        const configMetadata = app.config.getMetadata();
        expect(configMetadata.dataSourceType).toBe('ConfigDataSource');

        const dbSchema = app.database.getSchema();
        expect(dbSchema.type).toBe('mongodb');
        expect(dbSchema.collection).toBe('users');

        // Step 7: Test resource serialization for monitoring/debugging
        const appState = {
          config: app.config.toJSON(),
          database: app.database.toJSON(),
          logFile: app.logFile.toJSON(),
          initialized: app.isInitialized
        };

        expect(appState.config.type).toBe('ConfigHandle');
        expect(appState.database.type).toBe('MongoHandle');
        expect(appState.logFile.type).toBe('FileHandle');
        expect(appState.initialized).toBe(true);

      } finally {
        // Step 8: Application shutdown - clean up resources
        if (app.config && !app.config.isDestroyed()) {
          app.config.destroy();
        }
        if (app.database && !app.database.isDestroyed()) {
          app.database.destroy();
        }
        if (app.logFile && !app.logFile.isDestroyed()) {
          app.logFile.destroy();
        }
        app.isInitialized = false;
      }
    });
  });
});