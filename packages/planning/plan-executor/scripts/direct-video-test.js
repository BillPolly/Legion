#!/usr/bin/env node

import PlaywrightWrapper from '../../playwright/src/PlaywrightWrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function directVideoTest() {
  console.log('🎬 Direct Video Recording Test\n');

  const wrapper = new PlaywrightWrapper({ headless: true });
  
  try {
    const videoDir = path.join(__dirname, '..', '__tests__', 'tmp', 'video-test');
    await fs.mkdir(videoDir, { recursive: true });
    
    const videoPath = path.join(videoDir, 'animated-page.webm');
    
    console.log('📹 Recording video of animated page...');
    console.log('   URL: http://localhost:3460');
    console.log('   Duration: 10 seconds');
    console.log('   Output: ' + videoPath);
    console.log('\n   Recording...');
    
    const result = await wrapper.recordVideo({
      path: videoPath,
      duration: 10,
      url: 'http://localhost:3460'
    });
    
    if (result.success) {
      console.log('\n✅ Video recorded successfully!');
      console.log(`   📁 Path: ${result.path}`);
      console.log(`   📏 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   ⏱️  Duration: ${result.duration} seconds`);
    } else {
      console.error('\n❌ Recording failed:', result.error);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await wrapper.close();
  }
}

// Note: Make sure the server from video-recording-plan.js is running on port 3460
console.log('⚠️  Note: Make sure the animated webpage server is running on port 3460');
console.log('   You can start it by running the video-recording-plan.js script\n');

directVideoTest().catch(console.error);