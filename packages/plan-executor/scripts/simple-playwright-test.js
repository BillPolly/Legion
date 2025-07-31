#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function simplePlaywrightTest() {
  console.log('🎭 Simple Playwright test - navigate and screenshot...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load modules
    console.log('📦 Loading modules...');
    
    // Load file module
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    // Load playwright module
    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // Create output directory manually
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'playwright-simple');
    await fs.mkdir(workspaceDir, { recursive: true });
    console.log(`📁 Created directory: ${workspaceDir}`);

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });

    // Simple plan - just navigate and screenshot in one step
    const plan = {
      id: 'simple-playwright',
      name: 'Simple Playwright Test',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'browse-and-capture',
          name: 'Navigate to Google and take screenshot',
          actions: [
            {
              type: 'navigate_to_page',
              parameters: {
                url: 'https://www.google.com',
                waitUntil: 'load'
              }
            },
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

    console.log('\n📋 Executing plan...\n');
    
    const result = await executor.executePlan(plan);

    console.log('\n📊 Result:');
    console.log('   Success:', result.success);
    console.log('   Completed steps:', result.completedSteps);
    console.log('   Failed steps:', result.failedSteps);
    
    if (!result.success) {
      console.error('\n❌ Plan failed');
      
      // Try to get the tools directly and test them
      console.log('\n🔧 Testing tools directly...');
      
      const navigateTool = moduleLoader.getTool('navigate_to_page');
      const screenshotTool = moduleLoader.getTool('take_screenshot');
      
      console.log('Navigate tool found:', !!navigateTool);
      console.log('Screenshot tool found:', !!screenshotTool);
      
      if (navigateTool && screenshotTool) {
        console.log('\n🧪 Attempting direct tool execution...');
        
        try {
          // Navigate
          console.log('Navigating to Google...');
          const navResult = await navigateTool.execute({
            url: 'https://www.google.com',
            waitUntil: 'load'
          });
          console.log('Navigate result:', navResult.success ? 'SUCCESS' : 'FAILED');
          
          if (navResult.success) {
            // Screenshot
            console.log('Taking screenshot...');
            const screenshotResult = await screenshotTool.execute({
              fullPage: false,
              format: 'png'
            });
            console.log('Screenshot result:', screenshotResult.success ? 'SUCCESS' : 'FAILED');
            
            if (screenshotResult.success && screenshotResult.data.screenshot) {
              // Save screenshot
              const screenshotPath = path.join(workspaceDir, 'google.png');
              const imageBuffer = Buffer.from(screenshotResult.data.screenshot, 'base64');
              await fs.writeFile(screenshotPath, imageBuffer);
              console.log(`\n✅ Screenshot saved to: ${screenshotPath}`);
            }
          }
        } catch (toolError) {
          console.error('Tool execution error:', toolError);
        }
      }
    } else {
      console.log('\n✅ Plan executed successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
simplePlaywrightTest().catch(console.error);