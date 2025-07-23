#!/usr/bin/env node

/**
 * Simple Plan Execution Example
 * 
 * This example demonstrates how to use the Plan Executor to execute
 * a simple hierarchical plan with mock tools.
 */

import { PlanExecutor, ModuleLoader } from '../src/index.js';

// Mock ResourceManager
class MockResourceManager {
  constructor() {
    this.resources = new Map();
  }
  
  get(key) {
    return this.resources.get(key);
  }
  
  register(key, value) {
    this.resources.set(key, value);
  }
}

// Mock ModuleFactory
class MockModuleFactory {
  createModule(moduleClass) {
    // In a real implementation, this would create actual Legion modules
    return new moduleClass();
  }
}

// Mock Tools
const mockTools = {
  file_read: {
    name: 'file_read',
    execute: async (params) => {
      console.log(`📖 Reading file: ${params.path}`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
      return {
        success: true,
        content: `Content of ${params.path}`,
        size: 1024
      };
    }
  },
  
  text_transform: {
    name: 'text_transform',
    execute: async (params) => {
      console.log(`🔄 Transforming text: ${params.operation}`);
      await new Promise(resolve => setTimeout(resolve, 150)); // Simulate work
      return {
        success: true,
        result: `${params.operation.toUpperCase()}: ${params.input}`
      };
    }
  },
  
  file_write: {
    name: 'file_write',
    execute: async (params) => {
      console.log(`💾 Writing file: ${params.path}`);
      await new Promise(resolve => setTimeout(resolve, 80)); // Simulate work
      return {
        success: true,
        path: params.path,
        bytesWritten: params.content?.length || 0
      };
    }
  }
};

async function runExample() {
  console.log('🚀 Starting Plan Executor Example\n');

  // Set up dependencies
  const resourceManager = new MockResourceManager();
  const moduleFactory = new MockModuleFactory();

  // Create executor
  const executor = new PlanExecutor({
    moduleFactory,
    resourceManager
  });

  // Mock the module loader to return our mock tools
  executor.moduleLoader.loadModulesForPlan = async () => {
    console.log('📦 Loading required modules...');
  };
  
  executor.moduleLoader.getTool = (toolName) => {
    const tool = mockTools[toolName];
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return tool;
  };

  // Listen to events
  executor.on('plan:start', (event) => {
    console.log(`📋 Plan started: ${event.planName} (${event.totalSteps} steps)`);
  });

  executor.on('step:start', (event) => {
    console.log(`  ▶️  Starting step: ${event.stepName} [${event.stepPath}]`);
  });

  executor.on('step:complete', (event) => {
    console.log(`  ✅ Completed step: ${event.stepName}`);
  });

  executor.on('step:error', (event) => {
    console.log(`  ❌ Failed step: ${event.stepName} - ${event.error}`);
  });

  executor.on('plan:complete', (event) => {
    console.log(`\n🎉 Plan completed successfully!`);
    console.log(`   Completed: ${event.completedSteps} steps`);
    console.log(`   Failed: ${event.failedSteps} steps`);
    console.log(`   Execution time: ${event.executionTime}ms`);
  });

  // Define a sample plan
  const plan = {
    id: 'text-processing-pipeline',
    name: 'Text Processing Pipeline',
    description: 'Read a file, transform its content, and write the result',
    steps: [
      {
        id: 'read-source',
        name: 'Read Source File',
        description: 'Read the input text file',
        actions: [
          {
            type: 'file_read',
            parameters: {
              path: '/data/input.txt'
            }
          }
        ]
      },
      {
        id: 'text-processing',
        name: 'Text Processing',
        description: 'Transform the text content',
        steps: [
          {
            id: 'uppercase-transform',
            name: 'Uppercase Transform',
            dependencies: ['read-source'],
            actions: [
              {
                type: 'text_transform',
                parameters: {
                  input: '@read-source', // Reference to previous step result
                  operation: 'uppercase'
                }
              }
            ]
          },
          {
            id: 'prefix-transform',
            name: 'Add Prefix',
            dependencies: ['uppercase-transform'],
            actions: [
              {
                type: 'text_transform',
                parameters: {
                  input: '@uppercase-transform',
                  operation: 'prefix: processed'
                }
              }
            ]
          }
        ]
      },
      {
        id: 'write-output',
        name: 'Write Output File',
        description: 'Write the processed content to output file',
        dependencies: ['text-processing'],
        actions: [
          {
            type: 'file_write',
            parameters: {
              path: '/data/output.txt',
              content: '@prefix-transform'
            }
          }
        ]
      }
    ]
  };

  try {
    // Execute the plan
    console.log('Starting plan execution...\n');
    const result = await executor.executePlan(plan, {
      emitProgress: true,
      stopOnError: true,
      timeout: 5000,
      retries: 2
    });

    // Display results
    console.log('\n📊 Execution Results:');
    console.log(`Success: ${result.success}`);
    console.log(`Completed Steps: ${result.completedSteps.join(', ')}`);
    console.log(`Failed Steps: ${result.failedSteps.join(', ')}`);
    console.log(`Skipped Steps: ${result.skippedSteps.join(', ')}`);
    console.log(`Total Steps: ${result.statistics.totalSteps}`);
    console.log(`Execution Time: ${result.statistics.executionTime}ms`);

    if (result.success) {
      console.log('\n✨ Plan executed successfully!');
    } else {
      console.log('\n❌ Plan execution failed.');
    }

  } catch (error) {
    console.error('\n💥 Execution error:', error.message);
    process.exit(1);
  }
}

// Run the example
runExample().catch(error => {
  console.error('Example failed:', error);
  process.exit(1);
});