#!/usr/bin/env node

import SOPRegistry from '../src/index.js';

async function loadSOPs() {
  try {
    console.log('Loading SOPs from data/sops/...\n');
    
    const sopRegistry = await SOPRegistry.getInstance();
    
    const result = await sopRegistry.loadAllSOPs();
    
    console.log(`✅ Loaded ${result.loaded} SOPs`);
    
    if (result.failed > 0) {
      console.log(`❌ Failed ${result.failed} SOPs`);
      result.errors?.forEach(err => {
        console.log(`  • ${err.file}: ${err.error}`);
      });
    }
    
    console.log('');
    
    await sopRegistry.cleanup();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

loadSOPs();