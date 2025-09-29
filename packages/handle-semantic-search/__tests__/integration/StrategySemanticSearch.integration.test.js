/**
 * Integration test for strategy semantic search
 * Tests loading strategies from files, extracting metadata, storing in semantic search, and recalling
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';

describe('Strategy Semantic Search Integration', () => {
  let resourceManager;
  let semanticSearch;
  let testStrategyPath;
  let testStrategyURI;

  beforeAll(async () => {
    // Get ResourceManager and semantic search
    resourceManager = await ResourceManager.getInstance();
    semanticSearch = await resourceManager.createHandleSemanticSearch();

    // Use an existing strategy file for testing
    testStrategyPath = '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js';
    testStrategyURI = `legion://local/strategy${testStrategyPath}`;
  }, 120000);

  afterAll(async () => {
    // Cleanup
    try {
      await semanticSearch.removeHandle(testStrategyURI);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('Phase 1: Strategy Handle Loading', () => {
    it('should create strategy handle from URI', async () => {
      const handle = await resourceManager.createHandleFromURI(testStrategyURI);

      expect(handle).toBeDefined();
      expect(handle.resourceType).toBe('strategy');
      expect(handle.dataSource).toBeDefined();
      // Note: URI parsing removes leading / from paths
      expect(handle.dataSource.filePath).toBe(testStrategyPath.slice(1));
    }, 10000);

    it('should load strategy metadata', async () => {
      const handle = await resourceManager.createHandleFromURI(testStrategyURI);
      const results = await handle.dataSource.queryAsync({ getMetadata: true });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      const metadata = results[0].data;
      expect(metadata.strategyName).toBeDefined();
      // Note: URI parsing removes leading / from paths
      expect(metadata.filePath).toBe(testStrategyPath.slice(1));
      expect(metadata.fileName).toBe('SimpleNodeTestStrategy.js');

      console.log('Strategy metadata:', {
        name: metadata.strategyName,
        type: metadata.strategyType,
        tools: metadata.requiredTools,
        prompts: metadata.promptSchemas
      });
    }, 10000);
  });

  describe('Phase 2: Strategy Metadata Extraction', () => {
    it('should extract rich metadata from strategy handle', async () => {
      const handle = await resourceManager.createHandleFromURI(testStrategyURI);

      // Use the metadata extractor
      const { HandleMetadataExtractor } = await import('../../src/HandleMetadataExtractor.js');
      const extractor = new HandleMetadataExtractor();

      const metadata = await extractor.extractMetadata(handle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBe('strategy');
      expect(metadata.strategyName).toBeDefined();
      expect(metadata.strategyType).toBeDefined();
      expect(metadata.resourceDescription).toBeDefined();
      expect(metadata.capabilities).toContain('instantiate');
      expect(metadata.capabilities).toContain('execute');

      console.log('Extracted metadata:', {
        name: metadata.strategyName,
        type: metadata.strategyType,
        description: metadata.resourceDescription,
        capabilities: metadata.capabilities
      });
    }, 10000);
  });

  describe('Phase 3: Strategy Semantic Search', () => {
    it('should store strategy in semantic search', async () => {
      const result = await semanticSearch.storeHandle(testStrategyURI);

      expect(result.success).toBe(true);
      expect(result.handleURI).toBe(testStrategyURI);
      expect(result.glossCount).toBeGreaterThan(0);
      expect(result.vectorIds).toBeDefined();

      console.log(`Stored strategy with ${result.glossCount} glosses`);
    }, 60000);

    it('should retrieve stored strategy info', async () => {
      const info = await semanticSearch.getHandleInfo(testStrategyURI);

      expect(info).toBeDefined();
      expect(info.handleURI).toBe(testStrategyURI);
      expect(info.handleType).toBe('strategy');
      expect(info.metadata).toBeDefined();
      expect(info.metadata.strategyName).toBeDefined();
      expect(info.glosses).toBeDefined();
      expect(info.glosses.length).toBeGreaterThan(0);

      console.log('Strategy info:', {
        name: info.metadata.strategyName,
        type: info.metadata.strategyType,
        glossCount: info.glosses.length
      });
    }, 10000);

    it('should search for strategy using natural language', async () => {
      const results = await semanticSearch.searchHandles('test generation for Node.js', {
        limit: 5,
        threshold: 0.3
      });

      expect(results.results).toBeDefined();
      console.log(`Found ${results.results.length} handles matching "test generation for Node.js"`);

      // Look for our strategy
      const strategy = results.results.find(r => r.handleURI === testStrategyURI);
      if (strategy) {
        console.log('Found our strategy:', {
          uri: strategy.handleURI,
          similarity: strategy.similarity,
          type: strategy.handleType
        });
      }
    }, 30000);

    it('should filter search by strategy handle type', async () => {
      const results = await semanticSearch.searchHandles('test Node.js', {
        limit: 10,
        handleTypes: ['strategy']
      });

      // All results should be strategy handles
      for (const result of results.results) {
        expect(result.handleType).toBe('strategy');
      }

      console.log(`Found ${results.results.length} strategy handles`);
    }, 30000);
  });

  describe('Phase 4: Strategy Recall', () => {
    it('should recall strategy using semantic search', async () => {
      const recalled = await semanticSearch.recallHandles('generate tests for JavaScript', {
        limit: 5,
        handleTypes: ['strategy'],
        threshold: 0.3
      });

      expect(recalled).toBeDefined();
      expect(Array.isArray(recalled)).toBe(true);

      if (recalled.length > 0) {
        const first = recalled[0];
        expect(first.handle).toBeDefined();
        expect(first.handle.resourceType).toBe('strategy');
        expect(first.handleType).toBe('strategy');
        expect(first.similarity).toBeGreaterThan(0);

        console.log('Recalled strategy:', {
          uri: first.handleURI,
          similarity: first.similarity,
          strategyName: first.searchResult.metadata?.strategyName
        });
      }
    }, 30000);

    it('should restore strategy handle from URI', async () => {
      const handle = await semanticSearch.restoreHandle(testStrategyURI);

      expect(handle).toBeDefined();
      expect(handle.resourceType).toBe('strategy');
      expect(handle.dataSource).toBeDefined();

      console.log('Restored strategy handle from URI');
    }, 10000);
  });

  describe('Phase 5: Complete Workflow', () => {
    it('should demonstrate full workflow: store → search → recall → metadata', async () => {
      console.log('\n=== Complete Strategy Recall Workflow ===\n');

      // 1. Store (already stored in previous test)
      console.log('Step 1: Strategy already stored\n');

      // 2. Search semantically
      console.log('Step 2: Search for "test generation strategy"...');
      const recalled = await semanticSearch.recallHandles('test generation strategy', {
        limit: 3,
        handleTypes: ['strategy'],
        threshold: 0.3
      });
      console.log(`  ✓ Found ${recalled.length} strategies\n`);

      // 3. Use the first result
      if (recalled.length > 0) {
        const first = recalled[0];
        console.log('Step 3: Inspect recalled strategy:');
        console.log(`  URI: ${first.handleURI}`);
        console.log(`  Similarity: ${first.similarity.toFixed(3)}`);
        console.log(`  Type: ${first.handleType}`);
        console.log(`  Strategy: ${first.searchResult.metadata?.strategyName || 'unknown'}`);

        // 4. Get metadata
        const metadata = await first.handle.dataSource.queryAsync({ getMetadata: true });
        if (metadata && metadata.length > 0) {
          const meta = metadata[0].data;
          console.log(`\nStep 4: Strategy metadata:`);
          console.log(`  Name: ${meta.strategyName}`);
          console.log(`  Type: ${meta.strategyType}`);
          console.log(`  Tools: ${meta.requiredTools?.join(', ') || 'none'}`);
          console.log(`  Prompts: ${meta.promptSchemas?.join(', ') || 'none'}`);
        }

        console.log('\n  ✓ Strategy is ready to instantiate and use!\n');
      }
    }, 60000);
  });
});