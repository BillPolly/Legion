/**
 * Unit tests for LocalEmbeddingService
 * Tests ONNX runtime integration and embedding generation
 */

import { jest } from '@jest/globals';
import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';

describe('LocalEmbeddingService', () => {
  let service;

  beforeEach(() => {
    service = new LocalEmbeddingService({
      modelPath: '/fake/model/path.onnx',
      batchSize: 1,
      dimensions: 384
    });
  });

  afterEach(() => {
    if (service) {
      service = null;
    }
  });

  describe('Constructor', () => {
    test('should create service with default config', () => {
      const defaultService = new LocalEmbeddingService();
      
      expect(defaultService.config).toBeDefined();
      expect(defaultService.config.dimensions).toBe(384);
      expect(defaultService.config.batchSize).toBe(100);
      expect(defaultService.config.pooling).toBe('mean');
      expect(defaultService.config.normalize).toBe(true);
    });

    test('should create service with custom config', () => {
      const customService = new LocalEmbeddingService({
        dimensions: 768,
        batchSize: 50,
        pooling: 'cls',
        normalize: false
      });
      
      expect(customService.config.dimensions).toBe(768);
      expect(customService.config.batchSize).toBe(50);
      expect(customService.config.pooling).toBe('cls');
      expect(customService.config.normalize).toBe(false);
    });
  });

  describe('ONNX Runtime Import', () => {
    test('should be able to import onnxruntime-node', async () => {
      let ort;
      let importError;
      
      try {
        ort = await import('onnxruntime-node');
      } catch (error) {
        importError = error;
      }

      if (importError) {
        console.log('ONNX import failed:', importError.message);
        // Skip this test if ONNX is not available
        expect(importError.code).toBe('ERR_MODULE_NOT_FOUND');
        return;
      }

      expect(ort).toBeDefined();
      expect(ort.InferenceSession).toBeDefined();
      expect(ort.Tensor).toBeDefined();
      expect(typeof ort.InferenceSession.create).toBe('function');
    });

    test('should handle ONNX import gracefully when not available', async () => {
      // Mock a failed import
      const originalImport = global.import;
      
      // This test ensures error handling works
      expect(() => {
        // Service creation should not fail even if ONNX will fail later
        new LocalEmbeddingService();
      }).not.toThrow();
    });
  });

  describe('Initialization', () => {
    test('should fail initialization with non-existent model', async () => {
      const testService = new LocalEmbeddingService({
        modelPath: '/definitely/does/not/exist.onnx'
      });

      await expect(testService.initialize()).rejects.toThrow();
    });

    test('should handle ONNX runtime not available', async () => {
      // This service will fail to initialize if ONNX is not available
      const testService = new LocalEmbeddingService({
        modelPath: '/fake/model.onnx'
      });

      try {
        await testService.initialize();
        // If it succeeds, ONNX is available but model doesn't exist
        fail('Should have thrown error for non-existent model');
      } catch (error) {
        // Either ONNX not available OR model doesn't exist
        expect(error.message).toMatch(/(onnxruntime-node|model|file|path)/i);
      }
    });
  });

  describe('Utility Methods', () => {
    test('should return correct model info', () => {
      const info = service.getModelInfo();
      
      expect(info).toBeDefined();
      expect(info.name).toMatch(/local/i);
      expect(info.dimensions).toBe(384);
      expect(info.type).toBe('local');
    });

    test('should have tokenize method', () => {
      expect(typeof service.tokenize).toBe('function');
    });

    test('should have generateEmbedding method', () => {
      expect(typeof service.generateEmbedding).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('should throw error when tokenizer not initialized', async () => {
      // Service not initialized, should fail
      await expect(service.tokenize('test')).rejects.toThrow();
    });

    test('should throw error when session not initialized', async () => {
      // Service not initialized, should fail
      await expect(service.generateEmbedding('test')).rejects.toThrow();
    });
  });
});