#!/usr/bin/env node

/**
 * Test local deployment only
 */

import { CodeAgent } from '../src/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

async function main() {
  console.log('🚀 Testing local deployment...\n');
  
  // Create temp directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-test-'));
  console.log(`📁 Working directory: ${tempDir}\n`);
  
  try {
    // Generate code
    console.log('📝 Generating code...');
    
    const agent = new CodeAgent({
      projectType: 'backend',
      deployment: {
        enabled: true,
        provider: 'local'
      }
    });
    
    await agent.initialize(tempDir);
    
    const result = await agent.develop({
      projectName: 'Local Test App',
      description: 'Simple Express server',
      requirements: {
        backend: 'Express server with GET / returning "Hello World!" and GET /health'
      }
    });
    
    console.log(`✅ Generated ${result.filesGenerated} files\n`);
    
    // Deploy locally
    console.log('🏠 Deploying locally...');
    
    const deploy = await agent.deployApplication({
      provider: 'local',
      name: 'test-app',
      config: {
        port: 3456
      }
    });
    
    if (deploy.success) {
      console.log(`✅ Deployment running at ${deploy.url}`);
      console.log(`📍 Deployment ID: ${deploy.deploymentId}\n`);
      
      // Let it run for a moment
      console.log('⏳ Waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Stop deployment
      console.log('🛑 Stopping deployment...');
      await agent.deploymentPhase.stopDeployment(deploy.deploymentId);
      console.log('✅ Deployment stopped');
    } else {
      console.error('❌ Deployment failed:', deploy.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(console.error);