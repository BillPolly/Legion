#!/usr/bin/env node

/**
 * Create GitHub Repository Demo
 * 
 * This script creates a real GitHub repository in the AgentResults organization
 * and adds a simple Node.js server.
 */

import { ResourceManager } from '@legion/module-loader';
import GitIntegrationManager from './src/integration/GitIntegrationManager.js';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🚀 Create GitHub Repository Demo');
  console.log('=================================\n');
  
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Set up environment
  let githubPat;
  try {
    githubPat = resourceManager.get('GITHUB_PAT');
    process.env.GITHUB_PAT = githubPat;
  } catch {
    githubPat = process.env.GITHUB_PAT;
  }
  
  if (!githubPat) {
    console.error('❌ No GITHUB_PAT found!');
    process.exit(1);
  }
  
  console.log(`✅ GitHub PAT: ${githubPat.substring(0, 10)}...`);
  
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
    // Create resource manager for Git integration
    const gitResourceManager = {
      get: (key) => {
        if (key === 'GITHUB_USER') return process.env.GITHUB_USER;
        if (key === 'GITHUB_PAT') return process.env.GITHUB_PAT;
        if (key === 'GITHUB_AGENT_ORG') return 'AgentResults';
        return null;
      }
    };
    
    // Initialize Git integration
    console.log('🔧 Initializing Git integration...');
    
    const gitConfig = {
      enabled: true,
      autoCommit: true,
      commitStrategy: 'phase',
      organization: 'AgentResults',
      createRepository: true,
      repositoryName: repoName,
      repositoryDescription: `Demo Node.js server created by AI agent - ${new Date().toISOString()}`,
      pushChanges: true
    };
    
    const gitIntegration = new GitIntegrationManager(gitResourceManager, gitConfig);
    await gitIntegration.initialize(projectDir);
    
    console.log('✅ Git integration initialized\n');
    
    // Create GitHub repository
    console.log('📦 Creating GitHub repository...');
    
    // Use GitHub operations to create the repository
    const gitHubOps = gitIntegration.gitHubOperations;
    if (!gitHubOps) {
      throw new Error('GitHub operations not initialized');
    }
    
    const repoData = await gitHubOps.createInOrganization(
      repoName,
      `Demo Node.js server created by AI agent - ${new Date().toISOString()}`,
      {
        private: false,
        auto_init: false,
        has_issues: true,
        has_projects: false,
        has_wiki: false
      }
    );
    
    console.log('✅ GitHub repository created:', repoData.html_url);
    
    // Initialize local repository if needed
    if (!gitIntegration.repositoryManager.isGitRepository) {
      await gitIntegration.repositoryManager.initializeRepository();
    }
    
    // Add GitHub repository as remote using HTTPS with token
    const remoteUrl = repoData.clone_url.replace('https://', `https://${githubPat}@`);
    await gitIntegration.repositoryManager.executeGitCommand(['remote', 'add', 'origin', remoteUrl]);
    
    // Update repository manager state
    gitIntegration.repositoryManager.hasRemote = true;
    gitIntegration.repositoryManager.remoteUrl = remoteUrl;
    gitIntegration.repositoryManager.currentBranch = 'main';
    
    // Create basic Node.js server files
    console.log('\n📝 Creating server files...');
    
    // package.json
    const packageJson = {
      name: repoName,
      version: "1.0.0",
      description: "Simple Node.js server with Express",
      main: "server.js",
      scripts: {
        start: "node server.js",
        test: "echo 'No tests yet'"
      },
      dependencies: {
        express: "^4.18.2"
      }
    };
    
    await fs.writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // server.js
    const serverCode = `const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// About endpoint
app.get('/about', (req, res) => {
  res.json({
    name: '${repoName}',
    version: '1.0.0',
    node: process.version
  });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`;
    
    await fs.writeFile(join(projectDir, 'server.js'), serverCode);
    
    // Create public directory
    await fs.mkdir(join(projectDir, 'public'), { recursive: true });
    
    // index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${repoName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to ${repoName}</h1>
        <p>This is a simple Node.js server created by an AI agent.</p>
        <p>Created at: ${new Date().toLocaleString()}</p>
        <nav>
            <a href="/health">Health Check</a> | 
            <a href="/about">About</a>
        </nav>
    </div>
</body>
</html>`;
    
    await fs.writeFile(join(projectDir, 'public/index.html'), indexHtml);
    
    // style.css
    const styleCss = `body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f0f0f0;
}

.container {
    max-width: 800px;
    margin: 50px auto;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h1 {
    color: #333;
}

nav {
    margin-top: 20px;
}

nav a {
    color: #007bff;
    text-decoration: none;
    margin: 0 10px;
}

nav a:hover {
    text-decoration: underline;
}`;
    
    await fs.writeFile(join(projectDir, 'public/style.css'), styleCss);
    
    // README.md
    const readme = `# ${repoName}

Simple Node.js server created by AI agent.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

The server will run on http://localhost:3000

## Endpoints

- \`GET /\` - Homepage
- \`GET /health\` - Health check (JSON)
- \`GET /about\` - About info (JSON)

## Created

${new Date().toISOString()}
`;
    
    await fs.writeFile(join(projectDir, 'README.md'), readme);
    
    console.log('✅ Files created');
    
    // Track and commit files
    console.log('\n📤 Committing files to Git...');
    
    // Use git commands directly
    const files = [
      'package.json',
      'server.js',
      'public/index.html',
      'public/style.css',
      'README.md'
    ];
    
    // Stage all files
    await gitIntegration.repositoryManager.executeGitCommand(['add', '.']);
    
    // Commit
    const commitMessage = 'Initial commit: Node.js server with Express\n\nCreated by AI agent';
    await gitIntegration.repositoryManager.executeGitCommand(['commit', '-m', commitMessage]);
    
    const commitResult = { success: true, message: 'Files committed' };
    
    console.log('✅ Files committed:', commitResult);
    
    // Push to GitHub
    console.log('\n🚀 Pushing to GitHub...');
    const pushResult = await gitIntegration.repositoryManager.pushToRemote();
    console.log('✅ Pushed to GitHub:', pushResult);
    
    // Display final repository info
    console.log('\n📊 Repository Information:');
    console.log(`🔗 URL: ${repoData.html_url}`);
    console.log(`📝 Name: ${repoData.name}`);
    console.log(`📝 Description: ${repoData.description}`);
    console.log(`🔑 Clone URL: ${repoData.clone_url}`);
    
    console.log('\n🎉 SUCCESS! Repository created and code pushed.');
    console.log(`👀 View your repository at: ${repoData.html_url}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);