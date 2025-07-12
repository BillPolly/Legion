/**
 * Script to split a specific package with a specific step
 * Usage: node scripts/split-package.js <package> <step>
 * 
 * Packages: agent, modules, cli, tools, model-providers, response-parser
 * Steps: init, create, push, all
 */

import { ResourceManager, ModuleFactory } from '@jsenvoy/modules';
import GitHubModule from '../packages/tools/src/github/GitHubModule.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import * as gitTools from './git-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Package definitions
const PACKAGES = {
  'agent': {
    path: path.join(rootDir, 'packages/agent'),
    repoName: 'agent',
    description: 'AI agent implementation with retry logic and tool execution for jsEnvoy'
  },
  'modules': {
    path: path.join(rootDir, 'packages/modules'),
    repoName: 'modules',
    description: 'Core infrastructure with base classes, dependency injection, and module management for jsEnvoy'
  },
  'cli': {
    path: path.join(rootDir, 'packages/cli'),
    repoName: 'cli',
    description: 'Command-line interface for executing jsEnvoy tools with REPL and autocomplete'
  },
  'general-tools': {
    path: path.join(rootDir, 'packages/general-tools'),
    repoName: 'general-tools',
    description: 'Collection of AI agent tools (file operations, web tools, GitHub integration, etc.) for jsEnvoy'
  },
  'model-providers': {
    path: path.join(rootDir, 'packages/model-providers'),
    repoName: 'model-providers',
    description: 'LLM provider integrations (OpenAI, DeepSeek, OpenRouter) for jsEnvoy'
  },
  'response-parser': {
    path: path.join(rootDir, 'packages/response-parser'),
    repoName: 'response-parser',
    description: 'Response parsing and validation utilities for jsEnvoy'
  }
};


function printUsage() {
  console.log('Usage: node scripts/split-package.js <package> <step>\n');
  console.log('Packages:');
  Object.entries(PACKAGES).forEach(([key, pkg]) => {
    console.log(`  ${key.padEnd(15)} - ${pkg.repoName}`);
  });
  console.log('\nSteps:');
  console.log('  check           - Check git repository status and remote');
  console.log('  init            - Initialize git repository');
  console.log('  create          - Create GitHub repository');
  console.log('  push            - Push to GitHub');
  console.log('  all             - Run all steps');
  console.log('\nExamples:');
  console.log('  node scripts/split-package.js agent check');
  console.log('  node scripts/split-package.js agent init');
  console.log('  node scripts/split-package.js agent create');
  console.log('  node scripts/split-package.js agent push');
  console.log('  node scripts/split-package.js agent all');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    printUsage();
    process.exit(1);
  }
  
  const [packageName, step] = args;
  
  // Validate package
  if (!PACKAGES[packageName]) {
    console.error(`Error: Unknown package '${packageName}'\n`);
    printUsage();
    process.exit(1);
  }
  
  // Validate step
  const validSteps = ['check', 'init', 'create', 'push', 'all'];
  if (!validSteps.includes(step)) {
    console.error(`Error: Unknown step '${step}'\n`);
    printUsage();
    process.exit(1);
  }
  
  const pkg = PACKAGES[packageName];
  
  console.log(`Processing package: ${pkg.repoName}`);
  console.log(`Step: ${step}\n`);
  
  try {
    // Initialize ResourceManager (it will automatically load .env)
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Register GitHub resources from environment
    resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    resourceManager.register('GITHUB_ORG', resourceManager.get('env.GITHUB_ORG'));
    resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));

    // Create module using ModuleFactory
    const moduleFactory = new ModuleFactory(resourceManager);
    const githubModule = moduleFactory.createModule(GitHubModule);
    
    // Get the tools from the module
    const tools = githubModule.getTools();
    const polyRepo = tools.find(tool => tool.name === 'polyrepo');
    if (!polyRepo) {
      throw new Error('PolyRepoManager tool not found');
    }

    // Get organization name for display
    const orgName = resourceManager.get('GITHUB_ORG');

    console.log(`Organization: ${orgName}\n`);
    
    // Execute steps based on parameter
    if (step === 'check') {
      console.log('Checking repository status...');
      const status = await gitTools.getRepoStatus(pkg.path);
      
      console.log(`\nPackage: ${pkg.repoName}`);
      console.log(`Path: ${pkg.path}`);
      console.log(`\nGit Status:`);
      
      if (!status.isRepo) {
        console.log('  ✗ Not a git repository');
        console.log('\nRun the following to initialize:');
        console.log(`  node scripts/split-package.js ${packageName} init`);
      } else {
        console.log('  ✓ Valid git repository');
        console.log(`  Branch: ${status.branch}`);
        
        if (status.hasUncommittedChanges) {
          console.log('  ⚠️  Has uncommitted changes');
        }
        if (status.hasUntrackedFiles) {
          console.log('  ⚠️  Has untracked files');
        }
        
        if (!status.hasRemote) {
          console.log('  ✗ No remote configured');
          console.log('\nRun the following to create and push to GitHub:');
          console.log(`  node scripts/split-package.js ${packageName} create`);
          console.log(`  node scripts/split-package.js ${packageName} push`);
        } else {
          console.log('\n  Remotes:');
          status.remotes.forEach(remote => {
            console.log(`    ${remote.name}: ${remote.url}`);
          });
          
          if (status.ahead > 0 || status.behind > 0) {
            console.log(`\n  Sync status with origin/${status.branch}:`);
            if (status.ahead > 0) {
              console.log(`    ${status.ahead} commit(s) ahead`);
            }
            if (status.behind > 0) {
              console.log(`    ${status.behind} commit(s) behind`);
            }
          }
          
          // Check if remote matches expected GitHub repo
          const expectedUrl = `https://github.com/${orgName}/${pkg.repoName}.git`;
          const hasCorrectRemote = status.remotes.some(r => 
            r.url.includes(`${orgName}/${pkg.repoName}`)
          );
          
          if (!hasCorrectRemote) {
            console.log(`\n  ⚠️  Remote doesn't match expected repository`);
            console.log(`  Expected: ${expectedUrl}`);
          } else {
            console.log(`\n  ✓ Remote matches expected repository`);
          }
        }
      }
      
      process.exit(0);
    }
    
    if (step === 'init' || step === 'all') {
      console.log('Step 1: Initializing local repository...');
      await gitTools.preparePackageRepo(pkg.path, pkg.repoName);
      const initResult = await gitTools.initRepo(pkg.path, 'Initial commit', true);
      
      if (initResult.alreadyExists) {
        console.log('✓ Repository already initialized');
        const hasChanges = await gitTools.hasUncommittedChanges(pkg.path);
        if (hasChanges) {
          console.log('⚠️  Warning: Repository has uncommitted changes');
        }
      } else {
        console.log('✓ Repository initialized successfully');
      }
      
      if (step === 'init') {
        console.log('\nDone! Run the following to create the GitHub repository:');
        console.log(`  node scripts/split-package.js ${packageName} create`);
        process.exit(0);
      }
    }
    
    if (step === 'create' || step === 'all') {
      console.log('\nStep 2: Creating GitHub repository...');
      const createResult = await polyRepo.invoke({
        function: {
          name: 'polyrepo_create_org_repo',
          arguments: JSON.stringify({
            orgName: orgName,
            repoName: pkg.repoName,
            description: pkg.description,
            private: true
          })
        }
      });

      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create repository');
      }
      
      const repoData = createResult.data;
      console.log(`✓ Repository created: ${repoData.url}`);
      
      if (step === 'create') {
        console.log('\nDone! Run the following to push the code:');
        console.log(`  node scripts/split-package.js ${packageName} push`);
        process.exit(0);
      }
    }
    
    if (step === 'push' || step === 'all') {
      console.log('\nStep 3: Pushing to GitHub...');
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
      
      console.log(`✓ Successfully pushed to GitHub`);
      console.log(`\nView repository: https://github.com/${orgName}/${pkg.repoName}`);
    }
    
    if (step === 'all') {
      console.log('\n✓ All steps completed successfully!');
    }
    
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});