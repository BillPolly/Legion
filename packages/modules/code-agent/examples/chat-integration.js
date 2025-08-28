/**
 * Example: Using CodeAgent as a tool in a chat agent
 * 
 * This example shows how to integrate the CodeAgent JSON module
 * with a jsEnvoy chat agent to enable code generation capabilities.
 */

import { Agent } from '@legion/agent';
import { ModuleFactory } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize ResourceManager
const resourceManager = await ResourceManager.getResourceManager();

// Create ModuleFactory
const moduleFactory = new ModuleFactory(resourceManager);

// Load the CodeAgent module from module.json
const codeAgentModulePath = path.join(__dirname, '..', 'module.json');
const codeAgentModule = await moduleFactory.createJsonModule(codeAgentModulePath);

// Get the tools from the module
const codeAgentTools = await codeAgentModule.getTools();

// Create a chat agent with code generation capabilities
const chatAgent = new Agent({
  name: 'code-assistant',
  bio: 'I am an AI assistant that can help you generate complete applications with tests and documentation.',
  modelConfig: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  },
  tools: codeAgentTools,
  steps: [
    'Understand the user\'s requirements',
    'Plan the application architecture', 
    'Generate the code using the develop_code tool',
    'Fix any issues using the fix_code tool if needed',
    'Provide a summary of what was created'
  ],
  responseStructure: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Your response to the user'
      },
      filesCreated: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of files that were created'
      },
      nextSteps: {
        type: 'array', 
        items: { type: 'string' },
        description: 'Suggested next steps for the user'
      }
    },
    required: ['message']
  }
});

// Example usage
async function generateTodoApp() {
  console.log('🤖 Chat Agent with Code Generation');
  console.log('================================\n');
  
  const userRequest = `
    Create a simple todo list application with the following requirements:
    - Frontend: HTML page with a form to add todos and display them in a list
    - Backend: REST API with endpoints to create, read, update, and delete todos
    - Use in-memory storage for now
    - Include basic CSS styling
    - Add unit tests for the backend API
  `;
  
  console.log('📝 User Request:', userRequest);
  console.log('\n🔄 Processing...\n');
  
  try {
    const response = await chatAgent.run(userRequest);
    
    console.log('✅ Response:', response.message);
    
    if (response.filesCreated && response.filesCreated.length > 0) {
      console.log('\n📁 Files Created:');
      response.filesCreated.forEach(file => console.log(`  - ${file}`));
    }
    
    if (response.nextSteps && response.nextSteps.length > 0) {
      console.log('\n🚀 Next Steps:');
      response.nextSteps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTodoApp().catch(console.error);
}

export { chatAgent, generateTodoApp };