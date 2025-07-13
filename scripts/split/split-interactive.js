/**
 * Interactive script to split jsEnvoy monorepo step by step
 * Allows processing individual packages with manual verification at each stage
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import GitHubModule from '../../packages/general-tools/src/github/GitHubModule.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import * as gitTools from '../utils/git-tools.js';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Package definitions
const PACKAGES = {
  'agent': {
    path: path.join(rootDir, 'packages/agent'),
    repoName: 'jsenvoy-agent',
    description: 'AI agent implementation with retry logic and tool execution for jsEnvoy'
  },
  'modules': {
    path: path.join(rootDir, 'packages/modules'),
    repoName: 'jsenvoy-modules',
    description: 'Core infrastructure with base classes, dependency injection, and module management for jsEnvoy'
  },
  'cli': {
    path: path.join(rootDir, 'packages/cli'),
    repoName: 'jsenvoy-cli',
    description: 'Command-line interface for executing jsEnvoy tools with REPL and autocomplete'
  },
  'general-tools': {
    path: path.join(rootDir, 'packages/general-tools'),
    repoName: 'general-tools',
    description: 'Collection of AI agent tools (file operations, web tools, GitHub integration, etc.) for jsEnvoy'
  },
  'response-parser': {
    path: path.join(rootDir, 'packages/response-parser'),
    repoName: 'jsenvoy-response-parser',
    description: 'Response parsing and validation utilities for jsEnvoy'
  }
};

async function loadEnvironment(resourceManager) {
  const envPath = path.join(rootDir, '.env');
  const envContent = await fs.readFile(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        resourceManager.register(`env.${key}`, value);
      }
    }
  }
}

async function selectPackage() {
  console.log('\nAvailable packages:');
  Object.entries(PACKAGES).forEach(([key, pkg]) => {
    console.log(`  ${key.padEnd(15)} - ${pkg.repoName}`);
  });
  
  const answer = await question('\nWhich package would you like to process? (or "all" for all packages): ');
  
  if (answer.toLowerCase() === 'all') {
    return Object.entries(PACKAGES).map(([key, pkg]) => ({ key, ...pkg }));
  }
  
  if (PACKAGES[answer]) {
    return [{ key: answer, ...PACKAGES[answer] }];
  }
  
  console.log('Invalid package name. Please try again.');
  return selectPackage();
}

async function confirmAction(message) {
  const answer = await question(`\n${message} (y/n): `);
  return answer.toLowerCase() === 'y';
}

async function processPackageStep(pkg, polyRepo, orgName, step) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${pkg.repoName}`);
  console.log(`${'='.repeat(60)}`);
  
  const state = {
    initialized: false,
    repoCreated: false,
    pushed: false,
    repoUrl: null
  };
  
  try {
    // Step 1: Initialize local repository
    if (step === 'all' || step === 'init') {
      console.log('\nStep 1: Initialize local repository');
      console.log(`  Path: ${pkg.path}`);
      
      if (await confirmAction('Initialize git repository?')) {
        await gitTools.preparePackageRepo(pkg.path, pkg.repoName);
        const initResult = await gitTools.initRepo(pkg.path, 'Initial commit');
        
        if (initResult.alreadyExists) {
          console.log('  ✓ Repository already initialized');
          const hasChanges = await gitTools.hasUncommittedChanges(pkg.path);
          if (hasChanges) {
            console.log('  ⚠️  Warning: Repository has uncommitted changes');
          }
        } else {
          console.log('  ✓ Repository initialized successfully');
        }
        state.initialized = true;
        
        if (step === 'init') {
          return { success: true, state };
        }
      } else {
        console.log('  ⏭️  Skipped initialization');
        if (step === 'init') return { success: false, state };
      }
    }
    
    // Step 2: Create GitHub repository
    if (step === 'all' || step === 'create') {
      console.log('\nStep 2: Create GitHub repository');
      console.log(`  Organization: ${orgName}`);
      console.log(`  Repository: ${pkg.repoName}`);
      console.log(`  Description: ${pkg.description}`);
      
      if (await confirmAction('Create GitHub repository?')) {
        const createResult = await polyRepo.invoke({
          function: {
            name: 'polyrepo_create_org_repo',
            arguments: JSON.stringify({
              orgName: orgName,
              repoName: pkg.repoName,
              description: pkg.description,
              private: false
            })
          }
        });

        if (!createResult.success) {
          throw new Error(createResult.error || 'Failed to create repository');
        }
        
        const repoData = createResult.data;
        state.repoUrl = repoData.url;
        state.repoCreated = true;
        
        console.log(`  ✓ Repository created: ${repoData.url}`);
        console.log(`  Clone URL: ${repoData.cloneUrl}`);
        
        if (step === 'create') {
          return { success: true, state };
        }
      } else {
        console.log('  ⏭️  Skipped repository creation');
        if (step === 'create') return { success: false, state };
      }
    }
    
    // Step 3: Push to GitHub
    if (step === 'all' || step === 'push') {
      console.log('\nStep 3: Push to GitHub repository');
      console.log(`  Local: ${pkg.path}`);
      console.log(`  Remote: ${orgName}/${pkg.repoName}`);
      
      if (await confirmAction('Push to GitHub?')) {
        const pushResult = await polyRepo.invoke({
          function: {
            name: 'polyrepo_push_package',
            arguments: JSON.stringify({
              packagePath: pkg.path,
              orgName: orgName,
              repoName: pkg.repoName,
              branch: 'main'
            })
          }
        });

        if (!pushResult.success) {
          throw new Error(pushResult.error || 'Failed to push to repository');
        }
        
        state.pushed = true;
        console.log(`  ✓ Successfully pushed to GitHub`);
        console.log(`  View at: https://github.com/${orgName}/${pkg.repoName}`);
        
        if (step === 'push') {
          return { success: true, state };
        }
      } else {
        console.log('  ⏭️  Skipped push');
        if (step === 'push') return { success: false, state };
      }
    }
    
    console.log('\n✓ Package processing complete!');
    return { success: true, state };
    
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    return { success: false, state, error: error.message };
  }
}

async function main() {
  console.log('jsEnvoy Interactive Monorepo Splitter');
  console.log('=====================================\n');
  
  try {
    // Initialize ResourceManager and load environment
    const resourceManager = new ResourceManager();
    await loadEnvironment(resourceManager);

    // Initialize GitHub module
    const githubModule = new GitHubModule(resourceManager);
    await githubModule.initialize();
    
    // Get the PolyRepoManager tool
    const polyRepo = githubModule.getTools().find(tool => tool.name === 'polyrepo');
    if (!polyRepo) {
      throw new Error('PolyRepoManager tool not found');
    }

    // Get organization name
    const orgName = resourceManager.get('github.org') || 
                    resourceManager.get('env.GITHUB_ORG');
    
    if (!orgName) {
      throw new Error('GitHub organization not found in configuration');
    }

    console.log(`GitHub Organization: ${orgName}`);
    
    let continueProcessing = true;
    
    while (continueProcessing) {
      // Select package(s) to process
      const packages = await selectPackage();
      
      // Select processing mode
      console.log('\nProcessing options:');
      console.log('  1. Process all steps');
      console.log('  2. Initialize only');
      console.log('  3. Create repository only');
      console.log('  4. Push only');
      
      const mode = await question('\nSelect option (1-4): ');
      const stepMap = {
        '1': 'all',
        '2': 'init',
        '3': 'create',
        '4': 'push'
      };
      
      const step = stepMap[mode] || 'all';
      
      // Process selected packages
      for (const pkg of packages) {
        const result = await processPackageStep(pkg, polyRepo, orgName, step);
        
        if (!result.success && packages.length > 1) {
          const continueWithNext = await confirmAction('Continue with next package?');
          if (!continueWithNext) break;
        }
      }
      
      // Ask if user wants to continue
      continueProcessing = await confirmAction('\nProcess another package?');
    }
    
    console.log('\nThank you for using the interactive splitter!');
    rl.close();
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nInterrupted by user');
  rl.close();
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});