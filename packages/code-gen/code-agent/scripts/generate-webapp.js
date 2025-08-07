#!/usr/bin/env node

/**
 * Generate a webapp and save it to the generated directory
 */

import { ResourceManager } from '@legion/tools';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateWebapp() {
  console.log('🚀 Generating webapp with CodeAgent\n');
  
  let agent;
  const generatedDir = path.join(__dirname, '../../../../generated');
  const projectDir = path.join(generatedDir, `webapp-${Date.now()}`);
  
  try {
    // Create generated directory if it doesn't exist
    await fs.mkdir(generatedDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    
    console.log(`📁 Output directory: ${projectDir}`);
    
    // Initialize git in the project directory
    execSync('git init', { cwd: projectDir });
    execSync('git config user.name "CodeAgent"', { cwd: projectDir });
    execSync('git config user.email "agent@codeagent.dev"', { cwd: projectDir });
    
    // Setup ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Configure CodeAgent for a fullstack webapp
    agent = new CodeAgent({
      projectType: 'fullstack',
      llmConfig: {
        provider: 'anthropic'
      },
      deployment: {
        enabled: false // No deployment for now
      },
      enableGitIntegration: false // No GitHub push
    });
    
    await agent.initialize(projectDir, { resourceManager });
    console.log('✅ CodeAgent initialized\n');
    
    // Define webapp requirements
    const requirements = {
      projectName: 'ModernWebApp',
      description: 'A modern web application with React frontend and Express backend',
      requirements: {
        frontend: `Create a modern React web application with:
        1. A clean, responsive design using Tailwind CSS
        2. A header with navigation (Home, About, Services, Contact)
        3. A hero section with a call-to-action button
        4. A features section showcasing 3 key features
        5. A footer with links and copyright
        6. Use React hooks and functional components
        7. Include smooth scrolling and animations`,
        backend: `Create an Express.js API server with:
        1. GET /api/status - returns application status
        2. GET /api/features - returns the list of features
        3. POST /api/contact - handles contact form submissions
        4. Proper error handling and CORS setup
        5. Environment variable support
        6. Listen on PORT from env or 3001`
      }
    };
    
    console.log('📝 Generating webapp...\n');
    const result = await agent.develop(requirements);
    
    if (!result.success) {
      throw new Error('Failed to generate webapp');
    }
    
    console.log('\n✅ Webapp generated successfully!');
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
    
    console.log('\n🎉 Done! Your webapp is ready at:');
    console.log(`   ${projectDir}`);
    console.log('\nTo run it:');
    console.log(`   cd ${projectDir}`);
    console.log('   npm install');
    console.log('   npm start');
    
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
generateWebapp();