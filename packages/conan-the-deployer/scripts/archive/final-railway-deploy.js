#!/usr/bin/env node

import RailwayProvider from '../../../railway/src/providers/RailwayProvider.js';
import { ResourceManager } from '../../../module-loader/src/index.js';

const resourceManager = new ResourceManager();
await resourceManager.initialize();
const RAILWAY_API_TOKEN = resourceManager.env.RAILWAY_API_TOKEN;

const railwayProvider = new RailwayProvider(RAILWAY_API_TOKEN);

console.log('🚂 Final Railway Deployment Test\n');

// Use an existing GitHub repo that we know has the code
const githubRepo = 'Bill234/test-app-1753012112741';

console.log(`📦 Using existing GitHub repository: ${githubRepo}`);
console.log('   This repo contains a simple Express server\n');

// Deploy to Railway
console.log('🚀 Deploying to Railway...');
const deployConfig = {
  name: 'final-test-app',
  source: 'github',
  repo: githubRepo,
  branch: 'main',
  generateDomain: true
};

const deployResult = await railwayProvider.deployWithDomain(deployConfig);

if (!deployResult.success) {
  console.error('❌ Deployment failed:', deployResult.error);
  process.exit(1);
}

console.log('\n✅ Deployment successful!');
console.log(`   Project ID: ${deployResult.projectId}`);
console.log(`   Service ID: ${deployResult.serviceId}`);
console.log(`   URL: ${deployResult.url}`);

// Monitor deployment
console.log('\n📊 Monitoring deployment status...');
console.log('   (Railway needs time to build and deploy the app)\n');

let attempts = 0;
const maxAttempts = 20; // 10 minutes total
let isLive = false;

while (attempts < maxAttempts && !isLive) {
  attempts++;
  console.log(`   Checking... (${attempts}/${maxAttempts})`);
  
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
  
  try {
    const response = await fetch(deployResult.url);
    if (response.ok) {
      const text = await response.text();
      if (text.includes('Hello from Railway')) {
        isLive = true;
        console.log('\n🎉 Application is live!');
        console.log(`   URL: ${deployResult.url}`);
        console.log(`   Response: ${text}`);
        
        // Test status endpoint
        const statusResponse = await fetch(`${deployResult.url}/status`);
        const status = await statusResponse.json();
        console.log('   Status endpoint:', status);
      }
    }
  } catch (error) {
    // Not ready yet
  }
}

if (!isLive) {
  console.log('\n⚠️  Application did not become live within 10 minutes');
  console.log('   The deployment may still be building');
  console.log(`   Check: ${deployResult.url}`);
}

console.log('\n📝 Summary:');
console.log('   - GitHub repo exists and contains the code ✓');
console.log('   - Railway project created ✓');
console.log('   - Service created with GitHub source ✓');
console.log('   - Domain generated ✓');
console.log(`   - Live URL: ${deployResult.url}`);