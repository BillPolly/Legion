#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 DEPLOYING FROM GITHUB REPOSITORY\n');

async function deployGitHubApp() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  // First clean up the failed deployment
  console.log('🧹 Cleaning up previous deployment...');
  await railwayProvider.deleteProject('89f1d985-2938-4c57-87ad-60b060e134b5');
  console.log('✅ Cleaned up\n');
  
  // Deploy a working GitHub repository
  const config = {
    name: 'working-webapp',
    description: 'Working web application',
    source: 'github',
    repo: 'vercel/next.js',
    branch: 'canary'
  };
  
  console.log('📦 Deploying Next.js example app from Vercel...');
  console.log('This is a known working repository.\n');
  
  const result = await railwayProvider.deployWithDomain(config);
  
  if (result.success && result.domain) {
    console.log('\n✅ Deployment initiated successfully!');
    console.log(`🌐 URL: ${result.url}`);
    console.log('\n⏳ This is a large Next.js app, it will take 2-3 minutes to build.');
    console.log('Waiting 3 minutes before testing...\n');
    
    await new Promise(resolve => setTimeout(resolve, 180000));
    
    console.log('🧪 Testing the deployed app...');
    try {
      const response = await fetch(result.url, { 
        signal: AbortSignal.timeout(15000),
        redirect: 'follow'
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log('\n✅ SUCCESS! Your app is working!');
        console.log(`🌐 Visit: ${result.url}`);
      } else {
        console.log('\nApp may still be building. Check in another minute.');
      }
    } catch (error) {
      console.log('Error:', error.message);
    }
  } else {
    console.error('Deployment failed:', result.error);
  }
}

deployGitHubApp();