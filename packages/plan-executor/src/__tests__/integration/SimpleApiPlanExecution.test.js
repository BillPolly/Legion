/**
 * Integration test for executing the simple API plan with real modules
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { PlanExecutorModule } from '../../PlanExecutorModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Simple API Plan Execution', () => {
  let planExecutorModule;
  let planExecutorTool;
  let testPlan;

  beforeAll(async () => {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create PlanExecutorModule 
    planExecutorModule = new PlanExecutorModule({
      resourceManager: resourceManager,
      moduleFactory: new ModuleFactory(resourceManager)
    });

    // Get the plan_execute tool
    const tools = planExecutorModule.getTools();
    planExecutorTool = tools.find(tool => tool.name === 'plan_execute');
    
    // Load the test plan
    const planPath = path.join(__dirname, '..', '..', '..', '__tests__', 'fixtures', 'simple-api-plan.json');
    const planContent = await fs.readFile(planPath, 'utf8');
    testPlan = JSON.parse(planContent);
  }, 30000);

  test('should find plan_execute tool', () => {
    expect(planExecutorTool).toBeDefined();
    expect(planExecutorTool.name).toBe('plan_execute');
  });

  test('should successfully load all required modules for simple API plan', async () => {
    const toolCall = {
      function: {
        name: 'plan_execute',
        arguments: JSON.stringify({
          plan: testPlan,
          validateOnly: true // Only validate, don't execute
        })
      }
    };

    const result = await planExecutorTool.invoke(toolCall);
    
    console.log('Plan execution result:', JSON.stringify(result, null, 2));
    
    // Should succeed in loading modules
    expect(result.success).toBe(true);
    expect(result.message).toContain('Plan validation successful');
    
    // Should have loaded the required modules
    expect(result.data).toBeDefined();
    expect(result.data.validation).toBeDefined();
    expect(result.data.validation.modulesLoaded).toBeDefined();
    
    // Should contain the required modules: file, js-generator, package-manager, command-executor
    const loadedModules = result.data.validation.modulesLoaded;
    expect(loadedModules).toContain('file');
    expect(loadedModules).toContain('js-generator');
    expect(loadedModules).toContain('package-manager');
    expect(loadedModules).toContain('command-executor');
  }, 30000);

  test('should execute simple API plan steps successfully', async () => {
    const toolCall = {
      function: {
        name: 'plan_execute',
        arguments: JSON.stringify({
          plan: testPlan,
          options: {
            dryRun: false,
            continueOnError: false
          }
        })
      }
    };

    const result = await planExecutorTool.invoke(toolCall);
    
    // Execution should complete
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('completed');
    
    // Should have executed all 6 steps
    expect(result.data.steps).toBeDefined();
    expect(Object.keys(result.data.steps)).toHaveLength(6);
    
    // Check specific step results
    const steps = result.data.steps;
    expect(steps['cleanup-tmp']).toBeDefined();
    expect(steps['create-package']).toBeDefined();
    expect(steps['generate-server']).toBeDefined();
    expect(steps['start-server']).toBeDefined();
    expect(steps['test-api']).toBeDefined();
    expect(steps['stop-server']).toBeDefined();
    
    // All steps should have succeeded
    Object.values(steps).forEach(step => {
      expect(step.status).toBe('completed');
      expect(step.success).toBe(true);
    });
  }, 60000); // Longer timeout for actual execution
});