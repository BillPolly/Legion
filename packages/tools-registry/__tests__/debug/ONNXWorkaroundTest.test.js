/**
 * Test to find a working approach for ONNX embedding generation
 */

import ort from 'onnxruntime-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ONNX Workaround Test', () => {
  const modelPath = path.resolve(__dirname, '../../../../models/all-MiniLM-L6-v2-quantized.onnx');

  test('should test different ONNX Runtime configurations', async () => {
    console.log('Testing different ONNX configurations...');

    const configs = [
      { name: 'Default CPU', providers: ['cpu'] },
      { name: 'CPU with optimization', providers: ['cpu'], options: { optimizationLevel: 'basic' } },
      { name: 'CPU minimal', providers: ['cpu'], options: { 
        executionMode: 'sequential', 
        optimizationLevel: 'disabled',
        enableProfiling: false
      }},
    ];

    for (const config of configs) {
      try {
        console.log(`\nTrying: ${config.name}`);
        
        const sessionOptions = {
          executionProviders: config.providers,
          ...config.options
        };

        const session = await ort.InferenceSession.create(modelPath, sessionOptions);
        
        // Test with minimal tensors
        const feeds = {
          input_ids: new ort.Tensor('int64', new BigInt64Array([101n, 2023n, 102n]), [1, 3]),
          attention_mask: new ort.Tensor('int64', new BigInt64Array([1n, 1n, 1n]), [1, 3]),
          token_type_ids: new ort.Tensor('int64', new BigInt64Array([0n, 0n, 0n]), [1, 3])
        };

        const results = await session.run(feeds);
        console.log(`  ✅ ${config.name} WORKS!`);
        console.log(`     Output dims: ${results.last_hidden_state.dims}`);
        
        // This config works - remember it
        expect(results.last_hidden_state).toBeDefined();
        return; // Found working config
        
      } catch (error) {
        console.log(`  ❌ ${config.name} failed: ${error.message.substring(0, 80)}...`);
      }
    }

    // If we get here, no config worked
    throw new Error('No ONNX Runtime configuration worked');
  });

  test('should try alternative model loading approaches', async () => {
    console.log('Testing alternative model loading...');

    try {
      // Try loading with buffer instead of file path
      const fs = await import('fs');
      const modelBuffer = fs.readFileSync(modelPath);
      
      console.log(`Model buffer size: ${modelBuffer.length} bytes`);
      
      const session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['cpu']
      });
      
      console.log('✅ Model loaded from buffer');
      
      // Test inference
      const feeds = {
        input_ids: new ort.Tensor('int64', new BigInt64Array([101n, 2023n, 102n]), [1, 3]),
        attention_mask: new ort.Tensor('int64', new BigInt64Array([1n, 1n, 1n]), [1, 3]),
        token_type_ids: new ort.Tensor('int64', new BigInt64Array([0n, 0n, 0n]), [1, 3])
      };

      const results = await session.run(feeds);
      console.log('✅ Buffer-based loading works!');
      expect(results.last_hidden_state).toBeDefined();
      
    } catch (error) {
      console.log(`❌ Buffer approach failed: ${error.message}`);
    }
  });

  test('should check if model is corrupted', async () => {
    console.log('Checking model integrity...');

    const fs = await import('fs');
    const stats = fs.statSync(modelPath);
    
    console.log(`Model file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Model exists: ${fs.existsSync(modelPath)}`);
    
    // Read first few bytes to check if it's a valid ONNX file
    const fd = fs.openSync(modelPath, 'r');
    const buffer = Buffer.allocUnsafe(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
    
    const header = buffer.toString('utf8', 0, 8);
    console.log(`File header: "${header}"`);
    
    // ONNX files should start with specific magic bytes
    const isValidONNX = buffer[0] === 0x08 || header.includes('ONNX');
    console.log(`Valid ONNX format: ${isValidONNX}`);
    
    expect(stats.size).toBeGreaterThan(1000000); // At least 1MB
    expect(fs.existsSync(modelPath)).toBe(true);
  });

  test('should test with original unquantized model approach', async () => {
    console.log('Testing if quantized model is the issue...');
    
    // The error might be that the quantized model has issues
    // Let's see if we can get version info that might help
    
    try {
      const session = await ort.InferenceSession.create(modelPath);
      
      // Check if there are any session-level issues
      console.log('Model loaded successfully');
      console.log('Input names:', session.inputNames);
      console.log('Output names:', session.outputNames);
      
      // Try to get model metadata if available
      if (session.getModelMetadata) {
        const metadata = await session.getModelMetadata();
        console.log('Model metadata:', metadata);
      }
      
    } catch (error) {
      console.log('Model loading error:', error.message);
    }
  });
});