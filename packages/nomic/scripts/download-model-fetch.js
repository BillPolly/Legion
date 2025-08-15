#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL_URL = 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf';
const MODEL_PATH = path.join(__dirname, '../models/nomic-embed-text-v1.5.Q4_K_M.gguf');

async function downloadModel() {
  console.log('Downloading nomic-embed-text-v1.5 model...');
  console.log('URL:', MODEL_URL);
  console.log('Destination:', MODEL_PATH);
  
  // Create models directory if it doesn't exist
  const modelsDir = path.dirname(MODEL_PATH);
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log('Created models directory:', modelsDir);
  }

  // Check if model already exists
  if (fs.existsSync(MODEL_PATH)) {
    const stats = fs.statSync(MODEL_PATH);
    console.log(`Model already exists at: ${MODEL_PATH}`);
    console.log(`File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    return;
  }

  try {
    console.log('Starting download...');
    const response = await fetch(MODEL_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      console.log(`File size: ${(parseInt(contentLength) / (1024 * 1024)).toFixed(2)} MB`);
    }
    
    const fileStream = fs.createWriteStream(MODEL_PATH);
    
    // Download with progress tracking
    const reader = response.body.getReader();
    let downloadedBytes = 0;
    const totalBytes = parseInt(contentLength) || 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      downloadedBytes += value.length;
      fileStream.write(value);
      
      if (totalBytes > 0) {
        const progress = Math.round((downloadedBytes / totalBytes) * 100);
        process.stdout.write(`\rProgress: ${progress}% (${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB / ${(totalBytes / (1024 * 1024)).toFixed(2)} MB)`);
      }
    }
    
    fileStream.end();
    
    console.log('\n✅ Model downloaded successfully!');
    console.log('Location:', MODEL_PATH);
    
    // Verify file size
    const stats = fs.statSync(MODEL_PATH);
    console.log(`Final file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    
    // Clean up partial download
    if (fs.existsSync(MODEL_PATH)) {
      fs.unlinkSync(MODEL_PATH);
      console.log('Cleaned up partial download');
    }
    
    throw error;
  }
}

// Run the download
downloadModel().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});