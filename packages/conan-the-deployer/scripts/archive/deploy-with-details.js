#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying directly via RailwayProvider with detailed logging...\n');

async function deployWithDetails() {
  try {
    // Get Railway API key
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    console.log('🔑 Railway API key found:', apiKey ? `${apiKey.slice(0, 8)}...` : 'NOT FOUND');
    
    if (!apiKey) {
      throw new Error('Railway API key not found');
    }

    // Create Railway provider
    console.log('🏗️  Creating Railway provider...');
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Deployment config
    const config = {
      name: 'conan-real-deploy',
      description: 'Real deployment from Conan The Deployer framework',
      source: 'https://github.com/railwayapp/starters',
      branch: 'main',
      environment: {
        NODE_ENV: 'production',
        PORT: '3000'
      },
      railway: {
        region: 'us-west1'
      }
    };

    console.log('📋 Deployment config:');
    console.log(JSON.stringify(config, null, 2));
    
    console.log('\n🚀 Starting Railway deployment...');
    const result = await railwayProvider.deploy(config);
    
    console.log('\n📊 Deployment Result:');
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
      console.log('Full result:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.deployment) {
        console.log('\n🎯 Deployment Details:');
        console.log('ID:', result.deployment.id);
        console.log('Status:', result.deployment.status);
        console.log('URL:', result.deployment.url || 'Building...');
        console.log('Created:', result.deployment.createdAt);
      }
      
      if (result.project) {
        console.log('\n📁 Project Details:');
        console.log('Project ID:', result.project.id);
        console.log('Project Name:', result.project.name);
      }
      
      if (result.service) {
        console.log('\n⚙️  Service Details:');
        console.log('Service ID:', result.service.id);
        console.log('Service Name:', result.service.name);
      }
      
    } else {
      console.log('\n❌ DEPLOYMENT FAILED');
      console.log('Error:', result.error);
      console.log('Full result:');
      console.log(JSON.stringify(result, null, 2));
    }
    
    // List projects again to see if it appears
    console.log('\n🔄 Refreshing project list...');
    const projectsResult = await railwayProvider.listProjects();
    
    if (projectsResult.success) {
      console.log(`\n📋 Found ${projectsResult.projects.length} projects:`);
      projectsResult.projects.forEach((project, i) => {
        console.log(`${i + 1}. ${project.name} (ID: ${project.id})`);
        console.log(`   Created: ${new Date(project.createdAt).toLocaleString()}`);
        console.log(`   Services: ${project.services.length}`);
      });
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error(error.stack);
  }
}

deployWithDetails();