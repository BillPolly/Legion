#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeCompleteVideoPlan() {
  console.log('🎬 Executing Complete Animated Website & MP4 Video Plan\n');
  console.log('📋 This plan will:');
  console.log('   1. Clean workspace and setup directories');
  console.log('   2. Create animated website with beautiful effects');
  console.log('   3. Start Node.js server on port 3465');
  console.log('   4. Record 12 seconds of animation as MP4');
  console.log('   5. Convert to VS Code-compatible format');
  console.log('   6. Cleanup server process\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading required modules...');
    
    // Load File module
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    // Load Playwright module - testing if this causes the issue
    try {
      const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
      await moduleLoader.loadModuleFromJson(playwrightModulePath);
      console.log('✅ Loaded Playwright module');
    } catch (error) {
      console.error('❌ Failed to load Playwright module:', error.message);
      console.log('Stack:', error.stack);
      throw error;
    }

    // Skip Node Runner module due to ProcessManager cleanup issues
    console.log('⏭️  Skipping Node Runner module (ProcessManager conflicts)');

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });
    
    // Set up workspace directory
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'vscode-demo');
    
    // Use the video creation plan now that we fixed the event listener issue
    const planPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'simple-video-creation-plan.json');
    const planJson = await fs.readFile(planPath, 'utf8');
    const plan = JSON.parse(planJson);
    
    // Set workspace directory in plan
    plan.workspaceDir = workspaceDir;
    
    console.log(`\n🎯 Plan loaded: ${plan.name}`);
    console.log(`📁 Workspace: ${workspaceDir}`);
    console.log(`📝 Steps: ${plan.steps.length}\n`);

    // Remove event listeners to test if they cause the issue
    console.log('   (Event listeners removed for debugging)');

    // Execute the plan
    console.log('🎬 Executing plan...\n');
    console.log('Plan structure check:');
    console.log('- Plan ID:', plan.id);
    console.log('- Plan status:', plan.status);
    console.log('- Steps count:', plan.steps?.length);
    console.log('- First step:', plan.steps?.[0]?.name);
    
    const result = await executor.executePlan(plan);
    
    if (result.success) {
      console.log('\n🎉 Plan executed successfully!');
      console.log('\n📊 Execution Summary:');
      console.log(`   ✅ Status: ${result.status}`);
      console.log(`   ⏱️  Duration: ${result.executionTime}ms`);
      console.log(`   📋 Steps completed: ${result.completedSteps}/${result.totalSteps}`);
      
      // Now manually start server and record video
      console.log('\n🌐 Starting server and recording video...');
      
      const { spawn } = await import('child_process');
      
      // Start the server
      const serverProcess = spawn('node', ['server.mjs'], {
        cwd: workspaceDir,
        stdio: 'pipe',
        detached: false
      });
      
      // Wait for server to start
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server timeout')), 5000);
        serverProcess.stdout.on('data', (data) => {
          console.log('   Server:', data.toString().trim());
          if (data.toString().includes('server running')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      
      // Wait a bit more for full startup
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Server is running');
      
      // Record video using Playwright module
      console.log('\n🎬 Recording MP4 video...');
      const playwrightTool = moduleLoader.getTool('record_video');
      
      console.log('   Recording parameters:');
      console.log(`   - URL: http://localhost:3468`);
      console.log(`   - Duration: 12 seconds`);
      console.log(`   - Output: ${path.join(workspaceDir, 'vscode-compatible-demo.mp4')}`);
      console.log(`   - Format: mp4`);
      
      const videoResult = await playwrightTool.execute({
        path: path.join(workspaceDir, 'vscode-compatible-demo.mp4'),
        duration: 12,
        url: 'http://localhost:3468',
        format: 'mp4'
      });
      
      console.log('   Video result:', {
        success: videoResult.success,
        path: videoResult.path,
        size: videoResult.size,
        format: videoResult.format || 'unknown'
      });
      
      // Stop server
      serverProcess.kill();
      console.log('🛑 Server stopped');
      
      if (videoResult.success) {
        console.log('\n🎥 Video recorded successfully!');
        console.log(`   📁 Path: ${videoResult.path}`);
        console.log(`   📏 Size: ${(videoResult.size / 1024 / 1024).toFixed(2)} MB`);
        console.log('\n✨ Ready for VS Code!');
        console.log('   • Open VS Code');
        console.log('   • Navigate to the MP4 file');
        console.log('   • Click to preview in VS Code');
      } else {
        console.error('❌ Video recording failed:', videoResult.error);
      }
      
    } else {
      console.error('\n❌ Plan execution failed!');
      console.error('Error:', result.error?.message || result.error);
      if (result.failedStep) {
        console.error(`Failed at step: ${result.failedStep}`);
      }
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Execute the plan
executeCompleteVideoPlan().catch(console.error);