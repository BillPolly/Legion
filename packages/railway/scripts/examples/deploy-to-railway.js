#!/usr/bin/env node

import DeployApplicationTool from './src/tools/DeployApplicationTool.js';

console.log('🚀 Deploying a real project to Railway...\n');

const deployTool = new DeployApplicationTool();

const deployCall = {
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'railway',
      config: {
        name: 'conan-demo-app',
        source: 'https://github.com/railwayapp/starters',
        branch: 'main',
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        railway: {
          region: 'us-west1'
        }
      }
    })
  }
};

try {
  console.log('📦 Starting deployment...');
  const result = await deployTool.invoke(deployCall);
  
  console.log('\n📋 Deployment Result:');
  console.log('Success:', result.success);
  
  if (result.success) {
    console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
    console.log('Deployment ID:', result.data.deployment.id);
    console.log('Provider:', result.data.deployment.provider);
    console.log('Status:', result.data.deployment.status);
    console.log('Created:', result.data.deployment.createdAt);
    
    if (result.data.deployment.url) {
      console.log('URL:', result.data.deployment.url);
    } else {
      console.log('URL: Building... (will be available once build completes)');
    }
    
    console.log('\n📝 Summary:', result.data.summary);
    
    console.log('\n🔄 Next Steps:');
    result.data.nextSteps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    
    console.log('\n🌐 Check your Railway dashboard at: https://railway.app');
    console.log('🎯 You should see the "conan-demo-app" deployment there!');
    
  } else {
    console.log('\n❌ DEPLOYMENT FAILED');
    console.log('Error:', result.error);
    
    if (result.suggestions) {
      console.log('\n💡 Suggestions:');
      result.suggestions.forEach((suggestion, i) => {
        console.log(`  ${i + 1}. ${suggestion}`);
      });
    }
  }
  
} catch (error) {
  console.error('\n💥 Deployment Error:', error.message);
  process.exit(1);
}