#!/usr/bin/env node

/**
 * Script to fix module exports to use default export
 * This ensures all modules follow the standard interface pattern
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixModuleExport(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Skip if already has default export
    if (content.includes('export default')) {
      console.log(`  ✅ ${fileName}: Already has default export`);
      return true;
    }
    
    // Find the class name
    const classMatch = content.match(/(?:export\s+)?class\s+(\w+Module)\s+extends\s+Module/);
    if (!classMatch) {
      console.log(`  ⚠️  ${fileName}: No Module class found`);
      return false;
    }
    
    const className = classMatch[1];
    
    // Remove export from class declaration
    content = content.replace(/export\s+class\s+(\w+Module)\s+extends\s+Module/, 'class $1 extends Module');
    
    // Add default export at the end
    if (!content.endsWith('\n')) {
      content += '\n';
    }
    content += `\nexport default ${className};`;
    
    // Write back
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`  ✅ ${fileName}: Fixed to use default export`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

async function findAndFixModules() {
  const monorepoRoot = path.resolve(__dirname, '../../../..');
  const packagesDir = path.join(monorepoRoot, 'packages');
  
  console.log('🔍 Finding and fixing module exports...\n');
  
  // Get all packages
  const packages = await fs.readdir(packagesDir, { withFileTypes: true });
  
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  
  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;
    
    const packagePath = path.join(packagesDir, pkg.name);
    
    // Find all *Module.js files
    const findCommand = `find "${packagePath}" -name "*Module.js" -type f | grep -v node_modules | grep -v test`;
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(findCommand);
      const files = stdout.trim().split('\n').filter(f => f);
      
      if (files.length === 0 || (files.length === 1 && files[0] === '')) {
        continue;
      }
      
      console.log(`\n📦 Package: ${pkg.name} (${files.length} modules)`);
      
      for (const file of files) {
        const result = await fixModuleExport(file);
        if (result === true) {
          totalFixed++;
        } else if (result === false) {
          totalFailed++;
        }
      }
      
    } catch (error) {
      // No modules found in this package
      continue;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Fixed: ${totalFixed}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log('\n✅ Module export fixing complete!');
}

// Run the script
findAndFixModules().catch(console.error);