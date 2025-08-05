#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeMultiActionPlan() {
  console.log('🚀 Executing Multi-Action Website Plan\n');

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

    // Load Playwright Module for video recording
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
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'legion-multi-action-demo');
    
    // Clean workspace first
    try {
      await fs.rm(workspaceDir, { recursive: true });
      console.log('🧹 Cleaned previous workspace');
    } catch (e) {
      // Directory doesn't exist, that's fine
    }
    
    // Load the plan
    const planPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'multi-action-website-plan.json');
    const planJson = await fs.readFile(planPath, 'utf8');
    const plan = JSON.parse(planJson);
    
    // Set workspace directory in plan
    plan.workspaceDir = workspaceDir;
    
    console.log(`\n🎯 Plan: ${plan.name}`);
    console.log(`📁 Workspace: ${workspaceDir}`);
    console.log(`📝 Steps: ${plan.steps.length}`);
    console.log('\n📋 Plan Structure:');
    plan.steps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step.name}`);
      console.log(`      └─ ${step.actions.length} actions: ${step.actions.map(a => a.id).join(', ')}`);
    });
    console.log('');

    // Set up execution logging - single point for all events
    const logPath = path.join(workspaceDir, 'plan-execution.log');
    const logEntries = [];
    let actionCount = 0;
    
    // Single event logger that captures all executor events
    function logEvent(eventType, data) {
      const timestamp = new Date().toISOString();
      let message = '';
      
      switch(eventType) {
        case 'step:start':
          actionCount = 0;
          const stepNum = plan.steps.findIndex(s => s.id === data.stepId) + 1;
          message = `🔧 Step ${stepNum}/${plan.steps.length}: ${data.stepName || data.stepId}`;
          break;
        case 'action:start':
          actionCount++;
          message = `   [${actionCount}] ${data.action.id}`;
          break;
        case 'action:complete':
          if (data.result?.success !== false) {
            message = `       ✓ ${data.action.type} completed`;
          }
          break;
        case 'step:complete':
          message = `   ✅ Step completed successfully`;
          break;
        case 'step:error':
          message = `   ❌ Step failed: ${data.error}`;
          break;
      }
      
      if (message) {
        console.log(message);
        logEntries.push(`[${timestamp}] ${message}`);
      }
    }

    // Attach single logger to all events
    executor.on('step:start', (data) => logEvent('step:start', data));
    executor.on('action:start', (data) => logEvent('action:start', data));
    executor.on('action:complete', (data) => logEvent('action:complete', data));
    executor.on('step:complete', (data) => logEvent('step:complete', data));
    executor.on('step:error', (data) => logEvent('step:error', data));

    // Execute the plan
    console.log('🎬 Starting multi-action plan execution...\n');
    const startTime = Date.now();
    const result = await executor.executePlan(plan);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.success) {
      console.log('\n🎉 Plan executed successfully!');
      console.log(`\n📊 Execution Summary:`);
      console.log(`   ⏱️  Total time: ${duration}s`);
      console.log(`   ✅ Steps completed: ${result.completedSteps.length}/${plan.steps.length}`);
      
      // Count total actions
      const totalActions = plan.steps.reduce((sum, step) => sum + step.actions.length, 0);
      console.log(`   🔧 Total actions executed: ${totalActions}`);
      
      console.log('\n📁 Generated files:');
      try {
        const files = await fs.readdir(workspaceDir);
        for (const file of files.sort()) {
          const stats = await fs.stat(path.join(workspaceDir, file));
          if (stats.isFile()) {
            const size = (stats.size / 1024).toFixed(1);
            console.log(`   - ${file} (${size} KB)`);
          }
        }
      } catch (e) {
        console.log('   Could not list files');
      }
      
      console.log('\n✨ Success! Video created:');
      console.log(`   📹 VS Code compatible: ${workspaceDir}/demo-vscode.mp4`);
      console.log('\n🎬 You can now preview the video in VS Code!');
      
    } else {
      console.error('\n❌ Plan execution failed!');
      console.error(`\n📊 Execution Summary:`);
      console.error(`   ⏱️  Total time: ${duration}s`);
      console.error(`   ✅ Steps completed: ${result.completedSteps.length}`);
      console.error(`   ❌ Steps failed: ${result.failedSteps.length}`);
      
      if (result.error) {
        console.error(`\n💥 Error: ${result.error}`);
      }
    }

    // Write execution log to file
    try {
      logEntries.push(`[${new Date().toISOString()}] 📄 Plan execution completed`);
      logEntries.push(`[${new Date().toISOString()}] 💾 Writing execution log to: ${logPath}`);
      await fs.writeFile(logPath, logEntries.join('\n'), 'utf8');
      console.log(`\n📝 Execution log saved to: plan-execution.log`);
    } catch (logError) {
      console.error('Failed to write log file:', logError.message);
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error('Stack:', error.stack);
    
    // Try to save log even on error
    try {
      if (logEntries.length > 0) {
        logEntries.push(`[${new Date().toISOString()}] ❌ Fatal error: ${error.message}`);
        await fs.writeFile(logPath, logEntries.join('\n'), 'utf8');
      }
    } catch (logError) {
      // Ignore log errors during error handling
    }
  }
}

// Execute the plan
executeMultiActionPlan().catch(console.error);