#!/usr/bin/env node

import DeployApplicationTool from './src/tools/DeployApplicationTool.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Deploying Local Express App to Railway\n');

async function deployLocal() {
  try {
    const deployTool = new DeployApplicationTool();
    
    // First, let's test locally
    console.log('📦 Step 1: Testing app locally first...\n');
    
    const localDeployCall = {
      function: {
        name: 'deploy_application',
        arguments: JSON.stringify({
          provider: 'local',
          config: {
            name: 'test-express-app',
            projectPath: path.join(__dirname, 'simple-express-app'),
            command: 'node server.js',
            port: 3456,
            environment: {
              NODE_ENV: 'development'
            }
          }
        })
      }
    };
    
    const localResult = await deployTool.invoke(localDeployCall);
    
    if (localResult.success) {
      console.log('✅ Local deployment successful!');
      console.log(`🌐 Local URL: http://localhost:3456`);
      console.log('📝 Test it with: curl http://localhost:3456\n');
      
      // Wait a bit for the server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test the local deployment
      try {
        const response = await fetch('http://localhost:3456/health');
        const data = await response.json();
        console.log('✅ Health check passed:', data);
      } catch (e) {
        console.log('⚠️  Could not reach local server');
      }
    }
    
    // Now deploy to Railway
    console.log('\n📦 Step 2: Deploying to Railway...\n');
    
    const railwayDeployCall = {
      function: {
        name: 'deploy_application',
        arguments: JSON.stringify({
          provider: 'railway',
          config: {
            name: 'live-express-webapp',
            source: 'local',
            projectPath: path.join(__dirname, 'simple-express-app'),
            environment: {
              NODE_ENV: 'production',
              PORT: '3000'
            },
            description: 'Live Express app deployed from local source'
          }
        })
      }
    };
    
    const railwayResult = await deployTool.invoke(railwayDeployCall);
    
    if (railwayResult.success) {
      console.log('✅ Railway deployment initiated!');
      console.log(JSON.stringify(railwayResult.data, null, 2));
      
      console.log('\n🔍 Deployment created, now checking status...');
      console.log('Note: Local deployments to Railway may take a few minutes to process');
      console.log('Check your Railway dashboard: https://railway.app');
      
      // Since we got a local deployment ID, let's check the actual Railway project
      const projectId = railwayResult.data.deployment.id.includes('local-deploy') 
        ? 'Check Railway dashboard for actual deployment' 
        : railwayResult.data.deployment.id;
        
      console.log(`\n📋 To monitor this deployment:`);
      console.log(`1. Go to https://railway.app`);
      console.log(`2. Look for project: live-express-webapp`);
      console.log(`3. The deployment should appear there with a live URL`);
    } else {
      console.log('❌ Railway deployment failed:', railwayResult.error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployLocal();