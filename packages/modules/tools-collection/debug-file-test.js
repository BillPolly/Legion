#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ResourceManager } from '@legion/resource-manager';
import FileModule from './src/file/FileModule.js';

async function debugFileModule() {
  try {
    console.log('🔍 Debugging FileModule...\n');
    
    // Create test directory
    const testDir = path.join(os.tmpdir(), 'debug-file-test', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    console.log('✅ Created test directory:', testDir);
    
    // Create test file
    await fs.writeFile(path.join(testDir, 'test.txt'), 'Hello World Test Content');
    console.log('✅ Created test file');
    
    // Get ResourceManager and create FileModule
    const resourceManager = await ResourceManager.getInstance();
    console.log('✅ Got ResourceManager');
    
    const fileModule = await FileModule.create(resourceManager);
    console.log('✅ Created FileModule');
    
    // Override basePath for testing
    fileModule.config.basePath = testDir;
    fileModule.setBasePath(testDir);
    console.log('✅ Set basePath to:', testDir);
    
    // Check tool registration
    const tools = fileModule.getTools();
    console.log(`\n📋 Registered tools (${tools.length}):`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.constructor.name}`);
    });
    
    // Debug tool configuration
    const fileReadTool = fileModule.getTool('file_read');
    console.log(`\n🔍 Tool configuration:`);
    console.log(`  - tool.basePath: ${fileReadTool.basePath}`);
    console.log(`  - tool.config: ${JSON.stringify(fileReadTool.config)}`);
    console.log(`  - module.config: ${JSON.stringify(fileModule.config)}`);
    
    // Test path resolution manually
    const testFilePath = 'test.txt';
    const resolvedPath = fileReadTool.resolvePath(testFilePath);
    console.log(`  - resolvePath("${testFilePath}") -> "${resolvedPath}"`);
    console.log(`  - file exists: ${await fs.access(resolvedPath).then(() => true).catch(() => false)}`);
    console.log(`  - actual file: ${path.join(testDir, 'test.txt')}`);
    console.log(`  - paths match: ${resolvedPath === path.join(testDir, 'test.txt')}`);
    
    // Test file_read operation
    console.log('\n🧪 Testing file_read operation...');
    const result = await fileModule.invoke('file_read', { filePath: 'test.txt' });
    
    console.log('📊 Result structure:');
    console.log(`  - success: ${result.success}`);
    console.log(`  - error: ${result.error || 'none'}`);
    console.log(`  - data: ${JSON.stringify(result.data, null, 2)}`);
    
    if (result.success) {
      console.log('\n✅ FILE READ SUCCESS!');
      console.log(`Content: "${result.data.content}"`);
      console.log(`Path: "${result.data.path}"`);
    } else {
      console.log('\n❌ FILE READ FAILED!');
      console.log(`Error: ${result.error}`);
    }
    
    // Cleanup
    await fs.rm(testDir, { recursive: true });
    console.log('\n🧹 Cleaned up test directory');
    
  } catch (error) {
    console.error('💥 Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugFileModule();