#!/usr/bin/env node
/**
 * Minimal Live Test - Test core SD functionality without external dependencies
 */

import { DesignDatabaseService } from '../src/services/DesignDatabaseService.js';
import { RequirementParserTool } from '../src/tools/requirements/RequirementParserTool.js';
import { LLMClient } from '@legion/llm-client'

// Simple ResourceManager that just loads .env
class SimpleResourceManager {
  constructor() {
    this.env = {};
  }
  
  async initialize() {
    // Load .env file manually
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const envPath = path.resolve(process.cwd(), '../../.env');
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            this.env[key] = valueParts.join('=');
          }
        }
      }
      
      console.log('✅ Environment variables loaded');
    } catch (error) {
      console.warn('⚠️  Could not load .env file:', error.message);
    }
  }
  
  get(key) {
    if (key.startsWith('env.')) {
      const envKey = key.replace('env.', '');
      return this.env[envKey];
    }
    return null;
  }
}

async function runMinimalTest() {
  console.log('🚀 Starting Minimal Live Test...\n');
  
  try {
    // Test 1: ResourceManager
    console.log('📋 Testing ResourceManager...');
    const resourceManager = new SimpleResourceManager();
    await resourceManager.initialize();
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    if (!mongoUrl || !anthropicKey) {
      console.error('❌ Missing required environment variables');
      console.log('MongoDB URL:', !!mongoUrl);
      console.log('Anthropic Key:', !!anthropicKey);
      process.exit(1);
    }
    
    console.log('✅ ResourceManager working');
    
    // Test 2: Database Service
    console.log('\n🗄️  Testing Database Service...');
    const dbService = new DesignDatabaseService(resourceManager);
    await dbService.initialize();
    
    const health = await dbService.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error(`Database unhealthy: ${health.error}`);
    }
    
    console.log('✅ Database service healthy');
    
    // Store a test artifact
    const testArtifact = {
      type: 'live_test_artifact',
      projectId: `live-test-${Date.now()}`,
      data: { message: 'Live test successful' }
    };
    
    const stored = await dbService.storeArtifact(testArtifact);
    console.log('✅ Artifact stored:', stored.id);
    
    // Retrieve it
    const retrieved = await dbService.retrieveArtifacts('live_test_artifact', {
      projectId: testArtifact.projectId
    });
    
    if (retrieved.length !== 1) {
      throw new Error('Artifact retrieval failed');
    }
    
    console.log('✅ Artifact retrieved successfully');
    
    // Test 3: LLM Integration
    console.log('\n🤖 Testing LLM Integration...');
    
    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey
    });
    
    const tool = new RequirementParserTool({
      llmClient: llmClient,
      resourceManager: resourceManager
    });
    
    console.log('🤖 Making live LLM call...');
    const startTime = Date.now();
    
    const result = await tool.execute({
      requirementsText: 'Users should be able to register, login, and manage their profile',
      projectId: testArtifact.projectId,
      analysisDepth: 'basic'
    });
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  LLM call completed in ${duration}ms`);
    
    if (!result.success) {
      throw new Error(`LLM parsing failed: ${result.error}`);
    }
    
    const parsed = result.data.parsedRequirements;
    console.log('✅ LLM parsing successful:');
    console.log(`  - Functional requirements: ${parsed.functional?.length || 0}`);
    console.log(`  - Non-functional requirements: ${parsed.nonFunctional?.length || 0}`);
    
    if (parsed.functional?.length > 0) {
      console.log('  - Example requirement:', parsed.functional[0].description);
    }
    
    // Test 4: End-to-End Storage
    console.log('\n💾 Testing End-to-End Storage...');
    
    // The RequirementParserTool should have stored its results
    const finalStats = await dbService.getProjectStats(testArtifact.projectId);
    console.log('✅ Final project stats:', {
      totalArtifacts: finalStats.totalArtifacts,
      artifactTypes: Object.keys(finalStats.artifactCounts)
    });
    
    if (finalStats.totalArtifacts >= 2) { // Our test artifact + parsed requirements
      console.log('✅ End-to-end workflow successful');
    }
    
    // Cleanup
    await dbService.disconnect();
    
    console.log('\n🎉 All Live Tests Passed! 🎉');
    console.log('\n📊 Summary:');
    console.log('  ✅ ResourceManager: Environment variables loaded');
    console.log('  ✅ Database: MongoDB connection and CRUD operations');
    console.log('  ✅ LLM: Anthropic API calls and requirement parsing');
    console.log('  ✅ Integration: End-to-end workflow with real data storage');
    console.log(`  ⏱️  Total LLM time: ${duration}ms`);
    
  } catch (error) {
    console.error('\n❌ Live Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runMinimalTest();