#!/usr/bin/env node

/**
 * Test Dependency Injection Configuration
 * 
 * This script tests that ResourceManager DI is working correctly
 * before running the full Example2 workflow.
 */

import { ResourceManager } from '@legion/tools';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

async function testDI() {
  let tempDir;
  
  try {
    console.log('🧪 Testing Dependency Injection Setup');
    console.log('=====================================\n');
    
    // Step 1: Initialize ResourceManager
    console.log('1️⃣ Initializing ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    console.log('✅ ResourceManager initialized');
    
    // Step 2: Check environment variables
    console.log('\n2️⃣ Checking environment variables...');
    const envVars = [
      'ANTHROPIC_API_KEY',
      'GITHUB_PAT', 
      'RAILWAY_API_TOKEN'
    ];
    
    for (const varName of envVars) {
      try {
        const value = resourceManager.get(`env.${varName}`);
        console.log(`✅ ${varName}: ${value ? '***' + value.slice(-4) : 'NOT SET'}`);
      } catch (e) {
        console.log(`❌ ${varName}: NOT FOUND`);
      }
    }
    
    // Step 3: Register factories
    console.log('\n3️⃣ Registering dependency factories...');
    
    // Register mock LLM for this test
    resourceManager.registerFactory('llmClient', async (config, rm) => {
      console.log('   Creating LLM client (mock for test)...');
      const { LLMClientManager } = await import('../src/integration/LLMClientManager.js');
      const client = new LLMClientManager({
        provider: 'mock',
        ...config
      });
      await client.initialize();
      return client;
    });
    console.log('✅ Factories registered');
    
    // Step 4: Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'di-test-'));
    console.log(`\n4️⃣ Created temp directory: ${tempDir}`);
    
    // Step 5: Initialize CodeAgent
    console.log('\n5️⃣ Initializing CodeAgent with DI...');
    const agent = new CodeAgent({
      projectType: 'backend',
      llmConfig: {
        provider: 'mock'  // Use mock for this test
      }
    });
    
    await agent.initialize(tempDir, { resourceManager });
    console.log('✅ CodeAgent initialized successfully');
    
    // Step 6: Verify dependencies were injected
    console.log('\n6️⃣ Verifying injected dependencies...');
    console.log(`✅ ResourceManager: ${agent.resourceManager ? 'Present' : 'Missing'}`);
    console.log(`✅ FileOps: ${agent.fileOps ? 'Present' : 'Missing'}`);
    console.log(`✅ LLMClient: ${agent.llmClient ? 'Present' : 'Missing'}`);
    console.log(`✅ UnifiedPlanner: ${agent.unifiedPlanner ? 'Present' : 'Missing'}`);
    
    // Step 7: Test factory names
    console.log('\n7️⃣ Available factories:');
    const factories = agent.resourceManager.getFactoryNames();
    factories.forEach(name => console.log(`   - ${name}`));
    
    console.log('\n✅ Dependency Injection test completed successfully!');
    console.log('You can now run the full Example2 workflow.\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

// Run the test
testDI();