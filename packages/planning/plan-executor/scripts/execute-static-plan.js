#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeStaticPlan() {
  console.log('🚀 Executing Static Website Video Plan - No Server Required!\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading required modules...\n');
    
    // Load File Module
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    // Load Playwright Module
    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // Load Command Executor Module
    const commandExecutorPath = path.resolve(__dirname, '../../general-tools/src/command-executor/module.json');
    await moduleLoader.loadModuleFromJson(commandExecutorPath);
    console.log('✅ Loaded Command Executor module');

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });
    
    // Set up workspace directory
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'static-demo');
    
    // Clean workspace first
    try {
      await fs.rm(workspaceDir, { recursive: true });
      console.log('🧹 Cleaned previous workspace');
    } catch (e) {
      // Directory doesn't exist, that's fine
    }
    
    // Load the plan
    const planPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'static-website-video-plan.json');
    const planJson = await fs.readFile(planPath, 'utf8');
    const plan = JSON.parse(planJson);
    
    // Set workspace directory in plan
    plan.workspaceDir = workspaceDir;
    
    console.log(`\n🎯 Plan: ${plan.name}`);
    console.log(`📁 Workspace: ${workspaceDir}`);
    console.log(`📝 Steps: ${plan.steps.length}`);
    console.log('\n📋 Plan Steps:');
    plan.steps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step.name}`);
    });
    console.log('');

    // Add simple event listeners
    executor.on('step:start', (data) => {
      console.log(`\n🚀 Step: ${data.stepName || data.stepId}`);
    });
    
    executor.on('step:complete', (data) => {
      console.log(`   ✅ Completed: ${data.stepName || data.stepId}`);
    });
    
    executor.on('step:error', (data) => {
      console.error(`   ❌ Failed: ${data.stepName || data.stepId}`);
      console.error(`   Error: ${data.error}`);
    });

    // Execute the plan
    console.log('🎬 Starting plan execution...\n');
    const startTime = Date.now();
    const result = await executor.executePlan(plan);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.success) {
      console.log('\n🎉 Plan executed successfully!');
      console.log(`\n📊 Execution Summary:`);
      console.log(`   ⏱️  Total time: ${duration}s`);
      console.log(`   ✅ Steps completed: ${result.completedSteps.length}/${plan.steps.length}`);
      console.log(`   ❌ Steps failed: ${result.failedSteps.length}`);
      console.log(`   ⏭️  Steps skipped: ${result.skippedSteps.length}`);
      
      // Check for output files
      console.log('\n📁 Checking output files...');
      try {
        const files = await fs.readdir(workspaceDir);
        console.log(`   Files created: ${files.length}`);
        for (const file of files) {
          const stats = await fs.stat(path.join(workspaceDir, file));
          console.log(`   - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        }
        
        // Check specifically for MP4
        if (files.includes('vscode-compatible.mp4')) {
          console.log('\n✨ Success! VS Code compatible MP4 created!');
          console.log(`   Path: ${path.join(workspaceDir, 'vscode-compatible.mp4')}`);
          console.log('\n🎥 You can now preview the video in VS Code!');
        }
      } catch (error) {
        console.error('   Could not check files:', error.message);
      }
      
    } else {
      console.error('\n❌ Plan execution failed!');
      console.error(`\n📊 Execution Summary:`);
      console.error(`   ⏱️  Total time: ${duration}s`);
      console.error(`   ✅ Steps completed: ${result.completedSteps.length}`);
      console.error(`   ❌ Steps failed: ${result.failedSteps.length}`);
      console.error(`   ⏭️  Steps skipped: ${result.skippedSteps.length}`);
      
      if (result.error) {
        console.error(`\n💥 Error: ${result.error}`);
      }
      
      if (result.failedSteps.length > 0) {
        console.error('\n📋 Failed steps:');
        result.failedSteps.forEach(stepId => {
          const step = plan.steps.find(s => s.id === stepId);
          console.error(`   - ${step?.name || stepId}`);
        });
      }
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Execute the static plan
executeStaticPlan().catch(console.error);