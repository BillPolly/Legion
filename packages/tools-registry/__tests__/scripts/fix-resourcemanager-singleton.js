#!/usr/bin/env node

/**
 * Script to fix ResourceManager singleton usage in test files
 */

import fs from 'fs/promises';
import path from 'path';

async function fixFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;
    
    // Pattern 1: new ResourceManager() followed by await initialize()
    if (content.includes('new ResourceManager()')) {
      content = content.replace(
        /resourceManager = new ResourceManager\(\);\s*await resourceManager\.initialize\(\);/g,
        'resourceManager = await ResourceManager.getResourceManager();'
      );
      
      // Pattern 2: Just new ResourceManager()
      content = content.replace(
        /= new ResourceManager\(\);/g,
        '= ResourceManager.getInstance();'
      );
      
      modified = true;
    }
    
    // Pattern 3: const resourceManager = ResourceManager.getInstance()
    if (content.includes('const resourceManager = ResourceManager.getInstance()')) {
      content = content.replace(
        /const resourceManager = new ResourceManager\(\);\s*await resourceManager\.initialize\(\);/g,
        'const resourceManager = await ResourceManager.getResourceManager();'
      );
      modified = true;
    }
    
    if (modified) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`⏭️  Skipped: ${path.basename(filePath)} (no changes needed)`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

async function main() {
  const testFiles = [
    '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-registry/__tests__/uat/UserAcceptance.test.js',
    '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-registry/__tests__/integration/ToolRegistry.simple.test.js',
    '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-registry/__tests__/integration/SystemHealth.test.js',
    '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-registry/__tests__/integration/PerspectiveIntegration.test.js',
    '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-registry/__tests__/integration/EndToEnd.test.js',
    '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-registry/__tests__/integration/ToolRegistry.integration.test.js',
    '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-registry/__tests__/integration/PackageIntegration.test.js'
  ];
  
  console.log('🔧 Fixing ResourceManager singleton usage in test files...\n');
  
  let fixedCount = 0;
  for (const file of testFiles) {
    if (await fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} files`);
}

main().catch(console.error);