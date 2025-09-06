#!/usr/bin/env node

/**
 * Storage System Demo
 * 
 * This demo showcases the different storage providers available in the
 * Knowledge Graph system, including in-memory, file-based, and other
 * storage backends.
 */

import { KGEngine } from '../src/core/KGEngine.js';
import { 
  InMemoryTripleStore,
  FileSystemTripleStore,
  StorageConfig 
} from '../src/storage/index.js';
import { promises as fs } from 'fs';
import path from 'path';

console.log('💾 Storage System Demo\n');

// Sample data for testing
const sampleTriples = [
  ['john', 'rdf:type', 'Person'],
  ['john', 'name', 'John Smith'],
  ['john', 'age', 30],
  ['jane', 'rdf:type', 'Person'],
  ['jane', 'name', 'Jane Doe'],
  ['jane', 'age', 25],
  ['john', 'knows', 'jane'],
  ['acme', 'rdf:type', 'Company'],
  ['acme', 'name', 'Acme Corp'],
  ['john', 'worksAt', 'acme'],
  ['jane', 'worksAt', 'acme']
];

// Demo 1: In-Memory Storage
async function demoInMemoryStorage() {
  console.log('🧠 Demo 1: In-Memory Storage');
  console.log('============================');
  
  const memoryStore = new InMemoryTripleStore();
  const kg = new KGEngine(memoryStore);
  
  console.log('Adding sample data to in-memory store...');
  
  // Add sample triples
  for (const [s, p, o] of sampleTriples) {
    await kg.addTripleAsync(s, p, o);
  }
  
  const size = await kg.size();
  console.log(`✅ Added ${size} triples to memory store`);
  
  // Query the data
  const people = await kg.query(null, 'rdf:type', 'Person');
  console.log(`Found ${people.length} people:`);
  people.forEach(([personId]) => {
    console.log(`  - ${personId}`);
  });
  
  // Test performance
  const startTime = Date.now();
  for (let i = 0; i < 1000; i++) {
    await kg.query(null, 'rdf:type', 'Person');
  }
  const endTime = Date.now();
  console.log(`Performance: 1000 queries in ${endTime - startTime}ms`);
  
  console.log();
}

// Demo 2: File System Storage
async function demoFileSystemStorage() {
  console.log('📁 Demo 2: File System Storage');
  console.log('==============================');
  
  const dataDir = './demo-data';
  const filePath = path.join(dataDir, 'kg-demo.json');
  
  // Ensure directory exists
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  // Clean up any existing file
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // File might not exist
  }
  
  const fileStore = new FileSystemTripleStore(filePath, {
    format: 'json',
    autoSave: true
  });
  
  const kg = new KGEngine(fileStore);
  
  console.log(`Storing data in: ${filePath}`);
  
  // Add sample triples
  for (const [s, p, o] of sampleTriples) {
    await kg.addTripleAsync(s, p, o);
  }
  
  const size = await kg.size();
  console.log(`✅ Added ${size} triples to file store`);
  
  // Force save
  await fileStore.save();
  
  // Check if file was created
  try {
    const stats = await fs.stat(filePath);
    console.log(`File size: ${stats.size} bytes`);
  } catch (error) {
    console.log('❌ File was not created');
  }
  
  // Test persistence by creating a new store instance
  console.log('\nTesting persistence...');
  const newFileStore = new FileSystemTripleStore(filePath, {
    format: 'json'
  });
  
  await newFileStore.load();
  const newKg = new KGEngine(newFileStore);
  
  const persistedSize = await newKg.size();
  console.log(`✅ Loaded ${persistedSize} triples from file`);
  
  // Query the persisted data
  const persistedPeople = await newKg.query(null, 'rdf:type', 'Person');
  console.log(`Found ${persistedPeople.length} people in persisted data`);
  
  console.log();
}

// Demo 3: Storage Configuration
async function demoStorageConfiguration() {
  console.log('⚙️  Demo 3: Storage Configuration');
  console.log('=================================');
  
  // Test different storage configurations
  const configs = [
    {
      name: 'Memory Store',
      config: { type: 'memory' }
    },
    {
      name: 'JSON File Store',
      config: { 
        type: 'file', 
        path: './demo-data/config-test.json',
        format: 'json',
        autoSave: true
      }
    }
  ];
  
  for (const { name, config } of configs) {
    console.log(`Testing ${name}...`);
    
    try {
      const store = StorageConfig.createStore(config);
      const kg = new KGEngine(store);
      
      // Add a few test triples
      await kg.addTriple('test', 'rdf:type', 'TestEntity');
      await kg.addTriple('test', 'name', 'Test Entity');
      
      const size = await kg.size();
      console.log(`  ✅ ${name}: ${size} triples stored`);
      
      // Test querying
      const results = await kg.query('test', null, null);
      console.log(`  📊 Query returned ${results.length} results`);
      
    } catch (error) {
      console.log(`  ❌ ${name} failed: ${error.message}`);
    }
  }
  
  console.log();
}

// Demo 4: Batch Operations
async function demoBatchOperations() {
  console.log('📦 Demo 4: Batch Operations');
  console.log('===========================');
  
  const memoryStore = new InMemoryTripleStore();
  const kg = new KGEngine(memoryStore);
  
  // Test individual vs batch operations
  console.log('Testing individual operations...');
  const startIndividual = Date.now();
  
  for (const [s, p, o] of sampleTriples) {
    await kg.addTriple(s, p, o);
  }
  
  const endIndividual = Date.now();
  console.log(`Individual operations: ${endIndividual - startIndividual}ms`);
  
  // Clear and test batch operations
  await kg.clear();
  
  console.log('Testing batch operations...');
  const startBatch = Date.now();
  
  await memoryStore.addTriples(sampleTriples);
  
  const endBatch = Date.now();
  console.log(`Batch operations: ${endBatch - startBatch}ms`);
  
  const finalSize = await kg.size();
  console.log(`✅ Final size: ${finalSize} triples`);
  
  console.log();
}

// Demo 5: Storage Metadata and Statistics
async function demoStorageMetadata() {
  console.log('📊 Demo 5: Storage Metadata and Statistics');
  console.log('==========================================');
  
  const memoryStore = new InMemoryTripleStore();
  const kg = new KGEngine(memoryStore);
  
  // Add sample data
  for (const [s, p, o] of sampleTriples) {
    await kg.addTriple(s, p, o);
  }
  
  // Get metadata
  const metadata = memoryStore.getMetadata();
  console.log('Storage metadata:');
  console.log(`  Type: ${metadata.type}`);
  console.log(`  Created: ${metadata.created}`);
  console.log(`  Version: ${metadata.version}`);
  
  // Get statistics
  const size = await kg.size();
  console.log(`\nStorage statistics:`);
  console.log(`  Total triples: ${size}`);
  
  // Count unique subjects, predicates, objects
  const allTriples = await kg.query(null, null, null);
  const subjects = new Set(allTriples.map(([s]) => s));
  const predicates = new Set(allTriples.map(([, p]) => p));
  const objects = new Set(allTriples.map(([, , o]) => o));
  
  console.log(`  Unique subjects: ${subjects.size}`);
  console.log(`  Unique predicates: ${predicates.size}`);
  console.log(`  Unique objects: ${objects.size}`);
  
  // Most common predicates
  const predicateCount = new Map();
  allTriples.forEach(([, p]) => {
    predicateCount.set(p, (predicateCount.get(p) || 0) + 1);
  });
  
  console.log('\nMost common predicates:');
  Array.from(predicateCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([predicate, count]) => {
      console.log(`  - ${predicate}: ${count}`);
    });
  
  console.log();
}

// Demo 6: Error Handling and Recovery
async function demoErrorHandling() {
  console.log('🚨 Demo 6: Error Handling and Recovery');
  console.log('======================================');
  
  // Test with invalid file path
  console.log('Testing invalid file path...');
  try {
    const invalidStore = new FileSystemTripleStore('/invalid/path/file.json');
    const kg = new KGEngine(invalidStore);
    await kg.addTriple('test', 'test', 'test');
    console.log('❌ Should have failed');
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
  
  // Test with corrupted data recovery
  console.log('\nTesting graceful degradation...');
  const memoryStore = new InMemoryTripleStore();
  const kg = new KGEngine(memoryStore);
  
  // Add valid data
  await kg.addTriple('valid', 'rdf:type', 'Entity');
  
  // Try to add invalid data (should not crash)
  try {
    await kg.addTriple(null, 'test', 'test');
    console.log('❌ Should have failed with null subject');
  } catch (error) {
    console.log(`✅ Correctly rejected null subject: ${error.message}`);
  }
  
  // Verify valid data is still there
  const size = await kg.size();
  console.log(`✅ Valid data preserved: ${size} triples`);
  
  console.log();
}

// Cleanup function
async function cleanup() {
  console.log('🧹 Cleaning up demo files...');
  
  const filesToClean = [
    './demo-data/kg-demo.json',
    './demo-data/config-test.json'
  ];
  
  for (const file of filesToClean) {
    try {
      await fs.unlink(file);
      console.log(`  ✅ Removed ${file}`);
    } catch (error) {
      // File might not exist
    }
  }
  
  // Try to remove demo-data directory if empty
  try {
    await fs.rmdir('./demo-data');
    console.log('  ✅ Removed demo-data directory');
  } catch (error) {
    // Directory might not be empty or not exist
  }
}

// Main demo execution
async function runDemo() {
  try {
    await demoInMemoryStorage();
    await demoFileSystemStorage();
    await demoStorageConfiguration();
    await demoBatchOperations();
    await demoStorageMetadata();
    await demoErrorHandling();
    
    console.log('🎉 Storage demo completed successfully!');
    console.log('\nThe storage system demonstrates:');
    console.log('• Multiple storage backend support (memory, file, etc.)');
    console.log('• Configurable storage providers via configuration objects');
    console.log('• Persistent storage with automatic save/load functionality');
    console.log('• Batch operations for improved performance');
    console.log('• Storage metadata and statistical analysis');
    console.log('• Robust error handling and graceful degradation');
    
  } catch (error) {
    console.error('❌ Storage demo failed:', error);
    console.error(error.stack);
  } finally {
    await cleanup();
  }
}

// Run the demo
runDemo();
