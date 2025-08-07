#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '../../../module-loader/src/index.js';
import GitHubModule from '../../../general-tools/src/github/GitHubModule.js';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Register GitHub resources
resourceManager.register('GITHUB_PAT', resourceManager.env.GITHUB_PAT);
resourceManager.register('GITHUB_ORG', resourceManager.env.GITHUB_ORG || 'Bill234');
resourceManager.register('GITHUB_USER', resourceManager.env.GITHUB_USER || 'Bill234');

// Create module using ModuleFactory
const moduleFactory = new ModuleFactory(resourceManager);
const githubModule = moduleFactory.createModule(GitHubModule);

// Get the GitHub tool
const tools = githubModule.getTools();
const githubTool = tools.find(tool => tool.name === 'github');

const GITHUB_PAT = resourceManager.env.GITHUB_PAT;
const repoName = 'test-express-railway';
const workDir = path.join(__dirname, 'github-test-output');

console.log('🚀 Creating GitHub Repository with Express App\n');

// Step 1: Create working directory
console.log('📁 Creating working directory...');
await fs.rm(workDir, { recursive: true, force: true });
await fs.mkdir(workDir, { recursive: true });

// Step 2: Create Express app files
console.log('📝 Creating Express app files...');

// Create server.js
const serverCode = `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Railway! This is a test Express app.');
});

app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    message: 'Railway deployment successful!',
    version: '1.0.0'
  });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;

await fs.writeFile(path.join(workDir, 'server.js'), serverCode);

// Create package.json
const packageJson = {
  name: repoName,
  version: "1.0.0",
  description: "Simple Express server for Railway deployment",
  main: "server.js",
  scripts: {
    start: "node server.js"
  },
  dependencies: {
    express: "^4.18.2"
  },
  engines: {
    node: ">=14.0.0"
  }
};

await fs.writeFile(
  path.join(workDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Create .gitignore
const gitignore = `node_modules/
.env
.DS_Store
*.log
`;

await fs.writeFile(path.join(workDir, '.gitignore'), gitignore);

// Create README.md
const readme = `# Test Express Railway

Simple Express.js application for Railway deployment testing.

## Endpoints

- \`/\` - Homepage with welcome message
- \`/status\` - JSON status endpoint

## Deployment

This app is designed to be deployed on Railway.
`;

await fs.writeFile(path.join(workDir, 'README.md'), readme);

console.log('✅ App files created\n');

// Step 3: Initialize git repository
console.log('🔧 Initializing git repository...');
process.chdir(workDir);

await exec('git init');
await exec('git add .');
await exec('git commit -m "Initial commit: Express app for Railway"');
await exec('git branch -M main');

console.log('✅ Git repository initialized\n');

// Step 4: Create GitHub repository
console.log('📦 Creating GitHub repository...');

const createResult = await githubTool.invoke({
  function: {
    name: 'github_create_repo',
    arguments: JSON.stringify({
      repoName: repoName,
      description: 'Test Express app for Railway deployment',
      private: false,
      autoInit: false
    })
  }
});

if (!createResult.success) {
  console.error('❌ Failed to create repository:', createResult.error);
  process.exit(1);
}

console.log('✅ Repository created successfully\n');

// Step 5: Push to GitHub
console.log('📤 Pushing to GitHub...');
await exec(`git remote add origin https://github.com/Bill234/${repoName}.git`);
await exec('git push -u origin main');
console.log('✅ Code pushed to GitHub\n');

// Step 6: Verify repository exists and has content
console.log('🔍 Verifying repository...');

// Check repository
const repoResponse = await fetch(`https://api.github.com/repos/Bill234/${repoName}`, {
  headers: {
    'Authorization': `token ${GITHUB_PAT}`,
    'Accept': 'application/vnd.github.v3+json'
  }
});

if (!repoResponse.ok) {
  console.error('❌ Repository not found!');
  process.exit(1);
}

const repo = await repoResponse.json();
console.log('✅ Repository verified:');
console.log(`   Name: ${repo.name}`);
console.log(`   URL: ${repo.html_url}`);
console.log(`   Default branch: ${repo.default_branch}`);

// Check contents
const contentsResponse = await fetch(`https://api.github.com/repos/Bill234/${repoName}/contents`, {
  headers: {
    'Authorization': `token ${GITHUB_PAT}`,
    'Accept': 'application/vnd.github.v3+json'
  }
});

if (!contentsResponse.ok) {
  console.error('❌ Could not read repository contents!');
  process.exit(1);
}

const contents = await contentsResponse.json();
console.log('\n📂 Repository contents:');
contents.forEach(item => {
  console.log(`   - ${item.name} (${item.type})`);
});

// Verify critical files
const requiredFiles = ['server.js', 'package.json', 'README.md', '.gitignore'];
const fileNames = contents.map(item => item.name);
const missingFiles = requiredFiles.filter(file => !fileNames.includes(file));

if (missingFiles.length > 0) {
  console.error(`\n❌ Missing required files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

console.log('\n✅ All required files present!');

// Output summary
console.log('\n' + '='.repeat(50));
console.log('✅ GitHub repository ready for Railway deployment!');
console.log('='.repeat(50));
console.log(`Repository: https://github.com/Bill234/${repoName}`);
console.log(`Clone URL: https://github.com/Bill234/${repoName}.git`);
console.log('\nYou can now use this repository with Railway:');
console.log(`- Repository name: Bill234/${repoName}`);
console.log('- Branch: main');
console.log('='.repeat(50));

// Clean up working directory
process.chdir(__dirname);
await fs.rm(workDir, { recursive: true, force: true });