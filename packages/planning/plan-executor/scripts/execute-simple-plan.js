#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-core';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeSimplePlan() {
  console.log('🚀 Executing Streamlined Website Plan\n');

  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load required modules
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    const commandExecutorPath = path.resolve(__dirname, '../../general-tools/src/command-executor/module.json');
    await moduleLoader.loadModuleFromJson(commandExecutorPath);
    console.log('✅ Loaded Command Executor module');

    const executor = new PlanExecutor({ moduleLoader });
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'legion-multi-action-demo');
    
    // Clean workspace
    try {
      await fs.rm(workspaceDir, { recursive: true });
      console.log('🧹 Cleaned previous workspace');
    } catch (e) {}
    
    // Load plan
    const planPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'multi-action-website-plan.json');
    const planJson = await fs.readFile(planPath, 'utf8');
    const plan = JSON.parse(planJson);
    plan.workspaceDir = workspaceDir;
    
    console.log(`\n🎯 Plan: ${plan.name}`);
    console.log(`📁 Workspace: ${workspaceDir}`);
    console.log(`📝 Steps: ${plan.steps.length}\n`);

    // Simple event listeners
    executor.on('step:start', (data) => {
      const stepNum = plan.steps.findIndex(s => s.id === data.stepId) + 1;
      console.log(`🔧 Step ${stepNum}: ${data.stepName || data.stepId}`);
    });
    
    executor.on('step:complete', () => {
      console.log('✅ Step completed\n');
    });
    
    executor.on('step:error', (data) => {
      console.error(`❌ Step failed: ${data.error}\n`);
    });

    // Execute
    const startTime = Date.now();
    const result = await executor.executePlan(plan);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.success) {
      console.log('🎉 Plan executed successfully!');
      console.log(`⏱️  Time: ${duration}s`);
      console.log(`✅ Steps: ${result.completedSteps.length}/${plan.steps.length}`);
      console.log(`\n📹 VS Code video: ${workspaceDir}/demo-vscode.mp4`);
    } else {
      console.error('❌ Plan failed');
      if (result.error) console.error(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

executeSimplePlan().catch(console.error);