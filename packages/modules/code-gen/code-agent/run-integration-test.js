#!/usr/bin/env node

/**
 * Run the Real GitHub Integration Test
 * 
 * This script loads environment variables from the root .env file
 * and runs the integration test that creates a real GitHub repository
 */

import { config } from 'dotenv';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function findEnvFile() {
  // Look for .env file in various locations
  const possiblePaths = [
    join(__dirname, '.env'),
    join(__dirname, '..', '.env'),
    join(__dirname, '..', '..', '.env'),
    join(__dirname, '..', '..', '..', '.env'),
    join(__dirname, '..', '..', '..', '..', '.env'),
    '/Users/maxximus/Documents/max/jsEnvoy/.env'
  ];
  
  for (const path of possiblePaths) {
    try {
      await fs.access(path);
      console.log(`✅ Found .env file at: ${path}`);
      return path;
    } catch {
      // Continue searching
    }
  }
  
  throw new Error('Could not find .env file');
}

async function runIntegrationTest() {
  try {
    // Find and load .env file
    const envPath = await findEnvFile();
    config({ path: envPath });
    
    // Verify we have required environment variables
    if (!process.env.GITHUB_PAT) {
      console.error('❌ GITHUB_PAT not found in environment');
      console.log('Please ensure your .env file contains:');
      console.log('GITHUB_PAT=your-github-personal-access-token');
      process.exit(1);
    }
    
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.error('❌ No LLM API key found');
      console.log('Please ensure your .env file contains either:');
      console.log('OPENAI_API_KEY=your-openai-api-key');
      console.log('or');
      console.log('ANTHROPIC_API_KEY=your-anthropic-api-key');
      process.exit(1);
    }
    
    console.log('🚀 Starting Real GitHub Integration Test');
    console.log('📝 This will create a real GitHub repository in the AgentResults organization');
    console.log('🔑 Using GitHub PAT: ' + process.env.GITHUB_PAT.substring(0, 10) + '...');
    console.log('🤖 Using LLM: ' + (process.env.OPENAI_API_KEY ? 'OpenAI' : 'Anthropic'));
    console.log('');
    
    // Run the integration test
    const testProcess = spawn('npm', ['test'], {
      env: {
        ...process.env,
        NODE_OPTIONS: '--experimental-vm-modules --max-old-space-size=8192'
      },
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Integration test completed successfully!');
      } else {
        console.log(`\n❌ Integration test failed with code ${code}`);
      }
      process.exit(code);
    });
    
    testProcess.on('error', (error) => {
      console.error('Failed to start test process:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
runIntegrationTest();