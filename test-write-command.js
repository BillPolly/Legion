import { ResourceManager, ModuleFactory } from '@jsenvoy/modules';
import FileModule from './packages/general-tools/src/file/FileModule.js';
import fs from 'fs/promises';

async function testWriteCommand() {
  console.log('Testing write command flow...\n');
  
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Register file module dependencies
  resourceManager.register('basePath', process.cwd());
  resourceManager.register('encoding', 'utf-8');
  resourceManager.register('createDirectories', false);
  resourceManager.register('permissions', 0o755);
  
  // Create module instance
  const moduleFactory = new ModuleFactory(resourceManager);
  const fileModule = moduleFactory.createModule(FileModule);
  
  // Get the file operations tool
  const tools = fileModule.getTools();
  const fileTool = tools[0];
  
  console.log('Tool name:', fileTool.name);
  console.log('Tool functions:', fileTool.getAllToolDescriptions().map(d => d.function.name));
  
  // Test 1: Direct invoke with proper arguments
  console.log('\n=== Test 1: Direct invoke ===');
  const result1 = await fileTool.invoke({
    function: {
      name: 'file_write',
      arguments: JSON.stringify({
        filepath: 'test-direct.txt',
        content: 'Direct test content'
      })
    }
  });
  console.log('Result:', result1);
  
  // Check if file exists
  try {
    const content = await fs.readFile('test-direct.txt', 'utf-8');
    console.log('File content:', content);
    await fs.unlink('test-direct.txt');
    console.log('✓ Test 1 passed: File was created and deleted');
  } catch (e) {
    console.error('✗ Test 1 failed: File was not created');
  }
  
  // Test 2: Simulate CLI command parsing
  console.log('\n=== Test 2: Simulated CLI args ===');
  const cliArgs = {
    filepath: 'test-cli.txt',
    content: 'hello world'
  };
  
  const result2 = await fileTool.invoke({
    function: {
      name: 'file_write',
      arguments: JSON.stringify(cliArgs)
    }
  });
  console.log('Result:', result2);
  
  // Check if file exists
  try {
    const content = await fs.readFile('test-cli.txt', 'utf-8');
    console.log('File content:', content);
    await fs.unlink('test-cli.txt');
    console.log('✓ Test 2 passed: File was created and deleted');
  } catch (e) {
    console.error('✗ Test 2 failed: File was not created');
  }
  
  // Test 3: Empty content
  console.log('\n=== Test 3: Empty content ===');
  const result3 = await fileTool.invoke({
    function: {
      name: 'file_write',
      arguments: JSON.stringify({
        filepath: 'test-empty.txt',
        content: ''
      })
    }
  });
  console.log('Result:', result3);
  
  try {
    await fs.stat('test-empty.txt');
    await fs.unlink('test-empty.txt');
    console.log('✓ Test 3 passed: Empty file was created');
  } catch (e) {
    console.error('✗ Test 3 failed: Empty file was not created');
  }
}

testWriteCommand().catch(console.error);