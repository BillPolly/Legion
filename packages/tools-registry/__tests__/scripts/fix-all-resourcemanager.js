#!/usr/bin/env node

/**
 * Script to fix ResourceManager singleton usage across the entire monorepo
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

async function fixFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;
    
    // Skip the ResourceManager.js file itself
    if (filePath.includes('resource-manager/src/ResourceManager.js')) {
      return false;
    }
    
    // Pattern 1: new ResourceManager() followed by await initialize()
    if (content.includes('new ResourceManager()')) {
      // Pattern with const/let/var and await on separate line
      content = content.replace(
        /(const|let|var)\s+(\w+)\s*=\s*new ResourceManager\(\);\s*await \2\.initialize\(\);/g,
        '$1 $2 = await ResourceManager.getResourceManager();'
      );
      
      // Pattern with const/let/var and immediate await
      content = content.replace(
        /(const|let|var)\s+(\w+)\s*=\s*await\s*new ResourceManager\(\)\.initialize\(\);/g,
        '$1 $2 = await ResourceManager.getResourceManager();'
      );
      
      // Pattern without initialization
      content = content.replace(
        /(const|let|var)\s+(\w+)\s*=\s*new ResourceManager\(\);/g,
        '$1 $2 = ResourceManager.getInstance();'
      );
      
      // Direct new ResourceManager() usage
      content = content.replace(
        /= new ResourceManager\(\)/g,
        '= ResourceManager.getInstance()'
      );
      
      modified = content.includes('ResourceManager.getInstance()') || 
                 content.includes('ResourceManager.getResourceManager()');
    }
    
    if (modified) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing ResourceManager singleton usage across monorepo...\n');
  
  // Find all JS files that use new ResourceManager()
  const command = `find /Users/maxximus/Documents/max/pocs/Legion/packages -name "*.js" -type f | xargs grep -l "new ResourceManager()" | grep -v node_modules | grep -v ".git" | grep -v resource-manager/src/ResourceManager.js`;
  
  let files = [];
  try {
    const output = execSync(command, { encoding: 'utf-8' });
    files = output.split('\n').filter(f => f.trim());
  } catch (error) {
    console.log('No files found or error searching');
    return;
  }
  
  console.log(`Found ${files.length} files to check\n`);
  
  let fixedCount = 0;
  for (const file of files) {
    if (await fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} files`);
  console.log(`⏭️  Skipped ${files.length - fixedCount} files`);
}

main().catch(console.error);