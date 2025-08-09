#!/usr/bin/env node

/**
 * Download ONNX Model Script
 * 
 * Downloads the all-MiniLM-L6-v2 ONNX model for local embeddings.
 * This model generates 384-dimensional embeddings and is optimized for semantic similarity.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// Model URLs - These are from Hugging Face's model hub
const MODEL_URLS = {
  // ONNX quantized version for better performance
  'all-MiniLM-L6-v2': 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx',
  // Alternative: non-quantized version (larger but potentially more accurate)
  'all-MiniLM-L6-v2-full': 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
};

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading from: ${url}`);
    console.log(`📁 Saving to: ${destPath}`);
    
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`↪️ Following redirect to: ${redirectUrl}`);
        downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);
        
        // Show progress
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r📊 Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
      });
      
      response.on('end', () => {
        file.end();
        console.log('\n✅ Download complete!');
        resolve();
      });
      
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('🤖 ONNX Model Downloader for Legion Semantic Search\n');
  
  // Create models directory
  const modelsDir = path.join(rootDir, 'models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log(`📁 Created models directory: ${modelsDir}`);
  }
  
  // Check if model already exists
  const modelPath = path.join(modelsDir, 'all-MiniLM-L6-v2-quantized.onnx');
  if (fs.existsSync(modelPath)) {
    console.log('✅ Model already exists at:', modelPath);
    const stats = fs.statSync(modelPath);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
    console.log('\nTo re-download, delete the existing file first.');
    return;
  }
  
  try {
    console.log('📦 Downloading all-MiniLM-L6-v2 quantized model...');
    console.log('   This model generates 384-dimensional embeddings');
    console.log('   Optimized for semantic similarity tasks\n');
    
    await downloadFile(MODEL_URLS['all-MiniLM-L6-v2'], modelPath);
    
    // Verify the download
    const stats = fs.statSync(modelPath);
    console.log(`\n📊 Model details:`);
    console.log(`   Path: ${modelPath}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Type: ONNX quantized model`);
    console.log(`   Dimensions: 384`);
    
    // Also download the tokenizer config if needed
    const tokenizerConfigUrl = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json';
    const tokenizerPath = path.join(modelsDir, 'tokenizer_config.json');
    
    if (!fs.existsSync(tokenizerPath)) {
      console.log('\n📥 Downloading tokenizer configuration...');
      await downloadFile(tokenizerConfigUrl, tokenizerPath);
    }
    
    console.log('\n🎉 Model setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. The model is ready to use with LocalEmbeddingService');
    console.log('   2. Default path: ./models/all-MiniLM-L6-v2-quantized.onnx');
    console.log('   3. Run tests: npm test packages/semantic-search');
    
  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    console.error('\nYou can manually download the model from:');
    console.error('  https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main/onnx');
    console.error(`\nSave it as: ${modelPath}`);
    process.exit(1);
  }
}

main().catch(console.error);