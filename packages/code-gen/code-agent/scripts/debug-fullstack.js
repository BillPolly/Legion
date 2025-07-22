#!/usr/bin/env node

/**
 * Debug script to test fullstack generation with more focused debugging
 */

import { ResourceManager } from '@legion/module-loader';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugFullstack() {
  console.log('🔍 Debug Fullstack Generation\n');
  
  let agent;
  const generatedDir = path.join(__dirname, '../../../../generated');
  const projectDir = path.join(generatedDir, `fullstack-debug-${Date.now()}`);
  
  try {
    // Create generated directory if it doesn't exist
    await fs.mkdir(generatedDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    
    console.log(`📁 Debug directory: ${projectDir}`);
    
    // Setup ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Configure CodeAgent for a fullstack project
    agent = new CodeAgent({
      projectType: 'fullstack',
      llmConfig: {
        provider: 'anthropic'
      },
      deployment: {
        enabled: false
      },
      enableGitIntegration: false
    });
    
    await agent.initialize(projectDir, { resourceManager });
    console.log('✅ CodeAgent initialized\n');
    
    // Simple fullstack requirements
    const requirements = {
      projectName: 'SimpleFullstack',
      description: 'A simple fullstack app with React and Express',
      requirements: {
        frontend: `Create a basic React frontend with:
        1. A simple home page
        2. A button to call the backend API`,
        backend: `Create a basic Express backend with:
        1. GET /api/status - returns {"status": "ok"}
        2. Basic CORS setup`
      }
    };
    
    console.log('📝 Starting fullstack planning...\n');
    
    // Only do planning to see where the error occurs
    const projectPlan = await agent.planProject(requirements);
    
    console.log('✅ Planning completed successfully!');
    console.log('Frontend architecture exists:', !!projectPlan.frontendArchitecture);
    console.log('Backend architecture exists:', !!projectPlan.backendArchitecture);
    
  } catch (error) {
    console.error('\n❌ Debug Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (agent) {
      await agent.cleanup();
    }
  }
}

// Run it
debugFullstack();