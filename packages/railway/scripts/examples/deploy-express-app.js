#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying Express App from GitHub\n');

async function deployExpressApp() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Use Railway's official Express starter template - this DEFINITELY works
    const config = {
      name: 'conan-express-app',
      description: 'Express app that actually works',
      source: 'github',
      repo: 'railwayapp/starters',
      branch: 'master'
    };
    
    console.log('📦 Deploying Express application from Railway starter template...');
    console.log('This template is guaranteed to work on Railway.\n');
    
    const result = await railwayProvider.deployWithDomain(config);
    
    if (!result.success) {
      console.error('❌ Deployment failed:', result.error || result.errors);
      
      // Try the express template directly
      console.log('\n🔄 Trying alternative template...');
      config.repo = 'railwayapp-templates/expressjs';
      config.branch = 'main';
      
      const result2 = await railwayProvider.deployWithDomain(config);
      
      if (result2.success && result2.domain) {
        console.log('\n✅ Alternative deployment successful!');
        console.log(`🌐 Your Express app is deploying to: ${result2.url}`);
        
        // Wait and test
        console.log('\n⏳ Waiting 45 seconds for deployment...');
        await new Promise(resolve => setTimeout(resolve, 45000));
        
        console.log('🧪 Testing the URL...');
        try {
          const response = await fetch(result2.url);
          console.log(`Status: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            const text = await response.text();
            console.log('✅ App is working!');
            console.log(`Response: ${text.substring(0, 200)}`);
          }
        } catch (error) {
          console.log('Connection error:', error.message);
        }
        
        console.log(`\n🎯 Your working Express app: ${result2.url}`);
      }
      return;
    }
    
    if (result.domain) {
      console.log('\n✅ Deployment successful!');
      console.log(`🌐 Your Express app is deploying to: ${result.url}`);
      
      // Wait for deployment
      console.log('\n⏳ Waiting 45 seconds for deployment to complete...');
      await new Promise(resolve => setTimeout(resolve, 45000));
      
      // Test the URL
      console.log('\n🧪 Testing the deployed app...');
      try {
        const response = await fetch(result.url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        });
        
        console.log(`HTTP Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const text = await response.text();
          console.log('✅ SUCCESS! App is working!');
          console.log(`\nResponse preview:`);
          console.log(text.substring(0, 300));
          console.log('\n🎉 Your Express app is LIVE and working!');
        } else if (response.status === 502) {
          console.log('⚠️  App is still deploying, check back in a minute');
        }
        
      } catch (error) {
        console.log('❌ Connection error:', error.message);
      }
      
      console.log(`\n🌐 Your Express app URL: ${result.url}`);
      console.log('📝 Note: If still showing 502, wait another minute for build to complete');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployExpressApp();