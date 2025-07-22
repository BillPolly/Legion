#!/usr/bin/env node

/**
 * Debug script to test backend generation specifically
 */

import { ResourceManager } from '@legion/module-loader';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugBackend() {
  console.log('🔍 Debug Backend Generation\n');
  
  let agent;
  const generatedDir = path.join(__dirname, '../../../../generated');
  const projectDir = path.join(generatedDir, `backend-debug-${Date.now()}`);
  
  try {
    // Create generated directory if it doesn't exist
    await fs.mkdir(generatedDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    
    console.log(`📁 Debug directory: ${projectDir}`);
    
    // Setup ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Configure CodeAgent for a backend-only project
    agent = new CodeAgent({
      projectType: 'backend',
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
    
    // Very simple backend requirements
    const requirements = {
      projectName: 'SimpleBackend',
      description: 'A simple Express backend with basic API endpoints',
      requirements: {
        backend: `Create a basic Express.js server with:
        1. GET /api/status - returns {"status": "ok"}
        2. GET /api/health - returns health check
        3. Basic error handling and CORS`
      }
    };
    
    console.log('📝 Starting backend planning...\n');
    
    // Only do planning to see if the error occurs there
    const projectPlan = await agent.planProject(requirements);
    
    console.log('✅ Planning completed successfully!');
    console.log('Backend architecture:', JSON.stringify(projectPlan.backendArchitecture, null, 2));
    
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
debugBackend();