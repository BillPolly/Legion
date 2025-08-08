#!/usr/bin/env node

/**
 * Debug Level 5 with detailed BT inspection
 */

import { ResourceManager } from '@legion/tools';
import { ProfilePlannerModule } from '@legion/profile-planner';
import { BehaviorTreeExecutor } from '@legion/actor-BT';
import fs from 'fs/promises';
import path from 'path';

// Simple registry for testing
class DebugToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerAllTools();
  }
  
  registerAllTools() {
    // All the tools from simple test
    this.tools.set('file_write', {
      name: 'file_write',
      execute: async (params) => {
        console.log(`   📝 Writing: ${params.filepath}`);
        const dir = path.dirname(params.filepath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(params.filepath, params.content, 'utf-8');
        return { success: true, filepath: params.filepath };
      }
    });

    this.tools.set('directory_create', {
      name: 'directory_create',
      execute: async (params) => {
        console.log(`   📁 Creating: ${params.path}`);
        await fs.mkdir(params.path, { recursive: true });
        return { success: true, path: params.path };
      }
    });

    this.tools.set('npm_install', {
      name: 'npm_install',
      execute: async (params) => {
        console.log(`   📦 npm install in: ${params.directory}`);
        return { success: true, directory: params.directory };
      }
    });

    this.tools.set('run_tests', {
      name: 'run_tests',
      execute: async (params) => {
        console.log(`   🧪 Running tests in: ${params.directory}`);
        return { success: true, directory: params.directory, testResults: 'passed' };
      }
    });

    this.tools.set('start_dev_server', {
      name: 'start_dev_server',
      execute: async (params) => {
        console.log(`   🚀 Starting dev server on port: ${params.port || 3000}`);
        return { success: true, port: params.port || 3000 };
      }
    });

    this.tools.set('build_project', {
      name: 'build_project',
      execute: async (params) => {
        console.log(`   🔨 Building project: ${params.directory}`);
        return { success: true, directory: params.directory };
      }
    });
  }
  
  async getTool(toolName) {
    return this.tools.get(toolName);
  }
  
  async getAvailableTools() {
    return Array.from(this.tools.keys());
  }
}

async function debugLevel5() {
  console.log('🔍 LEVEL 5 DEBUG: Full App Generation Test\n');
  
  try {
    // STEP 1: Setup
    console.log('1. Setting up ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    console.log('   ✅ ResourceManager ready\n');

    // STEP 2: Create planner
    console.log('2. Creating ProfilePlannerModule...');
    const profileModule = await ProfilePlannerModule.create(resourceManager);
    const tools = profileModule.getTools();
    const profilePlannerTool = tools.find(tool => tool.name === 'profile_planner');
    console.log('   ✅ ProfilePlannerTool ready\n');

    // STEP 3: Generate FULL STACK plan
    console.log('3. Generating FULL-STACK application plan...');
    const planResult = await profilePlannerTool.execute({
      profileName: 'javascript-development',
      profile: 'javascript-development',
      task: 'Create a complete full-stack todo app with Express backend, React frontend, MongoDB database, tests, and Docker deployment'
    });

    if (!planResult.success) {
      throw new Error(`Planning failed: ${planResult.error}`);
    }

    const behaviorTree = planResult.data.behaviorTree;
    console.log('   ✅ Full-stack plan generated!');
    console.log(`   🌳 Total nodes: ${countAllNodes(behaviorTree)}`);
    console.log(`   🎯 Action nodes: ${countActions(behaviorTree)}`);
    
    // STEP 4: Show the generated BT structure
    console.log('\n4. Generated Behavior Tree Structure:');
    console.log(JSON.stringify(behaviorTree, null, 2));

    // STEP 5: Execute with debugging
    console.log('\n5. Executing full application generation...');
    const toolRegistry = new DebugToolRegistry();
    const btExecutor = new BehaviorTreeExecutor(toolRegistry);
    
    console.log(`   🔍 Available tools: ${(await toolRegistry.getAvailableTools()).length}`);
    console.log('   🔄 Starting execution...\n');
    
    const executionResult = await btExecutor.executeTree(behaviorTree);
    
    console.log('\n📊 FINAL EXECUTION RESULT:');
    console.log(`   - Success: ${executionResult.success}`);
    console.log(`   - Status: ${executionResult.status}`);
    console.log(`   - Execution time: ${executionResult.executionTime}ms`);
    
    if (executionResult.data) {
      console.log(`   - Total steps: ${executionResult.data.totalSteps || 'unknown'}`);
      console.log(`   - Completed steps: ${executionResult.data.completedSteps || 'unknown'}`);
      console.log(`   - Failed at: ${executionResult.data.failedAt || 'none'}`);
    }

    // STEP 6: Verify generated files
    console.log('\n6. Checking generated files...');
    try {
      const files = await fs.readdir('.', { withFileTypes: true });
      const appDirs = files.filter(f => f.isDirectory() && f.name.includes('app')).map(f => f.name);
      console.log(`   📁 App directories created: ${appDirs.join(', ')}`);
      
      for (const dir of appDirs.slice(0, 2)) { // Check first 2 dirs
        const dirContents = await fs.readdir(dir).catch(() => []);
        console.log(`   📄 ${dir} contents: ${dirContents.join(', ')}`);
      }
    } catch (error) {
      console.log(`   ❌ File check error: ${error.message}`);
    }

    return {
      success: executionResult.success,
      planGenerated: true,
      totalNodes: countAllNodes(behaviorTree),
      actionNodes: countActions(behaviorTree),
      executionDetails: executionResult
    };

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
    return {
      success: false,
      error: error.message
    };
  }
}

function countAllNodes(bt) {
  let count = 0;
  
  function traverse(node) {
    count++;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
    if (node.child) traverse(node.child);
  }
  
  traverse(bt);
  return count;
}

function countActions(bt) {
  let count = 0;
  
  function traverse(node) {
    if (node.type === 'action') count++;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
    if (node.child) traverse(node.child);
  }
  
  traverse(bt);
  return count;
}

// Run the debug
if (import.meta.url === `file://${process.argv[1]}`) {
  debugLevel5()
    .then(result => {
      console.log('\n📋 DEBUG RESULT:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

export { debugLevel5 };