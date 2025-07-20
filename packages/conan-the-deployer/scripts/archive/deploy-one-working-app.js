#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 DEPLOYING ONE WORKING APPLICATION\n');

async function deployOneWorkingApp() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  // Use Railway's official Express.js template - this is GUARANTEED to work
  const config = {
    name: 'working-express-app',
    description: 'A simple Express.js app that works on Railway',
    source: 'github',
    repo: 'railwayapp-templates/express-starter',
    branch: 'main'
  };
  
  console.log('📦 Step 1: Creating Railway project...');
  const projectResult = await railwayProvider.createProject(config);
  
  if (!projectResult.success) {
    console.error('❌ Failed to create project:', projectResult.error);
    return;
  }
  
  const projectId = projectResult.project.id;
  console.log(`✅ Project created: ${projectId}\n`);
  
  console.log('📦 Step 2: Creating service with Express.js template...');
  const serviceResult = await railwayProvider.createService(projectId, config);
  
  if (!serviceResult.success) {
    console.error('❌ Failed to create service:', serviceResult.error);
    return;
  }
  
  const serviceId = serviceResult.service.id;
  console.log(`✅ Service created: ${serviceId}\n`);
  
  console.log('📦 Step 3: Getting project details...');
  const projectDetails = await railwayProvider.getProjectDetails(projectId);
  
  if (!projectDetails.success) {
    console.error('❌ Failed to get project details:', projectDetails.error);
    return;
  }
  
  const environmentId = projectDetails.project.environments.edges[0]?.node.id;
  console.log(`✅ Environment ID: ${environmentId}\n`);
  
  // Wait a bit for service to initialize
  console.log('⏳ Waiting 5 seconds for service to initialize...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n📦 Step 4: Generating public domain...');
  const domainResult = await railwayProvider.generateDomain(serviceId, environmentId);
  
  if (!domainResult.success) {
    console.error('❌ Failed to generate domain:', domainResult.error);
    return;
  }
  
  const url = `https://${domainResult.domain}`;
  console.log(`✅ Domain generated: ${url}\n`);
  
  console.log('━'.repeat(60));
  console.log('📊 DEPLOYMENT SUMMARY:');
  console.log(`Project: ${config.name} (${projectId})`);
  console.log(`Service: ${serviceId}`);
  console.log(`URL: ${url}`);
  console.log('━'.repeat(60));
  
  console.log('\n⏳ Waiting 60 seconds for deployment to complete...');
  console.log('Railway needs time to build and deploy the Express.js app.\n');
  
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  console.log('🧪 Testing the deployed application...\n');
  
  try {
    console.log(`Sending GET request to ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const text = await response.text();
      console.log(`\n✅ SUCCESS! The app is working!`);
      console.log(`Response body:\n${text}`);
      console.log(`\n🎉 Your Express.js app is LIVE at: ${url}`);
    } else {
      console.log(`\n⚠️  App returned status ${response.status}`);
      const text = await response.text();
      console.log(`Response: ${text}`);
      console.log('\nThe app may still be building. Try again in a minute.');
    }
  } catch (error) {
    console.error('\n❌ Error testing URL:', error.message);
    console.log('The app may still be deploying. Check back in a minute.');
  }
  
  console.log(`\n🌐 Your application URL: ${url}`);
  console.log('📝 If it shows 502, wait another minute for the build to complete.');
}

deployOneWorkingApp();