/**
 * Test different ONNX Runtime approaches to fix the tensor issue
 */

import ort from 'onnxruntime-node';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutoTokenizer } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ONNX Version Fix', () => {
  const modelPath = path.resolve(__dirname, '../../../../models/all-MiniLM-L6-v2-quantized.onnx');
  let session;
  let tokenizer;

  beforeAll(async () => {
    // Initialize with the most compatible settings
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'disabled', // Disable all optimizations
      enableCpuMemArena: false,
      enableMemPattern: false,
      executionMode: 'sequential'
    });

    tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
  });

  test('should work with proper tensor construction from tokenizer', async () => {
    console.log('Testing proper tensor construction from @xenova/transformers...');

    const text = 'test text';
    
    // Get encoded output from tokenizer
    const encoded = await tokenizer(text, {
      padding: true,
      truncation: true,
      max_length: 128,
      return_tensors: false
    });

    console.log('Tokenizer output structure:');
    console.log('  input_ids type:', encoded.input_ids.constructor.name);
    console.log('  data type:', encoded.input_ids.data?.constructor.name);
    console.log('  dims:', encoded.input_ids.dims);

    // The key insight: @xenova/transformers returns BigInt64Array data
    // We need to use this data directly, not try to create new tensors
    const inputIds = encoded.input_ids.data;
    const attentionMask = encoded.attention_mask.data;
    const seqLength = inputIds.length;
    
    // Create token_type_ids if missing
    const tokenTypeIds = encoded.token_type_ids?.data || new BigInt64Array(seqLength).fill(0n);

    // The critical fix: ensure data types match exactly what ONNX expects
    console.log('Creating tensors with exact data types:');
    console.log('  input_ids data type:', inputIds.constructor.name);
    console.log('  attention_mask data type:', attentionMask.constructor.name);
    console.log('  token_type_ids data type:', tokenTypeIds.constructor.name);

    const feeds = {
      input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
      attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
      token_type_ids: new ort.Tensor('int64', tokenTypeIds, [1, seqLength])
    };

    // Verify tensor creation succeeded
    expect(feeds.input_ids.type).toBe('int64');
    expect(feeds.attention_mask.type).toBe('int64');
    expect(feeds.token_type_ids.type).toBe('int64');

    console.log('Running inference...');
    const results = await session.run(feeds);

    console.log('✅ ONNX inference successful!');
    console.log('Output dims:', results.last_hidden_state.dims);
    console.log('Output type:', results.last_hidden_state.type);

    expect(results.last_hidden_state).toBeDefined();
    expect(results.last_hidden_state.dims[2]).toBe(384);
  });

  test('should process output tensors correctly', async () => {
    console.log('Testing output tensor processing...');

    const text = 'calculator tool for math';
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

    const results = await session.run(feeds);
    
    // Process the output properly
    const outputTensor = results.last_hidden_state;
    const outputData = outputTensor.data;
    const maskData = encoded.attention_mask.data;
    const [batchSize, sequenceLength, hiddenSize] = outputTensor.dims;

    console.log('Processing output:');
    console.log('  Output data type:', outputData.constructor.name);
    console.log('  Output dims:', [batchSize, sequenceLength, hiddenSize]);
    console.log('  Mask data type:', maskData.constructor.name);

    // Apply mean pooling
    const embedding = new Float32Array(hiddenSize);
    let validTokens = 0;

    for (let i = 0; i < sequenceLength; i++) {
      // Check attention mask (BigInt64Array)
      if (maskData[i] === 1n) {
        validTokens++;
        for (let j = 0; j < hiddenSize; j++) {
          embedding[j] += outputData[i * hiddenSize + j];
        }
      }
    }

    // Average
    for (let j = 0; j < hiddenSize; j++) {
      embedding[j] /= validTokens;
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < hiddenSize; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);

    for (let i = 0; i < hiddenSize; i++) {
      embedding[i] /= norm;
    }

    console.log('✅ Embedding processed successfully!');
    console.log('  Dimensions:', embedding.length);
    console.log('  Norm:', norm);
    console.log('  Valid tokens:', validTokens);

    expect(embedding.length).toBe(384);
    expect(norm).toBeGreaterThan(0);
    expect(validTokens).toBeGreaterThan(0);
  });

  test('should match LocalEmbeddingService implementation', async () => {
    console.log('Testing complete LocalEmbeddingService workflow...');

    // Import and test the actual service
    const { LocalEmbeddingService } = await import('../../../semantic-search/src/services/LocalEmbeddingService.js');
    
    const service = new LocalEmbeddingService();
    await service.initialize();

    const text = 'test embedding generation';
    const embedding = await service.embed(text);

    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 5);

    console.log('✅ LocalEmbeddingService works correctly!');
    console.log('  Embedding dimensions:', embedding.length);
    console.log('  Norm:', norm);
  });
});