#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL_URL = 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf';
const MODEL_PATH = path.join(__dirname, '../models/nomic-embed-text-v1.5.Q4_K_M.gguf');

async function downloadModel() {
  console.log('Downloading nomic-embed-text-v1.5 model...');
  
  // Create models directory if it doesn't exist
  const modelsDir = path.dirname(MODEL_PATH);
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  // Check if model already exists
  if (fs.existsSync(MODEL_PATH)) {
    console.log('Model already exists at:', MODEL_PATH);
    return;
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(MODEL_PATH);
    
    https.get(MODEL_URL, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectResponse) => {
          const totalSize = parseInt(redirectResponse.headers['content-length'], 10);
          let downloadedSize = 0;

          redirectResponse.on('data', (chunk) => {
            downloadedSize += chunk.length;
            const progress = Math.round((downloadedSize / totalSize) * 100);
            process.stdout.write(`\rDownloading: ${progress}%`);
          });

          redirectResponse.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log('\nModel downloaded successfully to:', MODEL_PATH);
            resolve();
          });
        });
      } else {
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = Math.round((downloadedSize / totalSize) * 100);
          process.stdout.write(`\rDownloading: ${progress}%`);
        });

        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('\nModel downloaded successfully to:', MODEL_PATH);
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(MODEL_PATH, () => {});
      reject(err);
    });
  });
}

downloadModel().catch(console.error);