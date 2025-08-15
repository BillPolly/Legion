#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@legion/tools-registry';
import ConanTheDeployer from '../../src/ConanTheDeployer.js';

// Initialize ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Register resourceManager so it can be injected
resourceManager.register('resourceManager', resourceManager);

// Create module factory
const moduleFactory = new ModuleFactory(resourceManager);

// Create Conan module
const conanModule = moduleFactory.createModule(ConanTheDeployer);

// Get the check_deployment tool
const checkDeploymentTool = conanModule.getTools().find(tool => tool.name === 'check_deployment');

if (!checkDeploymentTool) {
  console.error('❌ CheckDeploymentTool not found in ConanTheDeployer module!');
  process.exit(1);
}

console.log('✅ CheckDeploymentTool found in module');
console.log('\n🔍 Testing deployment check functionality...\n');

// Set up event listeners on the module to see what's happening
conanModule.on('info', (event) => {
  if (event.tool === 'check_deployment') {
    console.log(event.message);
  }
});

conanModule.on('progress', (event) => {
  if (event.tool === 'check_deployment') {
    console.log(event.message);
  }
});

conanModule.on('warning', (event) => {
  if (event.tool === 'check_deployment') {
    console.log('⚠️ ', event.message);
  }
});

conanModule.on('error', (event) => {
  if (event.tool === 'check_deployment') {
    console.log('❌', event.message);
  }
});

// Test with the existing Railway deployment
const deploymentUrl = 'https://test-express-railway-production-fe3b.up.railway.app';

try {
  const result = await checkDeploymentTool.execute({
    url: deploymentUrl,
    endpoints: ['/', '/status'],
    retries: 3,
    retryDelay: 20000,
    timeout: 15000
  });

  console.log('\n📊 Check Complete:');
  console.log('   Success:', result.success);
  console.log('   Deployment Data:', JSON.stringify(result.data, null, 2));
} catch (error) {
  console.error('❌ Error checking deployment:', error.message);
}