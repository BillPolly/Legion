/**
 * Test that FileModule registers individual tools correctly
 */

import { describe, it, expect } from '@jest/globals';
import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import FileModule from '../../../general-tools/src/file/FileModule.js';

describe('FileModule Individual Tools Test', () => {
  it('should register individual tools instead of multi-function tool', async () => {
    // Initialize ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load the file module
    await moduleLoader.loadModuleByName('file', FileModule);
    
    // Get all tools
    const tools = await moduleLoader.getAllTools();
    console.log('Available tools:', tools.map(t => t.name));
    
    // Check for individual tools
    expect(moduleLoader.hasTool('file_read')).toBe(true);
    expect(moduleLoader.hasTool('file_write')).toBe(true);
    expect(moduleLoader.hasTool('directory_current')).toBe(true);
    expect(moduleLoader.hasTool('directory_list')).toBe(true);
    expect(moduleLoader.hasTool('directory_change')).toBe(true);
    expect(moduleLoader.hasTool('directory_create')).toBe(true);
    
    // The old multi-function tool should not be registered
    expect(moduleLoader.hasTool('file_operations')).toBe(false);
  });
  
  it('should execute directory_current tool', async () => {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load the file module
    await moduleLoader.loadModuleByName('file', FileModule);
    
    // Execute directory_current
    const result = await moduleLoader.executeTool('directory_current', {});
    
    console.log('Current directory result:', result);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.currentDirectory).toBeDefined();
    expect(typeof result.data.currentDirectory).toBe('string');
  });
  
  it('should execute file_write tool', async () => {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load the file module
    await moduleLoader.loadModuleByName('file', FileModule);
    
    // Write a test file
    const testFile = '/tmp/test-individual-tools.txt';
    const result = await moduleLoader.executeTool('file_write', {
      filepath: testFile,
      content: 'Testing individual tools'
    });
    
    console.log('File write result:', result);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.filepath).toBe(testFile);
    expect(result.data.bytesWritten).toBe(24);
  });
});