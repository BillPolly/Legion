#!/usr/bin/env node

/**
 * Debug schema validation to get detailed errors
 */

import fs from 'fs/promises';
import { createValidator } from '@legion/schema';
import { ModuleMetadataSchema, ToolMetadataSchema } from './src/verification/schemas/index.js';

async function debugSchemaValidation() {
  try {
    console.log('🔍 Testing schema validation...');
    
    // Load my metadata
    const metadata = JSON.parse(await fs.readFile('../modules/agent-tools/src/module.json', 'utf8'));
    console.log('✅ Loaded metadata:', metadata.module.name);
    
    // Validate module metadata
    const moduleValidator = createValidator(ModuleMetadataSchema);
    const moduleResult = moduleValidator.validate(metadata.module);
    
    console.log('\n📦 MODULE VALIDATION:');
    console.log('Valid:', moduleResult.valid);
    if (!moduleResult.valid) {
      console.log('❌ Module errors:', moduleResult.errors);
    }
    
    // Validate each tool metadata
    const toolValidator = createValidator(ToolMetadataSchema);
    
    console.log('\n🔧 TOOL VALIDATION:');
    for (const [toolName, toolMeta] of Object.entries(metadata.tools)) {
      const toolResult = toolValidator.validate(toolMeta);
      console.log(`\nTool ${toolName}:`);
      console.log('  Valid:', toolResult.valid);
      if (!toolResult.valid) {
        console.log('  ❌ Errors:', toolResult.errors);
      }
    }
    
  } catch (error) {
    console.error('❌ Schema debug error:', error);
  }
}

await debugSchemaValidation();