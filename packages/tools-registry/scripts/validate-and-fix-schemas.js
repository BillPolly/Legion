#!/usr/bin/env node

/**
 * Script to validate and fix tool schemas
 * 
 * Usage:
 *   npm run validate-schemas        # Validate only (dry run)
 *   npm run fix-schemas             # Fix all issues
 */

import { ToolSchemaValidator } from '../src/validation/ToolSchemaValidator.js';

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix') || args.includes('fix');
  const dryRun = !shouldFix;
  
  console.log('🚀 Legion Tool Schema Validator');
  console.log('═'.repeat(60));
  
  try {
    const validator = new ToolSchemaValidator({ verbose: true });
    
    if (shouldFix) {
      console.log('🔧 Running in FIX mode - will update database\n');
      await validator.fixIssues(false);
    } else {
      console.log('👀 Running in VALIDATE mode - no changes will be made\n');
      
      // First validate
      const results = await validator.validateAll();
      
      // If issues found, show what would be fixed
      if (results.invalid > 0 || results.warnings.length > 0) {
        console.log('\n💡 To fix these issues, run: npm run fix-schemas');
        console.log('\nPreview of fixes:');
        await validator.fixIssues(true);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);