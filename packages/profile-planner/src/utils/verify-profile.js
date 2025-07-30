#!/usr/bin/env node

/**
 * Script to verify a profile by loading modules and extracting tool signatures
 */

import { ProfileVerifier } from './ProfileVerifier.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const profilePath = path.join(__dirname, '..', 'profiles', 'javascript-dev.json');
  
  console.log('='.repeat(60));
  console.log('Profile Verification Tool');
  console.log('='.repeat(60));
  
  const verifier = new ProfileVerifier();
  
  try {
    // Initialize the verifier
    await verifier.initialize();
    
    // Verify the profile
    const verifiedProfile = await verifier.verifyProfile(profilePath);
    
    // Generate tool summary
    console.log('\nTool Summary:');
    console.log('-'.repeat(60));
    const summary = verifier.generateToolSummary(verifiedProfile);
    
    for (const tool of summary) {
      console.log(`\n${tool.tool}.${tool.function}`);
      console.log(`  Description: ${tool.description}`);
      console.log(`  Parameters:`, JSON.stringify(tool.parameters.properties, null, 2));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Profile verification complete!');
    
  } catch (error) {
    console.error('\n❌ Profile verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);