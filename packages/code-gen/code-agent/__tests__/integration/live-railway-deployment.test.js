/**
 * Live Railway Deployment Test
 * 
 * This test performs a complete end-to-end deployment to Railway:
 * 1. Generates code using CodeAgent
 * 2. Tests locally
 * 3. Pushes to GitHub
 * 4. Deploys to Railway
 * 5. Verifies the live deployment with curl
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';
import { CodeAgent } from '../../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Set longer timeout for deployment operations
jest.setTimeout(600000); // 10 minutes

describe('Live Railway Deployment Test', () => {
  let resourceManager;
  let tempDir;
  let githubToken;
  let railwayToken;
  let repoName;
  let agent;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Get tokens from ResourceManager
    githubToken = resourceManager.env.GITHUB_PAT;
    railwayToken = resourceManager.env.RAILWAY_API_TOKEN;
    
    if (!githubToken || !railwayToken) {
      console.warn('⚠️ Skipping live deployment test - missing GITHUB_PAT or RAILWAY_API_TOKEN in .env');
      return;
    }

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'railway-deploy-test-'));
    repoName = `railway-test-${Date.now()}`;
    
    console.log(`✅ Live deployment testing enabled`);
    console.log(`📁 Working directory: ${tempDir}`);
    console.log(`🏷️ Repository name: ${repoName}`);
  });

  afterAll(async () => {
    // Cleanup temp directory
    if (tempDir) {
      console.log(`🧹 Cleaning up: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should generate, push to GitHub, deploy to Railway, and verify with curl', async () => {
    if (!githubToken || !railwayToken) {
      console.log('⏭️ Skipping test - no credentials');
      return;
    }

    // Phase 1: Generate code
    console.log('\n📝 Phase 1: Generating code with CodeAgent...');
    
    agent = new CodeAgent({
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
          name: 'Railway Test Bot',
          email: 'test@railway.bot'
        }
      }
    });

    await agent.initialize(tempDir);

    const developResult = await agent.develop({
      projectName: 'Railway Test Server',
      description: 'Simple Express server for Railway deployment test',
      requirements: {
        backend: `Create a simple Express.js server with:
          - GET / endpoint that returns HTML with "<h1>Hello from Railway!</h1><p>Deployment successful at " + new Date() + "</p>"
          - GET /health endpoint that returns JSON {status: "ok", timestamp: Date.now(), uptime: process.uptime()}
          - GET /api/info endpoint that returns JSON {name: "Railway Test", version: "1.0.0", node: process.version}
          - Proper error handling middleware
          - Morgan logging middleware
          - Server listens on process.env.PORT || 3000
          - Log "Server running on port X" when started`
      }
    });

    expect(developResult.success).toBe(true);
    expect(developResult.filesGenerated).toBeGreaterThan(0);
    console.log(`✅ Generated ${developResult.filesGenerated} files`);

    // Phase 2: Test locally
    console.log('\n🏠 Phase 2: Testing local deployment...');
    
    const localDeployResult = await agent.deployApplication({
      provider: 'local',
      name: `${repoName}-local`,
      config: {
        port: 3456,
        healthCheckPath: '/health'
      }
    });

    expect(localDeployResult.success).toBe(true);
    expect(localDeployResult.url).toContain('localhost:3456');
    console.log(`✅ Local deployment running at ${localDeployResult.url}`);

    // Wait for server to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test local endpoints with curl
    console.log('Testing local endpoints:');
    try {
      const localHome = execSync('curl -s http://localhost:3456/', { encoding: 'utf8' });
      expect(localHome).toContain('Hello from Railway!');
      console.log('  ✅ GET / works');

      const localHealth = execSync('curl -s http://localhost:3456/health', { encoding: 'utf8' });
      const healthData = JSON.parse(localHealth);
      expect(healthData.status).toBe('ok');
      console.log('  ✅ GET /health works');

      const localInfo = execSync('curl -s http://localhost:3456/api/info', { encoding: 'utf8' });
      const infoData = JSON.parse(localInfo);
      expect(infoData.name).toBe('Railway Test');
      console.log('  ✅ GET /api/info works');
    } catch (error) {
      console.error('Local test error:', error.message);
      throw error;
    }

    // Stop local deployment
    if (agent.deploymentPhase) {
      await agent.deploymentPhase.stopDeployment(localDeployResult.deploymentId);
      console.log('✅ Local deployment stopped');
    }

    // Phase 3: Verify GitHub push
    console.log('\n🐙 Phase 3: Verifying GitHub repository...');
    
    // The code should already be pushed due to autoPush: true
    const gitMetrics = agent.gitIntegrationManager?.getGitMetrics();
    expect(gitMetrics).toBeDefined();
    expect(gitMetrics.totalCommits).toBeGreaterThan(0);
    console.log(`✅ Code pushed to GitHub: ${gitMetrics.totalCommits} commits`);
    console.log(`📍 Repository: https://github.com/AgentResults/${repoName}`);

    // Phase 4: Deploy to Railway
    console.log('\n🚂 Phase 4: Deploying to Railway...');
    console.log('This will take several minutes...');
    
    const railwayDeployResult = await agent.deployApplication({
      provider: 'railway',
      name: repoName,
      config: {
        source: 'github',
        githubRepo: `AgentResults/${repoName}`,
        environmentName: 'production',
        variables: {
          NODE_ENV: 'production',
          APP_NAME: 'Railway Test Server'
        }
      }
    });

    console.log('\nRailway deployment result:');
    console.log(JSON.stringify(railwayDeployResult, null, 2));

    expect(railwayDeployResult.success).toBe(true);
    expect(railwayDeployResult.deploymentId).toBeDefined();
    console.log(`✅ Railway deployment initiated: ${railwayDeployResult.deploymentId}`);

    // Phase 5: Monitor and wait for deployment
    console.log('\n📊 Phase 5: Monitoring Railway deployment...');
    
    let deploymentUrl = railwayDeployResult.url;
    let deploymentReady = false;
    let attempts = 0;
    const maxAttempts = 40; // 40 * 30 seconds = 20 minutes max

    while (!deploymentReady && attempts < maxAttempts) {
      attempts++;
      console.log(`\n⏳ Check ${attempts}/${maxAttempts}:`);
      
      try {
        // Monitor deployment
        const monitorResult = await agent.deploymentPhase.monitor({
          deploymentId: railwayDeployResult.deploymentId,
          duration: 10000,
          interval: 5000
        });
        
        console.log('Monitor status:', monitorResult.health?.status || 'unknown');
        
        // Update URL if available
        if (monitorResult.url && monitorResult.url !== 'pending') {
          deploymentUrl = monitorResult.url;
          console.log(`📍 Deployment URL: ${deploymentUrl}`);
        }

        // Check if we can reach the deployment
        if (deploymentUrl && deploymentUrl !== 'pending') {
          const fullUrl = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
          
          try {
            console.log(`Testing ${fullUrl}/health ...`);
            const healthCheck = execSync(`curl -s -f -m 10 "${fullUrl}/health"`, { encoding: 'utf8' });
            const healthData = JSON.parse(healthCheck);
            
            if (healthData.status === 'ok') {
              deploymentReady = true;
              console.log('✅ Deployment is ready!');
              break;
            }
          } catch (curlError) {
            console.log('Not ready yet:', curlError.message);
          }
        }
        
      } catch (error) {
        console.log('Monitor error:', error.message);
      }
      
      if (!deploymentReady) {
        console.log('Waiting 30 seconds before next check...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    expect(deploymentReady).toBe(true);
    expect(deploymentUrl).toBeDefined();
    expect(deploymentUrl).not.toBe('pending');

    // Phase 6: Verify live deployment with curl
    console.log('\n🌐 Phase 6: Verifying live deployment with curl...');
    
    const fullUrl = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
    console.log(`Live URL: ${fullUrl}`);

    // Test all endpoints
    console.log('\nTesting GET / :');
    const liveHome = execSync(`curl -s -L "${fullUrl}/"`, { encoding: 'utf8' });
    console.log('Response:', liveHome.substring(0, 200));
    expect(liveHome).toContain('Hello from Railway!');
    expect(liveHome).toContain('Deployment successful');

    console.log('\nTesting GET /health :');
    const liveHealth = execSync(`curl -s -L "${fullUrl}/health"`, { encoding: 'utf8' });
    console.log('Response:', liveHealth);
    const liveHealthData = JSON.parse(liveHealth);
    expect(liveHealthData.status).toBe('ok');
    expect(liveHealthData.timestamp).toBeDefined();
    expect(liveHealthData.uptime).toBeDefined();

    console.log('\nTesting GET /api/info :');
    const liveInfo = execSync(`curl -s -L "${fullUrl}/api/info"`, { encoding: 'utf8' });
    console.log('Response:', liveInfo);
    const liveInfoData = JSON.parse(liveInfo);
    expect(liveInfoData.name).toBe('Railway Test');
    expect(liveInfoData.version).toBe('1.0.0');
    expect(liveInfoData.node).toBeDefined();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DEPLOYMENT TEST SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log(`📁 Project: ${tempDir}`);
    console.log(`🐙 GitHub: https://github.com/AgentResults/${repoName}`);
    console.log(`🚂 Railway: ${fullUrl}`);
    console.log(`✅ All endpoints verified with curl`);
    console.log('='.repeat(60));
  });
});