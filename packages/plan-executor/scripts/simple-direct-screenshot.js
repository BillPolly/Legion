#!/usr/bin/env node

import PlaywrightWrapper from '../../playwright/src/PlaywrightWrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function simpleDirectScreenshot() {
  console.log('🎯 Testing direct Playwright wrapper...\n');

  const wrapper = new PlaywrightWrapper({
    headless: true,
    timeout: 30000
  });

  try {
    // Navigate to a page
    console.log('Navigating to example.com...');
    const navResult = await wrapper.navigateToPage('https://example.com');
    console.log('Navigation result:', navResult);

    // Take screenshot with path
    const outputPath = path.join(__dirname, '..', '__tests__', 'tmp', 'direct-wrapper-test.png');
    console.log(`\nTaking screenshot to: ${outputPath}`);
    
    const screenshotResult = await wrapper.takeScreenshot({
      path: outputPath,
      fullPage: true,
      format: 'png'
    });
    
    console.log('\nScreenshot result:', screenshotResult);

    // Check if file exists
    const exists = await fs.access(outputPath).then(() => true).catch(() => false);
    console.log(`\nFile exists: ${exists}`);
    
    if (exists) {
      const stats = await fs.stat(outputPath);
      console.log(`File size: ${stats.size} bytes`);
    }

    // Close browser
    await wrapper.close();
    console.log('\nBrowser closed');

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await wrapper.close();
  }
}

simpleDirectScreenshot().catch(console.error);