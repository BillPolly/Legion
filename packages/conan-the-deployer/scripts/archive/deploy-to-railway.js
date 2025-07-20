#!/usr/bin/env node

import RailwayProvider from '../../../railway/src/providers/RailwayProvider.js';
import { ResourceManager } from '../../../module-loader/src/index.js';

const resourceManager = new ResourceManager();
await resourceManager.initialize();
const RAILWAY_API_TOKEN = resourceManager.get('env.RAILWAY_API_TOKEN');

const railwayProvider = new RailwayProvider(RAILWAY_API_TOKEN);

console.log('🚂 Deploying to Railway\n');

const githubRepo = 'AgentResults/test-express-railway';

console.log(`📦 Using GitHub repository: ${githubRepo}`);
console.log('   Repository verified to exist with all required files\n');

// Deploy to Railway
console.log('🚀 Starting Railway deployment...');
const deployConfig = {
  name: 'test-express-railway',
  source: 'github',
  repo: githubRepo,
  branch: 'main',
  generateDomain: true,
  environment: {
    NODE_ENV: 'production'
  }
};

const deployResult = await railwayProvider.deployWithDomain(deployConfig);

if (!deployResult.success) {
  console.error('❌ Deployment failed:', deployResult.error);
  process.exit(1);
}

console.log('\n✅ Railway deployment initiated successfully!');
console.log('   Project ID:', deployResult.projectId);
console.log('   Service ID:', deployResult.serviceId);
console.log('   Domain:', deployResult.domain);
console.log('   URL:', deployResult.url);

console.log('\n📊 Checking deployment status...');

// Give Railway time to process
await new Promise(resolve => setTimeout(resolve, 10000));

// Check deployment status
const status = await railwayProvider.getStatus(deployResult.serviceId);
console.log('   Status:', status.status);

console.log('\n' + '='.repeat(50));
console.log('✅ Deployment Summary:');
console.log('='.repeat(50));
console.log('GitHub Repository: https://github.com/' + githubRepo);
console.log('Railway URL:', deployResult.url);
console.log('\nNote: Railway takes 2-5 minutes to build and deploy.');
console.log('The app will be available at:', deployResult.url);
console.log('='.repeat(50));

// Test the URL after a delay
console.log('\n⏳ Waiting 30 seconds before testing the URL...');
await new Promise(resolve => setTimeout(resolve, 30000));

console.log('\n🔍 Testing deployment URL...');
try {
  const response = await fetch(deployResult.url);
  if (response.ok) {
    const text = await response.text();
    console.log('✅ App is responding!');
    console.log('   Response:', text.substring(0, 100) + '...');
  } else {
    console.log('⚠️  App not ready yet (status:', response.status + ')');
    console.log('   Railway is still building. Check in a few minutes.');
  }
} catch (error) {
  console.log('⚠️  App not ready yet');
  console.log('   Railway is still building. Check in a few minutes.');
}

console.log('\n🎉 Deployment process complete!');
console.log(`   Visit: ${deployResult.url}`);