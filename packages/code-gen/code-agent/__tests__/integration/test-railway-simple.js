#!/usr/bin/env node

/**
 * Simple test to verify ResourceManager works
 */

import { ResourceManager } from '@jsenvoy/module-loader';

async function main() {
  console.log('Testing ResourceManager...');
  
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const githubToken = resourceManager.get('env.GITHUB_PAT');
    const railwayToken = resourceManager.get('env.RAILWAY_API_TOKEN');
    
    console.log('GitHub token exists:', !!githubToken);
    console.log('Railway token exists:', !!railwayToken);
    
    if (githubToken) {
      console.log('GitHub token length:', githubToken.length);
    }
    
    if (railwayToken) {
      console.log('Railway token length:', railwayToken.length);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();