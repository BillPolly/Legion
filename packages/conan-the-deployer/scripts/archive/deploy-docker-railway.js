#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying to Railway with Simple Approach\n');

async function deployToRailway() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Deploy using a known working GitHub template
    const config = {
      name: 'my-express-webapp',
      description: 'Express web application',
      source: 'github',
      repo: 'railwayapp/examples',
      branch: 'master',
      environment: {
        NODE_ENV: 'production'
      }
    };
    
    console.log('📦 Creating Railway project with Node.js example...');
    console.log('This will deploy a working Express app you can see in your browser\n');
    
    const result = await railwayProvider.deploy(config);
    
    if (result.success) {
      console.log('✅ Deployment initiated successfully!');
      console.log(`Project ID: ${result.projectId}`);
      console.log(`Service ID: ${result.serviceId}`);
      console.log(`Status: ${result.status}`);
      
      console.log('\n⏳ Your app is being deployed to Railway...');
      console.log('This usually takes 1-3 minutes.\n');
      
      console.log('📊 To see your live app:');
      console.log('1. Go to https://railway.app');
      console.log('2. Click on your project: "my-express-webapp"');
      console.log('3. You\'ll see the deployment progress');
      console.log('4. Once deployed, Railway will provide a URL like: https://my-express-webapp-production.up.railway.app');
      console.log('\n🎯 The app will show a Railway example page when it\'s ready!');
      
    } else {
      console.log('❌ Deployment failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployToRailway();