#!/usr/bin/env node

/**
 * Fix duplicate default exports in modules
 * Removes the trailing "export default" when class is already exported with "export default class"
 */

import fs from 'fs/promises';
import path from 'path';

const modulesToFix = [
  '/Users/maxximus/Documents/max/pocs/Legion/packages/mongo-query/src/MongoQueryModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/picture-analysis/src/PictureAnalysisModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/sd/src/SDModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/ai-generation/AIGenerationModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/encode/EncodeModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/file-analysis/FileAnalysisModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/serper/SerperModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/server-starter/ServerStarterModule.js',
  '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/system/SystemModule.js'
];

async function fixDuplicateExport(filePath) {
  try {
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Check if there's "export default class" somewhere
    const hasExportDefaultClass = lines.some(line => 
      line.includes('export default class') || 
      line.includes('export default function')
    );
    
    if (!hasExportDefaultClass) {
      console.log(`⚠️  No export default class found in ${path.basename(filePath)}`);
      return false;
    }
    
    // Check if there's a duplicate export at the end
    const lastNonEmptyLineIndex = lines.findLastIndex(line => line.trim() !== '');
    const lastLine = lines[lastNonEmptyLineIndex];
    
    if (lastLine && lastLine.trim().startsWith('export default ') && 
        !lastLine.includes('class') && !lastLine.includes('function')) {
      // Remove the duplicate export
      lines[lastNonEmptyLineIndex] = '';
      
      // Remove trailing empty lines
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
      }
      
      // Add single newline at end
      lines.push('');
      
      await fs.writeFile(filePath, lines.join('\n'));
      console.log(`✅ Fixed ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`✓  ${path.basename(filePath)} - no duplicate export found`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Fixing duplicate default exports...\n');
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const modulePath of modulesToFix) {
    const fixed = await fixDuplicateExport(modulePath);
    if (fixed) fixedCount++;
    else if (fixed === false) errorCount++;
  }
  
  console.log(`\n✅ Fixed ${fixedCount} modules`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} modules had issues or were already correct`);
  }
}

main().catch(console.error);