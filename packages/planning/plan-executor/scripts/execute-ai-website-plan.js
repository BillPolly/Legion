#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeAIWebsitePlan() {
  console.log('🚀 Executing AI-Generated Website Plan\n');

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

    // Load Code Agent Module - THIS IS THE KEY MODULE FOR AI GENERATION
    const codeAgentModulePath = path.resolve(__dirname, '../../code-gen/code-agent/module.json');
    await moduleLoader.loadModuleFromJson(codeAgentModulePath);
    console.log('✅ Loaded Code Agent module (AI-powered code generation)');

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
    const workspaceDir = path.join('/tmp', 'legion-ai-website');
    
    // Clean workspace first
    try {
      await fs.rm(workspaceDir, { recursive: true });
      console.log('🧹 Cleaned previous workspace');
    } catch (e) {
      // Directory doesn't exist, that's fine
    }
    
    // Load the plan
    const planPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'ai-generated-website-plan.json');
    const planJson = await fs.readFile(planPath, 'utf8');
    const plan = JSON.parse(planJson);
    
    // Set workspace directory in plan
    plan.workspaceDir = workspaceDir;
    
    console.log(`\n🎯 Plan: ${plan.name}`);
    console.log(`📁 Workspace: ${workspaceDir}`);
    console.log(`📝 Steps: ${plan.steps.length}`);
    console.log('\n📋 Plan Steps:');
    plan.steps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step.name} (${step.actions.length} actions)`);
    });
    console.log('');

    // Add event listeners
    executor.on('step:start', (data) => {
      console.log(`\n🔧 Step: ${data.stepName || data.stepId}`);
    });
    
    executor.on('step:complete', (data) => {
      console.log(`✅ Completed: ${data.stepName || data.stepId}\n`);
    });
    
    executor.on('step:error', (data) => {
      console.error(`❌ Failed: ${data.stepName || data.stepId}`);
      console.error(`   Error: ${data.error}\n`);
    });

    executor.on('action:start', (data) => {
      console.log(`  → ${data.action.id}: ${data.action.type}`);
    });

    executor.on('action:complete', (data) => {
      if (data.action.type === 'develop_code') {
        console.log(`  ✨ AI generated website successfully!`);
      }
    });

    // Execute the plan
    console.log('🎬 Starting AI-powered website generation and video recording...\n');
    const startTime = Date.now();
    const result = await executor.executePlan(plan);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.success) {
      console.log('\n🎉 Plan executed successfully!');
      console.log(`\n📊 Execution Summary:`);
      console.log(`   ⏱️  Total time: ${duration}s`);
      console.log(`   ✅ Steps completed: ${result.completedSteps.length}/${plan.steps.length}`);
      console.log(`   🤖 AI was used to generate the website content`);
      
      console.log('\n✨ Success! AI-generated website video created!');
      console.log(`   Path: ${workspaceDir}/legion-ai-demo.mp4`);
      console.log('\n🎥 You can now preview the video in VS Code!');
      
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
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Execute the plan
executeAIWebsitePlan().catch(console.error);