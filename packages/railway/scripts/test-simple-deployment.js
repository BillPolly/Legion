#!/usr/bin/env node

import { RailwayProvider } from '../src/index.js';

console.log('🧪 Testing Simple Deployment\n');

async function testSimpleDeployment() {
  try {
    const apiKey = process.env.RAILWAY_API_KEY || process.env.RAILWAY;
    if (!apiKey) {
      throw new Error('RAILWAY_API_KEY or RAILWAY environment variable is required');
    }
    const railwayProvider = new RailwayProvider(apiKey);
    
    // Clean up first
    console.log('🧹 Cleaning up previous test project...');
    await railwayProvider.deleteProject('bd1bb627-ab12-4e19-b8eb-b047a848a690');
    console.log('Cleaned up\n');
    
    // Try the deployWithDomain method which should handle everything
    console.log('📦 Using deployWithDomain method...\n');
    
    const config = {
      name: 'simple-test-app',
      description: 'Testing deployment',
      source: 'github',
      repo: 'railwayapp-templates/express-starter',
      branch: 'main'
    };
    
    const result = await railwayProvider.deployWithDomain(config);
    
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Deployment initiated!');
      console.log(`URL: ${result.url}`);
      
      // Wait and test
      console.log('\n⏳ Waiting 90 seconds for deployment...');
      await new Promise(resolve => setTimeout(resolve, 90000));
      
      console.log('\n🧪 Testing URL...');
      try {
        const response = await fetch(result.url);
        console.log(`Status: ${response.status}`);
        
        if (response.ok) {
          const text = await response.text();
          console.log('✅ SUCCESS! App is working!');
          console.log('Response preview:', text.substring(0, 200));
        } else {
          console.log('❌ App returned status:', response.status);
        }
      } catch (error) {
        console.log('❌ Error testing URL:', error.message);
      }
    } else {
      console.log('\n❌ Deployment failed:', result.error || result.errors);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testSimpleDeployment();