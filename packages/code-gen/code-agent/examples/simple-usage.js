/**
 * Simple example of using CodeAgent JSON module
 * 
 * This demonstrates how to load and use the CodeAgent tools directly
 */

import { ModuleFactory } from '@legion/tools-registry';
import ResourceManager from '@legion/module-loader/src/resources/ResourceManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('\n🚀 CodeAgent JSON Module Example');
  console.log('==================================\n');
  
  // 1. Initialize ResourceManager
  const resourceManager = await ResourceManager.getResourceManager();
  
  // 2. Create ModuleFactory
  const factory = new ModuleFactory(resourceManager);
  
  // 3. Load the CodeAgent module
  const moduleJsonPath = path.join(__dirname, '..', 'module.json');
  console.log('📦 Loading CodeAgent module...');
  const codeAgentModule = await factory.createJsonModule(moduleJsonPath);
  
  // 4. Get available tools
  const tools = await codeAgentModule.getTools();
  console.log(`✅ Loaded ${tools.length} tools:`);
  tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description.slice(0, 50)}...`);
  });
  
  // 5. Create a working directory
  const workingDir = path.join(__dirname, '..', 'temp', 'simple-example');
  
  // 6. Use the develop_code tool
  console.log('\n🔧 Using develop_code tool...');
  const developTool = tools.find(t => t.name === 'develop_code');
  
  const toolCall = {
    id: 'example_develop',
    type: 'function',
    function: {
      name: 'develop_code',
      arguments: JSON.stringify({
        workingDirectory: workingDir,
        task: 'Create a simple calculator web app',
        requirements: {
          frontend: 'HTML page with buttons for numbers and operations',
          backend: 'Not needed for this example'
        },
        projectType: 'frontend'
      })
    }
  };
  
  try {
    const result = await developTool.invoke(toolCall);
    
    if (result.success) {
      console.log('✅ Development successful!');
      console.log(`📁 Working directory: ${result.data.workingDirectory}`);
      console.log(`📝 Files generated: ${result.data.filesGenerated}`);
      console.log(`🧪 Tests created: ${result.data.testsCreated}`);
      console.log(`⏱️  Duration: ${result.data.duration}ms`);
    } else {
      console.log('❌ Development failed:', result.error);
      console.log('🔍 Error details:', result.data);
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
  
  // 7. Show tool descriptions
  console.log('\n📋 Tool Descriptions:');
  tools.forEach(tool => {
    const desc = tool.getToolDescription();
    console.log(`\n🔧 ${desc.function.name}:`);
    console.log(`   ${desc.function.description}`);
    console.log(`   Required params: ${desc.function.parameters.required.join(', ')}`);
  });
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;