#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from '../../src/providers/RailwayProvider.js';

console.log('🗑️  Delete All Railway Projects\n');

async function deleteAllProjects() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    const result = await railwayProvider.deleteAllProjects();
    
    if (result.success) {
      console.log('\n✅ Summary:');
      console.log(`Total projects found: ${result.totalProjects}`);
      console.log(`Successfully deleted: ${result.deletedProjects}`);
      console.log(`Failed deletions: ${result.failedDeletions}`);
      
      if (result.failedDeletions > 0) {
        console.log('\n❌ Failed projects:');
        result.results
          .filter(r => !r.success)
          .forEach(r => console.log(`   - ${r.projectName}: ${r.error}`));
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deleteAllProjects();