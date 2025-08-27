#!/usr/bin/env node

import { ResourceManager } from '@legion/tools-registry';

console.log('Starting debug test...');

try {
  const resourceManager = ResourceManager.getInstance();
  console.log('ResourceManager created');
  
  await resourceManager.initialize();
  console.log('ResourceManager initialized');
  
  const githubToken = resourceManager.env.GITHUB_PAT;
  const railwayToken = resourceManager.env.RAILWAY_API_TOKEN;
  
  console.log('GITHUB_PAT exists:', !!githubToken);
  console.log('RAILWAY_API_TOKEN exists:', !!railwayToken);
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}