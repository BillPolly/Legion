/**
 * Test to diagnose and fix ONNX tensor format issues in LocalEmbeddingService
 */

import { LocalEmbeddingService } from '../../../semantic-search/src/services/LocalEmbeddingService.js';
import ort from 'onnxruntime-node';

describe('ONNX Tensor Format Fix', () => {
  let service;

  beforeAll(async () => {
    service = new LocalEmbeddingService();
    await service.initialize();
  });

  test('should identify tensor format issue', async () => {
    // Get tokenizer output
    const { AutoTokenizer } = await import('@xenova/transformers');
    const tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
    
    const text = 'test text for embedding';
    const encoded = await tokenizer(text, {
      padding: true,
      truncation: true,
      max_length: 128,
      return_tensors: false
    });

    console.log('Tokenizer output analysis:');
    console.log('  input_ids type:', encoded.input_ids.constructor.name);
    console.log('  input_ids.data type:', encoded.input_ids.data?.constructor.name);
    console.log('  input_ids.ort_tensor exists?', !!encoded.input_ids.ort_tensor);
    
    // Check if tensors are already in ONNX format
    if (encoded.input_ids.ort_tensor) {
      console.log('  ✅ Tokenizer provides ONNX tensors directly');
      
      // Test if we can use them directly
      const feeds = {
        input_ids: encoded.input_ids.ort_tensor,
        attention_mask: encoded.attention_mask.ort_tensor,
        token_type_ids: encoded.token_type_ids?.ort_tensor || 
                       new ort.Tensor('int64', 
                         new BigInt64Array(encoded.input_ids.data.length).fill(0n), 
                         [1, encoded.input_ids.data.length])
      };
      
      // Try to run inference with these tensors
      const results = await service.session.run(feeds);
      expect(results.last_hidden_state).toBeDefined();
      console.log('  ✅ Direct tensor usage works!');
    } else {
      console.log('  ❌ Need to create ONNX tensors manually');
    }
  });

  test('should test fixed tokenize method', async () => {
    // Create a fixed version of the tokenize method
    const fixedTokenize = async (text) => {
      const { AutoTokenizer } = await import('@xenova/transformers');
      const tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
      
      const encoded = await tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: 128,
        return_tensors: false
      });
      
      // Check if tensors are already in ONNX format
      if (encoded.input_ids.ort_tensor) {
        // Use the ONNX tensors directly
        return {
          input_ids: encoded.input_ids.ort_tensor,
          attention_mask: encoded.attention_mask.ort_tensor,
          token_type_ids: encoded.token_type_ids?.ort_tensor || 
                         new ort.Tensor('int64', 
                           new BigInt64Array(encoded.input_ids.data.length).fill(0n), 
                           [1, encoded.input_ids.data.length])
        };
      } else {
        // Create tensors manually from data
        const inputIds = encoded.input_ids.data;
        const attentionMask = encoded.attention_mask.data;
        const seqLength = inputIds.length;
        
        return {
          input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
          attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
          token_type_ids: new ort.Tensor('int64', 
            new BigInt64Array(seqLength).fill(0n), 
            [1, seqLength])
        };
      }
    };

    // Test the fixed tokenize method
    const tokens = await fixedTokenize('test embedding generation');
    
    // Verify tensors are valid
    expect(tokens.input_ids).toBeDefined();
    expect(tokens.attention_mask).toBeDefined();
    expect(tokens.token_type_ids).toBeDefined();
    
    // Test inference with fixed tokens
    const results = await service.session.run(tokens);
    expect(results.last_hidden_state).toBeDefined();
    console.log('✅ Fixed tokenize method works!');
  });

  test('should generate embedding with fixed approach', async () => {
    // Override the tokenize method with the fixed version
    service.tokenize = async function(text) {
      if (!this.tokenizer) {
        throw new Error('Tokenizer not initialized');
      }
      
      const encoded = await this.tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: this.config.maxLength,
        return_tensors: false
      });
      
      // Check if tensors are already in ONNX format
      if (encoded.input_ids.ort_tensor) {
        // Use the ONNX tensors directly
        return {
          input_ids: encoded.input_ids.ort_tensor,
          attention_mask: encoded.attention_mask.ort_tensor,
          token_type_ids: encoded.token_type_ids?.ort_tensor || 
                         new ort.Tensor('int64', 
                           new BigInt64Array(encoded.input_ids.data.length).fill(0n), 
                           [1, encoded.input_ids.data.length])
        };
      } else {
        // Create tensors manually from data
        const inputIds = encoded.input_ids.data;
        const attentionMask = encoded.attention_mask.data;
        const seqLength = inputIds.length;
        
        // Handle BigInt64Array case
        if (inputIds instanceof BigInt64Array) {
          return {
            input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
            attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
            token_type_ids: new ort.Tensor('int64', 
              new BigInt64Array(seqLength).fill(0n), 
              [1, seqLength])
          };
        } else {
          // Convert to BigInt64Array if needed
          return {
            input_ids: new ort.Tensor('int64', 
              new BigInt64Array(inputIds.map(id => BigInt(id))), 
              [1, seqLength]),
            attention_mask: new ort.Tensor('int64', 
              new BigInt64Array(attentionMask.map(m => BigInt(m))), 
              [1, seqLength]),
            token_type_ids: new ort.Tensor('int64', 
              new BigInt64Array(seqLength).fill(0n), 
              [1, seqLength])
          };
        }
      }
    };

    // Now test embedding generation
    const embedding = await service.embed('test text for calculator tool');
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384); // all-MiniLM-L6-v2 produces 384-dimensional embeddings
    
    // Verify the embedding is normalized
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 5);
    
    console.log('✅ Embedding generation successful!');
    console.log('  Dimensions:', embedding.length);
    console.log('  Norm:', norm);
    console.log('  First 5 values:', embedding.slice(0, 5));
  });

  test('should work with batch embeddings', async () => {
    // Apply the fix to the service
    service.tokenize = async function(text) {
      if (!this.tokenizer) {
        throw new Error('Tokenizer not initialized');
      }
      
      const encoded = await this.tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: this.config.maxLength,
        return_tensors: false
      });
      
      // Check if tensors are already in ONNX format
      if (encoded.input_ids.ort_tensor) {
        return {
          input_ids: encoded.input_ids.ort_tensor,
          attention_mask: encoded.attention_mask.ort_tensor,
          token_type_ids: encoded.token_type_ids?.ort_tensor || 
                         new ort.Tensor('int64', 
                           new BigInt64Array(encoded.input_ids.data.length).fill(0n), 
                           [1, encoded.input_ids.data.length])
        };
      }
      
      // Create tensors from data
      const inputIds = encoded.input_ids.data;
      const attentionMask = encoded.attention_mask.data;
      const seqLength = inputIds.length;
      
      if (inputIds instanceof BigInt64Array) {
        return {
          input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
          attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
          token_type_ids: new ort.Tensor('int64', 
            new BigInt64Array(seqLength).fill(0n), 
            [1, seqLength])
        };
      }
      
      return {
        input_ids: new ort.Tensor('int64', 
          new BigInt64Array(Array.from(inputIds).map(id => BigInt(id))), 
          [1, seqLength]),
        attention_mask: new ort.Tensor('int64', 
          new BigInt64Array(Array.from(attentionMask).map(m => BigInt(m))), 
          [1, seqLength]),
        token_type_ids: new ort.Tensor('int64', 
          new BigInt64Array(seqLength).fill(0n), 
          [1, seqLength])
      };
    };

    // Test batch embedding
    const texts = [
      'calculator tool for mathematical operations',
      'file_write tool for writing files',
      'json_parse tool for parsing JSON'
    ];
    
    const embeddings = await service.generateEmbeddings(texts);
    
    expect(embeddings).toHaveLength(3);
    embeddings.forEach((embedding, i) => {
      expect(embedding).toHaveLength(384);
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0, 5);
      console.log(`  Embedding ${i + 1} norm:`, norm.toFixed(6));
    });
    
    console.log('✅ Batch embedding generation successful!');
  });
});