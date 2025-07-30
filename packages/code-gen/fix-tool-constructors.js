#!/usr/bin/env node

/**
 * Fix tool constructors to follow the correct Legion pattern
 * Tools should set properties after calling super(), not pass config to super()
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixToolConstructor(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check if this file needs fixing - look for super({ pattern
    if (!content.includes('super({')) {
      console.log(`✓ ${path.basename(filePath)} - already fixed or doesn't need fixing`);
      return;
    }

    // Fix the constructor pattern
    let fixed = content;
    
    // Pattern to match super({ ... }) constructor calls
    const superPattern = /super\(\{[\s\S]*?\}\);/m;
    const match = content.match(superPattern);
    
    if (match) {
      const superCall = match[0];
      
      // Extract properties from the super call
      const nameMatch = superCall.match(/name:\s*['"`]([^'"`]+)['"`]/);
      const descMatch = superCall.match(/description:\s*['"`]([^'"`]+)['"`]/);
      const inputSchemaMatch = superCall.match(/inputSchema:\s*(z\.object\([^}]+\}[^}]*\}?\))/);
      const outputSchemaMatch = superCall.match(/outputSchema:\s*(z\.object\([^}]+\}[^}]*\}?\))/);
      
      if (nameMatch) {
        // Build the new constructor
        let newConstructor = 'super();\n';
        newConstructor += `    this.name = '${nameMatch[1]}';\n`;
        
        if (descMatch) {
          newConstructor += `    this.description = '${descMatch[1]}';\n`;
        }
        
        if (inputSchemaMatch) {
          newConstructor += `    this.inputSchema = ${inputSchemaMatch[1]};\n`;
        }
        
        if (outputSchemaMatch) {
          newConstructor += `    this.outputSchema = ${outputSchemaMatch[1]};`;
        }
        
        // Replace the super call
        fixed = content.replace(superPattern, newConstructor);
        
        await fs.writeFile(filePath, fixed);
        console.log(`✅ Fixed ${path.basename(filePath)}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
  }
}

async function fixAllTools() {
  console.log('Fixing tool constructors...\n');
  
  // Find all tool files
  const toolDirs = [
    path.join(__dirname, 'js-generator/src/tools'),
    path.join(__dirname, 'package-manager/src/tools'),
    path.join(__dirname, 'code-analysis/src/tools')
  ];
  
  for (const dir of toolDirs) {
    try {
      const files = await fs.readdir(dir);
      console.log(`\nProcessing ${dir}:`);
      
      for (const file of files) {
        if (file.endsWith('Tool.js')) {
          await fixToolConstructor(path.join(dir, file));
        }
      }
    } catch (error) {
      console.error(`Could not process directory ${dir}: ${error.message}`);
    }
  }
  
  console.log('\nDone!');
}

fixAllTools();