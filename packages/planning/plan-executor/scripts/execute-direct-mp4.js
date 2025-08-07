#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executePlan() {
  console.log('🚀 Executing Direct MP4 Plan\n');

  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load modules
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    const commandExecutorPath = path.resolve(__dirname, '../../general-tools/src/command-executor/module.json');
    await moduleLoader.loadModuleFromJson(commandExecutorPath);
    console.log('✅ Loaded Command Executor module\n');

    const executor = new PlanExecutor({ moduleLoader });
    const workspaceDir = path.join('/tmp', 'legion-mp4-test');
    
    // Clean workspace
    try {
      await fs.rm(workspaceDir, { recursive: true });
    } catch (e) {}
    
    const planPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'direct-mp4-plan.json');
    const planJson = await fs.readFile(planPath, 'utf8');
    const plan = JSON.parse(planJson);
    plan.workspaceDir = workspaceDir;
    
    console.log(`📁 Workspace: ${workspaceDir}\n`);

    executor.on('step:start', (data) => {
      console.log(`🔧 ${data.stepName || data.stepId}`);
    });
    
    executor.on('step:complete', (data) => {
      console.log(`✅ Done\n`);
    });
    
    executor.on('step:error', (data) => {
      console.error(`❌ Error: ${data.error}\n`);
    });

    const result = await executor.executePlan(plan);
    
    if (result.success) {
      console.log('✨ Success! Check output:');
      console.log(`   ${workspaceDir}/vscode-demo.mp4`);
    } else {
      console.error('❌ Failed');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

executePlan().catch(console.error);