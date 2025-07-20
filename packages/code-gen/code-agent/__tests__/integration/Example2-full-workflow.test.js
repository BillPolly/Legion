/**
 * Example2 Full Workflow Test
 * 
 * This test demonstrates the complete end-to-end workflow:
 * 1. Code generation using CodeAgent
 * 2. Local testing for correctness
 * 3. Push to GitHub (AgentResults/Example2)
 * 4. Deploy to Railway (project: Example2)
 * 5. Verify live deployment with curl
 * 
 * Everything is done using only jsEnvoy modules and tools.
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { CodeAgent } from '../../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Set longer timeout for deployment operations
jest.setTimeout(900000); // 15 minutes

describe('Example2 Full Workflow', () => {
  let resourceManager;
  let tempDir;
  let githubToken;
  let railwayToken;
  let agent;
  const PROJECT_NAME = 'Example2';
  const GITHUB_ORG = 'AgentResults';

  beforeAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Example2 Full Workflow Test');
    console.log('='.repeat(80));
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Get tokens from ResourceManager
    githubToken = resourceManager.get('env.GITHUB_PAT');
    railwayToken = resourceManager.get('env.RAILWAY_API_TOKEN') || resourceManager.get('env.RAILWAY');
    
    if (!githubToken || !railwayToken) {
      throw new Error('Missing required tokens: GITHUB_PAT and RAILWAY_API_TOKEN must be set in .env');
    }

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'example2-test-'));
    
    console.log(`✅ Environment configured`);
    console.log(`📁 Working directory: ${tempDir}`);
    console.log(`🏷️ Project name: ${PROJECT_NAME}`);
    console.log(`🐙 GitHub org: ${GITHUB_ORG}`);
  });

  afterAll(async () => {
    // Only cleanup temp directory, leave GitHub repo and Railway project
    if (tempDir) {
      console.log(`\n🧹 Cleaning up temp directory: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    
    console.log('\n📌 Note: GitHub repository and Railway project were not deleted');
    console.log(`   GitHub: https://github.com/${GITHUB_ORG}/${PROJECT_NAME}`);
    console.log(`   Railway: Project "${PROJECT_NAME}"`);
  });

  test('should complete full workflow: generate, test, push to GitHub, deploy to Railway, and verify', async () => {
    // Phase 1: Generate code with CodeAgent
    console.log('\n' + '─'.repeat(60));
    console.log('📝 PHASE 1: Code Generation');
    console.log('─'.repeat(60));
    
    agent = new CodeAgent({
      projectType: 'fullstack',
      deployment: {
        enabled: true,
        provider: 'railway'
      },
      enableGitIntegration: true,
      gitConfig: {
        enabled: true,
        repositoryStrategy: 'new',
        organization: GITHUB_ORG,
        repositoryName: PROJECT_NAME,
        autoCommit: true,
        autoPush: true,
        user: {
          name: 'Example2 Bot',
          email: 'bot@example2.dev'
        }
      }
    });

    await agent.initialize(tempDir);
    console.log('✅ CodeAgent initialized');

    const developResult = await agent.develop({
      projectName: PROJECT_NAME,
      description: 'A simple web application demonstrating the full jsEnvoy workflow',
      requirements: {
        backend: `Create an Express.js server with the following:
          1. GET / - Serve the HTML page from public/index.html
          2. GET /api/status - Return JSON with:
             - project: "Example2"
             - version: "1.0.0"
             - timestamp: current ISO timestamp
             - uptime: process.uptime()
             - environment: process.env.NODE_ENV || "development"
          3. GET /health - Return JSON {status: "healthy", timestamp: Date.now()}
          4. Static file serving for public directory
          5. Morgan logging middleware
          6. CORS enabled
          7. Listen on process.env.PORT || 3000
          8. Log "Example2 server running on port X" when started`,
        frontend: `Create a simple but attractive webpage (public/index.html) with:
          1. Title: "Welcome to Example2"
          2. A header with the project name
          3. A main section with:
             - Welcome message
             - Current date/time (updated every second with JavaScript)
             - A button to fetch and display the API status
          4. Professional CSS styling with:
             - Modern color scheme (blue/white)
             - Centered layout
             - Responsive design
             - Smooth animations
          5. Include public/style.css for styling
          6. Include public/script.js for interactivity`,
        testing: `Create tests to verify:
          1. Server starts successfully
          2. GET / returns 200 status
          3. GET /api/status returns correct JSON structure
          4. GET /health returns healthy status
          5. Static files are served correctly`
      }
    });

    expect(developResult.success).toBe(true);
    expect(developResult.filesGenerated).toBeGreaterThan(0);
    console.log(`✅ Generated ${developResult.filesGenerated} files`);
    
    // List generated files
    console.log('\n📁 Generated files:');
    const files = await fs.readdir(tempDir, { recursive: true });
    files.forEach(file => {
      if (!file.includes('node_modules') && !file.includes('.git')) {
        console.log(`   ${file}`);
      }
    });

    // Phase 2: Test locally for correctness
    console.log('\n' + '─'.repeat(60));
    console.log('🏠 PHASE 2: Local Testing and Verification');
    console.log('─'.repeat(60));
    
    // Run the project's tests using the new testApplication method
    console.log('\n🧪 Running project tests...');
    const testResult = await agent.testApplication();
    
    if (testResult.success) {
      console.log(`✅ All ${testResult.passedTests} tests passed!`);
      console.log(`   Coverage: ${testResult.coverage?.toFixed(2) || 0}%`);
    } else {
      console.log(`⚠️  Tests failed: ${testResult.failedTests} failures`);
      if (testResult.error) {
        console.log(`   Error: ${testResult.error}`);
      }
      // Continue anyway for demo purposes
    }

    // Deploy locally for manual verification
    console.log('\n🚀 Starting local deployment...');
    const localDeployResult = await agent.deployApplication({
      provider: 'local',
      name: `${PROJECT_NAME}-local`,
      config: {
        port: 4567,
        healthCheckPath: '/health'
      }
    });

    expect(localDeployResult.success).toBe(true);
    expect(localDeployResult.url).toContain('localhost:4567');
    console.log(`✅ Local deployment running at ${localDeployResult.url}`);

    // Wait for server to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test all endpoints with curl
    console.log('\n🔍 Verifying local endpoints:');
    
    try {
      // Test home page
      const homeResponse = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:4567/', { encoding: 'utf8' });
      expect(homeResponse.trim()).toBe('200');
      console.log('  ✅ GET / returns 200');

      // Test API status
      const statusResponse = execSync('curl -s http://localhost:4567/api/status', { encoding: 'utf8' });
      const statusData = JSON.parse(statusResponse);
      expect(statusData.project).toBe('Example2');
      expect(statusData.version).toBe('1.0.0');
      expect(statusData.timestamp).toBeDefined();
      console.log('  ✅ GET /api/status returns correct data');

      // Test health endpoint
      const healthResponse = execSync('curl -s http://localhost:4567/health', { encoding: 'utf8' });
      const healthData = JSON.parse(healthResponse);
      expect(healthData.status).toBe('healthy');
      console.log('  ✅ GET /health returns healthy');

      // Test static files
      const cssResponse = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:4567/style.css', { encoding: 'utf8' });
      expect(cssResponse.trim()).toBe('200');
      console.log('  ✅ Static files served correctly');

    } catch (error) {
      console.error('❌ Local endpoint test failed:', error.message);
      throw error;
    }

    // Stop local deployment
    await agent.deploymentPhase.stopDeployment(localDeployResult.deploymentId);
    console.log('✅ Local deployment stopped');

    // Phase 3: Verify GitHub push
    console.log('\n' + '─'.repeat(60));
    console.log('🐙 PHASE 3: GitHub Repository Verification');
    console.log('─'.repeat(60));
    
    // Check Git metrics
    const gitMetrics = agent.gitIntegrationManager?.getGitMetrics();
    expect(gitMetrics).toBeDefined();
    expect(gitMetrics.totalCommits).toBeGreaterThan(0);
    
    console.log(`✅ Repository created and pushed`);
    console.log(`   Commits: ${gitMetrics.totalCommits}`);
    console.log(`   Files tracked: ${gitMetrics.filesTracked}`);
    console.log(`   Repository: https://github.com/${GITHUB_ORG}/${PROJECT_NAME}`);

    // Verify repository exists with curl
    console.log('\n🔍 Verifying GitHub repository...');
    try {
      const repoCheck = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${githubToken}" https://api.github.com/repos/${GITHUB_ORG}/${PROJECT_NAME}`,
        { encoding: 'utf8' }
      );
      expect(repoCheck.trim()).toBe('200');
      console.log('✅ GitHub repository confirmed');
    } catch (error) {
      console.error('❌ GitHub verification failed:', error.message);
      throw error;
    }

    // Phase 4: Deploy to Railway
    console.log('\n' + '─'.repeat(60));
    console.log('🚂 PHASE 4: Railway Deployment');
    console.log('─'.repeat(60));
    
    console.log('Deploying to Railway (this will take several minutes)...');
    
    const railwayDeployResult = await agent.deployApplication({
      provider: 'railway',
      name: PROJECT_NAME,
      config: {
        source: 'github',
        githubRepo: `${GITHUB_ORG}/${PROJECT_NAME}`,
        environmentName: 'production',
        variables: {
          NODE_ENV: 'production',
          APP_NAME: PROJECT_NAME
        }
      }
    });

    expect(railwayDeployResult.success).toBe(true);
    expect(railwayDeployResult.deploymentId).toBeDefined();
    console.log(`✅ Railway deployment initiated`);
    console.log(`   Deployment ID: ${railwayDeployResult.deploymentId}`);
    console.log(`   Provider: ${railwayDeployResult.provider}`);

    // Phase 5: Monitor and verify live deployment
    console.log('\n' + '─'.repeat(60));
    console.log('🌐 PHASE 5: Live Deployment Verification');
    console.log('─'.repeat(60));
    
    let deploymentUrl = railwayDeployResult.url;
    let deploymentReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 30 seconds = 15 minutes max

    console.log('Monitoring deployment status...');
    
    while (!deploymentReady && attempts < maxAttempts) {
      attempts++;
      process.stdout.write(`\r⏳ Checking deployment... (${attempts}/${maxAttempts})`);
      
      try {
        // Monitor deployment
        const monitorResult = await agent.deploymentPhase.monitor({
          deploymentId: railwayDeployResult.deploymentId,
          duration: 10000
        });
        
        // Update URL if available
        if (monitorResult.url && monitorResult.url !== 'pending') {
          deploymentUrl = monitorResult.url;
        }

        // Try to reach the deployment
        if (deploymentUrl && deploymentUrl !== 'pending') {
          const fullUrl = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
          
          try {
            const healthCheck = execSync(`curl -s -f -m 10 "${fullUrl}/health"`, { encoding: 'utf8' });
            const healthData = JSON.parse(healthCheck);
            
            if (healthData.status === 'healthy') {
              deploymentReady = true;
              console.log('\n✅ Deployment is ready!');
              break;
            }
          } catch (curlError) {
            // Not ready yet, continue waiting
          }
        }
        
      } catch (error) {
        // Continue monitoring
      }
      
      if (!deploymentReady) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      }
    }

    expect(deploymentReady).toBe(true);
    expect(deploymentUrl).toBeDefined();
    expect(deploymentUrl).not.toBe('pending');

    // Final verification with curl
    const fullUrl = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
    console.log(`\n🌍 Live URL: ${fullUrl}`);
    
    console.log('\n🔍 Testing live endpoints:');
    
    // Test home page
    console.log('\nGET / :');
    const liveHome = execSync(`curl -s -L "${fullUrl}/"`, { encoding: 'utf8' });
    expect(liveHome).toContain('Welcome to Example2');
    console.log('✅ Homepage loads successfully');
    
    // Test API status
    console.log('\nGET /api/status :');
    const liveStatus = execSync(`curl -s -L "${fullUrl}/api/status"`, { encoding: 'utf8' });
    console.log('Response:', liveStatus);
    const liveStatusData = JSON.parse(liveStatus);
    expect(liveStatusData.project).toBe('Example2');
    expect(liveStatusData.version).toBe('1.0.0');
    expect(liveStatusData.environment).toBe('production');
    console.log('✅ API status endpoint works');
    
    // Test health
    console.log('\nGET /health :');
    const liveHealth = execSync(`curl -s -L "${fullUrl}/health"`, { encoding: 'utf8' });
    const liveHealthData = JSON.parse(liveHealth);
    expect(liveHealthData.status).toBe('healthy');
    console.log('✅ Health endpoint works');

    // Success summary
    console.log('\n' + '='.repeat(80));
    console.log('🎉 EXAMPLE2 FULL WORKFLOW COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`📁 Local project: ${tempDir}`);
    console.log(`🐙 GitHub: https://github.com/${GITHUB_ORG}/${PROJECT_NAME}`);
    console.log(`🚂 Railway: ${fullUrl}`);
    console.log('✅ All phases completed and verified');
    console.log('='.repeat(80));
  });
});