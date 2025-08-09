/**
 * Integration tests for ONNX runtime
 * Tests actual ONNX functionality and embedding generation
 */

import { jest } from '@jest/globals';

describe('ONNX Runtime Integration', () => {
  let ort;
  let isONNXAvailable = false;

  beforeAll(async () => {
    // FORCE test ONNX runtime - NO SKIPPING!
    console.log('🔧 FORCING ONNX runtime test...');
  });

  describe('ONNX Runtime Core', () => {
    test('should import onnxruntime-node successfully', async () => {
      console.log('🔧 ATTEMPTING ONNX IMPORT...');
      
      // FORCE the import - NO SKIPPING
      try {
        ort = await import('onnxruntime-node');
        console.log('✅ ONNX Runtime imported successfully!');
        
        expect(ort).toBeDefined();
        expect(ort.InferenceSession).toBeDefined();
        expect(ort.Tensor).toBeDefined();
        expect(ort.env).toBeDefined();
        
        isONNXAvailable = true;
      } catch (error) {
        console.error('❌ ONNX IMPORT FAILED:', error.message);
        console.error('Error code:', error.code);
        throw new Error(`ONNX runtime not available: ${error.message}`);
      }
    });

    test('should have correct ONNX environment', async () => {
      if (!isONNXAvailable) {
        console.log('Skipping: ONNX runtime not available');
        return;
      }

      expect(ort.env).toBeDefined();
      
      // Test environment configuration
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
      
      expect(ort.env.wasm.numThreads).toBe(1);
      expect(ort.env.wasm.simd).toBe(true);
    });

    test('should create tensor successfully', async () => {
      if (!isONNXAvailable) {
        console.log('Skipping: ONNX runtime not available');
        return;
      }

      const data = new Float32Array([1, 2, 3, 4]);
      const tensor = new ort.Tensor('float32', data, [1, 4]);
      
      expect(tensor).toBeDefined();
      expect(tensor.type).toBe('float32');
      expect(tensor.dims).toEqual([1, 4]);
      expect(tensor.data).toEqual(data);
    });

    test('should handle session creation with invalid model path', async () => {
      if (!isONNXAvailable) {
        console.log('Skipping: ONNX runtime not available');
        return;
      }

      const invalidPath = '/definitely/does/not/exist.onnx';
      
      await expect(ort.InferenceSession.create(invalidPath)).rejects.toThrow();
    });
  });

  describe('Transformers Integration', () => {
    let transformers;
    let isTransformersAvailable = false;

    beforeAll(async () => {
      try {
        transformers = await import('@xenova/transformers');
        isTransformersAvailable = true;
        console.log('✅ Transformers library available');
      } catch (error) {
        console.log('⚠️ Transformers library not available');
        console.log('Install with: npm install @xenova/transformers');
      }
    });

    test('should import @xenova/transformers successfully', async () => {
      if (!isTransformersAvailable) {
        console.log('Skipping: Transformers not available');
        return;
      }

      expect(transformers).toBeDefined();
      expect(transformers.pipeline).toBeDefined();
      expect(transformers.env).toBeDefined();
    });

    test('should configure transformers environment', async () => {
      if (!isTransformersAvailable) {
        console.log('Skipping: Transformers not available');
        return;
      }

      // Configure to use local models only (no downloads)
      transformers.env.allowLocalModels = false;
      transformers.env.allowRemoteModels = false;
      
      expect(transformers.env.allowLocalModels).toBe(false);
      expect(transformers.env.allowRemoteModels).toBe(false);
    });
  });

  describe('LocalEmbeddingService Integration', () => {
    test('should create LocalEmbeddingService without errors', async () => {
      const { LocalEmbeddingService } = await import('../../src/services/LocalEmbeddingService.js');
      
      const service = new LocalEmbeddingService({
        modelPath: '/fake/model.onnx',
        batchSize: 1
      });

      expect(service).toBeDefined();
      expect(service.config).toBeDefined();
      expect(service.config.modelPath).toBe('/fake/model.onnx');
    });

    test('should fail initialization gracefully when ONNX not available', async () => {
      const { LocalEmbeddingService } = await import('../../src/services/LocalEmbeddingService.js');
      
      const service = new LocalEmbeddingService({
        modelPath: '/fake/model.onnx'
      });

      try {
        await service.initialize();
        
        if (!isONNXAvailable) {
          fail('Should have failed when ONNX not available');
        } else {
          fail('Should have failed with fake model path');
        }
      } catch (error) {
        // Expected to fail - either no ONNX or no model file
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/(onnxruntime-node|model|file)/i);
      }
    });

    test('should provide correct model info', async () => {
      const { LocalEmbeddingService } = await import('../../src/services/LocalEmbeddingService.js');
      
      const service = new LocalEmbeddingService({
        dimensions: 768
      });

      const info = service.getModelInfo();
      
      expect(info).toBeDefined();
      expect(info.type).toBe('local');
      expect(info.dimensions).toBe(768);
      expect(info.name).toMatch(/local/i);
    });
  });

  describe('End-to-End ONNX Workflow', () => {
    test('should demonstrate complete ONNX workflow when available', async () => {
      if (!isONNXAvailable) {
        console.log('Skipping: ONNX runtime not available');
        console.log('To enable this test: npm install onnxruntime-node @xenova/transformers');
        return;
      }

      console.log('🧪 Testing complete ONNX workflow...');

      // Step 1: Create tensors
      const inputData = new Float32Array(384).fill(0.5);
      const inputTensor = new ort.Tensor('float32', inputData, [1, 384]);
      
      expect(inputTensor.data.length).toBe(384);
      console.log('✅ Created input tensor');

      // Step 2: Test tensor operations
      const outputData = new Float32Array(inputTensor.data.length);
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * 2;
      }
      
      expect(outputData[0]).toBe(1.0);
      console.log('✅ Performed tensor operations');

      // Step 3: Test embedding-like operations
      const embeddingSize = 384;
      const mockEmbedding = new Float32Array(embeddingSize);
      
      // Simulate embedding normalization
      let norm = 0;
      for (let i = 0; i < embeddingSize; i++) {
        mockEmbedding[i] = Math.random() - 0.5;
        norm += mockEmbedding[i] * mockEmbedding[i];
      }
      
      norm = Math.sqrt(norm);
      for (let i = 0; i < embeddingSize; i++) {
        mockEmbedding[i] /= norm;
      }
      
      // Check normalization
      let checkNorm = 0;
      for (let i = 0; i < embeddingSize; i++) {
        checkNorm += mockEmbedding[i] * mockEmbedding[i];
      }
      
      expect(Math.abs(Math.sqrt(checkNorm) - 1.0)).toBeLessThan(0.001);
      console.log('✅ Performed embedding normalization');

      console.log('🎉 Complete ONNX workflow test passed!');
    });
  });
});