#!/usr/bin/env node

/**
 * Script to refactor files from ToolResult patterns to modern error handling
 * This script will:
 * 1. Remove ToolResult from imports
 * 2. Replace ToolResult.success() with direct returns
 * 3. Replace ToolResult.failure() with throw new Error() with cause
 */

import fs from 'fs';
import path from 'path';

function refactorFile(filePath) {
  console.log(`Refactoring ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Remove ToolResult from imports
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*['"]@legion\/tools-registry['"]/g;
  content = content.replace(importRegex, (match, imports) => {
    const importList = imports.split(',').map(i => i.trim());
    const filteredImports = importList.filter(i => !i.startsWith('ToolResult'));
    if (filteredImports.length !== importList.length) {
      modified = true;
      return `import { ${filteredImports.join(', ')} } from '@legion/tools-registry'`;
    }
    return match;
  });
  
  // Find all ToolResult.success() calls and replace them
  const successRegex = /return\s+ToolResult\.success\(([\s\S]*?)\);/g;
  content = content.replace(successRegex, (match, args) => {
    modified = true;
    // Clean up the arguments - if it's just a value, return it directly
    const trimmedArgs = args.trim();
    if (trimmedArgs.startsWith('{')) {
      return `return ${trimmedArgs};`;
    } else {
      return `return ${trimmedArgs};`;
    }
  });
  
  // Find ToolResult.failure() patterns and convert to throw
  // Pattern 1: Simple failure with message
  const simpleFailureRegex = /return\s+ToolResult\.failure\(\s*([^)]+)\s*\);/g;
  content = content.replace(simpleFailureRegex, (match, args) => {
    modified = true;
    return `throw new Error(${args}, {
      cause: {
        errorType: 'operation_error'
      }
    });`;
  });
  
  // Pattern 2: Failure with assignment to variable
  const assignFailureRegex = /const\s+(\w+)\s*=\s*ToolResult\.failure\((.*?)\);[\s\S]*?return\s+\1;/g;
  content = content.replace(assignFailureRegex, (match, varName, errorMsg) => {
    modified = true;
    
    // Extract additional properties that were being set
    const propsRegex = new RegExp(`${varName}\\.(\\w+)\\s*=\\s*([^;]+);`, 'g');
    const additionalProps = {};
    let propMatch;
    while ((propMatch = propsRegex.exec(match)) !== null) {
      additionalProps[propMatch[1]] = propMatch[2];
    }
    
    // Build the cause object
    let causeObj = '{\n        errorType: \'operation_error\'';
    for (const [key, value] of Object.entries(additionalProps)) {
      causeObj += `,\n        ${key}: ${value}`;
    }
    causeObj += '\n      }';
    
    return `throw new Error(${errorMsg}, {
      cause: ${causeObj}
    });`;
  });
  
  // Remove success field from return objects
  const successFieldRegex = /success:\s*true,?\s*\n\s*/g;
  content = content.replace(successFieldRegex, (match) => {
    modified = true;
    return '';
  });
  
  // Update execute method signature if using invoke pattern
  if (content.includes('async invoke(toolCall)') && !content.includes('async execute(')) {
    const invokeMethodRegex = /async\s+invoke\(toolCall\)\s*\{([\s\S]*?)\n\s*\}/g;
    let hasExecuteMethod = false;
    
    content = content.replace(invokeMethodRegex, (match, methodBody) => {
      if (!hasExecuteMethod) {
        modified = true;
        hasExecuteMethod = true;
        
        // Create execute method
        let executeMethod = `/**
   * Execute the tool with the given parameters
   * This is the main entry point for single-function tools
   */
  async execute(args) {${methodBody}
  }
  
  /**
   * Legacy invoke method for compatibility
   */
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      return await this.execute(args);
    } catch (error) {
      throw error;
    }
  }`;
        
        return executeMethod;
      }
      return match;
    });
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Refactored ${path.basename(filePath)}`);
    return true;
  } else {
    console.log(`⊘ No changes needed for ${path.basename(filePath)}`);
    return false;
  }
}

// Get file paths from command line arguments or use default
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node refactor-toolresult.js <file1> [file2] ...');
  console.log('Or: node refactor-toolresult.js --dir <directory>');
  process.exit(1);
}

let filesToProcess = [];

if (args[0] === '--dir' && args[1]) {
  // Process all .js files in directory
  const dirPath = args[1];
  const files = fs.readdirSync(dirPath);
  filesToProcess = files
    .filter(f => f.endsWith('.js'))
    .map(f => path.join(dirPath, f));
} else {
  // Process specified files
  filesToProcess = args;
}

console.log(`Processing ${filesToProcess.length} files...`);
console.log('');

let refactoredCount = 0;
for (const file of filesToProcess) {
  if (fs.existsSync(file)) {
    if (refactorFile(file)) {
      refactoredCount++;
    }
  } else {
    console.log(`⚠ File not found: ${file}`);
  }
}

console.log('');
console.log(`Complete! Refactored ${refactoredCount} of ${filesToProcess.length} files.`);