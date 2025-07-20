#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying Website with Auto-Generated Domain to Railway\n');

async function deployWithDomain() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Deploy a simple static website using Caddy
    const config = {
      name: 'my-public-website',
      description: 'Public website with auto-generated domain',
      source: 'docker',
      image: 'caddy:alpine'
    };
    
    console.log('📦 Deploying application to Railway...');
    const result = await railwayProvider.deployWithDomain(config);
    
    if (!result.success) {
      console.error('❌ Deployment failed:', result.error);
      return;
    }
    
    console.log('\n🎉 SUCCESS! Your website has been deployed to Railway!');
    console.log('━'.repeat(60));
    console.log('📊 Deployment Details:');
    console.log(`Project ID: ${result.projectId}`);
    console.log(`Service ID: ${result.serviceId}`);
    console.log(`Deployment ID: ${result.deploymentId}`);
    
    if (result.domain) {
      console.log(`\n🌐 Your website is accessible at:`);
      console.log(`   ${result.url}`);
      console.log('\n✨ The domain was generated automatically!');
    } else {
      console.log('\n⚠️  Domain generation failed. You may need to generate it manually in the Railway dashboard.');
    }
    
    console.log('━'.repeat(60));
    console.log('\n⏳ Railway is now building and deploying your website...');
    console.log('This usually takes 1-2 minutes.\n');
    
    // Wait and check deployment status
    console.log('Checking deployment status in 20 seconds...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    const status = await railwayProvider.getStatus(result.deploymentId);
    console.log(`\nDeployment Status: ${status.status}`);
    
    if (result.url) {
      console.log(`\n🎯 Your website should now be live at: ${result.url}`);
      console.log('Try opening it in your browser!');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployWithDomain();