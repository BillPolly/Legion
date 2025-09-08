/**
 * Example: Creating a Complex Agent with Task Decomposition
 * 
 * This example demonstrates how to create sophisticated multi-step agents
 * using the decent-planner's task decomposition and semantic tool discovery.
 */

import { MetaAgent } from '../src/MetaAgent.js';
import { ResourceManager } from '@legion/resource-manager';

async function createDataPipelineAgent() {
  console.log('🚀 Creating a Complex Data Pipeline Agent\n');
  console.log('=' + '='.repeat(60) + '\n');
  
  // Get ResourceManager singleton
  const resourceManager = await ResourceManager.getInstance();
  
  // Create MetaAgent
  const metaAgent = new MetaAgent({}, resourceManager);
  await metaAgent.initialize();
  
  // Define complex requirements for a data pipeline agent
  const requirements = {
    purpose: 'Create an agent that fetches data from multiple APIs, validates and transforms it, analyzes patterns, and generates comprehensive reports with visualizations',
    taskType: 'analytical',
    capabilities: [
      'Fetch data from REST APIs',
      'Validate data schemas',
      'Transform and normalize data',
      'Perform statistical analysis',
      'Generate reports',
      'Create visualizations'
    ]
  };
  
  console.log('📋 Requirements:', JSON.stringify(requirements, null, 2));
  console.log('\n' + '-'.repeat(60) + '\n');
  
  // Create the complex agent using the command
  const message = {
    type: 'message',
    content: `/create-complex-agent ${JSON.stringify(requirements)}`,
    from: 'example-user'
  };
  
  console.log('🔨 Creating complex agent with task decomposition...\n');
  const response = await metaAgent.receive(message);
  
  if (response.type === 'complex_agent_created') {
    console.log('✅ Complex Agent Created Successfully!\n');
    console.log(response.content);
    console.log('\n' + '-'.repeat(60) + '\n');
    
    // Display detailed information
    if (response.data) {
      console.log('📊 Agent Details:');
      console.log(`  - ID: ${response.data.agentId}`);
      console.log(`  - Name: ${response.data.agentName}`);
      console.log(`  - Registration: ${response.data.registrationId}`);
      
      // Show task decomposition
      if (response.data.decomposition && response.data.decomposition.hierarchy) {
        console.log('\n🌳 Task Decomposition:');
        displayHierarchy(response.data.decomposition.hierarchy, 0);
      }
      
      // Show discovered tools
      if (response.data.tools && response.data.tools.size > 0) {
        console.log('\n🔧 Discovered Tools:');
        const tools = Array.from(response.data.tools);
        tools.forEach(tool => {
          console.log(`  - ${tool}`);
        });
      }
      
      // Show behavior tree structure
      if (response.data.behaviorTree) {
        console.log('\n🎯 Behavior Tree Structure:');
        displayBehaviorTree(response.data.behaviorTree, 0);
      }
      
      // Show data flow
      if (response.data.dataFlow && response.data.dataFlow.size > 0) {
        console.log('\n🔄 Data Flow:');
        response.data.dataFlow.forEach((flow, key) => {
          console.log(`  ${flow.from} → ${flow.to}`);
        });
      }
    }
  } else {
    console.error('❌ Failed to create complex agent:', response.content);
  }
  
  await metaAgent.cleanup();
}

async function createWorkflowOrchestrator() {
  console.log('\n\n🚀 Creating a Workflow Orchestrator Agent\n');
  console.log('=' + '='.repeat(60) + '\n');
  
  const resourceManager = await ResourceManager.getInstance();
  const metaAgent = new MetaAgent({}, resourceManager);
  await metaAgent.initialize();
  
  // Natural language request that should trigger complex agent creation
  const message = {
    type: 'message',
    content: 'I need an agent that can orchestrate a complete CI/CD workflow: pull code from git, run tests, build the application, deploy to staging, run integration tests, and if everything passes, deploy to production',
    from: 'example-user'
  };
  
  console.log('💬 Natural Language Request:');
  console.log(message.content);
  console.log('\n' + '-'.repeat(60) + '\n');
  
  const response = await metaAgent.receive(message);
  
  console.log('📝 MetaAgent Response:');
  console.log(response.content);
  
  await metaAgent.cleanup();
}

// Helper function to display task hierarchy
function displayHierarchy(node, depth = 0) {
  const indent = '  '.repeat(depth);
  const marker = depth === 0 ? '📌' : node.complexity === 'SIMPLE' ? '▪️' : '▫️';
  
  console.log(`${indent}${marker} ${node.description}`);
  console.log(`${indent}   Complexity: ${node.complexity}`);
  
  if (node.tools && node.tools.length > 0) {
    console.log(`${indent}   Tools: ${node.tools.map(t => t.name).join(', ')}`);
  }
  
  if (node.subtasks && node.subtasks.length > 0) {
    node.subtasks.forEach(subtask => {
      displayHierarchy(subtask, depth + 1);
    });
  }
}

// Helper function to display behavior tree
function displayBehaviorTree(node, depth = 0) {
  const indent = '  '.repeat(depth);
  const typeIcon = {
    'sequence': '📦',
    'selector': '❓',
    'parallel': '⚡',
    'agent_tool': '🔧',
    'agent_chat': '💬',
    'action': '▶️'
  };
  
  const icon = typeIcon[node.type] || '•';
  console.log(`${indent}${icon} ${node.type}: ${node.id || node.name || 'unnamed'}`);
  
  if (node.tool) {
    console.log(`${indent}   Tool: ${node.tool}`);
  }
  
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      displayBehaviorTree(child, depth + 1);
    });
  }
}

// Run examples
async function main() {
  try {
    // Example 1: Create a data pipeline agent
    await createDataPipelineAgent();
    
    // Example 2: Create a workflow orchestrator using natural language
    await createWorkflowOrchestrator();
    
    console.log('\n✅ Examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}