#!/usr/bin/env node

/**
 * Improved script to refactor files from ToolResult patterns to modern error handling
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
    const trimmedArgs = args.trim();
    return `return ${trimmedArgs};`;
  });
  
  // Find all ToolResult.failure() patterns with variable assignment
  // This handles patterns like:
  // const someResult = ToolResult.failure('message');
  // someResult.prop = value;
  // return someResult;
  const complexFailureRegex = /const\s+(\w+)\s*=\s*ToolResult\.failure\(([\s\S]*?)\);([\s\S]*?)return\s+\1;/g;
  content = content.replace(complexFailureRegex, (match, varName, errorMsg, middle) => {
    modified = true;
    
    // Extract additional properties
    const propsRegex = new RegExp(`${varName}\\.(\\w+)\\s*=\\s*([^;]+);`, 'g');
    const additionalProps = {};
    let propMatch;
    while ((propMatch = propsRegex.exec(middle)) !== null) {
      additionalProps[propMatch[1]] = propMatch[2];
    }
    
    // Build the cause object
    let causeObj = '{\n          errorType: \'operation_error\'';
    for (const [key, value] of Object.entries(additionalProps)) {
      causeObj += `,\n          ${key}: ${value}`;
    }
    causeObj += '\n        }';
    
    return `throw new Error(${errorMsg.trim()}, {\n        cause: ${causeObj}\n      });`;
  });
  
  // Handle remaining standalone ToolResult.failure calls
  const standaloneFailureRegex = /(?:const\s+\w+\s*=\s*)?ToolResult\.failure\(([\s\S]*?)\)(?:\s*;)?/g;
  content = content.replace(standaloneFailureRegex, (match, args) => {
    // Skip if it's part of a larger pattern we already handled
    if (match.includes('return')) return match;
    
    modified = true;
    return `throw new Error(${args.trim()}, {\n        cause: {\n          errorType: 'operation_error'\n        }\n      })`;
  });
  
  // Simple failure returns
  const simpleFailureRegex = /return\s+ToolResult\.failure\((.*?)\);/g;
  content = content.replace(simpleFailureRegex, (match, args) => {
    modified = true;
    return `throw new Error(${args}, {\n      cause: {\n        errorType: 'operation_error'\n      }\n    });`;
  });
  
  // Remove success field from return objects
  const successFieldRegex = /success:\s*true,?\s*\n\s*/g;
  content = content.replace(successFieldRegex, () => {
    modified = true;
    return '';
  });
  
  // Handle emitError, emitInfo, emitProgress, emitWarning calls
  // Just comment them out for now since Tool base class doesn't have them
  const emitRegex = /this\.emit(Error|Info|Progress|Warning)\([^)]*\);/g;
  content = content.replace(emitRegex, (match) => {
    modified = true;
    return `// ${match}`;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Refactored ${path.basename(filePath)}`);
    return true;
  } else {
    console.log(`⊘ No changes needed for ${path.basename(filePath)}`);
    return false;
  }
}

// Get file paths from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node refactor-toolresult-v2.js <file1> [file2] ...');
  console.log('Or: node refactor-toolresult-v2.js --dir <directory>');
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