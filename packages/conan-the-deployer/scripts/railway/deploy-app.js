#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from '../../src/providers/RailwayProvider.js';

console.log('🚀 Deploy Application to Railway\n');

async function deployApp() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Example deployment configuration
    const config = {
      name: 'my-app',
      description: 'Application deployed via RailwayProvider',
      source: 'github',
      repo: 'railwayapp-templates/express-starter',
      branch: 'main'
    };
    
    console.log('📦 Deploying application...');
    console.log(`Name: ${config.name}`);
    console.log(`Source: ${config.source}`);
    console.log(`Repository: ${config.repo}\n`);
    
    const result = await railwayProvider.deployWithDomain(config);
    
    if (result.success) {
      console.log('✅ Deployment successful!');
      console.log(`\n📊 Deployment Details:`);
      console.log(`Project ID: ${result.projectId}`);
      console.log(`Service ID: ${result.serviceId}`);
      console.log(`Deployment ID: ${result.deploymentId}`);
      
      if (result.domain) {
        console.log(`\n🌐 Your application is accessible at:`);
        console.log(`   ${result.url}`);
      } else {
        console.log(`\n⚠️  Domain generation failed. Generate manually in Railway dashboard.`);
      }
      
      console.log('\n⏳ Note: The application may take 1-3 minutes to build and deploy.');
      
    } else {
      console.error('❌ Deployment failed:', result.error || result.errors);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployApp();