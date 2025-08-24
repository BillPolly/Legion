#!/usr/bin/env node

/**
 * Script to fix modules that were broken by the previous script
 */

import fs from 'fs/promises';
import path from 'path';

const brokenModules = [
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/file/FileModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/github/GitHubModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/serper/SerperModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/server-starter/ServerStarterModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/system/SystemModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/encode/EncodeModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/file-analysis/FileAnalysisModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/command-executor/CommandExecutorModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/ai-generation/AIGenerationModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/sd/src/SDModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/picture-analysis/src/PictureAnalysisModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/mongo-query/src/MongoQueryModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/code-gen/js-generator/src/JSGeneratorModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/code-gen/jester/src/JesterModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/code-gen/code-analysis/src/CodeAnalysisModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/aiur/src/modules/MCPModule.js'
];

async function fixModule(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const className = fileName.replace('.js', '');
    
    // Remove incomplete comment lines at the end
    content = content.replace(/\/\/ Also export.*\n?$/m, '');
    content = content.replace(/\/\/ Export the module.*\n?$/m, '');
    
    // Ensure file ends properly with export default
    content = content.trimEnd();
    
    // Check if export default is missing
    if (!content.includes(`export default ${className}`)) {
      content += `\n\nexport default ${className};\n`;
    } else {
      // Ensure proper ending
      content += '\n';
    }
    
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing modules that were broken by truncation...\n');
  
  let fixedCount = 0;
  for (const file of brokenModules) {
    if (await fixModule(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} modules`);
}

main().catch(console.error);