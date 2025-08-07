#!/usr/bin/env node

/**
 * Simple Railway deployment test using only existing tools
 */

import { ResourceManager } from '@legion/tools';
import { CodeAgent } from '../src/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

async function main() {
  console.log('🚀 Starting Railway deployment test...\n');
  
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Check credentials
  const githubToken = resourceManager.env.GITHUB_PAT;
  const railwayToken = resourceManager.env.RAILWAY_API_TOKEN;
  
  if (!githubToken || !railwayToken) {
    console.error('❌ Missing GITHUB_PAT or RAILWAY_API_TOKEN in .env file');
    process.exit(1);
  }
  
  console.log('✅ Credentials loaded from .env\n');
  
  // Create temp directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'railway-test-'));
  const repoName = `railway-test-${Date.now()}`;
  
  console.log(`📁 Working directory: ${tempDir}`);
  console.log(`🏷️  Repository name: ${repoName}\n`);
  
  try {
    // Step 1: Generate code
    console.log('📝 Step 1: Generating code...');
    
    const agent = new CodeAgent({
      projectType: 'backend',
      deployment: {
        enabled: true,
        provider: 'railway'
      },
      enableGitIntegration: true,
      gitConfig: {
        enabled: true,
        repositoryStrategy: 'new',
        organization: 'AgentResults',
        repositoryName: repoName,
        autoCommit: true,
        autoPush: true,
        user: {
          name: 'Railway Test',
          email: 'test@railway.app'
        }
      }
    });
    
    await agent.initialize(tempDir);
    
    const result = await agent.develop({
      projectName: 'Railway Test App',
      description: 'Simple Express server for Railway deployment',
      requirements: {
        backend: 'Express server with GET / returning "Hello from Railway!" and GET /health returning {status: "ok"}'
      }
    });
    
    console.log(`✅ Generated ${result.filesGenerated} files\n`);
    
    // Step 2: Deploy locally first
    console.log('🏠 Step 2: Testing local deployment...');
    
    const localDeploy = await agent.deployApplication({
      provider: 'local',
      name: 'test-local',
      config: {
        port: 3456
      }
    });
    
    if (localDeploy.success) {
      console.log(`✅ Local deployment running at ${localDeploy.url}`);
      
      // Stop local deployment
      await agent.deploymentPhase.stopDeployment(localDeploy.deploymentId);
      console.log('✅ Local deployment stopped\n');
    } else {
      console.error('❌ Local deployment failed:', localDeploy.error);
    }
    
    // Step 3: Deploy to Railway
    console.log('🚂 Step 3: Deploying to Railway...');
    
    const railwayDeploy = await agent.deployApplication({
      provider: 'railway',
      name: repoName,
      config: {
        source: 'github',
        githubRepo: `AgentResults/${repoName}`,
        environmentName: 'production'
      }
    });
    
    if (railwayDeploy.success) {
      console.log(`✅ Railway deployment initiated: ${railwayDeploy.deploymentId}`);
      console.log(`📍 URL: ${railwayDeploy.url || 'Pending...'}\n`);
      
      // Summary
      console.log('🎉 Deployment test completed!');
      console.log(`📁 Code: ${tempDir}`);
      console.log(`🐙 GitHub: https://github.com/AgentResults/${repoName}`);
      console.log(`🚂 Railway: ${railwayDeploy.url || 'Check Railway dashboard'}`);
    } else {
      console.error('❌ Railway deployment failed:', railwayDeploy.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up temp directory...');
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// Run the test
main().catch(console.error);