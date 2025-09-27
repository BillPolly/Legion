#!/usr/bin/env node

import SOPRegistry from '../src/index.js';

const forceRegenerate = process.argv.includes('--force');

async function generatePerspectives() {
  try {
    console.log('Generating perspectives...\n');
    if (forceRegenerate) {
      console.log('🔄 Force regenerate mode enabled\n');
    }
    
    const sopRegistry = await SOPRegistry.getInstance();
    
    const result = await sopRegistry.generateAllPerspectives({ 
      forceRegenerate 
    });
    
    console.log(`✅ Generated ${result.generated} perspectives`);
    
    if (result.failed > 0) {
      console.log(`❌ Failed ${result.failed} SOPs`);
      result.errors?.forEach(err => {
        console.log(`  • ${err.title}: ${err.error}`);
      });
    }
    
    console.log('');
    
    await sopRegistry.cleanup();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

generatePerspectives();