#!/usr/bin/env node

/**
 * Debug AgentToolsModule validation issues
 */

import { ServiceOrchestrator } from './src/services/ServiceOrchestrator.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugValidationError() {
  try {
    console.log('🔍 Starting validation error debugging...');
    
    const resourceManager = await ResourceManager.getInstance();
    const orchestrator = new ServiceOrchestrator();
    await orchestrator.initialize(resourceManager);
    
    const modulePath = 'packages/modules/agent-tools/src/AgentToolsModule.js';
    
    try {
      console.log('🔍 Testing addSingleModule...');
      const result = await orchestrator.addSingleModule(modulePath);
      console.log('✅ Module added:', result);
    } catch (error) {
      console.error('❌ VALIDATION ERROR DETAILS:');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error toString:', error.toString());
      
      // Get all error properties
      const errorProps = {};
      for (const key in error) {
        if (error.hasOwnProperty(key)) {
          errorProps[key] = error[key];
        }
      }
      console.error('❌ Error properties:', errorProps);
      
      // Try to JSON stringify with error handling
      try {
        const errorJSON = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
        console.error('❌ Error as JSON:', errorJSON);
      } catch (jsonError) {
        console.error('❌ Could not stringify error:', jsonError.message);
      }
      
      console.error('❌ Error stack:', error.stack);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

await debugValidationError();