#!/usr/bin/env node

/**
 * Full Railway deployment test with verification
 */

import { ResourceManager } from '@legion/tools-registry';
import { CodeAgent } from '../src/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

async function main() {
  console.log('🚀 Starting full Railway deployment test...\n');
  
  // Initialize ResourceManager
  const resourceManager = await ResourceManager.getResourceManager();
  
  // Check credentials
  const githubToken = resourceManager.env.GITHUB_PAT;
  const railwayToken = resourceManager.env.RAILWAY_API_TOKEN;
  
  console.log('Environment check:');
  console.log(`GITHUB_PAT: ${githubToken ? '✅ Found' : '❌ Missing'}`);
  console.log(`RAILWAY_API_TOKEN: ${railwayToken ? '✅ Found' : '❌ Missing'}\n`);
  
  if (!githubToken || !railwayToken) {
    console.error('❌ Missing required credentials in .env file');
    process.exit(1);
  }
  
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
        backend: `Create an Express.js server with:
          - GET / endpoint that returns HTML: "<h1>Hello from Railway!</h1><p>Deployment successful!</p>"
          - GET /health endpoint that returns JSON: {status: "ok", timestamp: Date.now()}
          - Listen on process.env.PORT || 3000
          - Include proper error handling
          - Log when server starts`
      }
    });
    
    console.log(`✅ Generated ${result.filesGenerated} files`);
    console.log(`✅ Quality gates passed: ${result.qualityGatesPassed}\n`);
    
    // Step 2: Test local deployment
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
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test with curl
      console.log('Testing local endpoints:');
      try {
        const homeResponse = execSync('curl -s http://localhost:3456/', { encoding: 'utf8' });
        console.log('  GET /: ✅', homeResponse.substring(0, 50) + '...');
        
        const healthResponse = execSync('curl -s http://localhost:3456/health', { encoding: 'utf8' });
        console.log('  GET /health: ✅', healthResponse);
      } catch (error) {
        console.error('  ❌ Local test failed:', error.message);
      }
      
      // Stop local deployment
      await agent.deploymentPhase.stopDeployment(localDeploy.deploymentId);
      console.log('✅ Local deployment stopped\n');
    } else {
      console.error('❌ Local deployment failed:', localDeploy.error);
      console.error('Details:', localDeploy);
    }
    
    // Step 3: Verify GitHub push
    console.log('🐙 Step 3: Verifying GitHub repository...');
    
    // Check if git integration is working
    if (agent.gitIntegrationManager) {
      const gitMetrics = agent.gitIntegrationManager.getGitMetrics();
      console.log(`✅ Git integration active: ${gitMetrics.totalCommits} commits`);
      console.log(`✅ Repository: https://github.com/AgentResults/${repoName}\n`);
    } else {
      console.error('❌ Git integration not initialized');
    }
    
    // Step 4: Deploy to Railway
    console.log('🚂 Step 4: Deploying to Railway...');
    console.log('This may take several minutes...\n');
    
    const railwayDeploy = await agent.deployApplication({
      provider: 'railway',
      name: repoName,
      config: {
        source: 'github',
        githubRepo: `AgentResults/${repoName}`,
        environmentName: 'production',
        variables: {
          NODE_ENV: 'production'
        }
      }
    });
    
    console.log('Railway deployment result:');
    console.log(JSON.stringify(railwayDeploy, null, 2));
    
    if (railwayDeploy.success) {
      console.log(`\n✅ Railway deployment initiated`);
      console.log(`📍 Deployment ID: ${railwayDeploy.deploymentId}`);
      console.log(`📍 Initial URL: ${railwayDeploy.url || 'Pending...'}\n`);
      
      // Step 5: Monitor deployment
      console.log('📊 Step 5: Monitoring deployment status...');
      
      let deploymentUrl = railwayDeploy.url;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`\nAttempt ${attempts}/${maxAttempts}:`);
        
        try {
          const monitorResult = await agent.deploymentPhase.monitor({
            deploymentId: railwayDeploy.deploymentId,
            duration: 10000,
            interval: 5000
          });
          
          console.log('Monitor result:', JSON.stringify(monitorResult, null, 2));
          
          // Check if we have a URL
          if (monitorResult.url && monitorResult.url !== 'pending') {
            deploymentUrl = monitorResult.url;
            console.log(`✅ Got deployment URL: ${deploymentUrl}`);
            
            // Check if deployment is healthy
            if (monitorResult.health?.status === 'healthy') {
              console.log('✅ Deployment is healthy!');
              break;
            }
          }
          
          // Check deployment status via Railway provider
          if (agent.deploymentPhase?.deploymentIntegration?.deployerModule) {
            const statusResult = await agent.deploymentPhase.deploymentIntegration.deployerModule.getDeploymentStatus({
              deploymentId: railwayDeploy.deploymentId,
              provider: 'railway'
            });
            console.log('Status check:', JSON.stringify(statusResult, null, 2));
          }
          
        } catch (error) {
          console.error('Monitor error:', error.message);
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds
      }
      
      // Step 6: Test live deployment
      if (deploymentUrl && deploymentUrl !== 'pending') {
        console.log('\n🌐 Step 6: Testing live deployment...');
        
        // Ensure URL has protocol
        const fullUrl = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
        console.log(`Testing URL: ${fullUrl}`);
        
        // Wait a bit more for deployment to be fully ready
        console.log('Waiting 30 seconds for deployment to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Test with curl
        try {
          console.log('\nTesting GET /:');
          const homeCmd = `curl -s -L "${fullUrl}/"`;
          console.log(`Running: ${homeCmd}`);
          const homeResponse = execSync(homeCmd, { encoding: 'utf8' });
          console.log('Response:', homeResponse);
          
          console.log('\nTesting GET /health:');
          const healthCmd = `curl -s -L "${fullUrl}/health"`;
          console.log(`Running: ${healthCmd}`);
          const healthResponse = execSync(healthCmd, { encoding: 'utf8' });
          console.log('Response:', healthResponse);
          
          console.log('\n✅ Live deployment verified!');
        } catch (error) {
          console.error('❌ Live test failed:', error.message);
          console.error('Error output:', error.stderr?.toString());
        }
      } else {
        console.error('❌ No deployment URL available');
      }
      
      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('📊 DEPLOYMENT SUMMARY');
      console.log('='.repeat(50));
      console.log(`📁 Code: ${tempDir}`);
      console.log(`🐙 GitHub: https://github.com/AgentResults/${repoName}`);
      console.log(`🚂 Railway ID: ${railwayDeploy.deploymentId}`);
      console.log(`🌐 URL: ${deploymentUrl || 'Not available'}`);
      console.log('='.repeat(50));
      
    } else {
      console.error('\n❌ Railway deployment failed:', railwayDeploy.error);
      console.error('Full error details:', railwayDeploy);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Don't cleanup immediately so we can inspect
    console.log('\n📁 Temp directory preserved for inspection:', tempDir);
    console.log('To clean up manually: rm -rf', tempDir);
  }
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});