#!/usr/bin/env node

/**
 * Debug validation by calling ModuleDiscovery directly
 */

import { ModuleDiscovery } from './src/core/ModuleDiscovery.js';
import { ModuleLoader } from './src/core/ModuleLoader.js';
import { MetadataManager } from './src/verification/MetadataManager.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugValidationDirect() {
  try {
    console.log('🔍 Direct validation testing...');
    
    const resourceManager = await ResourceManager.getInstance();
    
    // Create module loader
    const moduleLoader = new ModuleLoader();
    
    // Load the module with ResourceManager
    console.log('🔍 Loading module...');
    const moduleInstance = await moduleLoader.loadModule('packages/modules/agent-tools/src/AgentToolsModule.js', {
      resourceManager: resourceManager
    });
    console.log('✅ Module loaded:', moduleInstance.name);
    console.log('✅ Module tools count:', moduleInstance.getTools().length);
    
    // Create module discovery with metadata manager
    const metadataManager = new MetadataManager();
    const moduleDiscovery = new ModuleDiscovery({ metadataManager });
    
    // Validate the module
    console.log('🔍 Validating module...');
    const validation = await moduleDiscovery.validateModule(moduleInstance);
    
    console.log('\n📊 VALIDATION RESULTS:');
    console.log('Valid:', validation.valid);
    console.log('Tool count:', validation.toolsCount);
    console.log('Errors:', validation.errors);
    console.log('Errors type:', typeof validation.errors);
    console.log('Errors length:', validation.errors?.length);
    
    if (!validation.valid) {
      console.log('\n❌ DETAILED ERROR ANALYSIS:');
      validation.errors.forEach((error, i) => {
        console.log(`Error ${i}:`, error);
        console.log(`Error type:`, typeof error);
        if (typeof error === 'object') {
          console.log(`Error keys:`, Object.keys(error));
          console.log(`Error JSON:`, JSON.stringify(error, null, 2));
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Direct debug error:', error);
  }
}

await debugValidationDirect();