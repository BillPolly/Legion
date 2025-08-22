/**
 * Test to verify that Qdrant collections are NOT arbitrarily created during initialization
 * Collections should only be created when actually needed (during data insertion)
 */

import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { StorageProvider } from '@legion/storage';
import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { ToolRegistry } from '../../src/index.js';
import { ModuleDiscovery } from '../../src/loading/ModuleDiscovery.js';

describe('Verify No Arbitrary Collection Creation', () => {
  let resourceManager;
  let loadingManager;
  let qdrantClient;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Get Qdrant client to monitor collections
    try {
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      qdrantClient = new QdrantClient({
        url: process.env.QDRANT_URL || 'http://localhost:6333'
      });
    } catch (error) {
      console.log('Qdrant client not available, skipping collection monitoring');
    }
  });
  
  afterAll(async () => {
    // Cleanup if needed
  });
  
  describe('Clear operation', () => {
    it('should NOT create Qdrant collections during clear', async () => {
      // Get initial collection count
      let initialCollections = [];
      if (qdrantClient) {
        const result = await qdrantClient.getCollections();
        initialCollections = result.collections.map(c => c.name);
        console.log('Initial collections:', initialCollections);
      }
      
      // Create loading manager
      loadingManager = new LoadingManager({ resourceManager });
      await loadingManager.initialize();
      
      // Run clear operation
      const clearResult = await loadingManager.clearForReload();
      
      // Verify clear succeeded (clearForReload returns { totalCleared })
      expect(clearResult).toBeDefined();
      expect(clearResult.totalCleared).toBeGreaterThanOrEqual(0);
      
      // Check that no new collections were created
      if (qdrantClient) {
        const result = await qdrantClient.getCollections();
        const finalCollections = result.collections.map(c => c.name);
        
        // Should have same or fewer collections (clear might delete but not create)
        expect(finalCollections.length).toBeLessThanOrEqual(initialCollections.length);
        
        // No new collections should exist
        const newCollections = finalCollections.filter(c => !initialCollections.includes(c));
        expect(newCollections).toEqual([]);
        
        console.log('✅ No collections created during clear operation');
      }
    });
  });
  
  describe('Initialization', () => {
    it('should NOT create collections during ToolRegistry initialization', async () => {
      // Get initial collection count
      let initialCollections = [];
      if (qdrantClient) {
        const result = await qdrantClient.getCollections();
        initialCollections = result.collections.map(c => c.name);
      }
      
      // Create and initialize ToolRegistry
      const toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();
      
      // Check that no new collections were created
      if (qdrantClient) {
        const result = await qdrantClient.getCollections();
        const finalCollections = result.collections.map(c => c.name);
        
        // Should have same collections
        expect(finalCollections.length).toBe(initialCollections.length);
        
        console.log('✅ No collections created during ToolRegistry initialization');
      }
    });
    
    it('should NOT create collections during ModuleDiscovery', async () => {
      // Get initial collection count
      let initialCollections = [];
      if (qdrantClient) {
        const result = await qdrantClient.getCollections();
        initialCollections = result.collections.map(c => c.name);
      }
      
      // Run module discovery
      const discovery = new ModuleDiscovery();
      const result = await discovery.discover();
      
      // Check that no new collections were created
      if (qdrantClient) {
        const collResult = await qdrantClient.getCollections();
        const finalCollections = collResult.collections.map(c => c.name);
        
        // Should have same collections
        expect(finalCollections.length).toBe(initialCollections.length);
        
        console.log('✅ No collections created during module discovery');
      }
      
      expect(result.modules).toBeDefined();
      expect(result.modules.length).toBeGreaterThan(0);
    });
  });
  
  describe('Collection creation', () => {
    it('should ONLY create collection when actually inserting vectors', async () => {
      // Clear any existing collection first
      if (qdrantClient) {
        try {
          await qdrantClient.deleteCollection('test_collection');
        } catch (error) {
          // Collection might not exist
        }
      }
      
      // Get initial collection count
      let initialCollections = [];
      if (qdrantClient) {
        const result = await qdrantClient.getCollections();
        initialCollections = result.collections.map(c => c.name);
        expect(initialCollections).not.toContain('test_collection');
      }
      
      // Create loading manager
      loadingManager = new LoadingManager({ resourceManager });
      await loadingManager.initialize();
      
      // Simply initializing should NOT create the collection
      if (qdrantClient) {
        const result = await qdrantClient.getCollections();
        const collections = result.collections.map(c => c.name);
        expect(collections).not.toContain('test_collection');
      }
      
      // Now actually insert vectors (this SHOULD create the collection)
      const vectorStore = loadingManager.vectorStore;
      if (vectorStore) {
        await vectorStore.upsert('test_collection', [
          {
            id: 'test-1',
            vector: new Array(768).fill(0.1),
            payload: { name: 'test' }
          }
        ]);
        
        // NOW the collection should exist
        if (qdrantClient) {
          const result = await qdrantClient.getCollections();
          const collections = result.collections.map(c => c.name);
          expect(collections).toContain('test_collection');
          
          console.log('✅ Collection created only when needed during upsert');
        }
      }
    });
  });
});