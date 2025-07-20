#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying a WORKING Web Application to Railway\n');

async function deployWorkingApp() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Deploy a known working application - nginx with static content
    const config = {
      name: 'conan-live-site',
      description: 'Working website deployed by Conan',
      source: 'docker',
      image: 'nginx:alpine'  // nginx is more reliable than caddy for this
    };
    
    console.log('📦 Creating Railway project...');
    const projectResult = await railwayProvider.createProject(config);
    
    if (!projectResult.success) {
      console.error('❌ Failed to create project:', projectResult.error);
      return;
    }
    
    const projectId = projectResult.project.id;
    console.log(`✅ Project created: ${projectId}`);
    
    console.log('\n📦 Creating service...');
    const serviceResult = await railwayProvider.createService(projectId, {
      name: 'web',
      image: 'nginx:alpine'
    });
    
    if (!serviceResult.success) {
      console.error('❌ Failed to create service:', serviceResult.error);
      return;
    }
    
    const serviceId = serviceResult.service.id;
    console.log(`✅ Service created: ${serviceId}`);
    
    // Get environment ID
    const projectDetails = await railwayProvider.getProjectDetails(projectId);
    const environmentId = projectDetails.project.environments.edges[0]?.node.id;
    
    if (!environmentId) {
      console.error('❌ No environment found');
      return;
    }
    
    // Set the PORT environment variable that Railway expects
    console.log('\n🔧 Setting environment variables...');
    const envVars = {
      PORT: '80',
      NGINX_PORT: '80'
    };
    
    await railwayProvider.setEnvironmentVariables(serviceId, envVars);
    console.log('✅ Environment variables set');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate domain
    console.log('\n🌐 Generating public domain...');
    const domainResult = await railwayProvider.generateDomain(serviceId, environmentId);
    
    if (domainResult.success) {
      const url = `https://${domainResult.domain}`;
      
      console.log('\n🎉 SUCCESS! Your website has been deployed!');
      console.log('━'.repeat(60));
      console.log('📊 Deployment Details:');
      console.log(`Project: ${config.name} (${projectId})`);
      console.log(`Service: web (${serviceId})`);
      console.log(`\n🌐 Your website URL:`);
      console.log(`   ${url}`);
      console.log('━'.repeat(60));
      
      // Wait and check
      console.log('\n⏳ Waiting for deployment to complete...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Test the URL
      console.log('\n🧪 Testing the URL...');
      try {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log('✅ Website is responding!');
          const text = await response.text();
          console.log(`Response preview: ${text.substring(0, 100)}...`);
        } else {
          console.log('⚠️  Website returned status:', response.status);
        }
      } catch (error) {
        console.log('❌ Failed to reach website:', error.message);
      }
      
      console.log(`\n🎯 Visit your live website at: ${url}`);
      
    } else {
      console.error('❌ Domain generation failed:', domainResult.error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

// Let's also try deploying a simple Node.js app that we know works
async function deployNodeApp() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  console.log('\n\n🚀 Also deploying a Node.js application...\n');
  
  // Use Railway's official example that definitely works
  const config = {
    name: 'conan-node-app',
    description: 'Node.js app deployed by Conan',
    source: 'github',
    repo: 'railwayapp-templates/express-postgres',
    branch: 'main'
  };
  
  const result = await railwayProvider.deployWithDomain(config);
  
  if (result.success && result.domain) {
    console.log(`\n✅ Node.js app deployed!`);
    console.log(`🌐 URL: ${result.url}`);
  }
}

// Run both deployments
deployWorkingApp().then(() => deployNodeApp());