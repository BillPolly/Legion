#!/usr/bin/env node

/**
 * Script to rename a GitHub repository and update all local references
 * Usage: node scripts/rename-repo.js <package-name> <old-repo-name> <new-repo-name>
 * Example: node scripts/rename-repo.js llm jsenvoy-llm llm
 */

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function updateGitsubtree(packageName, oldRepoName, newRepoName, orgName) {
  const gitsubtreePath = path.join(rootDir, '.gitsubtree');
  let content = await fs.readFile(gitsubtreePath, 'utf8');
  
  const oldEntry = `packages/${packageName} https://github.com/${orgName}/${oldRepoName}.git main`;
  const newEntry = `packages/${packageName} https://github.com/${orgName}/${newRepoName}.git main`;
  
  if (content.includes(oldEntry)) {
    content = content.replace(oldEntry, newEntry);
    await fs.writeFile(gitsubtreePath, content);
    console.log('  ✓ Updated .gitsubtree configuration');
    return true;
  } else {
    console.log('  ⚠ Could not find old entry in .gitsubtree');
    return false;
  }
}

async function updatePackageJson(packageName, oldRepoName, newRepoName, orgName) {
  const packageJsonPath = path.join(rootDir, 'packages', packageName, 'package.json');
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    if (packageJson.repository && packageJson.repository.url) {
      const oldUrl = `https://github.com/${orgName}/${oldRepoName}.git`;
      const newUrl = `https://github.com/${orgName}/${newRepoName}.git`;
      
      if (packageJson.repository.url === oldUrl) {
        packageJson.repository.url = newUrl;
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log('  ✓ Updated package.json repository URL');
        return true;
      }
    }
    console.log('  ⚠ Package.json repository URL did not match expected format');
    return false;
  } catch (error) {
    console.log('  ⚠ Could not update package.json:', error.message);
    return false;
  }
}

async function updateGitRemotes(packageName, oldRepoName, newRepoName, orgName) {
  try {
    // Update the subtree remote
    const oldRemoteName = `subtree-${packageName}`;
    const newUrl = `https://github.com/${orgName}/${newRepoName}.git`;
    
    try {
      // Check if remote exists
      await execAsync(`git remote get-url ${oldRemoteName}`);
      // Update the remote URL
      await execAsync(`git remote set-url ${oldRemoteName} ${newUrl}`);
      console.log(`  ✓ Updated git remote ${oldRemoteName}`);
    } catch {
      console.log(`  ⚠ Remote ${oldRemoteName} not found, skipping`);
    }
    
    return true;
  } catch (error) {
    console.log('  ⚠ Error updating git remotes:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('Usage: node scripts/rename-repo.js <package-name> <old-repo-name> <new-repo-name>');
    console.error('Example: node scripts/rename-repo.js llm jsenvoy-llm llm');
    process.exit(1);
  }
  
  const [packageName, oldRepoName, newRepoName] = args;
  
  console.log(`\n🔄 Renaming repository for ${packageName} package`);
  console.log(`   From: ${oldRepoName}`);
  console.log(`   To: ${newRepoName}\n`);
  
  try {
    // Initialize ResourceManager (it will automatically load .env)
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Register GitHub resources from environment
    resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    resourceManager.register('GITHUB_ORG', resourceManager.get('env.GITHUB_ORG'));
    resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER') || 'unknown');

    const orgName = resourceManager.get('GITHUB_ORG');
    if (!orgName) {
      console.error('❌ GITHUB_ORG not found in environment');
      process.exit(1);
    }

    // Create module using ModuleFactory
    const moduleFactory = new ModuleFactory(resourceManager);
    const githubModule = moduleFactory.createModule(GitHubModule);
    
    // Get the PolyRepoManager tool
    const tools = githubModule.getTools();
    const polyRepo = tools.find(tool => tool.name === 'polyrepo');
    
    if (!polyRepo) {
      console.error('❌ PolyRepoManager tool not found');
      process.exit(1);
    }
    
    console.log('📋 Step 1: Renaming repository on GitHub\n');
    
    const result = await polyRepo.invoke({
      function: {
        name: 'polyrepo_rename_repo',
        arguments: JSON.stringify({
          orgName: orgName,
          oldRepoName: oldRepoName,
          newRepoName: newRepoName
        })
      }
    });

    if (!result.success) {
      console.error(`❌ Failed to rename repository: ${result.error}`);
      process.exit(1);
    }
    
    console.log('  ✓ Repository renamed successfully on GitHub');
    
    console.log('\n📋 Step 2: Updating local references\n');
    
    // Update .gitsubtree
    await updateGitsubtree(packageName, oldRepoName, newRepoName, orgName);
    
    // Update package.json
    await updatePackageJson(packageName, oldRepoName, newRepoName, orgName);
    
    // Update git remotes
    await updateGitRemotes(packageName, oldRepoName, newRepoName, orgName);
    
    console.log('\n✅ Repository rename completed successfully!');
    console.log(`\n📍 New repository URL: https://github.com/${orgName}/${newRepoName}`);
    
    console.log('\n📝 Next steps:');
    console.log('1. Commit the changes:');
    console.log('   git add .');
    console.log(`   git commit -m "Rename ${packageName} repository from ${oldRepoName} to ${newRepoName}"`);
    console.log('2. Push changes to the main repository:');
    console.log('   git push');
    console.log('3. Test subtree operations:');
    console.log('   npm run subtree:push');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});