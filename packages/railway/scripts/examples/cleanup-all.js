#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🧹 Cleaning up ALL Railway projects\n');

const projectIds = [
  '23c45dab-ef23-4463-95fe-e2ea4ecb0add',
  '25249ff6-e829-44a7-9447-ed8a9966257d', 
  '03cc8eca-6675-4671-a25d-9b6cf57268a9',
  '1bb5416e-f45c-4497-8d07-7b517948f99b',
  '34e68b9d-d460-4f5f-b352-b3ecba43b6d6'
];

async function cleanupAll() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  for (const projectId of projectIds) {
    console.log(`Deleting ${projectId}...`);
    const result = await railwayProvider.deleteProject(projectId);
    console.log(result.success ? '✅ Deleted' : `❌ Failed: ${result.error}`);
  }
}

cleanupAll();