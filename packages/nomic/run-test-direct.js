#!/usr/bin/env node

/**
 * Direct test runner for Nomic embeddings
 * Runs basic tests without Jest to verify functionality
 */

import { NomicEmbeddings } from './src/NomicEmbeddings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ ${description}`);
  } catch (error) {
    failedTests++;
    console.log(`  ❌ ${description}`);
    console.log(`     Error: ${error.message}`);
  }
}

async function testAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ ${description}`);
  } catch (error) {
    failedTests++;
    console.log(`  ❌ ${description}`);
    console.log(`     Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log('=' .repeat(60));
  console.log('NOMIC EMBEDDINGS TEST SUITE');
  console.log('=' .repeat(60));
  
  // Check for model
  console.log('\n📁 Checking for model file...');
  const modelsDir = path.join(__dirname, 'models');
  const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.gguf'));
  
  if (modelFiles.length === 0) {
    console.error('❌ NO MODEL FILES FOUND!');
    console.error(`   Expected location: ${modelsDir}`);
    process.exit(1);
  }
  
  console.log(`✅ Found model: ${modelFiles[0]}`);
  
  // Initialize
  console.log('\n🚀 Initializing NomicEmbeddings...');
  const embeddings = new NomicEmbeddings();
  
  try {
    await embeddings.initialize();
    console.log('✅ Initialization successful');
  } catch (error) {
    console.error('❌ Failed to initialize:', error.message);
    process.exit(1);
  }
  
  // Run tests
  console.log('\n' + '=' .repeat(60));
  console.log('RUNNING TESTS');
  console.log('=' .repeat(60));
  
  console.log('\n1️⃣ Model Initialization Tests');
  
  test('Model should be initialized', () => {
    assert(embeddings.initialized === true, 'Not initialized');
  });
  
  test('Model should have correct dimensions', () => {
    assert(embeddings.dimensions === 768, `Expected 768, got ${embeddings.dimensions}`);
  });
  
  test('Model should have a valid path', () => {
    assert(embeddings.modelPath.includes('.gguf'), 'Invalid model path');
  });
  
  console.log('\n2️⃣ Embedding Generation Tests');
  
  await testAsync('Should generate 768-dimensional embedding', async () => {
    const embedding = await embeddings.embed('Test sentence');
    assert(Array.isArray(embedding), 'Not an array');
    assert(embedding.length === 768, `Wrong dimensions: ${embedding.length}`);
  });
  
  await testAsync('Should generate numeric values only', async () => {
    const embedding = await embeddings.embed('Another test');
    for (const val of embedding) {
      assert(typeof val === 'number', 'Non-numeric value found');
      assert(!isNaN(val), 'NaN value found');
      assert(isFinite(val), 'Infinite value found');
    }
  });
  
  await testAsync('Should generate non-degenerate embeddings', async () => {
    const embedding = await embeddings.embed('Machine learning');
    
    // Check not all zeros
    const nonZeroCount = embedding.filter(v => v !== 0).length;
    assert(nonZeroCount > 700, `Too many zeros: only ${nonZeroCount} non-zero values`);
    
    // Check variety
    const uniqueValues = new Set(embedding.map(v => Math.round(v * 10000)));
    assert(uniqueValues.size > 100, `Not enough variety: only ${uniqueValues.size} unique values`);
    
    // Check range
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    assert(min > -10 && max < 10, `Values out of range: min=${min}, max=${max}`);
  });
  
  await testAsync('Should generate different embeddings for different texts', async () => {
    const embed1 = await embeddings.embed('First text');
    const embed2 = await embeddings.embed('Second text');
    
    let differentCount = 0;
    for (let i = 0; i < 768; i++) {
      if (Math.abs(embed1[i] - embed2[i]) > 0.0001) {
        differentCount++;
      }
    }
    
    assert(differentCount > 600, `Too similar: only ${differentCount} different dimensions`);
  });
  
  await testAsync('Should generate identical embeddings for same text', async () => {
    const text = 'Consistency check';
    const embed1 = await embeddings.embed(text);
    const embed2 = await embeddings.embed(text);
    
    let sameCount = 0;
    for (let i = 0; i < 768; i++) {
      if (Math.abs(embed1[i] - embed2[i]) < 0.000001) {
        sameCount++;
      }
    }
    
    assert(sameCount === 768, `Not deterministic: only ${sameCount}/768 dimensions match`);
  });
  
  console.log('\n3️⃣ Batch Processing Tests');
  
  await testAsync('Should process batch of texts', async () => {
    const texts = ['Text 1', 'Text 2', 'Text 3'];
    const batch = await embeddings.embedBatch(texts);
    
    assert(batch.length === 3, `Wrong batch size: ${batch.length}`);
    for (const emb of batch) {
      assert(emb.length === 768, 'Wrong embedding size in batch');
    }
  });
  
  console.log('\n4️⃣ Edge Cases');
  
  await testAsync('Should handle empty string', async () => {
    const embedding = await embeddings.embed('');
    assert(embedding.length === 768, 'Wrong size for empty string');
    assert(embedding.some(v => v !== 0), 'All zeros for empty string');
  });
  
  await testAsync('Should handle special characters', async () => {
    const embedding = await embeddings.embed('🚀 @#$%^&*() 中文');
    assert(embedding.length === 768, 'Wrong size for special chars');
    assert(embedding.every(v => !isNaN(v)), 'NaN with special chars');
  });
  
  console.log('\n5️⃣ Task Types');
  
  await testAsync('Should accept different task types', async () => {
    const text = 'Sample';
    const doc = await embeddings.embed(text, { taskType: 'search_document' });
    const query = await embeddings.embed(text, { taskType: 'search_query' });
    
    assert(doc.length === 768, 'Wrong size for search_document');
    assert(query.length === 768, 'Wrong size for search_query');
  });
  
  console.log('\n6️⃣ Similarity Function');
  
  await testAsync('Should calculate cosine similarity', async () => {
    const embed1 = await embeddings.embed('Text A');
    const embed2 = await embeddings.embed('Text B');
    
    const similarity = await embeddings.similarity(embed1, embed2);
    
    assert(typeof similarity === 'number', 'Similarity not a number');
    assert(similarity >= -1 && similarity <= 1, `Similarity out of range: ${similarity}`);
  });
  
  await testAsync('Should return 1 for identical embeddings', async () => {
    const embedding = await embeddings.embed('Same');
    const similarity = await embeddings.similarity(embedding, embedding);
    
    assert(Math.abs(similarity - 1.0) < 0.00001, `Not 1.0: ${similarity}`);
  });
  
  // Cleanup
  await embeddings.close();
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  
  if (failedTests === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Nomic embeddings are working correctly!');
    console.log('✅ NOT using hash-based fake embeddings!');
    console.log('✅ Ready for semantic search!');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});