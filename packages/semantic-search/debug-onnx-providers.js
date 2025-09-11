#!/usr/bin/env node

/**
 * Debug script to test ONNX providers and find the working configuration
 */

import ort from 'onnxruntime-node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.resolve(__dirname, '../../models/all-MiniLM-L6-v2-quantized.onnx');

console.log('🔍 ONNX Provider Debug Script');
console.log('================================\n');

// Check model exists
if (!fs.existsSync(modelPath)) {
  console.error('❌ Model not found at:', modelPath);
  process.exit(1);
}
console.log('✅ Model found at:', modelPath);

// List available backends
console.log('\n📋 Available backends:');
const backends = ort.listSupportedBackends ? ort.listSupportedBackends() : [];
backends.forEach(b => console.log(`  - ${b.name} (bundled: ${b.bundled})`));

// Test each provider
const providersToTest = [
  ['cpu'],
  ['coreml', 'cpu'],  // CoreML with CPU fallback
  ['coreml'],         // CoreML only
  ['webgpu', 'cpu'],  // WebGPU with CPU fallback
];

console.log('\n🧪 Testing execution providers...\n');

async function testProvider(providers) {
  console.log(`Testing: [${providers.join(', ')}]`);
  
  try {
    const sessionOptions = {
      executionProviders: providers,
      graphOptimizationLevel: 'disabled',
      enableCpuMemArena: false,
      enableMemPattern: false,
      executionMode: 'sequential',
      logSeverityLevel: 4,
      logVerbosityLevel: 0
    };
    
    const session = await ort.InferenceSession.create(modelPath, sessionOptions);
    
    // Try a simple inference
    const inputShape = [1, 128]; // batch_size=1, sequence_length=128
    const inputIds = new ort.Tensor(
      'int64',
      new BigInt64Array(128).fill(101n), // CLS token
      inputShape
    );
    const attentionMask = new ort.Tensor(
      'int64',
      new BigInt64Array(128).fill(1n),
      inputShape
    );
    const tokenTypeIds = new ort.Tensor(
      'int64',
      new BigInt64Array(128).fill(0n),
      inputShape
    );
    
    const startTime = Date.now();
    const results = await session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds
    });
    const inferenceTime = Date.now() - startTime;
    
    console.log(`  ✅ SUCCESS! Inference time: ${inferenceTime}ms`);
    console.log(`  Output shape: ${results.last_hidden_state.dims}`);
    console.log(`  Output type: ${results.last_hidden_state.type}`);
    
    // Check output data accessibility
    const outputData = results.last_hidden_state.data || results.last_hidden_state.cpuData;
    if (outputData instanceof Float32Array) {
      console.log(`  ✅ Output is Float32Array (length: ${outputData.length})`);
    } else {
      console.log(`  ⚠️ Output type: ${outputData?.constructor?.name || typeof outputData}`);
    }
    
    await session.release();
    return true;
    
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    if (error.message.includes('device')) {
      console.log(`  💡 Device/provider not supported on this system`);
    }
    return false;
  }
}

// Run tests
async function runTests() {
  const results = {};
  
  for (const providers of providersToTest) {
    const key = providers.join('+');
    results[key] = await testProvider(providers);
    console.log('');
  }
  
  console.log('📊 Summary:');
  console.log('===========');
  
  const working = Object.entries(results)
    .filter(([_, success]) => success)
    .map(([providers]) => providers);
  
  if (working.length > 0) {
    console.log('✅ Working providers:');
    working.forEach(p => console.log(`  - [${p}]`));
    
    console.log('\n🎯 Recommended configuration:');
    console.log(`  executionProviders: ['${working[0].split('+').join("', '")}']`);
  } else {
    console.log('❌ No providers worked! This is unexpected.');
  }
  
  // Test with optimizations enabled
  console.log('\n🔧 Testing CPU with optimizations...');
  try {
    const sessionOptions = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',  // Enable optimizations
      enableCpuMemArena: true,
      enableMemPattern: true,
      executionMode: 'sequential'
    };
    
    const session = await ort.InferenceSession.create(modelPath, sessionOptions);
    console.log('  ✅ CPU with optimizations works!');
    await session.release();
  } catch (error) {
    console.log('  ❌ CPU with optimizations failed:', error.message);
  }
}

runTests().catch(console.error);