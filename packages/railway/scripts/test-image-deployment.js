#!/usr/bin/env node

import { RailwayProvider } from '../src/index.js';

console.log('🧪 Testing Docker Image Deployment\n');

async function testImageDeployment() {
  try {
    const apiKey = process.env.RAILWAY_API_KEY || process.env.RAILWAY;
    if (!apiKey) {
      throw new Error('RAILWAY_API_KEY or RAILWAY environment variable is required');
    }
    const railwayProvider = new RailwayProvider(apiKey);
    
    // Clean up
    console.log('🧹 Cleaning up...');
    await railwayProvider.deleteProject('a0c7aef9-c434-4f9c-b28b-527e269bf89a');
    console.log('Cleaned\n');
    
    // Deploy using a Docker image
    const config = {
      name: 'docker-test-app',
      description: 'Testing Docker image deployment',
      source: 'docker',
      image: 'nginxdemos/hello'  // Simple nginx hello world image
    };
    
    console.log('📦 Deploying Docker image...\n');
    const result = await railwayProvider.deployWithDomain(config);
    
    console.log('Full result:', JSON.stringify(result, null, 2));
    
    if (result.success && result.url) {
      console.log('✅ Deployment successful!');
      console.log(`URL: ${result.url}`);
      
      console.log('\n⏳ Waiting 60 seconds...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      console.log('\n🧪 Testing URL...');
      const response = await fetch(result.url);
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ App is working!');
      } else {
        console.log('❌ App returned:', response.status);
      }
    } else {
      console.log('❌ Failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testImageDeployment();