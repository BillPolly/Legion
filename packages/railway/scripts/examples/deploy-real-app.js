#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying a Real Web Application to Railway\n');

async function deployRealApp() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Deploy a simple Node.js web app from Railway's starter templates
    const config = {
      name: 'my-live-webapp',
      description: 'Live web application deployed via Conan The Deployer',
      source: 'https://github.com/railwayapp/starters',
      branch: 'main',
      environment: {
        NODE_ENV: 'production',
        PORT: '3000'
      }
    };
    
    console.log('📦 Deployment Configuration:');
    console.log(`   Name: ${config.name}`);
    console.log(`   Source: ${config.source}`);
    console.log(`   Branch: ${config.branch}`);
    console.log('');
    
    console.log('🏗️  Creating Railway project and deploying...\n');
    
    const result = await railwayProvider.deploy(config);
    
    if (result.success) {
      console.log('✅ DEPLOYMENT SUCCESSFUL!\n');
      console.log('📋 Deployment Details:');
      console.log(`   Project ID: ${result.projectId}`);
      console.log(`   Service ID: ${result.serviceId}`);
      console.log(`   Deployment ID: ${result.id}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Created: ${new Date(result.createdAt).toLocaleString()}`);
      
      console.log('\n⏳ Waiting for deployment to build...');
      console.log('   This usually takes 1-3 minutes for a Node.js app');
      
      // Poll for deployment status
      let attempts = 0;
      let deploymentUrl = null;
      
      while (attempts < 30) { // Try for up to 5 minutes
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
        
        console.log(`\n🔄 Checking deployment status (attempt ${attempts}/30)...`);
        
        // Get deployment status
        const statusResult = await railwayProvider.getStatus(result.id);
        
        if (statusResult.success && statusResult.deployment) {
          const deployment = statusResult.deployment;
          console.log(`   Status: ${deployment.status}`);
          
          if (deployment.url) {
            deploymentUrl = deployment.url;
            console.log(`   URL: ${deployment.url}`);
            break;
          } else if (deployment.staticUrl) {
            deploymentUrl = deployment.staticUrl;
            console.log(`   Static URL: ${deployment.staticUrl}`);
            break;
          }
          
          if (deployment.status === 'FAILED' || deployment.status === 'CRASHED') {
            console.log('\n❌ Deployment failed!');
            break;
          }
        }
      }
      
      if (deploymentUrl) {
        console.log('\n🎉 YOUR WEB APP IS LIVE!');
        console.log('━'.repeat(50));
        console.log(`🌐 Visit your app at: ${deploymentUrl}`);
        console.log('━'.repeat(50));
        console.log('\n📱 You can now:');
        console.log(`   1. Open in browser: ${deploymentUrl}`);
        console.log(`   2. Test with curl: curl ${deploymentUrl}`);
        console.log('   3. Check Railway dashboard: https://railway.app');
        console.log('\n🎯 The app should show a welcome page with Railway branding!');
      } else {
        console.log('\n⏰ Deployment is still building...');
        console.log('   Check your Railway dashboard for the live URL once it\'s ready:');
        console.log('   https://railway.app');
      }
      
    } else {
      console.log('❌ DEPLOYMENT FAILED');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployRealApp();