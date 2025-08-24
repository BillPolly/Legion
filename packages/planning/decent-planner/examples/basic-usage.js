/**
 * Basic usage example for DecentPlanner
 * 
 * Demonstrates hierarchical task decomposition and planning
 */

import { DecentPlanner } from '../src/index.js';
import { ResourceManager, ToolRegistry } from '@legion/tools-registry';
import { MongoDBToolRegistryProvider } from '@legion/tools-registry/src/providers/MongoDBToolRegistryProvider.js';

async function main() {
  console.log('🚀 DecentPlanner Example\n');
  
  // Initialize ResourceManager
  const resourceManager = await ResourceManager.getResourceManager();
  
  // ResourceManager will supply all dependencies through getOrInitialize
  // This ensures proper singleton pattern and lazy initialization
  
  // Ensure LLM client is available (created on first access)
  const llmClient = await resourceManager.getOrInitialize('llmClient', async () => {
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }
    const { LLMClient } = await import('@legion/ai-agent-core');
    return new LLMClient({ apiKey: anthropicKey });
  });
  
  // Ensure tool registry provider is available
  console.log('📚 Setting up tool registry...');
  const toolRegistryProvider = await resourceManager.getOrInitialize('toolRegistryProvider', async () => {
    return await MongoDBToolRegistryProvider.create(
      resourceManager,
      { enableSemanticSearch: true }
    );
  });
  
  // Ensure tool registry is available
  const toolRegistry = await resourceManager.getOrInitialize('toolRegistry', async () => {
    const provider = await resourceManager.getOrInitialize('toolRegistryProvider', async () => {
      return await MongoDBToolRegistryProvider.create(
        resourceManager,
        { enableSemanticSearch: true }
      );
    });
    const registry = new ToolRegistry({ provider });
    await registry.initialize();
    return registry;
  });
  
  // Create DecentPlanner
  console.log('🧠 Creating DecentPlanner...\n');
  const planner = await DecentPlanner.create(resourceManager);
  
  // Example 1: Simple web API
  console.log('═══════════════════════════════════════════════');
  console.log('Example 1: Create a REST API for task management');
  console.log('═══════════════════════════════════════════════\n');
  
  const apiResult = await planner.plan(
    'Create a REST API for task management with CRUD operations',
    {
      domain: 'web-development',
      maxDepth: 3,
      debug: true
    }
  );
  
  if (apiResult.success) {
    console.log('\n✅ Planning successful!\n');
    console.log('📊 Statistics:');
    console.log(`  - Total simple tasks: ${apiResult.data.statistics.totalTasks}`);
    console.log(`  - Decomposition levels: ${apiResult.data.statistics.decompositionLevels}`);
    console.log(`  - Total BT nodes: ${apiResult.data.statistics.totalNodes}`);
    
    console.log('\n🌳 Task Hierarchy:');
    printHierarchy(apiResult.data.hierarchy);
    
    console.log('\n📦 Artifacts:');
    console.log(`  - Inputs: ${apiResult.data.artifacts.inputs.join(', ')}`);
    console.log(`  - Outputs: ${apiResult.data.artifacts.outputs.join(', ')}`);
    console.log(`  - Intermediate: ${apiResult.data.artifacts.intermediate.join(', ')}`);
    
    console.log('\n📋 Execution Plan:');
    apiResult.data.executionPlan.forEach((task, i) => {
      console.log(`  ${i + 1}. ${task.description}`);
      if (task.dependencies.length > 0) {
        console.log(`     Dependencies: ${task.dependencies.join(', ')}`);
      }
    });
  } else {
    console.error('❌ Planning failed:', apiResult.error);
  }
  
  // Example 2: Data pipeline
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 2: Build a data analysis pipeline');
  console.log('═══════════════════════════════════════════════\n');
  
  const pipelineResult = await planner.plan(
    'Build a data pipeline to analyze CSV sales data and generate visualizations',
    {
      domain: 'data-analysis',
      maxDepth: 4
    }
  );
  
  if (pipelineResult.success) {
    console.log('✅ Pipeline planning successful!\n');
    console.log('📊 Statistics:');
    console.log(`  - Total simple tasks: ${pipelineResult.data.statistics.totalTasks}`);
    console.log(`  - Decomposition levels: ${pipelineResult.data.statistics.decompositionLevels}`);
    
    console.log('\n🎯 Simple Tasks Discovered:');
    pipelineResult.data.executionPlan.forEach((task, i) => {
      console.log(`  ${i + 1}. ${task.description}`);
    });
  } else {
    console.error('❌ Pipeline planning failed:', pipelineResult.error);
  }
  
  // Close connections
  if (mongoProvider.close) {
    await mongoProvider.close();
  }
}

/**
 * Helper function to print task hierarchy
 */
function printHierarchy(node, indent = '') {
  console.log(`${indent}${node.complexity === 'SIMPLE' ? '📄' : '📁'} ${node.description} [${node.complexity}]`);
  
  if (node.suggestedOutputs && node.suggestedOutputs.length > 0) {
    console.log(`${indent}   → Outputs: ${node.suggestedOutputs.join(', ')}`);
  }
  
  if (node.children) {
    node.children.forEach(child => {
      printHierarchy(child, indent + '  ');
    });
  }
}

// Run the example
main().catch(console.error);