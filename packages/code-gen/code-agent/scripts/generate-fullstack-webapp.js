#!/usr/bin/env node

/**
 * Generate a complete fullstack web app with frontend and backend
 */

import { ResourceManager } from '@legion/tools-registry';
import { CodeAgent } from '../src/agent/CodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateFullstackWebapp() {
  console.log('🚀 Generating fullstack web app with CodeAgent\n');
  
  let agent;
  const generatedDir = path.join(__dirname, '../../../../generated');
  const projectDir = path.join(generatedDir, `fullstack-webapp-${Date.now()}`);
  
  try {
    // Create generated directory if it doesn't exist
    await fs.mkdir(generatedDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    
    console.log(`📁 Output directory: ${projectDir}`);
    
    // Setup ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Configure CodeAgent for a FULLSTACK project
    agent = new CodeAgent({
      projectType: 'fullstack', // This is crucial - asking for fullstack not backend
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
    
    // Comprehensive fullstack requirements - BOTH frontend and backend specified
    const requirements = {
      projectName: 'FullstackWebApp',
      description: 'A complete fullstack web application with interactive frontend and API backend',
      requirements: {
        // FRONTEND requirements - explicitly asking for HTML, CSS, and client-side JS
        frontend: `Create a complete frontend web application with:
        1. An index.html page with a modern, responsive design
        2. A header with the title "Fullstack Web App"
        3. A main content area with:
           - A welcome message
           - Current date/time display that updates every second
           - A button to fetch data from the backend API
           - A section to display the API response
        4. Professional CSS styling (can be embedded in HTML)
        5. Client-side JavaScript to:
           - Update the time display
           - Handle button clicks
           - Fetch data from /api/data endpoint
           - Display the fetched data in a formatted way
        6. Error handling for failed API calls`,
        
        // BACKEND requirements
        backend: `Create an Express.js backend server with:
        1. Serve static files from a public directory
        2. GET / - serves the index.html file
        3. GET /api/status - returns server status as JSON
        4. GET /api/data - returns sample data: { message: "Hello from backend!", items: ["Item 1", "Item 2", "Item 3"], timestamp: currentTime }
        5. Proper CORS setup for API endpoints
        6. Error handling middleware
        7. Listen on PORT from env or 3000`
      }
    };
    
    console.log('📝 Generating fullstack web app...\n');
    const result = await agent.develop(requirements);
    
    console.log('\n✅ Fullstack web app generated successfully!');
    console.log(`   Files created: ${result.filesGenerated}`);
    console.log(`   Location: ${projectDir}`);
    
    // List generated files
    console.log('\n📁 Generated files:');
    const files = await fs.readdir(projectDir, { recursive: true });
    files.forEach(file => {
      if (!file.includes('.git/') && !file.includes('node_modules/') && file !== '.DS_Store') {
        console.log(`   ${file}`);
      }
    });
    
    console.log('\n🎉 Done! Your fullstack web app is ready at:');
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
generateFullstackWebapp();