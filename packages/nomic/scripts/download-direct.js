#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Correct URL format for Hugging Face GGUF files
const MODEL_URL = 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf';
const MODEL_PATH = path.join(__dirname, '../models/nomic-embed-text-v1.5.Q4_K_M.gguf');

async function downloadWithHttps(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        file.close();
        fs.unlinkSync(destPath);
        console.log('Following redirect to:', response.headers.location);
        return downloadWithHttps(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          const downloadedMB = (downloadedSize / (1024 * 1024)).toFixed(2);
          const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
          process.stdout.write(`\rDownloading: ${progress}% (${downloadedMB}MB / ${totalMB}MB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n✅ Download complete!');
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading nomic-embed-text-v1.5.Q4_K_M.gguf (81MB)...');
  console.log('From:', MODEL_URL);
  console.log('To:', MODEL_PATH);
  
  // Create models directory
  const modelsDir = path.dirname(MODEL_PATH);
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log('Created models directory:', modelsDir);
  }
  
  // Check if already exists
  if (fs.existsSync(MODEL_PATH)) {
    const stats = fs.statSync(MODEL_PATH);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Model already exists: ${MODEL_PATH} (${sizeMB}MB)`);
    
    // Check if size is reasonable (should be around 81MB)
    if (stats.size > 80 * 1024 * 1024 && stats.size < 85 * 1024 * 1024) {
      console.log('Model size looks correct. Skipping download.');
      return;
    } else {
      console.log('Model size looks wrong. Re-downloading...');
      fs.unlinkSync(MODEL_PATH);
    }
  }
  
  try {
    await downloadWithHttps(MODEL_URL, MODEL_PATH);
    
    // Verify the download
    const stats = fs.statSync(MODEL_PATH);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Model saved: ${MODEL_PATH} (${sizeMB}MB)`);
    
    if (stats.size < 80 * 1024 * 1024) {
      throw new Error('Downloaded file seems too small. Expected ~81MB');
    }
    
    console.log('✅ Model ready for use!');
  } catch (error) {
    console.error('❌ Download failed:', error.message);
    if (fs.existsSync(MODEL_PATH)) {
      fs.unlinkSync(MODEL_PATH);
    }
    process.exit(1);
  }
}

main();