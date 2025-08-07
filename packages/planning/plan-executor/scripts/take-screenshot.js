#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-core';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshot() {
  console.log('📸 Taking screenshot of running server...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load page-screenshoter module
    const screenshotModulePath = path.resolve(__dirname, '../../general-tools/src/page-screenshoter/module.json');
    await moduleLoader.loadModuleFromJson(screenshotModulePath);
    console.log('✅ Loaded page-screenshoter module');

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'simple-server-demo');

    // Define screenshot plan
    const screenshotPlan = {
      id: 'screenshot-server',
      name: 'Take Screenshot of Running Server',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'capture',
          name: 'Capture webpage screenshot',
          actions: [
            {
              type: 'page_screenshot',
              parameters: {
                url: 'http://localhost:9876',
                outputPath: '$workspaceDir/screenshot.png',
                fullPage: true,
                viewport: {
                  width: 1280,
                  height: 800
                }
              }
            }
          ]
        }
      ]
    };

    console.log('📋 Executing screenshot plan...\n');
    const result = await executor.executePlan(screenshotPlan);

    if (result.success) {
      console.log('\n✅ Screenshot taken successfully!');
      console.log(`\n🖼️  Screenshot saved to: ${path.join(workspaceDir, 'screenshot.png')}`);
      console.log('\nYou can view the screenshot at:');
      console.log(`   ${path.join(workspaceDir, 'screenshot.png')}`);
    } else {
      console.error('\n❌ Failed to take screenshot');
      console.error('Failed steps:', result.failedSteps);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the screenshot capture
takeScreenshot().catch(console.error);