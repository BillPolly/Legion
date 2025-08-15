#!/usr/bin/env node

/**
 * Debug script to isolate the exact API interface planning hang
 */

import { ResourceManager } from '@legion/tools-registry';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugAPIHang() {
  console.log('🔍 Debug API Interface Planning Hang\n');
  
  let agent;
  const generatedDir = path.join(__dirname, '../../../../generated');
  const projectDir = path.join(generatedDir, `api-debug-${Date.now()}`);
  
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
    
    // Simple requirements - minimal to reduce complexity
    const requirements = {
      projectName: 'APIDebug',
      description: 'Simple API debug test',
      requirements: {
        frontend: 'Simple HTML page',
        backend: 'Basic Express server with one API endpoint'
      }
    };
    
    console.log('📝 Starting API planning debug...\n');
    console.log('⏰ Current time:', new Date().toISOString());
    
    // Add timeout to catch hangs
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT: Planning took longer than 60 seconds')), 60000);
    });
    
    const planningPromise = agent.planProject(requirements);
    
    const projectPlan = await Promise.race([planningPromise, timeoutPromise]);
    
    console.log('✅ Planning completed at:', new Date().toISOString());
    
  } catch (error) {
    console.error('\n❌ Debug Error at:', new Date().toISOString());
    console.error('Error message:', error.message);
    
    if (error.message.includes('TIMEOUT')) {
      console.error('🚨 CONFIRMED: The process is hanging during planning phase');
    } else {
      console.error('Stack:', error.stack);
    }
  } finally {
    if (agent) {
      await agent.cleanup();
    }
  }
}

// Run it
debugAPIHang();