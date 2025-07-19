#!/usr/bin/env node

/**
 * Real GitHub Integration Demo
 * 
 * This script demonstrates creating a real GitHub repository and generating
 * a Node.js server using the Enhanced Code Agent.
 */

import { EnhancedCodeAgent } from './src/agent/EnhancedCodeAgent.js';
import { ResourceManager } from '@jsenvoy/module-loader';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🚀 GitHub Integration Demo');
  console.log('==========================\n');
  
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Get GitHub PAT
  let githubPat;
  try {
    githubPat = resourceManager.get('GITHUB_PAT');
    process.env.GITHUB_PAT = githubPat;
  } catch {
    githubPat = process.env.GITHUB_PAT;
  }
  
  if (!githubPat) {
    console.error('❌ No GITHUB_PAT found!');
    console.log('Please set GITHUB_PAT environment variable');
    process.exit(1);
  }
  
  // Get LLM API keys
  let llmProvider, llmModel, llmApiKey;
  
  try {
    const openaiKey = resourceManager.get('OPENAI_API_KEY');
    if (openaiKey) {
      process.env.OPENAI_API_KEY = openaiKey;
      llmProvider = 'openai';
      llmModel = 'gpt-4-turbo-preview';
      llmApiKey = openaiKey;
    }
  } catch {}
  
  if (!llmApiKey) {
    try {
      const anthropicKey = resourceManager.get('ANTHROPIC_API_KEY');
      if (anthropicKey) {
        process.env.ANTHROPIC_API_KEY = anthropicKey;
        llmProvider = 'anthropic';
        llmModel = 'claude-3-opus-20240229';
        llmApiKey = anthropicKey;
      }
    } catch {}
  }
  
  if (!llmApiKey) {
    console.error('❌ No LLM API key found!');
    console.log('Please set either OPENAI_API_KEY or ANTHROPIC_API_KEY');
    process.exit(1);
  }
  
  console.log(`✅ Using ${llmProvider} (${llmModel})`);
  console.log(`✅ GitHub PAT: ${githubPat.substring(0, 10)}...`);
  console.log('');
  
  // Create repository name
  const timestamp = Date.now();
  const repoName = `demo-node-server-${timestamp}`;
  const projectDir = join(__dirname, 'tmp', repoName);
  
  console.log(`📁 Project directory: ${projectDir}`);
  console.log(`📝 Repository name: ${repoName}`);
  console.log('');
  
  // Create project directory
  await fs.mkdir(projectDir, { recursive: true });
  
  try {
    // Initialize Enhanced Code Agent
    console.log('🤖 Initializing Enhanced Code Agent...');
    
    const agent = new EnhancedCodeAgent({
      enableGitIntegration: true,
      gitConfig: {
        enabled: true,
        autoCommit: true,
        commitStrategy: 'phase',
        organization: 'AgentResults',
        createRepository: true,
        repositoryName: repoName,
        repositoryDescription: `Demo Node.js server - ${new Date().toISOString()}`,
        pushChanges: true
      },
      llmConfig: {
        provider: llmProvider,
        model: llmModel,
        temperature: 0.3,
        apiKey: llmApiKey
      },
      enhancedConfig: {
        enableRuntimeTesting: true,
        enableBrowserTesting: false,
        enableLogAnalysis: true,
        enablePerformanceMonitoring: false
      }
    });
    
    await agent.initialize(projectDir, {
      llmConfig: {
        provider: llmProvider,
        model: llmModel,
        temperature: 0.3,
        apiKey: llmApiKey
      }
    });
    
    console.log('✅ Agent initialized\n');
    
    // Define requirements
    const requirements = {
      type: 'backend',
      name: repoName,
      description: 'Simple Node.js web server with HTML pages',
      features: [
        'Express.js server',
        'Homepage with welcome message',
        'About page with server info',
        'Health check endpoint',
        'Static file serving',
        'Basic CSS styling'
      ],
      architecture: {
        backend: true,
        frontend: false,
        database: false
      },
      requirements: {
        'Create Node.js server': {
          framework: 'Express.js',
          port: 'PORT environment variable or 3000',
          routes: [
            'GET / - Homepage',
            'GET /about - About page',
            'GET /health - JSON health status'
          ]
        },
        'Add static files': {
          'public/index.html': 'Homepage HTML',
          'public/about.html': 'About page HTML', 
          'public/style.css': 'Basic styling'
        },
        'Package configuration': {
          scripts: {
            start: 'node server.js',
            test: 'jest'
          },
          dependencies: ['express'],
          devDependencies: ['jest', 'supertest']
        }
      }
    };
    
    console.log('🚀 Starting development process...\n');
    
    // Run development workflow
    const result = await agent.develop(requirements);
    
    console.log('\n✅ Development completed!');
    console.log(`📊 Generated ${result.files.length} files`);
    
    // Get repository info
    if (agent.gitIntegration) {
      console.log('\n📦 GitHub Repository:');
      
      const gitHubOps = agent.gitIntegration.gitHubOperations;
      if (gitHubOps) {
        try {
          const repoInfo = await gitHubOps.getRepositoryInfo('AgentResults', repoName);
          console.log(`🔗 URL: ${repoInfo.html_url}`);
          console.log(`📝 Description: ${repoInfo.description}`);
          console.log(`📊 Size: ${repoInfo.size}KB`);
        } catch (error) {
          console.log('⚠️  Could not fetch repository info:', error.message);
        }
      }
    }
    
    console.log('\n🎉 Demo completed successfully!');
    console.log(`Check out the generated project at: ${projectDir}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);