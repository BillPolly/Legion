#!/usr/bin/env node

/**
 * Railway Integration Test
 * 
 * End-to-end test that:
 * 1. Generates a simple Express server using CodeAgent
 * 2. Tests it locally using deployment tools
 * 3. Pushes to GitHub using GitIntegrationManager
 * 4. Deploys to Railway using conan-the-deployer
 * 5. Verifies the live deployment
 * 
 * State is tracked in a JSON file for resumability.
 */

import { CodeAgent } from '../../src/index.js';
import { ModuleLoader, ResourceManager } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple state helper to keep main flow clean
class TestState {
  constructor(stateFile) {
    this.stateFile = stateFile;
    this.state = this.load();
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
    } catch (e) {
      return { 
        testId: `railway-test-${Date.now()}`,
        startTime: new Date().toISOString(),
        phases: {} 
      };
    }
  }

  save() {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  isComplete(phase) {
    return this.state.phases[phase]?.status === 'completed';
  }

  setPhase(phase, data) {
    this.state.phases[phase] = { 
      status: 'completed', 
      timestamp: new Date().toISOString(),
      ...data 
    };
    this.save();
  }

  setPhaseError(phase, error) {
    this.state.phases[phase] = { 
      status: 'failed', 
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    this.save();
  }

  get(phase, key) {
    return this.state.phases[phase]?.[key];
  }

  getTestId() {
    return this.state.testId;
  }
}

// Helper to wait for a condition
async function waitFor(fn, timeout = 30000, interval = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (e) {
      // Keep trying
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
}

// Main test function
async function main() {
  // Initialize ResourceManager to get environment variables
  const resourceManager = await ResourceManager.getResourceManager();
  
  // Get tokens from ResourceManager
  const githubToken = resourceManager.env.GITHUB_PAT;
  const railwayToken = resourceManager.env.RAILWAY_API_TOKEN;
  
  if (!githubToken || !railwayToken) {
    console.error('❌ Missing required environment variables in .env file');
    console.error('Please ensure GITHUB_PAT and RAILWAY_API_TOKEN are set in the root .env file');
    process.exit(1);
  }

  // Initialize
  const WORK_DIR = path.join(__dirname, 'temp', `railway-test-${Date.now()}`);
  await fs.mkdir(WORK_DIR, { recursive: true });
  
  const STATE_FILE = path.join(WORK_DIR, 'test-state.json');
  const state = new TestState(STATE_FILE);
  
  console.log(`🚀 Railway Integration Test`);
  console.log(`📁 Working directory: ${WORK_DIR}`);
  console.log(`🏷️  Test ID: ${state.getTestId()}`);
  console.log(`📄 State file: ${STATE_FILE}\n`);

  let localProcess = null;

  try {
    // Phase 1: Generate Code
    if (!state.isComplete('generate')) {
      console.log('📝 Phase 1: Generating code...');
      
      try {
        const agent = new CodeAgent({
          projectType: 'backend',
          deployment: { enabled: true }
        });
        
        const projectDir = path.join(WORK_DIR, 'app');
        await fs.mkdir(projectDir, { recursive: true });
        
        await agent.initialize(projectDir);
        
        const result = await agent.develop({
          task: 'Create a simple Express server',
          requirements: {
            backend: `Create an Express.js server with:
              - GET / endpoint that returns HTML page with "<h1>Hello from Railway!</h1>"
              - GET /health endpoint that returns JSON {status: "ok", timestamp: new Date()}
              - Server listens on process.env.PORT || 3000
              - Includes proper package.json with start script`
          }
        });
        
        state.setPhase('generate', {
          filesCount: result.filesGenerated,
          projectDir: projectDir
        });
        
        console.log(`✅ Generated ${result.filesGenerated} files\n`);
      } catch (error) {
        state.setPhaseError('generate', error);
        throw error;
      }
    } else {
      console.log('✓ Phase 1: Code already generated\n');
    }

    // Phase 2: Test Locally
    if (!state.isComplete('localTest')) {
      console.log('🏠 Phase 2: Testing locally...');
      
      try {
        const projectDir = state.get('generate', 'projectDir');
        
        // Install dependencies
        console.log('  Installing dependencies...');
        execSync('npm install', { 
          cwd: projectDir,
          stdio: 'inherit'
        });
        
        // Start server in background
        console.log('  Starting server...');
        localProcess = spawn('npm', ['start'], {
          cwd: projectDir,
          detached: false,
          stdio: 'pipe',
          env: { ...process.env, PORT: '3456' }
        });
        
        // Capture output for debugging
        let serverOutput = '';
        localProcess.stdout.on('data', (data) => {
          serverOutput += data.toString();
        });
        localProcess.stderr.on('data', (data) => {
          serverOutput += data.toString();
        });
        
        // Wait for server to be ready
        console.log('  Waiting for server to start...');
        await waitFor(async () => {
          try {
            const res = await fetch('http://localhost:3456/health');
            return res.ok;
          } catch (e) {
            return false;
          }
        }, 10000);
        
        // Test endpoints
        console.log('  Testing endpoints...');
        
        const homeRes = await fetch('http://localhost:3456/');
        const homeText = await homeRes.text();
        
        const healthRes = await fetch('http://localhost:3456/health');
        const healthJson = await healthRes.json();
        
        // Verify responses
        if (!homeText.includes('Hello from Railway!')) {
          throw new Error(`Home page incorrect. Got: ${homeText.substring(0, 200)}`);
        }
        
        if (healthJson.status !== 'ok') {
          throw new Error(`Health check incorrect. Got: ${JSON.stringify(healthJson)}`);
        }
        
        // Kill server
        if (localProcess) {
          localProcess.kill();
          localProcess = null;
        }
        
        state.setPhase('localTest', {
          port: 3456,
          homeResponse: homeText.substring(0, 100),
          healthResponse: healthJson,
          serverOutput: serverOutput.substring(0, 500)
        });
        
        console.log('✅ Local tests passed\n');
      } catch (error) {
        if (localProcess) {
          localProcess.kill();
          localProcess = null;
        }
        state.setPhaseError('localTest', error);
        throw error;
      }
    } else {
      console.log('✓ Phase 2: Local test already completed\n');
    }

    // Phase 3: Push to GitHub
    if (!state.isComplete('github')) {
      console.log('🐙 Phase 3: Pushing to GitHub...');
      
      try {
        const projectDir = state.get('generate', 'projectDir');
        const repoName = state.getTestId();
        
        // Initialize git
        console.log('  Initializing git repository...');
        execSync('git init', { cwd: projectDir });
        execSync('git config user.name "Railway Test Bot"', { cwd: projectDir });
        execSync('git config user.email "test@railway.bot"', { cwd: projectDir });
        execSync('git add .', { cwd: projectDir });
        execSync('git commit -m "Initial commit"', { cwd: projectDir });
        
        // Create GitHub repo
        console.log('  Creating GitHub repository...');
        const githubRes = await fetch('https://api.github.com/orgs/AgentResults/repos', {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            name: repoName,
            description: 'Automated Railway deployment test',
            private: false,
            auto_init: false
          })
        });
        
        if (!githubRes.ok) {
          const error = await githubRes.text();
          throw new Error(`GitHub API error: ${githubRes.status} - ${error}`);
        }
        
        const repo = await githubRes.json();
        
        // Push code
        console.log('  Pushing code to GitHub...');
        execSync(`git remote add origin ${repo.clone_url}`, { cwd: projectDir });
        
        // Configure git to use token
        const cloneUrlWithToken = repo.clone_url.replace(
          'https://',
          `https://${githubToken}@`
        );
        execSync(`git remote set-url origin ${cloneUrlWithToken}`, { cwd: projectDir });
        
        execSync('git branch -M main', { cwd: projectDir });
        execSync('git push -u origin main', { cwd: projectDir });
        
        state.setPhase('github', {
          repoName: repoName,
          repoUrl: repo.html_url,
          cloneUrl: repo.clone_url
        });
        
        console.log(`✅ Pushed to GitHub: ${repo.html_url}\n`);
      } catch (error) {
        state.setPhaseError('github', error);
        throw error;
      }
    } else {
      console.log('✓ Phase 3: GitHub repository already created\n');
    }

    // Phase 4: Deploy to Railway
    if (!state.isComplete('railway')) {
      console.log('🚂 Phase 4: Deploying to Railway...');
      
      try {
        // Railway token is already available via resourceManager
        const loader = new ModuleLoader(resourceManager);
        await loader.initialize();
        
        // Load conan-the-deployer
        console.log('  Loading deployment module...');
        const conanResult = await loader.loadModule('@legion/conan-the-deployer');
        
        if (!conanResult.success) {
          throw new Error(`Failed to load conan-the-deployer: ${conanResult.error}`);
        }
        
        const conanModule = conanResult.module;
        
        // Deploy to Railway
        console.log('  Deploying to Railway...');
        const deployResult = await conanModule.deployApplication({
          projectPath: state.get('generate', 'projectDir'),
          provider: 'railway',
          name: state.get('github', 'repoName'),
          config: {
            source: 'github',
            githubRepo: `AgentResults/${state.get('github', 'repoName')}`,
            environmentName: 'production',
            variables: {
              NODE_ENV: 'production'
            }
          }
        });
        
        if (!deployResult.success) {
          throw new Error(`Railway deployment failed: ${deployResult.error}`);
        }
        
        console.log('  Waiting for deployment to be ready...');
        
        // Get deployment domain
        let deploymentUrl = deployResult.url;
        
        // If no URL yet, we need to wait for Railway to assign one
        if (!deploymentUrl || deploymentUrl === 'pending') {
          console.log('  Waiting for Railway to assign domain...');
          
          // Monitor deployment status
          for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            
            const statusResult = await conanModule.monitorDeployment({
              deploymentId: deployResult.id,
              provider: 'railway'
            });
            
            if (statusResult.url && statusResult.url !== 'pending') {
              deploymentUrl = statusResult.url;
              break;
            }
            
            console.log(`  Still waiting... (${i + 1}/30)`);
          }
        }
        
        if (!deploymentUrl || deploymentUrl === 'pending') {
          throw new Error('Timeout waiting for Railway deployment URL');
        }
        
        state.setPhase('railway', {
          deploymentId: deployResult.id,
          projectId: deployResult.projectId,
          serviceId: deployResult.serviceId,
          url: deploymentUrl
        });
        
        console.log(`✅ Deployed to Railway: ${deploymentUrl}\n`);
      } catch (error) {
        state.setPhaseError('railway', error);
        throw error;
      }
    } else {
      console.log('✓ Phase 4: Railway deployment already completed\n');
    }

    // Phase 5: Verify Live Site
    if (!state.isComplete('verify')) {
      console.log('🌐 Phase 5: Verifying live deployment...');
      
      try {
        const deployUrl = state.get('railway', 'url');
        
        if (!deployUrl) {
          throw new Error('No deployment URL found');
        }
        
        // Ensure URL has protocol
        const fullUrl = deployUrl.startsWith('http') ? deployUrl : `https://${deployUrl}`;
        
        console.log(`  Testing ${fullUrl}...`);
        
        // Wait for deployment to be fully ready
        console.log('  Waiting for deployment to respond...');
        await waitFor(async () => {
          try {
            const res = await fetch(`${fullUrl}/health`);
            return res.ok;
          } catch (e) {
            console.log(`  Not ready yet: ${e.message}`);
            return false;
          }
        }, 120000, 5000); // 2 minutes, check every 5 seconds
        
        // Test live endpoints
        console.log('  Testing live endpoints...');
        
        const liveHomeRes = await fetch(fullUrl);
        const liveHomeText = await liveHomeRes.text();
        
        const liveHealthRes = await fetch(`${fullUrl}/health`);
        const liveHealthJson = await liveHealthRes.json();
        
        // Verify responses
        if (!liveHomeText.includes('Hello from Railway!')) {
          throw new Error(`Live home page incorrect. Got: ${liveHomeText.substring(0, 200)}`);
        }
        
        if (liveHealthJson.status !== 'ok') {
          throw new Error(`Live health check incorrect. Got: ${JSON.stringify(liveHealthJson)}`);
        }
        
        state.setPhase('verify', {
          verified: true,
          liveUrl: fullUrl,
          homeResponse: liveHomeText.substring(0, 100),
          healthResponse: liveHealthJson
        });
        
        console.log('✅ Live site verified!\n');
      } catch (error) {
        state.setPhaseError('verify', error);
        throw error;
      }
    } else {
      console.log('✓ Phase 5: Live verification already completed\n');
    }

    // Success summary
    console.log('🎉 All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`  📁 Project: ${state.get('generate', 'projectDir')}`);
    console.log(`  🐙 GitHub: ${state.get('github', 'repoUrl')}`);
    console.log(`  🚂 Railway ID: ${state.get('railway', 'deploymentId')}`);
    console.log(`  🌐 Live URL: ${state.get('railway', 'url')}`);
    console.log(`\n💡 To re-run, simply execute this script again.`);
    console.log(`   Completed phases will be skipped.`);
    console.log(`   To restart, delete: ${STATE_FILE}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n📋 Stack trace:');
    console.error(error.stack);
    console.error('\n💡 You can re-run this script to continue from where it failed.');
    console.error(`   State is saved in: ${STATE_FILE}`);
    
    // Cleanup any running processes
    if (localProcess) {
      localProcess.kill();
    }
    
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});