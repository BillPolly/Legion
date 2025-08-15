/**
 * Debug test to identify tensor format issue
 */

import { LocalEmbeddingService } from '../../../semantic-search/src/services/LocalEmbeddingService.js';
import ort from 'onnxruntime-node';

describe('Tensor Debug', () => {
  let service;

  beforeAll(async () => {
    service = new LocalEmbeddingService();
    await service.initialize();
  });

  test('should debug tensor creation step by step', async () => {
    console.log('\n=== Debugging Tensor Creation ===');
    
    // Step 1: Test tokenizer output
    const text = 'test';
    const tokens = await service.tokenize(text);
    
    console.log('\nStep 1: Tokenizer output');
    console.log('  input_ids type:', tokens.input_ids.constructor.name);
    console.log('  input_ids.data type:', tokens.input_ids.data?.constructor.name);
    console.log('  input_ids.dims:', tokens.input_ids.dims);
    
    // Step 2: Check data types
    console.log('\nStep 2: Data validation');
    console.log('  input_ids data length:', tokens.input_ids.data?.length);
    console.log('  Sample input_ids data:', tokens.input_ids.data?.slice(0, 5));
    console.log('  attention_mask data:', tokens.attention_mask.data?.slice(0, 5));
    
    // Step 3: Try to create simple tensors manually
    console.log('\nStep 3: Manual tensor creation');
    try {
      const testTensor = new ort.Tensor('int64', new BigInt64Array([101n, 2023n, 102n]), [1, 3]);
      console.log('  ✅ Manual int64 tensor creation works');
    } catch (error) {
      console.log('  ❌ Manual tensor creation failed:', error.message);
    }
    
    // Step 4: Check if the issue is with the session
    console.log('\nStep 4: Session input info');
    console.log('  Session input names:', service.session.inputNames);
    
    // Step 5: Try with minimal inputs
    console.log('\nStep 5: Testing minimal inference');
    const minimalFeeds = {
      input_ids: new ort.Tensor('int64', new BigInt64Array([101n, 102n]), [1, 2]),
      attention_mask: new ort.Tensor('int64', new BigInt64Array([1n, 1n]), [1, 2]),
      token_type_ids: new ort.Tensor('int64', new BigInt64Array([0n, 0n]), [1, 2])
    };
    
    try {
      const results = await service.session.run(minimalFeeds);
      console.log('  ✅ Minimal inference works!');
      console.log('  Output shape:', results.last_hidden_state.dims);
    } catch (error) {
      console.log('  ❌ Minimal inference failed:', error.message);
    }
    
    // If we get here, the issue is with our tokenizer output
    console.log('\nStep 6: Compare tensor properties');
    console.log('  Our tensor type:', tokens.input_ids.type);
    console.log('  Our tensor dims:', JSON.stringify(tokens.input_ids.dims));
    console.log('  Working tensor type:', minimalFeeds.input_ids.type);
    console.log('  Working tensor dims:', JSON.stringify(minimalFeeds.input_ids.dims));
  });
});