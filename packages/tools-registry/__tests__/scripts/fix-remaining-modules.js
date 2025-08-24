#!/usr/bin/env node

/**
 * Script to fix modules that still use named export instead of default export
 */

import fs from 'fs/promises';
import path from 'path';

const modulesToFix = [
  '/Users/maxximus/Documents/max/pocs/Legion/packages/code-gen/code-analysis/src/CodeAnalysisModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/code-gen/jester/src/JesterModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/code-gen/js-generator/src/JSGeneratorModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/calculator/CalculatorModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/file/FileModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/github/GitHubModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/server-starter/ServerStarterModule.js'
];

async function fixModule(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;
    const fileName = path.basename(filePath);
    const className = fileName.replace('.js', '');
    
    // Pattern 1: export class ClassName extends Module -> class ClassName extends Module + export default
    if (content.includes(`export class ${className} extends Module`)) {
      content = content.replace(
        `export class ${className} extends Module`,
        `class ${className} extends Module`
      );
      
      // Add export default at the end if not present
      if (!content.includes(`export default ${className}`)) {
        content += `\nexport default ${className};\n`;
      }
      
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
    
    if (modified) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${fileName}`);
      return true;
    } else {
      console.log(`⏭️  Skipped: ${fileName} (no changes needed)`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing remaining modules to use default export...\n');
  
  let fixedCount = 0;
  for (const file of modulesToFix) {
    if (await fixModule(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} modules`);
}

main().catch(console.error);