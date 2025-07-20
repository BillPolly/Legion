#!/usr/bin/env node

import { ResourceManager } from '../../../module-loader/src/index.js';
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

const GITHUB_PAT = resourceManager.get('env.GITHUB_PAT');
const repoName = 'test-express-railway';
const orgName = 'AgentResults';
const workDir = path.join(__dirname, 'agentresults-output');

console.log('🚀 Creating GitHub Repository in AgentResults Organization\n');

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
  res.send('Hello from Railway! This Express app is deployed from AgentResults org.');
});

app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    message: 'Railway deployment successful!',
    version: '1.0.0',
    organization: 'AgentResults'
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
  description: "Simple Express server for Railway deployment from AgentResults org",
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
Created by jsEnvoy Code Agent in the AgentResults organization.

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
await exec('git commit -m "Initial commit: Express app for Railway deployment"');
await exec('git branch -M main');

console.log('✅ Git repository initialized\n');

// Step 4: Create GitHub repository in AgentResults org
console.log(`📦 Creating GitHub repository in ${orgName} organization...`);

const createResponse = await fetch(`https://api.github.com/orgs/${orgName}/repos`, {
  method: 'POST',
  headers: {
    'Authorization': `token ${GITHUB_PAT}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: repoName,
    description: 'Test Express app for Railway deployment - created by jsEnvoy',
    private: false,
    has_issues: true,
    has_projects: false,
    has_wiki: false
  })
});

if (!createResponse.ok) {
  const error = await createResponse.text();
  console.error('❌ Failed to create repository:', error);
  process.exit(1);
}

const repo = await createResponse.json();
console.log('✅ Repository created successfully');
console.log(`   URL: ${repo.html_url}\n`);

// Step 5: Push to GitHub
console.log('📤 Pushing to GitHub...');
await exec(`git remote add origin ${repo.clone_url}`);
await exec('git push -u origin main');
console.log('✅ Code pushed to GitHub\n');

// Step 6: Verify repository exists and has content
console.log('🔍 Verifying repository...');

// Wait a moment for GitHub to process
await new Promise(resolve => setTimeout(resolve, 2000));

// Check repository
const verifyResponse = await fetch(`https://api.github.com/repos/${orgName}/${repoName}`, {
  headers: {
    'Authorization': `token ${GITHUB_PAT}`,
    'Accept': 'application/vnd.github.v3+json'
  }
});

if (!verifyResponse.ok) {
  console.error('❌ Repository not found!');
  process.exit(1);
}

const verifiedRepo = await verifyResponse.json();
console.log('✅ Repository verified:');
console.log(`   Name: ${verifiedRepo.name}`);
console.log(`   Organization: ${verifiedRepo.owner.login}`);
console.log(`   URL: ${verifiedRepo.html_url}`);
console.log(`   Default branch: ${verifiedRepo.default_branch}`);

// Check contents
const contentsResponse = await fetch(`https://api.github.com/repos/${orgName}/${repoName}/contents`, {
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
console.log('\n' + '='.repeat(60));
console.log('✅ GitHub repository ready for Railway deployment!');
console.log('='.repeat(60));
console.log(`Organization: ${orgName}`);
console.log(`Repository: ${verifiedRepo.html_url}`);
console.log(`Clone URL: ${verifiedRepo.clone_url}`);
console.log('\nFor Railway deployment use:');
console.log(`- Repository: ${orgName}/${repoName}`);
console.log('- Branch: main');
console.log('='.repeat(60));

// Clean up working directory
process.chdir(__dirname);
await fs.rm(workDir, { recursive: true, force: true });