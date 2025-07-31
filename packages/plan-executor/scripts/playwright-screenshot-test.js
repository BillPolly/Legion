#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPlaywrightScreenshot() {
  console.log('🎭 Testing Playwright screenshot with google.com...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading modules...');
    
    // Load file module for saving screenshot
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    // Load playwright module
    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // Show available tools
    console.log('\n🔧 Available tools:');
    const toolNames = moduleLoader.getToolNames();
    toolNames.forEach(name => console.log(`   - ${name}`));

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'playwright-screenshot');

    // Define plan to navigate and take screenshot
    const screenshotPlan = {
      id: 'playwright-screenshot',
      name: 'Test Playwright Screenshot',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'setup',
          name: 'Create output directory',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                dirpath: '$workspaceDir',
                operation: 'create'
              }
            }
          ]
        },
        {
          id: 'navigate',
          name: 'Navigate to Google',
          actions: [
            {
              type: 'navigate_to_page',
              parameters: {
                url: 'https://www.google.com',
                waitUntil: 'networkidle',
                timeout: 30000
              }
            }
          ]
        },
        {
          id: 'screenshot',
          name: 'Take screenshot',
          actions: [
            {
              type: 'take_screenshot',
              parameters: {
                fullPage: false,
                format: 'png'
              }
            }
          ]
        }
      ]
    };

    console.log('\n📋 Executing Playwright screenshot plan...\n');
    
    // Add event listeners for debugging
    executor.on('step:start', (data) => {
      console.log(`\n🔄 Step: ${data.step.name}`);
    });
    
    executor.on('action:start', (data) => {
      console.log(`   → Action: ${data.action.type}`);
    });
    
    executor.on('action:complete', (data) => {
      console.log(`   ✓ Completed: ${data.action.type}`);
      if (data.result && data.action.type === 'take_screenshot') {
        console.log(`   📸 Screenshot taken!`);
      }
    });
    
    executor.on('action:error', (data) => {
      console.error(`   ❌ Error in ${data.action.type}:`, data.error?.message || data.error);
      if (data.error?.stack) {
        console.error('Stack:', data.error.stack);
      }
    });
    
    executor.on('step:error', (data) => {
      console.error(`\n❌ Step error in ${data.step.id}:`, data.error);
    });

    const result = await executor.executePlan(screenshotPlan);

    console.log('\n📊 Plan execution result:');
    console.log('   Success:', result.success);
    console.log('   Completed steps:', result.completedSteps);
    console.log('   Failed steps:', result.failedSteps);
    
    if (result.success) {
      console.log('\n✅ Playwright screenshot test completed!');
      console.log(`📁 Check output directory: ${workspaceDir}`);
      
      // If screenshot was taken, let's save it to a file
      // The take_screenshot tool returns base64 data
      console.log('\n💾 Note: The screenshot is captured as base64 data.');
      console.log('To save it as a file, we would need to add another step to decode and write it.');
    } else {
      console.error('\n❌ Playwright screenshot test failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testPlaywrightScreenshot().catch(console.error);