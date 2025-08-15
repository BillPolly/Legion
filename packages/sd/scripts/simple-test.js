#!/usr/bin/env node
/**
 * Simple Test - Just test ResourceManager and basic imports
 */

import { ResourceManager } from '@legion/tools-registry';

async function simpleTest() {
  console.log('🧪 Simple Test - ResourceManager only...\n');
  
  try {
    console.log('📋 Testing ResourceManager import...');
    const resourceManager = new ResourceManager();
    console.log('✅ ResourceManager imported');
    
    console.log('📋 Testing ResourceManager initialization...');
    await resourceManager.initialize();
    console.log('✅ ResourceManager initialized');
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    console.log('📋 Testing environment variables...');
    console.log('MongoDB URL:', !!mongoUrl);
    console.log('Anthropic Key:', !!anthropicKey);
    
    if (mongoUrl && anthropicKey) {
      console.log('✅ All required environment variables found');
    } else {
      console.log('⚠️  Some environment variables missing (but ResourceManager works)');
    }
    
    console.log('\n🎉 Simple Test Passed! 🎉');
    
  } catch (error) {
    console.error('\n❌ Simple Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

simpleTest();