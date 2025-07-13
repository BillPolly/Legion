/**
 * Script to split jsEnvoy monorepo with preserved git history
 * Uses git subtree to maintain commit history for each package
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import GitHubModule from '../../packages/general-tools/src/github/GitHubModule.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import * as gitTools from '../utils/git-tools.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

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

async function splitPackageWithHistory(pkg, polyRepo, orgName, tempDir) {
  console.log(`\nProcessing ${pkg.repoName} with history preservation...`);
  
  const tempPackagePath = path.join(tempDir, pkg.repoName);
  
  try {
    // Extract package with history using git subtree
    console.log('  1. Extracting package with git history...');
    const relativePath = path.relative(rootDir, pkg.path);
    await gitTools.extractWithHistory(rootDir, relativePath, tempPackagePath);
    
    // Prepare package for standalone repo
    console.log('  2. Preparing package for standalone repository...');
    await gitTools.preparePackageRepo(tempPackagePath, pkg.repoName);
    
    // Add and commit any changes from preparation
    const hasChanges = await gitTools.hasUncommittedChanges(tempPackagePath);
    if (hasChanges) {
      await execAsync('git add .', { cwd: tempPackagePath });
      await execAsync('git commit -m "Prepare package for standalone repository"', { cwd: tempPackagePath });
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
          packagePath: tempPackagePath,
          orgName: orgName,
          repoName: pkg.repoName,
          branch: 'main'
        })
      }
    });

    if (!pushResult.success) {
      throw new Error(pushResult.error || 'Failed to push to repository');
    }
    
    console.log(`  ✓ Successfully created and pushed ${pkg.repoName} with history`);
    return {
      success: true,
      package: pkg.repoName,
      url: `https://github.com/${orgName}/${pkg.repoName}`
    };
    
  } catch (error) {
    console.error(`  ✗ Failed to process ${pkg.repoName}: ${error.message}`);
    return {
      success: false,
      package: pkg.repoName,
      error: error.message
    };
  }
}

async function main() {
  console.log('Starting monorepo split with history preservation...\n');

  // Create temp directory for extracted packages
  const tempDir = path.join(rootDir, '.split-temp');
  await fs.mkdir(tempDir, { recursive: true });

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

    console.log(`Organization: ${orgName}`);

    // Define packages
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

    console.log(`Packages to process: ${packages.length}\n`);

    // Process packages
    const results = [];
    for (const pkg of packages) {
      const result = await splitPackageWithHistory(pkg, polyRepo, orgName, tempDir);
      results.push(result);
    }

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total packages: ${packages.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\nSuccessfully created repositories:');
      for (const result of successful) {
        console.log(`  - ${result.package}: ${result.url}`);
      }
    }

    if (failed.length > 0) {
      console.log('\nFailed packages:');
      for (const result of failed) {
        console.log(`  - ${result.package}: ${result.error}`);
      }
    }

    process.exit(failed.length > 0 ? 1 : 0);

  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('\nCleaned up temporary files');
    } catch (error) {
      console.error('Warning: Failed to clean up temp directory:', error.message);
    }
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});