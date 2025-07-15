/**
 * Example: Using CodeAgent to generate a simple project
 */

import { CodeAgent } from '../src/index.js';

async function generateSimpleProject() {
  // Create CodeAgent instance
  const agent = new CodeAgent({
    projectType: 'fullstack',
    testCoverage: {
      threshold: 80
    }
  });

  // Initialize in a working directory
  await agent.initialize('./generated-project', {
    llmConfig: {
      provider: 'anthropic', // Change to 'openai' or your preferred provider
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
    }
  });

  // Define project requirements
  const requirements = {
    task: 'Create a simple todo list application',
    frontend: {
      description: 'Web interface to add, view, and delete todos',
      features: ['Add todo form', 'Todo list display', 'Delete functionality']
    },
    backend: {
      description: 'REST API to manage todos',
      features: ['CRUD operations', 'File-based storage', 'Simple validation']
    }
  };

  try {
    // Generate the complete project
    console.log('🚀 Generating project...');
    const result = await agent.develop(requirements);
    
    console.log('\n✅ Project generated successfully!');
    console.log(`Files created: ${result.filesGenerated}`);
    console.log(`Tests created: ${result.testsCreated}`);
    console.log(`Quality gates passed: ${result.qualityGatesPassed}`);
    console.log(`Duration: ${result.duration}ms`);
    
    // Get current status
    const status = agent.getStatus();
    console.log('\n📊 Final status:', status.qualityCheckResults);
    
  } catch (error) {
    console.error('❌ Project generation failed:', error.message);
  }
}

// Example: Fix specific issues in existing code
async function fixExistingCode() {
  const agent = new CodeAgent();
  
  await agent.initialize('./existing-project');
  
  const fixRequirements = {
    errors: [
      'ESLint: Unexpected console statement at line 15',
      'Jest: Test "should calculate total" is failing'
    ]
  };
  
  try {
    const result = await agent.fix(fixRequirements);
    console.log('✅ Fixes applied:', result);
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSimpleProject().catch(console.error);
}