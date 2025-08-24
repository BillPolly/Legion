#!/usr/bin/env node

/**
 * Demonstration of the Informal Planner
 * Shows how to use the planner to decompose complex goals
 */

import { InformalPlanner } from '../src/core/informal/index.js';
import { ResourceManager } from '@legion/module-loader';
import { ToolRegistry } from '@legion/tools-registry';

// Simple console LLM client for demonstration
class DemoLLMClient {
  constructor() {
    this.callCount = 0;
  }

  async complete(prompt) {
    this.callCount++;
    console.log(`\n[LLM Call #${this.callCount}]`);
    
    const promptLower = prompt.toLowerCase();
    
    // Classification
    if (promptLower.includes('classify') || promptLower.includes('complexity')) {
      if (promptLower.includes('build') && promptLower.includes('web')) {
        return JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Building a web application requires multiple components: frontend, backend, database, and deployment'
        });
      }
      
      if (promptLower.includes('create') && promptLower.includes('frontend')) {
        return JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Frontend development involves multiple subtasks'
        });
      }
      
      if (promptLower.includes('set') && promptLower.includes('html')) {
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Creating HTML structure is a focused task'
        });
      }
      
      if (promptLower.includes('implement') && promptLower.includes('css')) {
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Implementing styles is a focused task'
        });
      }
      
      if (promptLower.includes('add') && promptLower.includes('javascript')) {
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Adding interactivity is a focused task'
        });
      }
      
      if (promptLower.includes('create') && promptLower.includes('backend')) {
        return JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Backend API requires multiple components'
        });
      }
      
      if (promptLower.includes('initialize')) {
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Project initialization is a straightforward task'
        });
      }
      
      if (promptLower.includes('database') || promptLower.includes('models')) {
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Database setup is a focused task'
        });
      }
      
      if (promptLower.includes('api') && promptLower.includes('routes')) {
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Creating API routes is a focused task'
        });
      }
      
      if (promptLower.includes('deployment')) {
        return JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Deployment configuration is a focused task'
        });
      }
      
      return JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Task appears to be focused and achievable with tools'
      });
    }
    
    // Decomposition
    if (promptLower.includes('decompose') || promptLower.includes('break')) {
      if (promptLower.includes('web application')) {
        return JSON.stringify({
          task: 'Build web application',
          subtasks: [
            {
              id: 'web-1',
              description: 'Create frontend interface',
              suggestedInputs: ['design requirements'],
              suggestedOutputs: ['HTML/CSS/JS files', 'frontend build'],
              reasoning: 'User interface for the application'
            },
            {
              id: 'web-2',
              description: 'Create backend API',
              suggestedInputs: ['API requirements', 'data models'],
              suggestedOutputs: ['API server', 'endpoints'],
              reasoning: 'Server-side logic and data handling'
            },
            {
              id: 'web-3',
              description: 'Set up deployment',
              suggestedInputs: ['built application', 'deployment config'],
              suggestedOutputs: ['deployed application', 'public URL'],
              reasoning: 'Make application accessible'
            }
          ]
        });
      }
      
      if (promptLower.includes('frontend')) {
        return JSON.stringify({
          task: 'Create frontend',
          subtasks: [
            {
              id: 'fe-1',
              description: 'Set up HTML structure',
              suggestedInputs: ['design mockups'],
              suggestedOutputs: ['HTML templates'],
              reasoning: 'Create the document structure'
            },
            {
              id: 'fe-2',
              description: 'Implement CSS styles',
              suggestedInputs: ['HTML templates', 'design system'],
              suggestedOutputs: ['styled components'],
              reasoning: 'Apply visual design'
            },
            {
              id: 'fe-3',
              description: 'Add JavaScript interactivity',
              suggestedInputs: ['HTML/CSS', 'feature requirements'],
              suggestedOutputs: ['interactive frontend'],
              reasoning: 'Make the interface dynamic'
            }
          ]
        });
      }
      
      if (promptLower.includes('backend')) {
        return JSON.stringify({
          task: 'Create backend',
          subtasks: [
            {
              id: 'be-1',
              description: 'Initialize Node.js project',
              suggestedInputs: ['project requirements'],
              suggestedOutputs: ['package.json', 'project structure'],
              reasoning: 'Set up the project foundation'
            },
            {
              id: 'be-2',
              description: 'Set up database and models',
              suggestedInputs: ['data requirements'],
              suggestedOutputs: ['database schema', 'ORM models'],
              reasoning: 'Data persistence layer'
            },
            {
              id: 'be-3',
              description: 'Create API routes',
              suggestedInputs: ['models', 'API spec'],
              suggestedOutputs: ['REST endpoints', 'route handlers'],
              reasoning: 'HTTP interface for the application'
            }
          ]
        });
      }
      
      return JSON.stringify({
        task: 'Generic task',
        subtasks: [
          {
            id: 'gen-1',
            description: 'Prepare',
            suggestedInputs: [],
            suggestedOutputs: ['preparation complete'],
            reasoning: 'Initial setup'
          },
          {
            id: 'gen-2',
            description: 'Execute',
            suggestedInputs: ['preparation complete'],
            suggestedOutputs: ['results'],
            reasoning: 'Main execution'
          }
        ]
      });
    }
    
    return '{}';
  }
}

async function main() {
  console.log('=== Informal Planner Demonstration ===\n');
  
  try {
    // Initialize ResourceManager
    console.log('Initializing ResourceManager...');
    const resourceManager = await ResourceManager.getResourceManager();
    
    // Create ToolRegistry
    console.log('Creating ToolRegistry...');
    const toolRegistry = new ToolRegistry(resourceManager);
    
    // Create demo LLM client
    console.log('Creating demo LLM client...');
    const llmClient = new DemoLLMClient();
    
    // Create the planner
    console.log('Creating InformalPlanner...\n');
    const planner = new InformalPlanner(llmClient, toolRegistry, {
      maxDepth: 3,
      confidenceThreshold: 0.6,
      minSubtasks: 2
    });
    
    // Example 1: Simple task
    console.log('=' .repeat(60));
    console.log('Example 1: Simple Task');
    console.log('=' .repeat(60));
    
    const simpleResult = await planner.plan('Write configuration to a JSON file');
    
    console.log('\nResult:');
    console.log(`- Complexity: ${simpleResult.hierarchy.complexity}`);
    console.log(`- Tools found: ${simpleResult.hierarchy.tools?.length || 0}`);
    console.log(`- Feasible: ${simpleResult.hierarchy.feasible}`);
    console.log(`- Valid: ${simpleResult.validation.valid}`);
    
    // Example 2: Complex task
    console.log('\n' + '=' .repeat(60));
    console.log('Example 2: Complex Task');
    console.log('=' .repeat(60));
    
    const complexResult = await planner.plan('Build a web application with user authentication');
    
    console.log('\nResult:');
    console.log(`- Complexity: ${complexResult.hierarchy.complexity}`);
    console.log(`- Total tasks: ${complexResult.statistics.totalTasks}`);
    console.log(`- Simple tasks: ${complexResult.statistics.simpleTasks}`);
    console.log(`- Complex tasks: ${complexResult.statistics.complexTasks}`);
    console.log(`- Max depth: ${complexResult.statistics.maxDepth}`);
    console.log(`- Valid: ${complexResult.validation.valid}`);
    console.log(`- Feasible: ${complexResult.validation.feasibility.overallFeasible}`);
    
    // Generate and display report
    console.log('\n' + '=' .repeat(60));
    console.log('Full Report for Complex Task');
    console.log('=' .repeat(60));
    
    const report = planner.generateReport(complexResult);
    console.log(report);
    
    // Show statistics
    console.log('\n' + '=' .repeat(60));
    console.log('Planning Statistics');
    console.log('=' .repeat(60));
    console.log(`Total LLM calls: ${llmClient.callCount}`);
    console.log(`Processing time: ${complexResult.metadata.processingTime}ms`);
    console.log(`Unique tools discovered: ${complexResult.statistics.uniqueToolsCount}`);
    
    // Display the hierarchy as JSON
    console.log('\n' + '=' .repeat(60));
    console.log('Hierarchy Structure (JSON)');
    console.log('=' .repeat(60));
    console.log(JSON.stringify(complexResult.hierarchy, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);