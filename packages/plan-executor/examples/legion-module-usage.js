#!/usr/bin/env node

/**
 * Legion Module Usage Example
 * 
 * This example demonstrates how to use the Plan Executor as a Legion module
 * integrated with the Legion ecosystem.
 */

import { PlanExecutorModule } from '../src/index.js';

// Mock ResourceManager (would be provided by Legion framework)
class MockResourceManager {
  constructor() {
    this.resources = new Map();
    
    // Pre-populate with some mock resources
    this.resources.set('config.timeout', 10000);
    this.resources.set('config.retries', 3);
  }
  
  get(key) {
    return this.resources.get(key);
  }
  
  register(key, value) {
    this.resources.set(key, value);
  }
}

// Mock ModuleFactory (would be provided by Legion framework)
class MockModuleFactory {
  constructor() {
    this.modules = new Map();
  }
  
  createModule(moduleClass) {
    const moduleName = moduleClass.name;
    if (!this.modules.has(moduleName)) {
      this.modules.set(moduleName, new moduleClass());
    }
    return this.modules.get(moduleName);
  }
}

async function demonstrateLegionIntegration() {
  console.log('🏛️  Legion Module Integration Example\n');

  // Initialize Legion-style dependencies
  const resourceManager = new MockResourceManager();
  const moduleFactory = new MockModuleFactory();

  // Create the plan executor module
  const planExecutorModule = new PlanExecutorModule(resourceManager, moduleFactory);

  // Verify module interface
  console.log('📋 Module Information:');
  console.log(`  Dependencies: ${planExecutorModule.constructor.dependencies.join(', ')}`);
  console.log(`  Tools provided: ${planExecutorModule.getTools().length}`);
  
  const tool = planExecutorModule.getTools()[0];
  console.log(`  Tool name: ${tool.name}`);
  console.log(`  Tool description: ${tool.description}`);

  // Mock the executor's module loader for this example
  planExecutorModule.executor.moduleLoader.loadModulesForPlan = async () => {
    console.log('\n🔧 Loading required Legion modules...');
  };

  // Create mock tools that would be provided by other Legion modules
  const mockLegionTools = {
    http_request: {
      execute: async (params) => {
        console.log(`🌐 HTTP Request: ${params.method} ${params.url}`);
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          success: true,
          status: 200,
          data: { message: 'API response data', timestamp: new Date().toISOString() }
        };
      }
    },
    
    data_transform: {
      execute: async (params) => {
        console.log(`🔄 Data Transform: ${params.transform}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          result: {
            original: params.input,
            transformed: `${params.transform}(${JSON.stringify(params.input)})`
          }
        };
      }
    },
    
    notification_send: {
      execute: async (params) => {
        console.log(`📢 Notification: ${params.message} to ${params.channel}`);
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          messageId: 'msg-' + Math.random().toString(36).substr(2, 9)
        };
      }
    }
  };

  planExecutorModule.executor.moduleLoader.getTool = (toolName) => {
    const legionTool = mockLegionTools[toolName];
    if (!legionTool) {
      throw new Error(`Legion tool not found: ${toolName}`);
    }
    return legionTool;
  };

  // Define a plan that uses various Legion tools
  const legionPlan = {
    id: 'api-processing-workflow',
    name: 'API Data Processing Workflow',
    description: 'Fetch data from API, process it, and send notifications',
    steps: [
      {
        id: 'data-collection',
        name: 'Data Collection Phase',
        steps: [
          {
            id: 'fetch-user-data',
            name: 'Fetch User Data',
            actions: [
              {
                type: 'http_request',
                parameters: {
                  method: 'GET',
                  url: 'https://api.example.com/users',
                  headers: { 'Authorization': 'Bearer token123' }
                }
              }
            ]
          },
          {
            id: 'fetch-activity-data',
            name: 'Fetch Activity Data',
            actions: [
              {
                type: 'http_request',
                parameters: {
                  method: 'GET',
                  url: 'https://api.example.com/activities',
                  headers: { 'Authorization': 'Bearer token123' }
                }
              }
            ]
          }
        ]
      },
      {
        id: 'data-processing',
        name: 'Data Processing Phase',
        dependencies: ['data-collection'],
        steps: [
          {
            id: 'merge-data',
            name: 'Merge User and Activity Data',
            dependencies: ['fetch-user-data', 'fetch-activity-data'],
            actions: [
              {
                type: 'data_transform',
                parameters: {
                  transform: 'merge',
                  input: {
                    users: '@fetch-user-data',
                    activities: '@fetch-activity-data'
                  }
                }
              }
            ]
          },
          {
            id: 'analyze-data',
            name: 'Analyze Combined Data',
            dependencies: ['merge-data'],
            actions: [
              {
                type: 'data_transform',
                parameters: {
                  transform: 'analyze',
                  input: '@merge-data'
                }
              }
            ]
          }
        ]
      },
      {
        id: 'notification',
        name: 'Send Results Notification',
        dependencies: ['data-processing'],
        actions: [
          {
            type: 'notification_send',
            parameters: {
              channel: 'slack',
              message: 'Data processing completed successfully',
              data: '@analyze-data'
            }
          }
        ]
      }
    ]
  };

  try {
    console.log('\n🚀 Executing Legion Plan...\n');

    // Execute the plan using the Legion tool interface
    const result = await tool.execute({
      plan: legionPlan,
      options: {
        emitProgress: true,
        stopOnError: true,
        timeout: resourceManager.get('config.timeout'),
        retries: resourceManager.get('config.retries')
      }
    });

    // Display results
    console.log('\n📊 Legion Execution Results:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📋 Completed Steps: ${result.completedSteps.length}`);
    console.log(`❌ Failed Steps: ${result.failedSteps.length}`);
    console.log(`⏭️  Skipped Steps: ${result.skippedSteps.length}`);
    console.log(`⏱️  Execution Time: ${result.statistics.executionTime}ms`);

    if (result.success) {
      console.log('\n🎉 Legion plan executed successfully!');
      console.log('All Legion tools were orchestrated properly.');
    } else {
      console.log('\n❌ Legion plan execution failed.');
      console.log(`Error: ${result.error}`);
    }

    // Show step-by-step results
    console.log('\n📄 Step Results:');
    for (const [stepId, stepResult] of Object.entries(result.results || {})) {
      console.log(`  ${stepId}: ${JSON.stringify(stepResult, null, 2)}`);
    }

  } catch (error) {
    console.error('\n💥 Legion execution failed:', error.message);
    process.exit(1);
  }
}

// Demonstrate module lifecycle
async function demonstrateModuleLifecycle() {
  console.log('\n🔄 Module Lifecycle Demonstration\n');

  const resourceManager = new MockResourceManager();
  const moduleFactory = new MockModuleFactory();

  // 1. Module Creation
  console.log('1️⃣  Creating module instance...');
  const module = new PlanExecutorModule(resourceManager, moduleFactory);

  // 2. Module Registration (would be done by Legion framework)
  console.log('2️⃣  Registering module with Legion framework...');
  console.log(`   Module dependencies satisfied: ${module.constructor.dependencies.join(', ')}`);

  // 3. Tool Discovery
  console.log('3️⃣  Discovering available tools...');
  const availableTools = module.getTools();
  availableTools.forEach(tool => {
    console.log(`   Found tool: ${tool.name} - ${tool.description}`);
  });

  // 4. Tool Usage
  console.log('4️⃣  Tool ready for use by Legion system');
  console.log('   ✅ Module successfully integrated into Legion ecosystem');

  return module;
}

// Run the complete example
async function runExample() {
  try {
    // Demonstrate module lifecycle
    const module = await demonstrateModuleLifecycle();

    // Demonstrate actual usage
    await demonstrateLegionIntegration();

    console.log('\n✨ Legion integration example completed successfully!');
  } catch (error) {
    console.error('\nExample failed:', error);
    process.exit(1);
  }
}

runExample();