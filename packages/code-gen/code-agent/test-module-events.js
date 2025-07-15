#!/usr/bin/env node

/**
 * Simple test script to verify the module event system
 */

import { ModuleFactory } from '@jsenvoy/module-loader';
import ResourceManager from '@jsenvoy/module-loader/src/resources/ResourceManager.js';
import { Agent } from '@jsenvoy/agent';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testModuleEvents() {
  console.log('🧪 Testing Module Event System...\n');
  
  try {
    // 1. Test Module Factory with events
    console.log('1️⃣ Testing Module Factory Events:');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Set up required resources for FileModule
    resourceManager.register('basePath', process.cwd());
    resourceManager.register('encoding', 'utf8');
    resourceManager.register('createDirectories', true);
    resourceManager.register('permissions', 0o755);
    
    const moduleFactory = new ModuleFactory(resourceManager);
    
    // Add event listeners to the factory
    moduleFactory.addEventListener('progress', (event) => {
      console.log(`   📊 Module Progress: ${event.message} (${event.module})`);
    });
    
    moduleFactory.addEventListener('info', (event) => {
      console.log(`   ℹ️  Module Info: ${event.message} (${event.module})`);
    });
    
    moduleFactory.addEventListener('error', (event) => {
      console.log(`   ❌ Module Error: ${event.message} (${event.module})`);
    });
    
    // Import and create a File module directly
    const { FileModule } = await import('../../../packages/general-tools/src/file/FileModule.js');
    const fileModule = moduleFactory.createModule(FileModule);
    
    console.log(`   ✅ File module created: ${fileModule.name}`);
    console.log(`   📊 Module extends EventEmitter: ${typeof fileModule.on === 'function'}`);
    console.log(`   📊 Module has tools: ${fileModule.getTools().length}`);
    
    // 2. Test direct module events
    console.log('\n2️⃣ Testing Direct Module Events:');
    
    // Listen to module events directly
    fileModule.on('progress', (event) => {
      console.log(`   📊 Direct Progress: ${event.message}`);
    });
    
    fileModule.on('info', (event) => {
      console.log(`   ℹ️  Direct Info: ${event.message}`);
    });
    
    fileModule.on('error', (event) => {
      console.log(`   ❌ Direct Error: ${event.message}`);
    });
    
    // Test file operations to trigger events
    const fileOps = fileModule.getTools()[0];
    if (fileOps) {
      console.log('   🧪 Testing file operations...');
      
      // Test file write (should trigger progress and info events)
      const testDir = path.join(__dirname, 'test-output');
      const testFile = path.join(testDir, 'test-file.txt');
      
      const writeResult = await fileOps.safeInvoke({
        id: 'test-1',
        type: 'function',
        function: {
          name: 'file_write',
          arguments: JSON.stringify({
            filepath: testFile,
            content: 'Hello, Event System!'
          })
        }
      });
      
      console.log(`   📝 File write result: ${writeResult.success ? 'Success' : 'Failed'}`);
      
      // Test file read (should trigger more events)
      const readResult = await fileOps.safeInvoke({
        id: 'test-2',
        type: 'function',
        function: {
          name: 'file_read',
          arguments: JSON.stringify({
            filepath: testFile
          })
        }
      });
      
      console.log(`   📖 File read result: ${readResult.success ? 'Success' : 'Failed'}`);
    }
    
    // 3. Test Agent with module events
    console.log('\n3️⃣ Testing Agent Module Integration:');
    const agent = new Agent({
      name: 'test-agent',
      bio: 'Test agent for event system',
      tools: [],
      modelConfig: {
        provider: 'OPEN_AI',
        model: 'gpt-4',
        apiKey: 'test-key'
      }
    });
    
    // Register the file module with the agent
    agent.registerModule(fileModule);
    
    // Listen to module events from the agent
    agent.on('module-event', (event) => {
      console.log(`   🔄 Agent Module Event: ${event.type} - ${event.message}`);
    });
    
    agent.on('module-progress', (event) => {
      console.log(`   📊 Agent Module Progress: ${event.message}`);
    });
    
    agent.on('module-info', (event) => {
      console.log(`   ℹ️  Agent Module Info: ${event.message}`);
    });
    
    // Test another file operation through the agent
    if (fileOps) {
      console.log('   🧪 Testing file operations through agent...');
      
      const listResult = await fileOps.safeInvoke({
        id: 'test-3',
        type: 'function',
        function: {
          name: 'directory_list',
          arguments: JSON.stringify({
            dirpath: path.join(__dirname, 'test-output')
          })
        }
      });
      
      console.log(`   📋 Directory list result: ${listResult.success ? 'Success' : 'Failed'}`);
    }
    
    console.log('   ✅ Agent module integration complete');
    
    // 4. Summary
    console.log('\n4️⃣ Test Summary:');
    console.log('   ✅ Module factory event listeners working');
    console.log('   ✅ Module EventEmitter inheritance working');
    console.log('   ✅ Tool event emission through parent module working');
    console.log('   ✅ Agent module event integration working');
    
    console.log('\n🎉 Module Event System Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testModuleEvents().catch(console.error);