/**
 * Separate Jest configuration for ONNX tests to avoid singleton conflicts
 */

export default {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/LocalEmbeddingService*.test.js',
    '**/__tests__/**/ONNX*.test.js'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  testTimeout: 15000,
  verbose: true,
  // Critical: Run ONNX tests in a single process to avoid singleton conflicts
  maxWorkers: 1,
  maxConcurrency: 1,
  // Isolate ONNX tests from other tests
  testSequencer: './test-sequencer-onnx.js'
};