/**
 * Example demonstrating the new storage abstraction
 */

import { KGEngine, createTripleStore, InMemoryTripleStore, StorageConfig } from '../index.js';

export function storageAbstractionExample() {
  console.log('\n=== Storage Abstraction Example ===\n');

  // Method 1: Using default storage (InMemoryTripleStore)
  console.log('1. Creating KGEngine with default storage:');
  const engine1 = new KGEngine();
  console.log('Storage type:', engine1.getStorageMetadata().type);

  // Method 2: Creating storage explicitly and passing to KGEngine
  console.log('\n2. Creating KGEngine with explicit storage:');
  const store = new InMemoryTripleStore();
  const engine2 = new KGEngine(store);
  console.log('Storage type:', engine2.getStorageMetadata().type);

  // Method 3: Using StorageConfig factory
  console.log('\n3. Creating storage using StorageConfig:');
  const store3 = StorageConfig.createStore({ type: 'memory' });
  const engine3 = new KGEngine(store3);
  console.log('Storage type:', engine3.getStorageMetadata().type);

  // Method 4: Using convenience function
  console.log('\n4. Creating storage using convenience function:');
  const store4 = createTripleStore({ type: 'memory' });
  const engine4 = new KGEngine(store4);
  console.log('Storage type:', engine4.getStorageMetadata().type);

  // Demonstrate backward compatibility
  console.log('\n5. Demonstrating backward compatibility:');
  const engine = new KGEngine();
  
  // Synchronous operations (backward compatible)
  console.log('Adding triples synchronously...');
  engine.addTriple('person:john', 'name', 'John Doe');
  engine.addTriple('person:john', 'age', 30);
  engine.addTriple('person:jane', 'name', 'Jane Smith');
  
  const results = engine.query('person:john', null, null);
  console.log('John\'s data:', results);

  // Asynchronous operations (new API)
  console.log('\n6. Demonstrating new async API:');
  return demonstrateAsyncAPI(engine);
}

async function demonstrateAsyncAPI(engine) {
  console.log('Adding triples asynchronously...');
  await engine.addTripleAsync('person:bob', 'name', 'Bob Wilson');
  await engine.addTripleAsync('person:bob', 'age', 25);
  
  const results = await engine.queryAsync('person:bob', null, null);
  console.log('Bob\'s data:', results);
  
  const totalTriples = await engine.size();
  console.log('Total triples in store:', totalTriples);
  
  // Batch operations
  console.log('\nDemonstrating batch operations:');
  const newTriples = [
    ['person:alice', 'name', 'Alice Brown'],
    ['person:alice', 'age', 28],
    ['person:alice', 'city', 'New York']
  ];
  
  const addedCount = await engine.addTriples(newTriples);
  console.log('Added', addedCount, 'new triples');
  
  const finalSize = await engine.size();
  console.log('Final total triples:', finalSize);
  
  // Check if specific triple exists
  const exists = await engine.exists('person:alice', 'city', 'New York');
  console.log('Alice lives in New York:', exists);
  
  return {
    totalTriples: finalSize,
    storageType: engine.getStorageMetadata().type,
    supportsAsync: engine.getStorageMetadata().supportsAsync
  };
}

export function demonstrateStorageConfiguration() {
  console.log('\n=== Storage Configuration Examples ===\n');

  // Show different storage configurations (even though not implemented yet)
  console.log('1. Memory storage config:');
  const memoryConfig = StorageConfig.getDefaultConfig('memory');
  console.log(JSON.stringify(memoryConfig, null, 2));

  console.log('\n2. File storage config (not implemented):');
  const fileConfig = StorageConfig.getDefaultConfig('file');
  console.log(JSON.stringify(fileConfig, null, 2));

  console.log('\n3. GitHub storage config (not implemented):');
  const githubConfig = StorageConfig.getDefaultConfig('github');
  console.log(JSON.stringify(githubConfig, null, 2));

  console.log('\n4. Validating configurations:');
  try {
    StorageConfig.validateConfig({ type: 'memory' });
    console.log('✓ Memory config is valid');
  } catch (error) {
    console.log('✗ Memory config error:', error.message);
  }

  try {
    StorageConfig.validateConfig({ type: 'file', path: './data.json' });
    console.log('✓ File config is valid');
  } catch (error) {
    console.log('✗ File config error:', error.message);
  }

  try {
    StorageConfig.validateConfig({ type: 'invalid' });
    console.log('✓ Invalid config is valid');
  } catch (error) {
    console.log('✗ Invalid config error:', error.message);
  }
}

// Run the examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const result = await storageAbstractionExample();
      console.log('\nExample completed successfully:', result);
      
      demonstrateStorageConfiguration();
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}
