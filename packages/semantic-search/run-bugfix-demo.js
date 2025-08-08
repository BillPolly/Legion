#!/usr/bin/env node

/**
 * Bug Fix Agent Demo Runner
 * 
 * This script demonstrates an LLM agent automatically detecting and fixing
 * a bug in a Node.js Express API by:
 * 1. Starting a buggy server
 * 2. Testing the API to detect the issue
 * 3. Analyzing logs and source code with LLM
 * 4. Automatically applying the fix
 * 5. Restarting and verifying the fix works
 */

import { ResourceManager } from '../tools/src/ResourceManager.js';
import { SimpleBugFixAgent } from './simple-bugfix-agent.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Simple LLM client for Anthropic Claude
 */
class AnthropicClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async complete(prompt, options = {}) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }
}

/**
 * Ensure the buggy API server is properly set up
 */
async function setupBuggyAPI() {
  const apiPath = '/Users/maxximus/Documents/max/pocs/Legion/scratch/simple-api';
  
  try {
    // Check if directory exists
    await fs.access(apiPath);
    console.log('✅ Buggy API directory exists');
    
    // Check for package.json
    const packagePath = path.join(apiPath, 'package.json');
    await fs.access(packagePath);
    console.log('✅ package.json exists');
    
    // Check for server.js with the bug
    const serverPath = path.join(apiPath, 'server.js');
    const serverCode = await fs.readFile(serverPath, 'utf8');
    
    if (serverCode.includes('req.query.gretting')) {
      console.log('✅ Bug is present in server.js (req.query.gretting)');
      return true;
    } else if (serverCode.includes('req.query.greeting')) {
      console.log('⚠️  Bug appears to be already fixed - reverting to buggy state...');
      
      // Restore the bug for demonstration
      const buggyCode = serverCode.replace(
        'const greeting = req.query.greeting || \'Hello\';',
        'const greeting = req.query.gretting || \'Hello\';'
      );
      
      await fs.writeFile(serverPath, buggyCode);
      console.log('✅ Bug restored for demonstration');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Failed to setup buggy API:', error.message);
    return false;
  }
}

/**
 * Main demo runner function
 */
async function runBugFixDemo() {
  console.log('🎯 Bug Fix Agent Demo\n');
  console.log('This demo shows an LLM agent automatically detecting and fixing bugs in a Node.js API\n');

  try {
    // Step 1: Initialize ResourceManager and get API key
    console.log('🔧 Initializing ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
      console.error('Please add ANTHROPIC_API_KEY to your .env file');
      process.exit(1);
    }
    
    console.log('✅ ResourceManager initialized\n');

    // Step 2: Setup the buggy API
    console.log('🛠️  Setting up buggy API...');
    const setupSuccess = await setupBuggyAPI();
    if (!setupSuccess) {
      console.error('❌ Failed to setup buggy API. Demo cannot continue.');
      process.exit(1);
    }
    console.log('');

    // Step 3: Create LLM client
    console.log('🤖 Creating LLM client...');
    const llmClient = new AnthropicClient(anthropicKey);
    console.log('✅ LLM client ready\n');

    // Step 4: Create and run the bug fix agent
    console.log('🚀 Starting Bug Fix Agent...\n');
    const bugFixAgent = new SimpleBugFixAgent(llmClient);
    
    // Run the complete demonstration
    await bugFixAgent.runFullDemo();
    
    console.log('🎉 Bug Fix Agent Demo completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Demo failed with error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

/**
 * Handle process cleanup
 */
process.on('SIGINT', () => {
  console.log('\n\n🛑 Demo interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Demo terminated');
  process.exit(0);
});

// Add some helpful information
console.log('================================================');
console.log('         LLM Bug Fix Agent Demo');
console.log('================================================');
console.log('');
console.log('This demonstration will:');
console.log('1. 🖥️  Start a buggy Express.js API server');
console.log('2. 📡 Test the API to detect the bug');
console.log('3. 🔍 Capture and analyze server logs');
console.log('4. 🤖 Use Claude LLM to identify the fix needed');
console.log('5. 🔧 Automatically apply the fix to source code');
console.log('6. 🔄 Restart the server and verify the fix works');
console.log('');
console.log('Press Ctrl+C at any time to stop the demo');
console.log('================================================');
console.log('');

// Run the demo
runBugFixDemo().catch(console.error);