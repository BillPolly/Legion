#!/usr/bin/env node

/**
 * Check Available Tools Script
 * 
 * This script checks what tools are actually available in the ModuleLoader
 * and maps them against profile requirements to identify mismatches.
 */

import { ModuleLoader } from '@legion/tools';
import { ResourceManager } from '@legion/tools';

async function main() {
  console.log('🔍 Checking Available Tools vs Profile Requirements\n');
  
  try {
    // Initialize ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    await moduleLoader.loadAllFromRegistry();
    
    // Get all canonical tool names
    const tools = await moduleLoader.getAllToolNames(false);
    console.log('📋 Available Tools (canonical names):');
    tools.sort().forEach(t => console.log(`   - ${t}`));
    
    console.log('\n🔄 Profile Tool Mapping Check:');
    const profileNeeds = [
      'execute_command',
      'write_file', 
      'read_file',
      'create_directory',
      'list_directory',
      'install_dependencies',
      'run_npm_script',
      'start_dev_server',
      'run_tests',
      'validate_code'
    ];
    
    const mapping = {};
    for (const need of profileNeeds) {
      const available = await moduleLoader.hasToolByNameOrAlias(need);
      const actual = await moduleLoader.getToolByNameOrAlias(need);
      const status = available ? '✅' : '❌';
      const actualName = actual ? ` -> ${actual.name}` : '';
      
      console.log(`   ${need}: ${status}${actualName}`);
      
      if (actual) {
        mapping[need] = actual.name;
      }
    }
    
    console.log('\n📝 Suggested Profile Corrections:');
    for (const [profileName, actualName] of Object.entries(mapping)) {
      if (profileName !== actualName) {
        console.log(`   Change "${profileName}" to "${actualName}"`);
      }
    }
    
    // Check for missing tools
    console.log('\n⚠️  Missing Tools (need to find alternatives):');
    for (const need of profileNeeds) {
      const available = await moduleLoader.hasToolByNameOrAlias(need);
      if (!available) {
        // Find similar tools
        const similar = tools.filter(t => 
          t.includes(need.split('_')[0]) || 
          need.split('_').some(part => t.includes(part))
        );
        if (similar.length > 0) {
          console.log(`   ${need} -> Consider: ${similar.join(', ')}`);
        } else {
          console.log(`   ${need} -> No similar tools found`);
        }
      }
    }
    
    console.log('\n✅ Tool mapping analysis complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);