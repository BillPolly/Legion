/**
 * Simple debug test to understand tool parameter passing
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { PlanExecutorModule } from '../../src/PlanExecutorModule.js';
import PackageManagerModule from '../../../code-gen/package-manager/src/PackageManagerModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Simple Tool Debug', () => {
  let resourceManager;
  let planExecutorModule;
  let testDir;
  let plan;
  
  beforeAll(async () => {
    // Setup test directory
    testDir = path.join(__dirname, '..', 'tmp', 'simple-debug-test');
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    await fs.mkdir(testDir, { recursive: true });
    console.log(`\n🧪 Test directory: ${testDir}`);
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create modules
    const JSGeneratorModule = (await import('../../../code-gen/js-generator/src/JSGeneratorModule.js')).default;
    const jsGeneratorModule = await JSGeneratorModule.create(resourceManager);
    console.log(`📦 JS Generator module: ${jsGeneratorModule.getTools().length} tools`);
    
    // Create module registry
    const moduleRegistry = new Map();
    moduleRegistry.set('js-generator', jsGeneratorModule);
    
    const enhancedModuleFactory = {
      getAllTools: () => {
        const allTools = new Map();
        for (const [moduleName, module] of moduleRegistry.entries()) {
          const tools = module.getTools();
          for (const tool of tools) {
            allTools.set(tool.name, { tool, module: moduleName });
          }
        }
        return allTools;
      }
    };
    
    // Create PlanExecutorModule
    planExecutorModule = new PlanExecutorModule({
      resourceManager,
      moduleFactory: enhancedModuleFactory
    });
    
    // Create custom tool registry
    const customToolRegistry = {
      async loadModulesForPlan(plan) {
        console.log(`📋 Loading modules: ${plan.metadata?.requiredModules?.join(', ') || 'none'}`);
        return;
      },
      
      getTool(actionType) {
        console.log(`🔍 Looking for tool: ${actionType}`);
        
        const allTools = enhancedModuleFactory.getAllTools();
        const toolInfo = allTools.get(actionType);
        
        if (!toolInfo) {
          throw new Error(`Tool not found: ${actionType}`);
        }
        
        const originalTool = toolInfo.tool;
        return {
          name: actionType,
          async execute(params) {
            console.log(`🔧 ${actionType} - Received params:`, params);
            console.log(`🔧 ${actionType} - Param keys:`, Object.keys(params || {}));
            console.log(`🔧 ${actionType} - Param values:`, Object.values(params || {}));
            
            try {
              const rawResult = await originalTool.execute(params);
              console.log(`🔧 ${actionType} - Raw result:`, rawResult);
              
              // Convert to standard format
              let result;
              if (rawResult && typeof rawResult === 'object') {
                if (rawResult.hasOwnProperty('success')) {
                  result = rawResult;
                } else if (rawResult.hasOwnProperty('created')) {
                  result = {
                    success: rawResult.created !== false && !rawResult.error,
                    data: rawResult,
                    error: rawResult.error
                  };
                } else {
                  result = {
                    success: !rawResult.error,
                    data: rawResult,
                    error: rawResult.error
                  };
                }
              } else {
                result = {
                  success: rawResult !== null && rawResult !== undefined,
                  data: rawResult
                };
              }
              
              console.log(`🔧 ${actionType} - Converted result success:`, result.success);
              if (!result.success) {
                console.log(`🔧 ${actionType} - Error:`, result.error);
              }
              return result;
            } catch (error) {
              console.log(`🔧 ${actionType} - Exception:`, error.message);
              return {
                success: false,
                error: error.message,
                data: null
              };
            }
          }
        };
      }
    };
    
    planExecutorModule.planToolRegistry = customToolRegistry;
    planExecutorModule.executor.planToolRegistry = customToolRegistry;
    
    // Load the test plan
    const planPath = path.join(__dirname, '..', 'tmp', 'js-generator-test-plan.json');
    const planContent = await fs.readFile(planPath, 'utf8');
    plan = JSON.parse(planContent);
    
    console.log(`📋 Loaded plan: ${plan.name}`);
    
  }, 30000);
  
  test('should execute simple JS generator test', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      const tools = planExecutorModule.getTools();
      const planExecuteTool = tools.find(tool => tool.name === 'plan_execute');
      
      const toolCall = {
        function: {
          name: 'plan_execute',
          arguments: JSON.stringify({
            plan: plan,
            options: {
              parallel: false,
              stopOnError: true
            }
          })
        }
      };
      
      console.log(`\n🎯 Executing simple plan...`);
      const result = await planExecuteTool.invoke(toolCall);
      
      console.log(`📊 Result success: ${result.success}`);
      if (!result.success) {
        console.log(`📊 Error: ${result.error}`);
        console.log(`📊 Details:`, result.details);
      }
      
      expect(result).toBeDefined();
      
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);
});