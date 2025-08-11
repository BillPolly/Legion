/**
 * Direct ONNX model test to isolate tensor format issues
 */

import ort from 'onnxruntime-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Direct ONNX Model Test', () => {
  let session;
  const modelPath = path.resolve(__dirname, '../../../../models/all-MiniLM-L6-v2-quantized.onnx');

  beforeAll(async () => {
    console.log('Loading ONNX model:', modelPath);
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu']
    });
  });

  test('should run minimal inference successfully', async () => {
    console.log('Testing minimal ONNX inference...');

    // Create minimal test tensors
    const inputIds = new ort.Tensor('int64', new BigInt64Array([101n, 2023n, 102n]), [1, 3]);
    const attentionMask = new ort.Tensor('int64', new BigInt64Array([1n, 1n, 1n]), [1, 3]);
    const tokenTypeIds = new ort.Tensor('int64', new BigInt64Array([0n, 0n, 0n]), [1, 3]);

    const feeds = {
      input_ids: inputIds,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds
    };

    console.log('Input tensor types:');
    console.log('  input_ids:', inputIds.type, inputIds.dims);
    console.log('  attention_mask:', attentionMask.type, attentionMask.dims);
    console.log('  token_type_ids:', tokenTypeIds.type, tokenTypeIds.dims);

    // This should work if the model is correct
    const results = await session.run(feeds);

    console.log('✅ Inference successful!');
    console.log('Output metadata:');
    console.log('  Type:', results.last_hidden_state.type);
    console.log('  Dims:', results.last_hidden_state.dims);
    console.log('  Data type:', results.last_hidden_state.data.constructor.name);

    expect(results.last_hidden_state).toBeDefined();
    expect(results.last_hidden_state.dims).toEqual([1, 3, 384]);
    expect(results.last_hidden_state.type).toBe('float32');
  });

  test('should test with longer sequences', async () => {
    console.log('Testing with longer sequence...');

    // Test with sequence length that matches what tokenizer produces
    const seqLength = 10;
    const inputIds = new BigInt64Array(seqLength);
    const attentionMask = new BigInt64Array(seqLength);
    const tokenTypeIds = new BigInt64Array(seqLength);

    // Fill with valid token IDs
    inputIds[0] = 101n; // CLS
    for (let i = 1; i < seqLength - 1; i++) {
      inputIds[i] = BigInt(2000 + i); // Some token IDs
      attentionMask[i] = 1n;
    }
    inputIds[seqLength - 1] = 102n; // SEP
    attentionMask[0] = 1n; // CLS
    attentionMask[seqLength - 1] = 1n; // SEP
    tokenTypeIds.fill(0n);

    const feeds = {
      input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
      attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
      token_type_ids: new ort.Tensor('int64', tokenTypeIds, [1, seqLength])
    };

    const results = await session.run(feeds);

    console.log('✅ Longer sequence inference successful!');
    console.log('Output dims:', results.last_hidden_state.dims);

    expect(results.last_hidden_state.dims).toEqual([1, seqLength, 384]);
  });

  test('should identify ONNX Runtime version and capabilities', async () => {
    console.log('ONNX Runtime Information:');
    console.log('  Environment:', ort.env);
    console.log('  Version info:', ort.env.versions);

    // Check session metadata
    console.log('Session Information:');
    console.log('  Input names:', session.inputNames);
    console.log('  Output names:', session.outputNames);

    expect(session.inputNames).toContain('input_ids');
    expect(session.inputNames).toContain('attention_mask');
    expect(session.outputNames).toContain('last_hidden_state');
  });
});