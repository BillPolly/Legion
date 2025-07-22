#!/usr/bin/env node

/**
 * Script to add any package to the jsEnvoy polyrepo structure with hierarchical support
 * Usage: node scripts/add-hierarchical-package-to-polyrepo.js <package-path> <repo-name> [--keep-name]
 * Example: node scripts/add-hierarchical-package-to-polyrepo.js apps/web-frontend web-frontend
 * Example: node scripts/add-hierarchical-package-to-polyrepo.js apps/web-backend web-backend
 * Example: node scripts/add-hierarchical-package-to-polyrepo.js llm llm --keep-name
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

async function updateGitsubtree(packagePath, repoName, orgName) {
  const gitsubtreePath = path.join(rootDir, 'scripts', 'config', 'gitsubtree.config');
  const content = await fs.readFile(gitsubtreePath, 'utf8');
  const newEntry = `packages/${packagePath} https://github.com/${orgName}/${repoName}.git main`;
  
  if (!content.includes(newEntry)) {
    await fs.appendFile(gitsubtreePath, `\n${newEntry}`);
    console.log('  ✓ Updated gitsubtree.config');
  } else {
    console.log('  ℹ gitsubtree.config already contains entry');
  }
}

async function ensurePackageNaming(packageFullPath, packagePath) {
  const packageJsonPath = path.join(packageFullPath, 'package.json');
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const expectedName = `@jsenvoy/${packagePath.replace(/\//g, '-')}`;
    
    if (packageJson.name !== expectedName) {
      packageJson.name = expectedName;
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`  ✓ Updated package name to ${expectedName}`);
    }
    
    return packageJson;
  } catch (error) {
    console.warn('  ⚠ Could not read/update package.json:', error.message);
    return null;
  }
}

async function cleanupGitDirectory(packageFullPath) {
  const gitPath = path.join(packageFullPath, '.git');
  try {
    const stats = await fs.stat(gitPath);
    if (stats.isDirectory()) {
      await fs.rm(gitPath, { recursive: true, force: true });
      console.log('  ✓ Removed existing .git directory');
      return true;
    }
  } catch {
    // .git doesn't exist, that's fine
  }
  return false;
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/add-hierarchical-package-to-polyrepo.js <package-path> <repo-name> [--keep-name]');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/add-hierarchical-package-to-polyrepo.js apps/web-frontend web-frontend');
    console.error('  node scripts/add-hierarchical-package-to-polyrepo.js apps/web-backend web-backend');
    console.error('  node scripts/add-hierarchical-package-to-polyrepo.js llm llm --keep-name');
    console.error('');
    console.error('Parameters:');
    console.error('  package-path: Relative path from packages/ (e.g., apps/web-frontend)');
    console.error('  repo-name: Name of the GitHub repository to create');
    console.error('  --keep-name: Use repo-name as-is instead of adding jsenvoy- prefix');
    process.exit(1);
  }

  const packagePath = args[0];  // e.g., "apps/web-frontend"
  const repoNameArg = args[1];  // e.g., "web-frontend"
  const keepOriginalName = args.includes('--keep-name');
  const repoName = keepOriginalName ? repoNameArg : `jsenvoy-${repoNameArg}`;
  const packageFullPath = path.join(rootDir, 'packages', packagePath);

  console.log(`\n🚀 Adding ${packagePath} to polyrepo structure\n`);
  console.log(`   Package path: packages/${packagePath}`);
  console.log(`   Repository name: ${repoName}\n`);

  // Validate package exists
  try {
    const stats = await fs.stat(packageFullPath);
    if (!stats.isDirectory()) {
      throw new Error(`${packageFullPath} is not a directory`);
    }
  } catch (error) {
    console.error(`❌ Package directory not found: ${packageFullPath}`);
    console.error(`   Make sure the package exists at packages/${packagePath}`);
    process.exit(1);
  }

  // Initialize ResourceManager and load environment
  const resourceManager = new ResourceManager();
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
          resourceManager.register(key, value);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error loading .env file:', error.message);
    console.error('   Please ensure .env exists with GITHUB_PAT and GITHUB_ORG');
    process.exit(1);
  }

  // Get dependencies for GitHub module
  const dependencies = {
    GITHUB_PAT: resourceManager.get('GITHUB_PAT'),
    GITHUB_ORG: resourceManager.get('GITHUB_ORG'),
    GITHUB_USER: resourceManager.get('GITHUB_USER') || 'unknown'
  };

  const orgName = dependencies.GITHUB_ORG;
  if (!orgName) {
    console.error('❌ GITHUB_ORG not found in .env');
    process.exit(1);
  }

  // Initialize GitHub module
  const githubModule = new GitHubModule(dependencies);
  await githubModule.initialize();
  
  const polyRepo = githubModule.getTools().find(tool => tool.name === 'polyrepo');
  if (!polyRepo) {
    console.error('❌ PolyRepoManager tool not found');
    process.exit(1);
  }

  try {
    console.log('📋 Step 1: Preparing package\n');
    
    // Update package.json naming
    const packageJson = await ensurePackageNaming(packageFullPath, packagePath);
    const description = packageJson?.description || `${packagePath} package for jsEnvoy`;
    
    // Ensure .gitignore exists
    await gitTools.ensureGitignore(packageFullPath);
    
    // Clean up any existing .git directory
    await cleanupGitDirectory(packageFullPath);

    console.log('\n📦 Step 2: Creating GitHub repository\n');
    
    // Prepare package for standalone repo
    await gitTools.preparePackageRepo(packageFullPath, repoName, orgName);

    // Initialize local repo with force to ensure clean state
    const initResult = await gitTools.initRepo(packageFullPath, 'Initial commit', true);
    
    // Create remote repository
    console.log(`  Creating ${repoName} in ${orgName} organization...`);
    const createResult = await polyRepo.invoke({
      function: {
        name: 'polyrepo_create_org_repo',
        arguments: JSON.stringify({
          orgName: orgName,
          repoName: repoName,
          description: description,
          private: false
        })
      }
    });

    if (!createResult.success) {
      // Check if it's because repo already exists
      if (createResult.error && createResult.error.includes('already exists')) {
        console.log('  ℹ Repository already exists, continuing...');
      } else {
        throw new Error(createResult.error || 'Failed to create repository');
      }
    } else {
      console.log('  ✓ Repository created successfully');
    }

    console.log('\n🔄 Step 3: Pushing to remote\n');
    
    // Push to remote
    const pushResult = await polyRepo.invoke({
      function: {
        name: 'polyrepo_push_package',
        arguments: JSON.stringify({
          packagePath: packageFullPath,
          orgName: orgName,
          repoName: repoName,
          branch: 'main'
        })
      }
    });

    if (!pushResult.success) {
      throw new Error(pushResult.error || 'Failed to push to repository');
    }
    console.log('  ✓ Code pushed successfully');

    console.log('\n🌳 Step 4: Setting up subtree\n');
    
    // Update .gitsubtree
    await updateGitsubtree(packagePath, repoName, orgName);
    
    // Clean up the .git directory again to prepare for subtree
    await cleanupGitDirectory(packageFullPath);

    console.log('\n✅ Success! Package added to polyrepo structure');
    console.log(`\n📍 Repository URL: https://github.com/${orgName}/${repoName}`);
    
    console.log('\n📝 Next steps:');
    console.log('1. Run: npm run subtree:setup');
    console.log('2. Commit changes:');
    console.log('   git add .');
    console.log(`   git commit -m "Add ${packagePath} package to polyrepo structure"`);
    console.log('3. Push to subtree:');
    console.log(`   git subtree push --prefix=packages/${packagePath} https://github.com/${orgName}/${repoName}.git main`);
    console.log('\n💡 Tip: Use npm run subtree:push to push all subtrees at once');

  } catch (error) {
    console.error(`\n❌ Failed to process ${packagePath}: ${error.message}`);
    
    // Provide helpful error messages
    if (error.message.includes('Resource') && error.message.includes('not found')) {
      console.error('\n💡 Make sure your .env file contains:');
      console.error('   GITHUB_PAT=your_personal_access_token');
      console.error('   GITHUB_ORG=BillPolly');
      console.error('   GITHUB_USER=your_github_username (optional)');
    }
    
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});