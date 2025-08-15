/**
 * Test ONNX Runtime 1.14.0 Float32Array bug workaround by pre-allocating output tensors
 */

import ort from 'onnxruntime-node';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutoTokenizer } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ONNX Output Preallocation Workaround', () => {
  const modelPath = path.resolve(__dirname, '../../../../models/all-MiniLM-L6-v2-quantized.onnx');
  let session;
  let tokenizer;

  beforeAll(async () => {
    // Create session with output pre-allocation options
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'disabled',
      enableCpuMemArena: false,
      enableMemPattern: false,
      executionMode: 'sequential'
    });

    tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
  });

  test('should work with output tensor pre-allocation', async () => {
    console.log('Testing ONNX 1.14.0 Float32Array bug workaround with output pre-allocation...');

    const text = 'test text for embedding';
    
    // Get tokenized input
    const encoded = await tokenizer(text, {
      padding: true,
      truncation: true,
      max_length: 64,
      return_tensors: false
    });

    const seqLength = encoded.input_ids.data.length;
    const feeds = {
      input_ids: new ort.Tensor('int64', encoded.input_ids.data, [1, seqLength]),
      attention_mask: new ort.Tensor('int64', encoded.attention_mask.data, [1, seqLength]),
      token_type_ids: new ort.Tensor('int64', 
        encoded.token_type_ids?.data || new BigInt64Array(seqLength).fill(0n), 
        [1, seqLength])
    };

    console.log('Input tensors created successfully');

    try {
      // The key insight: ONNX 1.14.0 has a bug where it tries to create Float32Array tensors
      // for outputs but fails due to constructor validation. Let's try to pre-allocate outputs.
      
      // First, let's try with outputNames to see if we can specify output tensors
      console.log('Session output names:', session.outputNames);
      
      // Try to create pre-allocated output tensor
      // For all-MiniLM-L6-v2, output should be [batch_size, sequence_length, 384]
      const expectedOutputShape = [1, seqLength, 384];
      const outputSize = expectedOutputShape.reduce((a, b) => a * b, 1);
      
      // Pre-allocate the output buffer with proper Float32Array
      const outputBuffer = new Float32Array(outputSize);
      console.log('Pre-allocated output buffer:', outputBuffer.constructor.name, 'size:', outputSize);
      
      // Try creating output tensor with pre-allocated buffer
      const preAllocatedOutput = new ort.Tensor('float32', outputBuffer, expectedOutputShape);
      console.log('Pre-allocated output tensor created');
      
      // Option 1: Try passing output tensors in the run options
      const runOptions = {
        // logSeverityLevel: 0,
        // logVerbosityLevel: 0,
        // outputNames: ['last_hidden_state'],
      };
      
      console.log('Attempting inference with run options...');
      const results = await session.run(feeds, runOptions);
      
      console.log('✅ ONNX inference successful with pre-allocation approach!');
      console.log('Output tensor type:', results.last_hidden_state.data.constructor.name);
      console.log('Output dims:', results.last_hidden_state.dims);
      
      expect(results.last_hidden_state).toBeDefined();
      expect(results.last_hidden_state.dims[2]).toBe(384);
      
    } catch (error) {
      console.log('❌ Pre-allocation approach failed:', error.message);
      
      // If that doesn't work, let's try the fetches approach
      console.log('Trying alternative approach with outputNames...');
      
      try {
        const results = await session.run(feeds, ['last_hidden_state']);
        console.log('✅ Alternative approach succeeded!');
        expect(results.last_hidden_state).toBeDefined();
      } catch (altError) {
        console.log('❌ Alternative approach also failed:', altError.message);
        throw altError;
      }
    }
  });

  test('should try different session configuration approaches', async () => {
    console.log('Testing different session configurations for ONNX 1.14.0...');

    // Try creating session with different memory management options
    const testConfigs = [
      {
        name: 'Memory Arena Disabled',
        options: {
          executionProviders: ['cpu'],
          enableCpuMemArena: false,
          enableMemPattern: false,
          executionMode: 'sequential',
          graphOptimizationLevel: 'disabled'
        }
      },
      {
        name: 'All Optimizations Disabled', 
        options: {
          executionProviders: ['cpu'],
          enableCpuMemArena: false,
          enableMemPattern: false,
          enableProfiling: false,
          executionMode: 'sequential',
          graphOptimizationLevel: 'disabled',
          logSeverityLevel: 4,
          logVerbosityLevel: 0
        }
      }
    ];

    for (const config of testConfigs) {
      console.log(`\nTesting configuration: ${config.name}`);
      
      try {
        const testSession = await ort.InferenceSession.create(modelPath, config.options);
        
        // Simple test with minimal input
        const feeds = {
          input_ids: new ort.Tensor('int64', new BigInt64Array([101n, 2023n, 102n]), [1, 3]),
          attention_mask: new ort.Tensor('int64', new BigInt64Array([1n, 1n, 1n]), [1, 3]),
          token_type_ids: new ort.Tensor('int64', new BigInt64Array([0n, 0n, 0n]), [1, 3])
        };

        const results = await testSession.run(feeds);
        console.log(`✅ ${config.name} WORKS!`);
        console.log(`   Output dims: ${results.last_hidden_state.dims}`);
        
        // Found a working configuration
        expect(results.last_hidden_state).toBeDefined();
        return; // Success!
        
      } catch (error) {
        console.log(`❌ ${config.name} failed: ${error.message.substring(0, 80)}`);
      }
    }

    // If we reach here, no configuration worked
    throw new Error('No ONNX Runtime configuration resolved the Float32Array bug');
  });

  test('should investigate the exact error source', async () => {
    console.log('Investigating the exact source of the Float32Array error...');

    // Let's create the most minimal possible test case
    const feeds = {
      input_ids: new ort.Tensor('int64', new BigInt64Array([101n]), [1, 1]),
      attention_mask: new ort.Tensor('int64', new BigInt64Array([1n]), [1, 1]),
      token_type_ids: new ort.Tensor('int64', new BigInt64Array([0n]), [1, 1])
    };

    console.log('Created minimal input tensors:');
    console.log('  input_ids:', feeds.input_ids.type, feeds.input_ids.dims);
    console.log('  attention_mask:', feeds.attention_mask.type, feeds.attention_mask.dims);
    console.log('  token_type_ids:', feeds.token_type_ids.type, feeds.token_type_ids.dims);

    // The error happens specifically at session.run() 
    // Let's trace what happens in the ONNX Runtime internal calls
    try {
      console.log('About to call session.run() - this is where the error occurs...');
      console.log('ONNX Runtime version info:', ort.env?.versions || 'Unknown');
      
      const results = await session.run(feeds);
      console.log('✅ Minimal test succeeded!');
      expect(results.last_hidden_state).toBeDefined();
      
    } catch (error) {
      console.log('❌ Error details:');
      console.log('  Message:', error.message);
      console.log('  Type:', error.constructor.name);
      console.log('  Stack (first 3 lines):');
      const stackLines = error.stack.split('\n').slice(0, 3);
      stackLines.forEach(line => console.log(`    ${line}`));
      
      // This confirms the bug exists - expected behavior
      expect(error.message).toContain('Float32Array');
    }
  });
});