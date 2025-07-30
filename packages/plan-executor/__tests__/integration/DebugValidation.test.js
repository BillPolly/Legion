/**
 * Debug test to understand validation failure
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';
import CodeAnalysisModule from '../../../code-gen/code-analysis/src/CodeAnalysisModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Debug Validation', () => {
  let resourceManager;
  let codeAnalysisModule;
  let testDir;
  
  beforeAll(async () => {
    testDir = path.join(__dirname, '..', 'tmp', 'code-gen-comprehensive-test');
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create module
    codeAnalysisModule = await CodeAnalysisModule.create(resourceManager);
    console.log(`📦 Code Analysis module: ${codeAnalysisModule.getTools().length} tools`);
  });
  
  test('should validate the generated calculator.js file', async () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // Get the validate_javascript tool
      const tools = codeAnalysisModule.getTools();
      const validateTool = tools.find(tool => tool.name === 'validate_javascript');
      expect(validateTool).toBeDefined();
      
      // Execute validation exactly as the plan would
      const result = await validateTool.execute({
        filePath: "./src/calculator.js",
        projectPath: "./",
        includeAnalysis: true,
        checkSecurity: true,
        checkPerformance: true
      });
      
      console.log('Validation result:', JSON.stringify(result, null, 2));
      
      // Check what the tool returns
      expect(result).toBeDefined();
      
    } finally {
      process.chdir(originalCwd);
    }
  });
});