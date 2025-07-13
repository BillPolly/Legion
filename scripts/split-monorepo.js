/**
 * Script to split jsEnvoy monorepo into separate GitHub repositories
 * Uses the PolyRepoManager tool to create and push individual packages
 */

import { ResourceManager } from '@jsenvoy/modules';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import * as gitTools from './git-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function main() {
  console.log('Starting monorepo split process...\n');

  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  
  // Load environment variables from .env file
  const envPath = path.join(rootDir, '.env');
  try {
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
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    process.exit(1);
  }

  // Initialize GitHub module
  const githubModule = new GitHubModule(resourceManager);
  await githubModule.initialize();
  
  // Get the PolyRepoManager tool
  const polyRepo = githubModule.getTools().find(tool => tool.name === 'polyrepo');
  if (!polyRepo) {
    console.error('PolyRepoManager tool not found');
    process.exit(1);
  }

  // Define packages to split
  const packages = [
    {
      path: path.join(rootDir, 'packages/modules'),
      repoName: 'jsenvoy-modules',
      description: 'Core infrastructure with base classes, dependency injection, and module management for jsEnvoy'
    },
    {
      path: path.join(rootDir, 'packages/cli'),
      repoName: 'jsenvoy-cli',
      description: 'Command-line interface for executing jsEnvoy tools with REPL and autocomplete'
    },
    {
      path: path.join(rootDir, 'packages/general-tools'),
      repoName: 'general-tools',
      description: 'Collection of AI agent tools (file operations, web tools, GitHub integration, etc.) for jsEnvoy'
    },
    {
      path: path.join(rootDir, 'packages/response-parser'),
      repoName: 'jsenvoy-response-parser',
      description: 'Response parsing and validation utilities for jsEnvoy'
    },
    {
      path: path.join(rootDir, 'packages/agent'),
      repoName: 'jsenvoy-agent',
      description: 'AI agent implementation with retry logic and tool execution for jsEnvoy'
    }
  ];

  // Get the organization name
  const orgName = resourceManager.get('github.org') || 
                  resourceManager.get('env.GITHUB_ORG');
  
  if (!orgName) {
    console.error('GitHub organization not found. Please set GITHUB_ORG in .env');
    process.exit(1);
  }

  console.log(`Organization: ${orgName}`);
  console.log(`Packages to process: ${packages.length}\n`);

  // Process each package individually
  const results = [];
  const errors = [];

  for (const pkg of packages) {
    console.log(`\nProcessing ${pkg.repoName}...`);
    
    try {
      // Check if package directory exists
      const stats = await fs.stat(pkg.path);
      if (!stats.isDirectory()) {
        throw new Error(`${pkg.path} is not a directory`);
      }

      // Prepare package for standalone repo
      console.log('  1. Preparing package for standalone repository...');
      await gitTools.preparePackageRepo(pkg.path, pkg.repoName);

      // Initialize local repo
      console.log('  2. Initializing local repository...');
      const initResult = await gitTools.initRepo(pkg.path, 'Initial commit');
      
      // If already a repo, check for uncommitted changes
      if (initResult.alreadyExists) {
        const hasChanges = await gitTools.hasUncommittedChanges(pkg.path);
        if (hasChanges) {
          console.log('  Warning: Repository has uncommitted changes');
        }
      }

      // Create remote repository
      console.log('  3. Creating remote repository...');
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

      // Push to remote
      console.log('  4. Pushing to remote repository...');
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

      console.log(`  ✓ Successfully created and pushed ${pkg.repoName}`);
      results.push({
        package: pkg.repoName,
        url: `https://github.com/${orgName}/${pkg.repoName}`,
        status: 'success'
      });

    } catch (error) {
      console.error(`  ✗ Failed to process ${pkg.repoName}: ${error.message}`);
      errors.push({
        package: pkg.repoName,
        error: error.message,
        status: 'failed'
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total packages: ${packages.length}`);
  console.log(`Successful: ${results.length}`);
  console.log(`Failed: ${errors.length}`);

  if (results.length > 0) {
    console.log('\nSuccessfully created repositories:');
    for (const result of results) {
      console.log(`  - ${result.package}: ${result.url}`);
    }
  }

  if (errors.length > 0) {
    console.log('\nFailed packages:');
    for (const error of errors) {
      console.log(`  - ${error.package}: ${error.error}`);
    }
  }

  console.log('\nDone!');
  process.exit(errors.length > 0 ? 1 : 0);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});