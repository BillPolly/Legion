#!/usr/bin/env node

/**
 * Test Real LLM Code Generation
 * 
 * This script tests CodeAgent with real Anthropic LLM
 * for basic code generation without full deployment.
 */

import { ResourceManager } from '@legion/tool-system';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

async function testRealLLM() {
  let tempDir;
  let agent;
  let resourceManager;
  
  try {
    console.log('\n🧪 Testing CodeAgent with Real LLM');
    console.log('===================================\n');
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Check for Anthropic API key
    const anthropicKey = resourceManager.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY must be set in .env file');
    }
    console.log('✅ Found Anthropic API key');
    
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-test-'));
    console.log(`📁 Working directory: ${tempDir}`);
    
    // Register real LLM client factory
    resourceManager.registerFactory('llmClient', async (config, rm) => {
      const apiKey = config.apiKey || rm.env.ANTHROPIC_API_KEY;
      console.log('   ✓ Creating Anthropic LLM client...');
      
      const { LLMClientManager } = await import('../src/integration/LLMClientManager.js');
      const client = new LLMClientManager({
        provider: 'anthropic',
        apiKey: apiKey,
        model: 'claude-3-sonnet-20240229',
        ...config
      });
      await client.initialize();
      return client;
    });
    
    // Create CodeAgent with minimal config
    console.log('\n🤖 Initializing CodeAgent...');
    agent = new CodeAgent({
      projectType: 'backend',
      llmConfig: {
        provider: 'anthropic'
      },
      deployment: {
        enabled: false  // No deployment for this test
      },
      enableGitIntegration: false  // No git for this test
    });
    
    await agent.initialize(tempDir, { resourceManager });
    console.log('✅ CodeAgent initialized with real LLM');
    
    // Test simple code generation
    console.log('\n📝 Generating simple Express server...');
    const developResult = await agent.develop({
      projectName: 'simple-server',
      description: 'A minimal Express.js server',
      requirements: {
        backend: `Create a very simple Express.js server with:
          1. GET / - Returns { message: "Hello World" }
          2. GET /health - Returns { status: "ok" }
          3. Listen on port 3000`,
        testing: `Create one simple test that verifies the server starts`
      }
    });
    
    if (developResult.success) {
      console.log('\n✅ Code generation successful!');
      console.log(`   Files generated: ${developResult.filesGenerated}`);
      
      // List generated files
      console.log('\n📁 Generated files:');
      const files = await fs.readdir(tempDir, { recursive: true });
      files.forEach(file => {
        if (!file.includes('node_modules') && !file.includes('.git')) {
          console.log(`   ${file}`);
        }
      });
      
      // Read and display main server file
      const serverPath = path.join(tempDir, 'server.js');
      if (await fs.access(serverPath).then(() => true).catch(() => false)) {
        console.log('\n📄 Generated server.js:');
        console.log('─'.repeat(60));
        const content = await fs.readFile(serverPath, 'utf8');
        console.log(content);
        console.log('─'.repeat(60));
      }
    } else {
      console.log('\n❌ Code generation failed');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  } finally {
    // Cleanup
    if (agent) {
      await agent.cleanup();
    }
    if (tempDir) {
      console.log('\n🧹 Cleaning up...');
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

// Run the test
testRealLLM();