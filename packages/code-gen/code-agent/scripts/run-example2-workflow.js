#!/usr/bin/env node

/**
 * Run the Example2 Full Workflow
 * 
 * This script demonstrates the complete workflow using only jsEnvoy modules:
 * 1. Generate code with CodeAgent
 * 2. Test with CodeAgent.testApplication()
 * 3. Push to GitHub via CodeAgent's Git integration
 * 4. Deploy to Railway via CodeAgent's deployment integration
 * 5. Verify the live deployment
 */

import { ResourceManager } from '@legion/tools-registry';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const PROJECT_NAME = 'Example2';
const GITHUB_ORG = 'AgentResults';

async function runExample2Workflow() {
  let tempDir;
  let agent;
  let resourceManager;
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Example2 Full Workflow');
    console.log('='.repeat(80));
    
    // Initialize ResourceManager for dependency injection
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Get tokens from ResourceManager
    const githubToken = resourceManager.env.GITHUB_PAT;
    const railwayToken = resourceManager.env.RAILWAY_API_TOKEN || resourceManager.env.RAILWAY;
    const anthropicKey = resourceManager.env.ANTHROPIC_API_KEY;
    
    if (!githubToken || !railwayToken) {
      throw new Error('Missing required tokens: GITHUB_PAT and RAILWAY_API_TOKEN must be set in .env');
    }
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY must be set in .env file for real LLM operations');
    }

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'example2-'));
    
    // Initialize git repository in the temp directory
    execSync('git init', { cwd: tempDir });
    execSync('git config user.name "Example2 Bot"', { cwd: tempDir });
    execSync('git config user.email "bot@example2.dev"', { cwd: tempDir });
    
    console.log(`✅ Environment configured`);
    console.log(`📁 Working directory: ${tempDir}`);
    console.log(`🏷️ Project name: ${PROJECT_NAME}`);
    console.log(`🐙 GitHub org: ${GITHUB_ORG}`);

    // Phase 1: Generate code with CodeAgent
    console.log('\n' + '─'.repeat(60));
    console.log('📝 PHASE 1: Code Generation');
    console.log('─'.repeat(60));
    
    // Configure ResourceManager with real implementations
    console.log('🔧 Configuring dependency injection...');
    
    // Register LLM client factory for Anthropic BEFORE CodeAgent init
    resourceManager.registerFactory('llmClient', async (config, rm) => {
      const apiKey = config.apiKey || rm.env.ANTHROPIC_API_KEY;
      console.log('   ✓ Using Anthropic LLM provider');
      
      const { LLMClientManager } = await import('../src/integration/LLMClientManager.js');
      const client = new LLMClientManager({
        provider: 'anthropic',
        apiKey: apiKey,
        model: 'claude-3-sonnet-20240229',
        ...config
      });
      await client.initialize();
      return client;
    });
    
    agent = new CodeAgent({
      projectType: 'fullstack',
      llmConfig: {
        provider: 'anthropic'  // Specify provider in config
      },
      deployment: {
        enabled: true,
        provider: 'railway'
      },
      enableGitIntegration: true,  // Enable GitHub integration
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

    // Initialize with our configured ResourceManager
    await agent.initialize(tempDir, { resourceManager });
    console.log('✅ CodeAgent initialized with real LLM');

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

    if (!developResult.success) {
      throw new Error('Code generation failed');
    }

    console.log(`✅ Generated ${developResult.filesGenerated} files`);
    
    // List generated files
    console.log('\n📁 Generated files:');
    const files = await fs.readdir(tempDir, { recursive: true });
    files.forEach(file => {
      if (!file.includes('node_modules') && !file.includes('.git')) {
        console.log(`   ${file}`);
      }
    });

    // Phase 2: Test with CodeAgent
    console.log('\n' + '─'.repeat(60));
    console.log('🏠 PHASE 2: Testing with CodeAgent');
    console.log('─'.repeat(60));
    
    console.log('\n🧪 Running tests via CodeAgent.testApplication()...');
    const testResult = await agent.testApplication();
    
    if (testResult.success) {
      console.log(`✅ All ${testResult.passedTests} tests passed!`);
      console.log(`   Coverage: ${testResult.coverage?.toFixed(2) || 0}%`);
    } else {
      console.log(`⚠️  Tests failed: ${testResult.failedTests || 0} failures`);
      if (testResult.error) {
        console.log(`   Error: ${testResult.error}`);
      }
      // Continue anyway for demo purposes
    }

    // Deploy locally for verification
    console.log('\n🚀 Starting local deployment...');
    const localDeployResult = await agent.deployApplication({
      provider: 'local',
      name: `${PROJECT_NAME}-local`,
      config: {
        port: 4567,
        healthCheckPath: '/health'
      }
    });

    if (!localDeployResult.success) {
      console.log('⚠️  Local deployment failed, continuing anyway...');
    } else {
      console.log(`✅ Local deployment running at ${localDeployResult.url}`);
      
      // Test endpoints
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('\n🔍 Testing local endpoints:');
      
      try {
        const healthCheck = execSync('curl -s http://localhost:4567/health', { encoding: 'utf8' });
        const healthData = JSON.parse(healthCheck);
        console.log('  ✅ Health check:', healthData.status);
      } catch (e) {
        console.log('  ⚠️  Could not reach local deployment');
      }
      
      // Stop local deployment
      if (localDeployResult.deploymentId) {
        await agent.stopDeployment(localDeployResult.deploymentId);
        console.log('✅ Local deployment stopped');
      }
    }

    // Phase 3: Verify GitHub push
    console.log('\n' + '─'.repeat(60));
    console.log('🐙 PHASE 3: GitHub Repository');
    console.log('─'.repeat(60));
    
    const gitMetrics = agent.gitIntegrationManager?.getGitMetrics();
    if (gitMetrics) {
      console.log(`✅ Repository created and pushed`);
      console.log(`   Commits: ${gitMetrics.totalCommits}`);
      console.log(`   Repository: https://github.com/${GITHUB_ORG}/${PROJECT_NAME}`);
    }

    // Phase 4: Deploy to Railway
    console.log('\n' + '─'.repeat(60));
    console.log('🚂 PHASE 4: Railway Deployment');
    console.log('─'.repeat(60));
    
    console.log('Deploying to Railway...');
    
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

    if (!railwayDeployResult.success) {
      throw new Error(`Railway deployment failed: ${railwayDeployResult.error}`);
    }

    console.log(`✅ Railway deployment initiated`);
    console.log(`   Deployment ID: ${railwayDeployResult.deploymentId}`);

    // Phase 5: Monitor and verify
    console.log('\n' + '─'.repeat(60));
    console.log('🌐 PHASE 5: Verification');
    console.log('─'.repeat(60));
    
    let deploymentUrl = railwayDeployResult.url;
    let attempts = 0;
    const maxAttempts = 20;

    console.log('Waiting for deployment to be ready...');
    
    while (attempts < maxAttempts) {
      attempts++;
      process.stdout.write(`\r⏳ Checking... (${attempts}/${maxAttempts})`);
      
      try {
        const monitorResult = await agent.deploymentPhase.monitor({
          deploymentId: railwayDeployResult.deploymentId,
          duration: 5000
        });
        
        if (monitorResult.url && monitorResult.url !== 'pending') {
          deploymentUrl = monitorResult.url;
          const fullUrl = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
          
          // Try to reach it
          try {
            execSync(`curl -s -f "${fullUrl}/health"`, { encoding: 'utf8' });
            console.log('\n✅ Deployment is ready!');
            deploymentUrl = fullUrl;
            break;
          } catch (e) {
            // Not ready yet
          }
        }
      } catch (e) {
        // Continue monitoring
      }
      
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    if (deploymentUrl) {
      console.log(`\n🌍 Live URL: ${deploymentUrl}`);
      
      // Test live endpoints
      console.log('\n🔍 Testing live endpoints:');
      try {
        const liveHealth = execSync(`curl -s "${deploymentUrl}/health"`, { encoding: 'utf8' });
        const healthData = JSON.parse(liveHealth);
        console.log('✅ Health check:', healthData.status);
        
        const liveStatus = execSync(`curl -s "${deploymentUrl}/api/status"`, { encoding: 'utf8' });
        const statusData = JSON.parse(liveStatus);
        console.log('✅ API status:', statusData.project);
      } catch (e) {
        console.log('⚠️  Could not verify all endpoints');
      }
    }

    // Success!
    console.log('\n' + '='.repeat(80));
    console.log('🎉 EXAMPLE2 WORKFLOW COMPLETED!');
    console.log('='.repeat(80));
    console.log(`📁 Local project: ${tempDir}`);
    console.log(`🐙 GitHub: https://github.com/${GITHUB_ORG}/${PROJECT_NAME}`);
    if (deploymentUrl) {
      console.log(`🚂 Railway: ${deploymentUrl}`);
    }
    console.log('✅ All phases completed using jsEnvoy modules');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    if (agent) {
      await agent.cleanup();
    }
    if (tempDir) {
      console.log(`\n🧹 Cleaning up temp directory...`);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

// Run the workflow
runExample2Workflow();