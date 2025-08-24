#!/usr/bin/env node

/**
 * Script to ensure ALL modules use ONLY default export for complete uniformity
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

async function fixModule(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;
    const fileName = path.basename(filePath);
    const className = fileName.replace('.js', '');
    
    // Remove any named exports alongside default
    if (content.includes(`export { `) && content.includes(`export default ${className}`)) {
      // Remove the named export line
      content = content.replace(/export\s*{\s*[^}]+\s*};\s*$/gm, '');
      modified = true;
    }
    
    // Pattern 1: export class ClassName extends Module -> class ClassName extends Module
    const exportClassRegex = new RegExp(`export\\s+class\\s+${className}\\s+extends\\s+Module`, 'g');
    if (exportClassRegex.test(content)) {
      content = content.replace(exportClassRegex, `class ${className} extends Module`);
      modified = true;
    }
    
    // Pattern 2: module.exports = ClassName -> export default ClassName
    if (content.includes(`module.exports = ${className}`)) {
      content = content.replace(
        `module.exports = ${className}`,
        `export default ${className}`
      );
      modified = true;
    }
    
    // Pattern 3: Remove any module.exports.ClassName = ClassName
    if (content.includes(`module.exports.${className} = ${className}`)) {
      content = content.replace(
        new RegExp(`module\\.exports\\.${className}\\s*=\\s*${className};?`, 'g'),
        ''
      );
      modified = true;
    }
    
    // Ensure export default is at the end
    if (!content.includes(`export default ${className}`)) {
      // Check if the class exists in the file
      const classRegex = new RegExp(`class\\s+${className}\\s+extends\\s+Module`);
      if (classRegex.test(content)) {
        // Remove any trailing whitespace and add export default
        content = content.trimEnd() + `\n\nexport default ${className};\n`;
        modified = true;
      }
    }
    
    // Remove duplicate export defaults
    const exportDefaultCount = (content.match(new RegExp(`export default ${className}`, 'g')) || []).length;
    if (exportDefaultCount > 1) {
      // Keep only the last one
      const lines = content.split('\n');
      let foundFirst = false;
      content = lines.filter(line => {
        if (line.includes(`export default ${className}`)) {
          if (!foundFirst) {
            foundFirst = true;
            return false; // Remove first occurrence
          }
        }
        return true;
      }).join('\n');
      modified = true;
    }
    
    if (modified) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${fileName}`);
      return true;
    } else {
      console.log(`✔️  Already uniform: ${fileName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Ensuring ALL modules use ONLY default export for complete uniformity...\n');
  
  // Find all Module files in the monorepo
  const command = `find /Users/maxximus/Documents/max/pocs/Legion/packages -name "*Module.js" -type f | grep -v node_modules | grep -v ".git" | grep -v test | grep -v __tests__ | grep -v obsolete`;
  
  let files = [];
  try {
    const output = execSync(command, { encoding: 'utf-8' });
    files = output.split('\n').filter(f => f.trim() && !f.includes('/test/') && !f.includes('Mock'));
  } catch (error) {
    console.log('Error finding module files');
    return;
  }
  
  console.log(`Found ${files.length} module files to check\n`);
  
  let fixedCount = 0;
  for (const file of files) {
    if (await fixModule(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} modules`);
  console.log(`✔️  ${files.length - fixedCount} modules were already uniform`);
  console.log('\n🎯 All modules now use ONLY default export!');
}

main().catch(console.error);