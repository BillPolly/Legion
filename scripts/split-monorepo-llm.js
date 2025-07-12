/**
 * Script to add the llm package to the jsEnvoy polyrepo structure
 * Uses the PolyRepoManager tool to create and push the package
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
  console.log('Adding llm package to polyrepo structure...\n');

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
          // Also register without env prefix for module dependencies
          resourceManager.register(key, value);
        }
      }
    }
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    process.exit(1);
  }

  // Get dependencies for GitHub module
  const dependencies = {
    GITHUB_PAT: resourceManager.get('GITHUB_PAT'),
    GITHUB_ORG: resourceManager.get('GITHUB_ORG'),
    GITHUB_USER: resourceManager.get('GITHUB_USER') || 'unknown'
  };

  // Initialize GitHub module with dependencies
  const githubModule = new GitHubModule(dependencies);
  await githubModule.initialize();
  
  // Get the PolyRepoManager tool
  const polyRepo = githubModule.getTools().find(tool => tool.name === 'polyrepo');
  if (!polyRepo) {
    console.error('PolyRepoManager tool not found');
    process.exit(1);
  }

  // Define the llm package
  const pkg = {
    path: path.join(rootDir, 'packages/llm'),
    repoName: 'jsenvoy-llm',
    description: 'LLM client package with retry logic and error handling for jsEnvoy'
  };

  // Get the organization name
  const orgName = dependencies.GITHUB_ORG;
  
  if (!orgName) {
    console.error('GitHub organization not found. Please set GITHUB_ORG in .env');
    process.exit(1);
  }

  console.log(`Organization: ${orgName}`);
  console.log(`Package: ${pkg.repoName}\n`);

  try {
    // Check if package directory exists
    const stats = await fs.stat(pkg.path);
    if (!stats.isDirectory()) {
      throw new Error(`${pkg.path} is not a directory`);
    }

    // Prepare package for standalone repo
    console.log('1. Preparing package for standalone repository...');
    await gitTools.preparePackageRepo(pkg.path, pkg.repoName);

    // Initialize local repo
    console.log('2. Initializing local repository...');
    const initResult = await gitTools.initRepo(pkg.path, 'Initial commit', true);
    
    // Create remote repository
    console.log('3. Creating remote repository...');
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
    console.log('4. Pushing to remote repository...');
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

    console.log(`\n✓ Successfully created and pushed ${pkg.repoName}`);
    console.log(`  Repository URL: https://github.com/${orgName}/${pkg.repoName}`);
    
    console.log('\nNext steps:');
    console.log('1. Update .gitsubtree file to add:');
    console.log(`   packages/llm https://github.com/${orgName}/${pkg.repoName}.git main`);
    console.log('2. Run: npm run subtree:setup');
    console.log('3. Establish subtree connection:');
    console.log('   git add .');
    console.log('   git commit -m "Add llm package"');
    console.log(`   git subtree push --prefix=packages/llm https://github.com/${orgName}/${pkg.repoName}.git main`);

  } catch (error) {
    console.error(`\n✗ Failed to process ${pkg.repoName}: ${error.message}`);
    process.exit(1);
  }

  console.log('\nDone!');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});