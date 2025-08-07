#!/usr/bin/env node

/**
 * Generate a simple Node server and webpage
 */

import { ResourceManager } from '@legion/tools';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateSimpleServer() {
  console.log('🚀 Generating simple Node server and webpage\n');
  
  let agent;
  const generatedDir = path.join(__dirname, '../../../../generated');
  const projectDir = path.join(generatedDir, `simple-server-${Date.now()}`);
  
  try {
    // Create generated directory if it doesn't exist
    await fs.mkdir(generatedDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    
    console.log(`📁 Output directory: ${projectDir}`);
    
    // Setup ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Configure CodeAgent for a simple backend project
    agent = new CodeAgent({
      projectType: 'backend',
      llmConfig: {
        provider: 'anthropic'
      },
      deployment: {
        enabled: false
      },
      enableGitIntegration: false
    });
    
    await agent.initialize(projectDir, { resourceManager });
    console.log('✅ CodeAgent initialized\n');
    
    // Very simple requirements
    const requirements = {
      projectName: 'SimpleServer',
      description: 'A simple Express server with a basic webpage',
      requirements: {
        backend: `Create a basic Express.js server with:
        1. GET / - serves an HTML page with "Hello World"
        2. GET /api/status - returns {"status": "ok", "time": currentTime}
        3. Listen on port 3000`
      }
    };
    
    console.log('📝 Generating simple server...\n');
    const result = await agent.develop(requirements);
    
    console.log('✅ Simple server generated successfully!');
    console.log(`   Files created: ${result.filesGenerated}`);
    console.log(`   Location: ${projectDir}`);
    
    // List generated files
    console.log('\n📁 Generated files:');
    const files = await fs.readdir(projectDir, { recursive: true });
    files.forEach(file => {
      if (!file.includes('.git/') && !file.includes('node_modules/')) {
        console.log(`   ${file}`);
      }
    });
    
    console.log('\n🎉 Done! Your simple server is ready at:');
    console.log(`   ${projectDir}`);
    console.log('\nTo run it:');
    console.log(`   cd "${projectDir}"`);
    console.log('   npm install');
    console.log('   npm start');
    console.log('   # Then visit http://localhost:3000');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (agent) {
      await agent.cleanup();
    }
  }
}

// Run it
generateSimpleServer();