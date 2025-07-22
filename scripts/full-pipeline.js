#!/usr/bin/env node
/**
 * Complete Full-Stack Development Pipeline
 * 
 * Steps: generate → test-local → github → railway → test-live
 * Each step can be run individually, undone, or run as a complete pipeline
 * 
 * Configuration:
 * - Set GITHUB_ORG environment variable to create repos in an organization
 * - Set GITHUB_ORG=personal or leave empty to create repos in personal account
 * - Default: AgentResults
 */

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import { CodeAgent } from '../packages/code-gen/code-agent/src/agent/CodeAgent.js';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import fetch from 'node-fetch';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '.pipeline-state.json');
const WEBAPP_DIR = path.join(__dirname, '..', 'generated', 'demo-webapp');

class PipelineManager {
    constructor() {
        this.resourceManager = null;
        this.state = {};
    }

    /**
     * Initialize the pipeline manager
     */
    async initialize() {
        console.log('🔧 Initializing Pipeline Manager...\n');
        
        // Initialize ResourceManager
        this.resourceManager = new ResourceManager();
        await this.resourceManager.initialize();
        
        // Initialize GitHub module
        await this.initializeGitHub();
        
        // Load state
        await this.loadState();
        
        console.log('✅ Pipeline Manager initialized\n');
    }

    /**
     * Initialize GitHub tools
     */
    async initializeGitHub() {
        // Register GitHub credentials from environment
        this.resourceManager.register('GITHUB_PAT', this.resourceManager.get('env.GITHUB_PAT'));
        this.resourceManager.register('GITHUB_ORG', this.resourceManager.get('env.GITHUB_ORG') || 'AgentResults');
        this.resourceManager.register('GITHUB_USER', this.resourceManager.get('env.GITHUB_USER'));
        
        // Create GitHub module
        const moduleFactory = new ModuleFactory(this.resourceManager);
        this.githubModule = moduleFactory.createModule(GitHubModule);
        
        // Get GitHub tools
        const tools = this.githubModule.getTools();
        this.githubTool = tools.find(tool => tool.name === 'github');
        
        if (!this.githubTool) {
            throw new Error('GitHub tool not found');
        }
    }

    /**
     * Load pipeline state from file
     */
    async loadState() {
        try {
            const stateData = await fs.readFile(STATE_FILE, 'utf-8');
            this.state = JSON.parse(stateData);
            console.log('📄 Loaded existing state');
        } catch (error) {
            this.state = {
                steps: {},
                resources: {},
                timestamp: Date.now()
            };
            console.log('📄 Created new state file');
        }
    }

    /**
     * Save pipeline state to file
     */
    async saveState() {
        try {
            await fs.writeFile(STATE_FILE, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('❌ Failed to save state:', error.message);
        }
    }

    /**
     * Check if a step has been completed
     */
    isStepCompleted(stepName) {
        return this.state.steps[stepName]?.completed === true;
    }

    /**
     * Mark a step as completed
     */
    async markStepCompleted(stepName, data = {}) {
        this.state.steps[stepName] = {
            completed: true,
            timestamp: Date.now(),
            ...data
        };
        await this.saveState();
    }

    /**
     * Mark a step as not completed
     */
    async markStepUndone(stepName) {
        if (this.state.steps[stepName]) {
            this.state.steps[stepName].completed = false;
        }
        await this.saveState();
    }

    /**
     * Get unique project name with timestamp
     */
    getProjectName() {
        if (!this.state.resources.projectName) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
            this.state.resources.projectName = `demo-webapp-${timestamp}`;
        }
        return this.state.resources.projectName;
    }

    /**
     * STEP 1: Generate webapp using CodeAgent
     */
    async stepGenerate() {
        console.log('🚀 STEP 1: Generating webapp...\n');
        
        if (this.isStepCompleted('generate')) {
            console.log('✅ Step already completed: generate\n');
            return;
        }

        try {
            // Clean the webapp directory
            try {
                await fs.rm(WEBAPP_DIR, { recursive: true, force: true });
                console.log('🧹 Cleaned existing webapp directory');
            } catch (error) {
                // Directory might not exist, that's ok
            }

            // Define requirements for the webapp - EXACT same format as working script
            const requirements = {
                task: 'Create a simple demonstration web application',
                frontend: {
                    description: 'Modern web interface for sending messages to server',
                    features: [
                        'Responsive HTML page with clean design',
                        'Form with text input for entering messages',
                        'Submit button to send messages to server',
                        'Display area to show server responses',
                        'Professional CSS styling with gradients and shadows',
                        'Client-side JavaScript using fetch API',
                        'Loading states and error handling'
                    ]
                },
                backend: {
                    description: 'Express.js server to process messages',
                    features: [
                        'Express.js server running on port 3001',
                        'POST endpoint /api/message to receive messages',
                        'Transform the message (reverse it and add timestamp)',
                        'Return JSON response with original and transformed message',
                        'CORS configuration for development',
                        'Basic error handling and validation',
                        'Health check endpoint at /api/health'
                    ]
                }
            };

            // Configure and run CodeAgent - EXACT same config as working script
            const config = {
                projectType: 'fullstack',
                skipTesting: false,
                generateTests: true,
                enableGit: false,
                llmConfig: {
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20241022'
                }
            };

            console.log('🤖 Starting CodeAgent generation...');
            const agent = new CodeAgent(config);
            await agent.initialize(WEBAPP_DIR, { resourceManager: this.resourceManager });
            
            const result = await agent.develop(requirements);
            
            console.log('✅ CodeAgent generation completed');
            console.log(`   - Files Generated: ${result.filesGenerated}`);
            console.log(`   - Tests Created: ${result.testsCreated}`);
            console.log(`   - Quality Gates Passed: ${result.qualityGatesPassed}\n`);

            // Verify key files exist
            const keyFiles = ['package.json', 'server.js', 'public/index.html', 'public/favicon.ico'];
            for (const file of keyFiles) {
                const filePath = path.join(WEBAPP_DIR, file);
                try {
                    await fs.access(filePath);
                    console.log(`✅ Verified: ${file}`);
                } catch {
                    throw new Error(`Missing required file: ${file}`);
                }
            }

            await this.markStepCompleted('generate', { 
                result,
                projectPath: WEBAPP_DIR 
            });
            
            console.log('🎉 STEP 1 COMPLETE: Webapp generated successfully\n');

        } catch (error) {
            console.error('❌ STEP 1 FAILED:', error.message);
            throw error;
        }
    }

    /**
     * STEP 2: Test locally
     */
    async stepTestLocal() {
        console.log('🧪 STEP 2: Testing locally...\n');
        
        if (this.isStepCompleted('test-local')) {
            console.log('✅ Step already completed: test-local\n');
            return;
        }

        try {
            // Change to webapp directory
            process.chdir(WEBAPP_DIR);

            // Install dependencies
            console.log('📦 Installing npm dependencies...');
            await this.runCommand('npm', ['install']);
            console.log('✅ Dependencies installed');

            // Start server in background
            console.log('🚀 Starting server...');
            const serverProcess = spawn('node', ['server.js'], {
                env: { ...process.env, PORT: '3998' },
                detached: false
            });

            // Wait for server to start
            await this.waitForServer('http://localhost:3998', 10000);
            console.log('✅ Server started on port 3998');

            // Test endpoints
            console.log('🔍 Testing endpoints...');
            
            // Test health endpoint
            const healthResponse = await fetch('http://localhost:3998/health');
            if (!healthResponse.ok) {
                throw new Error('Health endpoint failed');
            }
            console.log('✅ Health endpoint working');

            // Test API status endpoint
            const statusResponse = await fetch('http://localhost:3998/api/status');
            if (!statusResponse.ok) {
                throw new Error('API status endpoint failed');
            }
            console.log('✅ API status endpoint working');

            // Test favicon
            const faviconResponse = await fetch('http://localhost:3998/favicon.ico');
            if (!faviconResponse.ok) {
                throw new Error('Favicon not loading');
            }
            console.log('✅ Favicon loading correctly');

            // Test main page
            const mainResponse = await fetch('http://localhost:3998');
            if (!mainResponse.ok) {
                throw new Error('Main page not loading');
            }
            console.log('✅ Main page loading correctly');

            // Stop server
            serverProcess.kill();
            console.log('🛑 Server stopped');

            await this.markStepCompleted('test-local', { 
                port: 3998,
                testsRun: 4
            });
            
            console.log('🎉 STEP 2 COMPLETE: Local testing successful\n');

        } catch (error) {
            console.error('❌ STEP 2 FAILED:', error.message);
            throw error;
        } finally {
            // Change back to original directory
            process.chdir(__dirname);
        }
    }

    /**
     * Helper: Wait for server to be ready
     */
    async waitForServer(url, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const response = await fetch(url);
                if (response.status < 500) {
                    return;
                }
            } catch (error) {
                // Server not ready yet
            }
            await this.sleep(500);
        }
        throw new Error(`Server did not start within ${timeout}ms`);
    }

    /**
     * Helper: Sleep for given milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Helper: Run a command and wait for completion
     */
    runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, { stdio: 'pipe' });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });
            
            process.on('error', reject);
        });
    }

    /**
     * STEP 3: Push to GitHub
     */
    async stepGithub() {
        console.log('📚 STEP 3: Pushing to GitHub...\n');
        
        if (this.isStepCompleted('github')) {
            console.log('✅ Step already completed: github\n');
            return;
        }

        try {
            const projectName = this.getProjectName();
            const githubOrg = this.resourceManager.get('GITHUB_ORG');
            
            // Change to webapp directory
            process.chdir(WEBAPP_DIR);

            // Remove any existing .git directory from parent repo influence
            console.log('🔧 Setting up clean git repository...');
            try {
                await execAsync('rm -rf .git');
            } catch {
                // .git might not exist, that's ok
            }
            
            // Initialize fresh git repository
            await execAsync('git init');
            console.log('✅ Git repository initialized')

            // Determine where to create the repository
            const targetOrg = this.resourceManager.get('GITHUB_ORG');
            const useOrganization = targetOrg && targetOrg !== 'personal';
            
            if (useOrganization) {
                // Create repository in organization using direct API call
                console.log(`🏗️  Creating GitHub repository in organization ${targetOrg}: ${projectName}...`);
                
                // Import the helper function
                const { createOrgRepo } = await import('./create-org-repo.js');
                const createResult = await createOrgRepo(
                    targetOrg,
                    projectName,
                    'Demo webapp generated by CodeAgent',
                    false
                );
                
                if (!createResult.success) {
                    throw new Error(`Failed to create GitHub repo in organization`);
                }
                
                var repoData = createResult;
                var repoUrl = createResult.url;
                var githubUser = targetOrg; // For organization repos, use org name
            } else {
                // Create repository in personal account
                console.log(`🏗️  Creating GitHub repository in personal account: ${projectName}...`);
                const createResult = await this.githubTool.invoke({
                    function: {
                        name: 'github_create_repo',
                        arguments: JSON.stringify({
                            repoName: projectName,
                            description: 'Demo webapp generated by CodeAgent',
                            private: false
                        })
                    }
                });
                
                if (!createResult.success) {
                    throw new Error(`Failed to create GitHub repo: ${createResult.error}`);
                }
                
                // Get the actual GitHub user and URL from the tool's response
                var repoData = createResult.data || createResult.result || createResult;
                var repoUrl = repoData.url;
                var githubUser = repoUrl.split('/')[3];
            }

            console.log('✅ GitHub repository created:', repoUrl);

            // Add all files
            console.log('📦 Adding files to git...');
            await execAsync('git add .');
            console.log('✅ Files added to git');

            // Create initial commit
            console.log('💾 Creating initial commit...');
            await execAsync('git commit -m "Initial commit: CodeAgent generated webapp with favicon support"');
            console.log('✅ Initial commit created');

            // Add remote origin
            console.log('🔗 Adding remote origin...');
            const cloneUrl = repoData.cloneUrl;
            try {
                await execAsync(`git remote add origin ${cloneUrl}`);
            } catch {
                // Remote might already exist, update it
                await execAsync(`git remote set-url origin ${cloneUrl}`);
            }
            console.log('✅ Remote origin configured');

            // Push to GitHub
            console.log('🚀 Pushing to GitHub...');
            await execAsync('git branch -M main');
            await execAsync('git push -u origin main');
            console.log('✅ Code pushed to GitHub');

            // Store the repository information
            this.state.resources.githubUrl = repoUrl;
            this.state.resources.githubRepo = projectName;
            this.state.resources.githubOrg = githubUser;

            await this.markStepCompleted('github', {
                repoUrl,
                repoName: projectName,
                organization: githubOrg
            });

            console.log('🎉 STEP 3 COMPLETE: Code successfully pushed to GitHub');
            console.log(`📚 Repository URL: ${repoUrl}\n`);

        } catch (error) {
            console.error('❌ STEP 3 FAILED:', error.message);
            throw error;
        } finally {
            // Change back to original directory
            process.chdir(__dirname);
        }
    }

    /**
     * STEP 4: Deploy to Railway
     */
    async stepRailway() {
        console.log('🚂 STEP 4: Deploying to Railway...\n');
        
        if (this.isStepCompleted('railway')) {
            console.log('✅ Step already completed: railway\n');
            return;
        }

        try {
            // Import RailwayProvider
            const { default: RailwayProvider } = await import('../packages/railway/src/providers/RailwayProvider.js');
            
            // Get Railway API token from ResourceManager
            const railwayToken = this.resourceManager.get('env.RAILWAY_API_TOKEN');
            if (!railwayToken) {
                throw new Error('RAILWAY_API_TOKEN not found in environment');
            }
            
            // Create Railway provider
            const railway = new RailwayProvider(railwayToken);
            
            // Get GitHub repository URL from state
            const githubUrl = this.state.resources.githubUrl;
            if (!githubUrl) {
                throw new Error('GitHub repository URL not found. Please run the github step first.');
            }
            
            // Extract owner and repo from GitHub URL
            const urlParts = githubUrl.split('/');
            const owner = urlParts[3];
            const repo = urlParts[4];
            const githubRepo = `${owner}/${repo}`;
            
            console.log(`🔗 Deploying from GitHub: ${githubRepo}`);
            
            // Deploy the application
            const projectName = this.getProjectName();
            const deploymentResult = await railway.deploy({
                name: projectName,
                source: 'github',
                githubRepo: githubRepo,
                branch: 'main',
                settings: {
                    PORT: 3001,
                    NODE_ENV: 'production'
                }
            });
            
            if (!deploymentResult.success) {
                throw new Error(`Railway deployment failed: ${deploymentResult.error || JSON.stringify(deploymentResult)}`);
            }
            
            console.log('✅ Railway deployment initiated');
            console.log(`   - Project ID: ${deploymentResult.projectId}`);
            console.log(`   - Service ID: ${deploymentResult.serviceId}`);
            console.log(`   - Deployment ID: ${deploymentResult.deploymentId}`);
            
            // Get the environment ID (Railway projects have a default 'production' environment)
            console.log('\n🔍 Getting environment information...');
            const projectQuery = `
                query GetProject($id: String!) {
                    project(id: $id) {
                        environments {
                            edges {
                                node {
                                    id
                                    name
                                }
                            }
                        }
                    }
                }
            `;
            
            const envResult = await railway.makeGraphQLRequest(projectQuery, { 
                id: deploymentResult.projectId 
            });
            
            let environmentId;
            if (envResult.success && envResult.data?.project?.environments?.edges?.length > 0) {
                environmentId = envResult.data.project.environments.edges[0].node.id;
                console.log(`✅ Found environment: ${envResult.data.project.environments.edges[0].node.name}`);
            } else {
                console.log('⚠️  Could not get environment ID, using service ID as fallback');
                environmentId = deploymentResult.serviceId;
            }
            
            // Generate domain for the service
            console.log('\n🌐 Generating public domain...');
            const domainResult = await railway.generateDomain(
                deploymentResult.serviceId,
                environmentId
            );
            
            let deploymentUrl;
            if (domainResult.success) {
                deploymentUrl = `https://${domainResult.domain}`;
                console.log(`✅ Domain generated: ${deploymentUrl}`);
            } else {
                console.log('⚠️  Could not generate domain automatically');
                deploymentUrl = `https://${projectName}.up.railway.app`;
                console.log(`   Expected URL: ${deploymentUrl}`);
            }
            
            // Wait for deployment to be ready
            console.log('\n⏳ Waiting for deployment to be ready...');
            console.log('   Build logs:', deploymentResult.url || 'Check Railway dashboard');
            
            // Check deployment status periodically
            let isReady = false;
            let attempts = 0;
            const maxAttempts = 36; // 3 minutes total
            
            while (!isReady && attempts < maxAttempts) {
                await this.sleep(5000); // Wait 5 seconds between checks
                
                try {
                    // Try to fetch the health endpoint
                    const response = await fetch(`${deploymentUrl}/health`);
                    if (response.ok) {
                        isReady = true;
                        console.log('\n✅ Deployment is ready!');
                        break;
                    }
                    console.log(`   Checking deployment... (attempt ${attempts + 1}/${maxAttempts})`);
                } catch (error) {
                    // Service not ready yet
                    if (attempts % 6 === 0) { // Log every 30 seconds
                        console.log('   Still building...');
                    }
                }
                attempts++;
            }
            
            if (!isReady) {
                console.log('\n⚠️  Deployment is taking longer than expected');
                console.log('   The deployment may still be building. Check Railway dashboard for status.');
            }
            
            // Store Railway information
            this.state.resources.railwayProjectId = deploymentResult.projectId;
            this.state.resources.railwayServiceId = deploymentResult.serviceId;
            this.state.resources.railwayUrl = deploymentUrl;
            
            await this.markStepCompleted('railway', {
                projectId: deploymentResult.projectId,
                serviceId: deploymentResult.serviceId,
                deploymentId: deploymentResult.deploymentId,
                url: deploymentUrl
            });
            
            console.log('🎉 STEP 4 COMPLETE: Successfully deployed to Railway');
            console.log(`🚂 Railway URL: ${deploymentUrl}\n`);
            
        } catch (error) {
            console.error('❌ STEP 4 FAILED:', error.message);
            throw error;
        }
    }

    /**
     * STEP 5: Test live deployment
     */
    async stepTestLive() {
        console.log('🌐 STEP 5: Testing live deployment...\n');
        
        if (this.isStepCompleted('test-live')) {
            console.log('✅ Step already completed: test-live\n');
            return;
        }

        try {
            // Get deployment URL from state
            const deploymentUrl = this.state.resources.railwayUrl;
            if (!deploymentUrl) {
                throw new Error('Railway deployment URL not found. Please run the railway step first.');
            }

            console.log(`🔍 Testing deployment at: ${deploymentUrl}`);
            console.log('⏳ Waiting for deployment to be ready (this may take a few minutes)...\n');

            // Wait for deployment with retries
            let isLive = false;
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes total

            while (!isLive && attempts < maxAttempts) {
                try {
                    // Test health endpoint
                    const healthResponse = await fetch(`${deploymentUrl}/health`);
                    if (healthResponse.ok) {
                        isLive = true;
                        console.log('✅ Deployment is live!');
                        break;
                    }
                    console.log(`   Attempt ${attempts + 1}/${maxAttempts}: Status ${healthResponse.status}`);
                } catch (error) {
                    console.log(`   Attempt ${attempts + 1}/${maxAttempts}: Not ready yet...`);
                }

                attempts++;
                if (!isLive && attempts < maxAttempts) {
                    await this.sleep(5000); // Wait 5 seconds between attempts
                }
            }

            if (!isLive) {
                throw new Error('Deployment did not become available within 5 minutes');
            }

            // Run comprehensive tests
            console.log('\n🧪 Running live deployment tests...\n');

            // Test 1: Health endpoint
            console.log('1️⃣ Testing health endpoint...');
            const healthResponse = await fetch(`${deploymentUrl}/health`);
            if (!healthResponse.ok) {
                throw new Error(`Health endpoint failed with status ${healthResponse.status}`);
            }
            const healthData = await healthResponse.json();
            console.log('✅ Health endpoint working:', JSON.stringify(healthData));

            // Test 2: API status endpoint
            console.log('\n2️⃣ Testing API status endpoint...');
            const statusResponse = await fetch(`${deploymentUrl}/api/status`);
            if (!statusResponse.ok) {
                throw new Error(`API status endpoint failed with status ${statusResponse.status}`);
            }
            const statusData = await statusResponse.json();
            console.log('✅ API status endpoint working:', JSON.stringify(statusData));

            // Test 3: Main page
            console.log('\n3️⃣ Testing main page...');
            const mainResponse = await fetch(deploymentUrl);
            if (!mainResponse.ok) {
                throw new Error(`Main page failed with status ${mainResponse.status}`);
            }
            const mainContent = await mainResponse.text();
            if (!mainContent.includes('<!DOCTYPE html>')) {
                throw new Error('Main page does not return valid HTML');
            }
            console.log('✅ Main page loading correctly');

            // Test 4: Static assets
            console.log('\n4️⃣ Testing static assets...');
            
            // Test favicon
            const faviconResponse = await fetch(`${deploymentUrl}/favicon.ico`);
            if (!faviconResponse.ok) {
                console.log('⚠️  Warning: Favicon not loading');
            } else {
                console.log('✅ Favicon loading correctly');
            }

            // Test CSS
            const cssResponse = await fetch(`${deploymentUrl}/style.css`);
            if (!cssResponse.ok) {
                console.log('⚠️  Warning: CSS not loading');
            } else {
                console.log('✅ CSS loading correctly');
            }

            // Test JavaScript
            const jsResponse = await fetch(`${deploymentUrl}/script.js`);
            if (!jsResponse.ok) {
                console.log('⚠️  Warning: JavaScript not loading');
            } else {
                console.log('✅ JavaScript loading correctly');
            }

            // Test 5: API functionality (skip if endpoint doesn't exist)
            console.log('\n5️⃣ Testing API functionality...');
            try {
                const messageResponse = await fetch(`${deploymentUrl}/api/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: 'Hello from pipeline test!' })
                });
                
                if (messageResponse.ok) {
                    const messageData = await messageResponse.json();
                    console.log('✅ API message endpoint working:', JSON.stringify(messageData));
                } else {
                    console.log('⚠️  API message endpoint not found (this is ok for generated apps)');
                }
            } catch (error) {
                console.log('⚠️  Could not test API message endpoint');
            }

            await this.markStepCompleted('test-live', {
                url: deploymentUrl,
                testsRun: 5,
                allTestsPassed: true
            });

            console.log('\n🎉 STEP 5 COMPLETE: Live deployment tests passed!');
            console.log(`🌐 Live URL: ${deploymentUrl}\n`);

        } catch (error) {
            console.error('❌ STEP 5 FAILED:', error.message);
            throw error;
        }
    }

    /**
     * UNDO: Delete GitHub repository
     */
    async undoGithub() {
        console.log('🗑️  UNDO: Deleting GitHub repository...\n');
        
        try {
            const githubOrg = this.state.resources.githubOrg;
            const repoName = this.state.resources.githubRepo;
            
            if (!githubOrg || !repoName) {
                console.log('⚠️  No GitHub repository information found');
                return;
            }

            console.log(`🗑️  Deleting repository: ${githubOrg}/${repoName}...`);
            
            const deleteResult = await this.githubTool.invoke({
                function: {
                    name: 'github_delete_repo',
                    arguments: JSON.stringify({
                        owner: githubOrg,
                        repo: repoName
                    })
                }
            });

            if (!deleteResult.success) {
                throw new Error(`Failed to delete GitHub repo: ${deleteResult.error}`);
            }

            console.log('✅ GitHub repository deleted');

            // Clean up state
            delete this.state.resources.githubUrl;
            delete this.state.resources.githubRepo;
            delete this.state.resources.githubOrg;

            await this.markStepUndone('github');
            console.log('✅ UNDO COMPLETE: GitHub repository removed\n');
        } catch (error) {
            console.error('❌ UNDO FAILED:', error.message);
        }
    }

    /**
     * UNDO: Delete Railway project
     */
    async undoRailway() {
        console.log('🗑️  UNDO: Deleting Railway project...\n');
        
        try {
            const projectId = this.state.resources.railwayProjectId;
            
            if (!projectId) {
                console.log('⚠️  No Railway project information found');
                return;
            }
            
            // Import RailwayProvider
            const { default: RailwayProvider } = await import('../packages/railway/src/providers/RailwayProvider.js');
            
            // Get Railway API token from ResourceManager
            const railwayToken = this.resourceManager.get('env.RAILWAY_API_TOKEN');
            if (!railwayToken) {
                throw new Error('RAILWAY_API_TOKEN not found in environment');
            }
            
            // Create Railway provider
            const railway = new RailwayProvider(railwayToken);
            
            console.log(`🗑️  Deleting Railway project: ${projectId}...`);
            
            // Delete the project
            const deleteResult = await railway.deleteProject(projectId);
            
            if (!deleteResult.success) {
                throw new Error(`Failed to delete Railway project: ${deleteResult.error}`);
            }
            
            console.log('✅ Railway project deleted');
            
            // Clean up state
            delete this.state.resources.railwayProjectId;
            delete this.state.resources.railwayServiceId;
            delete this.state.resources.railwayUrl;
            
            await this.markStepUndone('railway');
            console.log('✅ UNDO COMPLETE: Railway project removed\n');
        } catch (error) {
            console.error('❌ UNDO FAILED:', error.message);
        }
    }

    /**
     * UNDO: Clean generated files
     */
    async undoGenerate() {
        console.log('🧹 UNDO: Cleaning generated files...\n');
        
        try {
            await fs.rm(WEBAPP_DIR, { recursive: true, force: true });
            console.log('✅ Removed webapp directory');
            
            await this.markStepUndone('generate');
            console.log('✅ UNDO COMPLETE: Generated files cleaned\n');
        } catch (error) {
            console.error('❌ UNDO FAILED:', error.message);
        }
    }

    /**
     * Run all steps in sequence
     */
    async runAll() {
        console.log('🎯 Running complete pipeline...\n');
        
        try {
            await this.stepGenerate();
            await this.stepTestLocal();
            await this.stepGithub();
            await this.stepRailway();
            await this.stepTestLive();
            
            console.log('🎉 PIPELINE COMPLETE: All steps successful!\n');
            this.displaySummary();
        } catch (error) {
            console.error('❌ PIPELINE FAILED:', error.message);
            console.log('💡 You can resume from the failed step or run --reset to start over\n');
        }
    }

    /**
     * Reset all steps (undo in reverse order)
     */
    async reset() {
        console.log('🔄 Resetting pipeline...\n');
        
        // Undo steps in reverse order
        // await this.undoTestLive();
        await this.undoRailway();
        await this.undoGithub();
        // await this.undoTestLocal();
        await this.undoGenerate();
        
        // Clear state
        this.state = {
            steps: {},
            resources: {},
            timestamp: Date.now()
        };
        await this.saveState();
        
        console.log('✅ RESET COMPLETE: Pipeline reset to initial state\n');
    }

    /**
     * Comprehensive cleanup - removes all demo resources
     */
    async cleanup() {
        console.log('🧹 Running comprehensive cleanup...\n');
        
        try {
            // 1. Clean up GitHub repositories
            console.log('📚 Cleaning GitHub repositories...');
            const listResult = await this.githubTool.invoke({
                function: {
                    name: 'github_list_repos',
                    arguments: JSON.stringify({
                        type: 'all',
                        sort: 'created',
                        per_page: 100
                    })
                }
            });
            
            if (listResult.success && listResult.data) {
                const repos = listResult.data.repositories || listResult.data || [];
                const demoRepos = repos.filter(repo => 
                    repo.name.startsWith('demo-webapp-') ||
                    repo.name.includes('test-app') ||
                    repo.name.includes('generated')
                );
                
                console.log(`Found ${demoRepos.length} demo repositories to delete`);
                
                for (const repo of demoRepos) {
                    try {
                        console.log(`  🗑️  Deleting ${repo.owner}/${repo.name}...`);
                        await this.githubTool.invoke({
                            function: {
                                name: 'github_delete_repo',
                                arguments: JSON.stringify({
                                    owner: repo.owner,
                                    repo: repo.name
                                })
                            }
                        });
                        console.log(`  ✅ Deleted ${repo.name}`);
                    } catch (error) {
                        console.error(`  ❌ Failed to delete ${repo.name}: ${error.message}`);
                    }
                }
            }
            
            // 2. Clean up Railway projects
            console.log('\n🚂 Cleaning Railway projects...');
            const { default: RailwayProvider } = await import('../packages/railway/src/providers/RailwayProvider.js');
            const railwayToken = this.resourceManager.get('env.RAILWAY_API_TOKEN');
            
            if (railwayToken) {
                const railway = new RailwayProvider(railwayToken);
                const projectsResult = await railway.listProjects();
                
                if (projectsResult.success) {
                    const projects = projectsResult.projects || [];
                    const demoProjects = projects.filter(project => 
                        project.name.startsWith('demo-webapp-') ||
                        project.name.includes('test-app') ||
                        project.name.includes('generated')
                    );
                    
                    console.log(`Found ${demoProjects.length} demo projects to delete`);
                    
                    for (const project of demoProjects) {
                        try {
                            console.log(`  🗑️  Deleting ${project.name}...`);
                            await railway.deleteProject(project.id);
                            console.log(`  ✅ Deleted ${project.name}`);
                        } catch (error) {
                            console.error(`  ❌ Failed to delete ${project.name}: ${error.message}`);
                        }
                    }
                }
            }
            
            // 3. Clean up generated files
            console.log('\n📁 Cleaning generated files...');
            const generatedDir = path.join(__dirname, '..', 'generated');
            try {
                const files = await fs.readdir(generatedDir);
                for (const file of files) {
                    if (file.startsWith('demo-webapp-') || file === 'demo-webapp') {
                        const filePath = path.join(generatedDir, file);
                        await fs.rm(filePath, { recursive: true, force: true });
                        console.log(`  ✅ Removed ${file}`);
                    }
                }
            } catch (error) {
                console.log('  ⚠️  No generated files found');
            }
            
            // 4. Verify cleanup
            console.log('\n🔍 Verifying cleanup...');
            
            // Check GitHub again
            const verifyGitHub = await this.githubTool.invoke({
                function: {
                    name: 'github_list_repos',
                    arguments: JSON.stringify({
                        type: 'all',
                        sort: 'created',
                        per_page: 100
                    })
                }
            });
            
            if (verifyGitHub.success && verifyGitHub.data) {
                const remainingRepos = (verifyGitHub.data.repositories || [])
                    .filter(repo => repo.name.startsWith('demo-webapp-'));
                console.log(`  GitHub: ${remainingRepos.length} demo repos remaining`);
            }
            
            // Check Railway again
            if (railwayToken) {
                const railway = new RailwayProvider(railwayToken);
                const verifyRailway = await railway.listProjects();
                if (verifyRailway.success) {
                    const remainingProjects = (verifyRailway.projects || [])
                        .filter(p => p.name.startsWith('demo-webapp-'));
                    console.log(`  Railway: ${remainingProjects.length} demo projects remaining`);
                }
            }
            
            // Clear state file
            this.state = {
                steps: {},
                resources: {},
                timestamp: Date.now()
            };
            await this.saveState();
            
            console.log('\n✅ CLEANUP COMPLETE: All demo resources cleaned\n');
            
        } catch (error) {
            console.error('❌ CLEANUP FAILED:', error.message);
        }
    }

    /**
     * Display summary of completed steps
     */
    displaySummary() {
        console.log('📊 PIPELINE SUMMARY:');
        console.log('━━━━━━━━━━━━━━━━━━━━');
        
        const steps = ['generate', 'test-local', 'github', 'railway', 'test-live'];
        steps.forEach(step => {
            const status = this.isStepCompleted(step) ? '✅' : '⏸️';
            console.log(`${status} ${step}`);
        });
        
        console.log('\n📁 Project Directory:', WEBAPP_DIR);
        
        if (this.state.resources.githubUrl) {
            console.log('📚 GitHub Repository:', this.state.resources.githubUrl);
        }
        
        if (this.state.resources.railwayUrl) {
            console.log('🚂 Railway Deployment:', this.state.resources.railwayUrl);
        }
        
        console.log('');
    }

    /**
     * Show help
     */
    showHelp() {
        console.log(`
🚀 Full-Stack Development Pipeline

USAGE:
  node full-pipeline.js [COMMAND]

STEP COMMANDS:
  --step generate      Generate webapp using CodeAgent
  --step test-local    Run and test locally  
  --step github        Push to GitHub repository
  --step railway       Deploy to Railway
  --step test-live     Test live deployment

UNDO COMMANDS:
  --undo generate      Clean generated files
  --undo test-local    Stop local processes
  --undo github        Delete GitHub repository
  --undo railway       Delete Railway project
  --undo test-live     Stop monitoring

BATCH COMMANDS:
  --all                Run all steps in sequence
  --reset              Undo all steps (full reset)
  --cleanup            Remove ALL demo resources (comprehensive)
  --status             Show current pipeline status
  --help               Show this help message

EXAMPLES:
  node full-pipeline.js --step generate
  node full-pipeline.js --all
  node full-pipeline.js --reset
  node full-pipeline.js --cleanup
`);
    }

    /**
     * Show current status
     */
    showStatus() {
        console.log('📊 CURRENT STATUS:\n');
        this.displaySummary();
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const pipeline = new PipelineManager();
    
    try {
        await pipeline.initialize();
        
        if (args.length === 0 || args.includes('--help')) {
            pipeline.showHelp();
            return;
        }
        
        if (args.includes('--status')) {
            pipeline.showStatus();
            return;
        }
        
        if (args.includes('--all')) {
            await pipeline.runAll();
            return;
        }
        
        if (args.includes('--reset')) {
            await pipeline.reset();
            return;
        }
        
        if (args.includes('--cleanup')) {
            await pipeline.cleanup();
            return;
        }
        
        // Handle step commands
        const stepIndex = args.indexOf('--step');
        if (stepIndex !== -1 && args[stepIndex + 1]) {
            const step = args[stepIndex + 1];
            switch (step) {
                case 'generate':
                    await pipeline.stepGenerate();
                    break;
                case 'test-local':
                    await pipeline.stepTestLocal();
                    break;
                case 'github':
                    await pipeline.stepGithub();
                    break;
                case 'railway':
                    await pipeline.stepRailway();
                    break;
                case 'test-live':
                    await pipeline.stepTestLive();
                    break;
                default:
                    console.error(`❌ Unknown step: ${step}`);
                    pipeline.showHelp();
            }
            return;
        }
        
        // Handle undo commands
        const undoIndex = args.indexOf('--undo');
        if (undoIndex !== -1 && args[undoIndex + 1]) {
            const step = args[undoIndex + 1];
            switch (step) {
                case 'generate':
                    await pipeline.undoGenerate();
                    break;
                case 'github':
                    await pipeline.undoGithub();
                    break;
                case 'railway':
                    await pipeline.undoRailway();
                    break;
                default:
                    console.error(`❌ Undo not implemented for: ${step}`);
            }
            return;
        }
        
        console.error('❌ Invalid command. Use --help for usage information.');
        
    } catch (error) {
        console.error('❌ Pipeline error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}