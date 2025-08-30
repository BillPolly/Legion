/**
 * Semantic Search End-to-End Integration Test
 * 
 * Tests the complete semantic search pipeline:
 * 1. Load module -> 2. Generate perspectives -> 3. Index vectors -> 4. Search with metadata
 * 
 * This test should have caught the metadata mapping bug!
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';

describe('Semantic Search End-to-End Integration', () => {
  let toolRegistry;

  beforeAll(async () => {
    toolRegistry = await ToolRegistry.getInstance();
    
    // Clear everything to start fresh
    await toolRegistry.clearAllData();
  }, 30000);

  afterAll(async () => {
    if (toolRegistry) {
      await toolRegistry.cleanup();
    }
  });

  test('complete semantic search pipeline should work end-to-end', async () => {
    console.log('\n🚀 Starting complete semantic search pipeline test...\n');

    // Phase 1: Discover modules first (required before loading)
    console.log('🔍 Phase 1: Discovering modules...');
    const discoverResult = await toolRegistry.discoverModules();
    expect(discoverResult.discovered).toBeGreaterThan(0);
    console.log(`✅ Discovered ${discoverResult.discovered} modules`);
    // Log the module names to see what was discovered
    console.log('Discovered modules:', discoverResult.modules.map(m => m.name));

    // Phase 2: Load Calculator module
    console.log('📦 Phase 2: Loading Calculator module...');
    const loadResult = await toolRegistry.loadMultipleModules(['CalculatorModule']);
    
    expect(loadResult.successful).toBe(1);
    expect(loadResult.failed).toBe(0);
    console.log('✅ Calculator module loaded');

    // Phase 3: Generate perspectives 
    console.log('📝 Phase 3: Generating perspectives...');
    const perspectiveResult = await toolRegistry.generatePerspectives({
      moduleFilter: 'CalculatorModule',
      limit: 1
    });
    
    expect(perspectiveResult.generated).toBeGreaterThan(0);
    console.log(`✅ Generated ${perspectiveResult.generated} perspectives`);

    // Phase 4: Index vectors
    console.log('🔍 Phase 4: Indexing vectors...');
    const indexResult = await toolRegistry.indexVectors();
    
    expect(indexResult.indexed).toBeGreaterThan(0);
    console.log(`✅ Indexed ${indexResult.indexed} vectors`);

    // Phase 5: THE CRITICAL TEST - Semantic search with proper metadata validation
    console.log('🎯 Phase 5: Testing semantic search with metadata validation...');
    
    const searchResults = await toolRegistry.testSemanticSearch(['calculate numbers', 'math'], {
      threshold: 0.1,
      limit: 5
    });

    // Validate search worked
    expect(searchResults.totalQueries).toBe(2);
    expect(searchResults.successfulQueries).toBe(2);
    expect(searchResults.errors).toHaveLength(0);

    // THE BUG TEST: Validate first search result has proper metadata
    const firstQuery = searchResults.results[0];
    expect(firstQuery.query).toBe('calculate numbers');
    expect(firstQuery.resultCount).toBeGreaterThan(0);
    expect(firstQuery.topResult).toBeDefined();

    // CRITICAL METADATA VALIDATION (this would have caught the bug!)
    const topResult = firstQuery.topResult;
    console.log('Top result metadata:', {
      name: topResult.name,
      description: topResult.description,
      moduleName: topResult.moduleName,
      similarity: topResult.similarity,
      perspective: topResult.perspective
    });

    // These assertions would have FAILED and caught the bug
    expect(topResult.name).toBeDefined();
    expect(topResult.name).not.toBe('undefined');
    expect(topResult.name).toBe('calculator'); // Should be the actual tool name
    
    expect(topResult.moduleName).toBeDefined();
    expect(topResult.moduleName).not.toBe('undefined'); 
    expect(topResult.moduleName).toBe('CalculatorModule'); // Should be the actual module name
    
    expect(topResult.similarity).toBeDefined();
    expect(topResult.similarity).toBeGreaterThan(0);
    expect(topResult.similarity).toBeLessThanOrEqual(1);

    console.log('✅ Semantic search metadata validation passed!');

    // Phase 5: Verify search quality
    console.log('📊 Phase 5: Verifying search quality...');
    
    // Second query should also return valid results
    const secondQuery = searchResults.results[1];
    expect(secondQuery.resultCount).toBeGreaterThan(0);
    expect(secondQuery.topResult.name).toBe('calculator');
    
    console.log('✅ Search quality validation passed!');
    
    console.log('\n🎉 Complete semantic search pipeline test PASSED!');
  }, 120000);

  test('semantic search should handle edge cases properly', async () => {
    console.log('\n🧪 Testing semantic search edge cases...');

    // Test empty query
    const emptyResults = await toolRegistry.testSemanticSearch([''], {
      threshold: 0.5,
      limit: 3
    });
    
    expect(emptyResults.results[0].resultCount).toBe(0);

    // Test very high threshold (should return fewer/no results)
    const highThresholdResults = await toolRegistry.testSemanticSearch(['calculate'], {
      threshold: 0.99,
      limit: 10
    });
    
    // With a 0.99 threshold, we should get very few results
    // But calculator tool with "calculate" query might have multiple highly relevant perspectives
    // So we'll allow up to 5 high-quality matches (perspectives) for the same tool
    expect(highThresholdResults.results[0].resultCount).toBeLessThanOrEqual(5);

    console.log('✅ Edge case testing passed!');
  }, 60000);
});