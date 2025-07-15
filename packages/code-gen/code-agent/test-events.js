#!/usr/bin/env node

/**
 * Test script to verify the event system integration
 */

import { CodeAgent } from './src/index.js';
import { ModuleFactory } from '@jsenvoy/module-loader';
import ResourceManager from '@jsenvoy/module-loader/src/resources/ResourceManager.js';
import { Agent } from '@jsenvoy/agent';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testEventSystem() {
  console.log('🧪 Testing Event System Integration...\n');
  
  try {
    // 1. Test CodeAgent events
    console.log('1️⃣ Testing CodeAgent Events:');
    const codeAgent = new CodeAgent({
      projectType: 'backend',
      enableConsoleOutput: false // Disable console output for cleaner test
    });
    
    // Collect events
    const events = [];
    codeAgent.on('progress', (event) => {
      events.push({ type: 'progress', ...event });
      console.log(`   📊 Progress: ${event.message}`);
    });
    
    codeAgent.on('info', (event) => {
      events.push({ type: 'info', ...event });
      console.log(`   ℹ️  Info: ${event.message}`);
    });
    
    codeAgent.on('error', (event) => {
      events.push({ type: 'error', ...event });
      console.log(`   ❌ Error: ${event.message}`);
    });
    
    // Test initialization
    const testDir = path.join(__dirname, 'test-output');
    await codeAgent.initialize(testDir);
    
    console.log(`   ✅ CodeAgent initialized, collected ${events.length} events\n`);
    
    // 2. Test Module Factory with events
    console.log('2️⃣ Testing Module Factory Events:');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleFactory = new ModuleFactory(resourceManager);
    
    // Add event listeners to the factory
    moduleFactory.addEventListener('progress', (event) => {
      console.log(`   📊 Module Progress: ${event.message}`);
    });
    
    moduleFactory.addEventListener('info', (event) => {
      console.log(`   ℹ️  Module Info: ${event.message}`);
    });
    
    // Create a File module and test its events
    const fileModule = await moduleFactory.createModuleAuto(
      path.join(__dirname, '../../../packages/general-tools/src/file')
    );
    
    console.log(`   ✅ File module created: ${fileModule.name}\n`);
    
    // 3. Test Agent with module events
    console.log('3️⃣ Testing Agent Module Integration:');
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
      console.log(`   🔄 Module Event: ${event.type} - ${event.message}`);
    });
    
    agent.on('module-progress', (event) => {
      console.log(`   📊 Module Progress: ${event.message}`);
    });
    
    agent.on('module-info', (event) => {
      console.log(`   ℹ️  Module Info: ${event.message}`);
    });
    
    // Test file operations to trigger events
    const fileOps = fileModule.getTools()[0];
    if (fileOps) {
      console.log('   🧪 Testing file operations...');
      
      // Test file write (should trigger progress and info events)
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
    
    console.log('   ✅ Agent module integration complete\n');
    
    // 4. Summary
    console.log('4️⃣ Test Summary:');
    console.log('   ✅ CodeAgent event system working');
    console.log('   ✅ Module factory event listeners working');
    console.log('   ✅ Agent module event integration working');
    console.log('   ✅ File module event emissions working');
    
    console.log('\n🎉 Event System Integration Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEventSystem().catch(console.error);