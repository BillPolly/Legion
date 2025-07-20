#!/usr/bin/env node

import { RailwayProvider } from '../src/index.js';

console.log('🗑️  Delete All Railway Projects\n');

async function deleteAllProjects() {
  try {
    const apiKey = process.env.RAILWAY_API_KEY || process.env.RAILWAY;
    if (!apiKey) {
      throw new Error('RAILWAY_API_KEY or RAILWAY environment variable is required');
    }
    const railwayProvider = new RailwayProvider(apiKey);
    
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