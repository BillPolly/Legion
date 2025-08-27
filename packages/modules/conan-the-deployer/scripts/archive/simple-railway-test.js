#!/usr/bin/env node

import RailwayProvider from '../../../railway/src/providers/RailwayProvider.js';
import { ResourceManager } from '../../../module-loader/src/index.js';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize ResourceManager to get environment variables
const resourceManager = await ResourceManager.getResourceManager();

// Get API tokens from ResourceManager
const RAILWAY_API_TOKEN = resourceManager.env.RAILWAY_API_TOKEN;
const GITHUB_PAT = resourceManager.env.GITHUB_PAT;

if (!RAILWAY_API_TOKEN) {
  console.error('❌ RAILWAY_API_TOKEN not found in environment');
  process.exit(1);
}

if (!GITHUB_PAT) {
  console.error('❌ GITHUB_PAT not found in environment');
  process.exit(1);
}

// Test configuration
const TEST_CONFIG = {
  appName: `test-app-${Date.now()}`,
  repoName: `test-app-${Date.now()}`,
  githubOrg: 'AgentResults',
  workDir: path.join(__dirname, 'test-output')
};

async function createSimpleApp() {
  console.log('\n📝 Creating simple Express app...');
  
  // Create working directory
  await fs.mkdir(TEST_CONFIG.workDir, { recursive: true });
  
  // Create server.js
  const serverCode = `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Railway!');
});

app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    message: 'Railway deployment successful!'
  });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;

  await fs.writeFile(path.join(TEST_CONFIG.workDir, 'server.js'), serverCode);
  
  // Create package.json
  const packageJson = {
    name: TEST_CONFIG.appName,
    version: "1.0.0",
    description: "Simple Express server for Railway deployment test",
    main: "server.js",
    scripts: {
      start: "node server.js"
    },
    dependencies: {
      express: "^4.18.2"
    }
  };
  
  await fs.writeFile(
    path.join(TEST_CONFIG.workDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  console.log('✅ App created successfully');
}

async function testLocally() {
  console.log('\n🧪 Testing app locally...');
  
  // Install dependencies
  console.log('📦 Installing dependencies...');
  await exec('npm install', { cwd: TEST_CONFIG.workDir });
  
  // Start server
  console.log('🚀 Starting server...');
  const serverProcess = execCallback('npm start', { cwd: TEST_CONFIG.workDir });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Test endpoints
    const response = await fetch('http://localhost:3000');
    const text = await response.text();
    console.log(`✅ Homepage: ${text}`);
    
    const statusResponse = await fetch('http://localhost:3000/status');
    const status = await statusResponse.json();
    console.log('✅ Status:', status);
  } finally {
    // Kill server
    serverProcess.kill();
  }
}

async function createGitHubRepo() {
  console.log('\n🐙 Creating GitHub repository...');
  
  // Create under user account instead of org
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_PAT}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: TEST_CONFIG.repoName,
      description: 'Test repository for Railway deployment',
      private: false
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('GitHub API error:', errorText);
    throw new Error(`Failed to create repository: ${response.status} ${response.statusText}`);
  }
  
  const repo = await response.json();
  console.log(`✅ Repository created: ${repo.html_url}`);
  
  // Update the githubOrg to match the owner
  TEST_CONFIG.githubOrg = repo.owner.login;
  
  return repo;
}

async function pushToGitHub() {
  console.log('\n📤 Pushing to GitHub...');
  
  const commands = [
    'git init',
    'git add .',
    'git commit -m "Initial commit: Simple Express server for Railway"',
    'git branch -M main',
    `git remote add origin https://github.com/${TEST_CONFIG.githubOrg}/${TEST_CONFIG.repoName}.git`,
    'git push -u origin main'
  ];
  
  for (const cmd of commands) {
    console.log(`  Running: ${cmd}`);
    await exec(cmd, { cwd: TEST_CONFIG.workDir });
  }
  
  console.log('✅ Code pushed successfully');
  
  // Wait a bit for GitHub to process the push
  console.log('⏳ Waiting for GitHub to process...');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

async function deployToRailway(railwayProvider) {
  console.log('\n🚂 Deploying to Railway...');
  
  // First check if we have any existing projects we can use
  console.log('📋 Checking for existing projects...');
  const projectsResult = await railwayProvider.listProjects();
  
  let deployConfig = {
    name: TEST_CONFIG.appName,
    source: 'github',
    repo: `${TEST_CONFIG.githubOrg}/${TEST_CONFIG.repoName}`,
    branch: 'main',
    generateDomain: true
  };
  
  if (projectsResult.success && projectsResult.projects.length > 0) {
    console.log(`Found ${projectsResult.projects.length} existing project(s)`);
    // Use the first existing project
    deployConfig.projectId = projectsResult.projects[0].id;
    console.log(`Using existing project: ${projectsResult.projects[0].name} (${deployConfig.projectId})`);
  }
  
  console.log('🚀 Starting deployment...');
  const deployResult = await railwayProvider.deployWithDomain(deployConfig);
  
  if (!deployResult.success) {
    // If it's a resource limit error, provide helpful message
    if (deployResult.error?.includes('resource provision limit')) {
      console.error('\n⚠️  Railway free plan resource limit reached!');
      console.error('This usually means you have too many services or projects.');
      console.error('Please clean up unused Railway resources or upgrade your plan.');
      console.error('\nTo clean up, you can:');
      console.error('1. Log in to Railway dashboard and delete unused projects');
      console.error('2. Use the Railway CLI: railway logout && railway login');
      console.error('3. Upgrade to a paid plan for more resources');
    }
    throw new Error(`Deployment failed: ${deployResult.error}`);
  }
  
  console.log('✅ Deployment initiated');
  console.log(`   Project ID: ${deployResult.projectId}`);
  console.log(`   Service ID: ${deployResult.serviceId}`);
  console.log(`   Deployment ID: ${deployResult.id}`);
  
  // Wait for deployment to complete
  console.log('\n⏳ Waiting for deployment to complete...');
  let deploymentUrl = deployResult.url;
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts && !deploymentUrl) {
    attempts++;
    console.log(`   Checking status (${attempts}/${maxAttempts})...`);
    
    const status = await railwayProvider.getStatus(deployResult.id);
    console.log(`   Status: ${status.status}`);
    
    if (status.url) {
      deploymentUrl = status.url;
      break;
    }
    
    if (status.status === 'failed') {
      throw new Error('Deployment failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  if (!deploymentUrl) {
    throw new Error('Deployment timed out');
  }
  
  console.log(`✅ Deployment completed!`);
  console.log(`   URL: ${deploymentUrl}`);
  
  return deploymentUrl;
}

async function verifyDeployment(url) {
  console.log('\n✅ Verifying deployment...');
  
  // Wait for service to be ready with retries
  console.log('⏳ Waiting for service to be ready...');
  
  let attempts = 0;
  const maxAttempts = 12; // 2 minutes total
  let success = false;
  
  while (attempts < maxAttempts && !success) {
    attempts++;
    console.log(`   Attempt ${attempts}/${maxAttempts}...`);
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds between attempts
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        if (text.includes('Hello from Railway')) {
          success = true;
          console.log(`   ✅ Service is ready!`);
          console.log(`   Homepage response: ${text}`);
          
          // Test status endpoint
          const statusResponse = await fetch(`${url}/status`);
          const status = await statusResponse.json();
          console.log('   Status endpoint:', status);
        }
      }
    } catch (error) {
      // Service not ready yet
    }
  }
  
  if (!success) {
    console.log('   ⚠️  Service did not become ready in time');
    console.log('   The deployment may still be building...');
  }
  
  // Test with curl
  console.log('\n🔍 Testing with curl...');
  const { stdout: curlHome } = await exec(`curl -s ${url}`);
  console.log(`   curl /: ${curlHome}`);
  
  const { stdout: curlStatus } = await exec(`curl -s ${url}/status`);
  console.log(`   curl /status: ${curlStatus}`);
  
  console.log('\n🎉 Deployment verified successfully!');
}

async function main() {
  console.log('🚀 Railway Deployment Integration Test');
  console.log('='.repeat(50));
  
  try {
    // Initialize Railway provider
    const railwayProvider = new RailwayProvider(RAILWAY_API_TOKEN);
    
    // Create app
    await createSimpleApp();
    
    // Test locally
    await testLocally();
    
    // Create GitHub repo
    await createGitHubRepo();
    
    // Push to GitHub
    await pushToGitHub();
    
    // Deploy to Railway
    const deploymentUrl = await deployToRailway(railwayProvider);
    
    // Verify deployment
    await verifyDeployment(deploymentUrl);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed!');
    console.log(`🌐 Live app: ${deploymentUrl}`);
    console.log(`🐙 GitHub: https://github.com/${TEST_CONFIG.githubOrg}/${TEST_CONFIG.repoName}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);