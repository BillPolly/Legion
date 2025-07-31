#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function directScreenshotTest() {
  console.log('📸 Testing direct Playwright screenshot...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load playwright module
    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // Get the tools
    const navigateTool = moduleLoader.getTool('navigate_to_page');
    const screenshotTool = moduleLoader.getTool('take_screenshot');
    
    console.log('navigate_to_page tool:', navigateTool ? 'FOUND' : 'NOT FOUND');
    console.log('take_screenshot tool:', screenshotTool ? 'FOUND' : 'NOT FOUND');

    if (!navigateTool || !screenshotTool) {
      throw new Error('Required tools not found');
    }

    // Navigate to Google
    console.log('\n🌐 Navigating to Google...');
    const navResult = await navigateTool.execute({
      url: 'https://www.google.com',
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('Navigation result:', navResult.success ? 'SUCCESS' : 'FAILED');
    if (navResult.success && navResult.data) {
      console.log('   URL:', navResult.data.url || navResult.url);
      console.log('   Title:', navResult.data.title || navResult.title);
      console.log('   Status:', navResult.data.status || navResult.status);
    } else if (navResult.success) {
      // Try direct properties
      console.log('   URL:', navResult.url);
      console.log('   Title:', navResult.title);
      console.log('   Status:', navResult.status);
    } else {
      console.error('Navigation error:', navResult.error);
      return;
    }

    // Take screenshot with path
    const outputPath = path.join(__dirname, '..', '__tests__', 'tmp', 'google-screenshot.png');
    console.log(`\n📸 Taking screenshot to: ${outputPath}`);
    
    const screenshotResult = await screenshotTool.execute({
      path: outputPath,
      fullPage: false,
      format: 'png'
    });
    
    console.log('Screenshot result:', screenshotResult.success ? 'SUCCESS' : 'FAILED');
    if (screenshotResult.success) {
      const data = screenshotResult.data || screenshotResult;
      console.log('   Saved to:', data.savedPath || 'path not in response');
      console.log('   Format:', data.format || 'png');
      console.log('   Timestamp:', data.timestamp || new Date().toISOString());
    } else {
      console.error('Screenshot error:', screenshotResult.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
directScreenshotTest().catch(console.error);