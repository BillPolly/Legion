#!/usr/bin/env node
/**
 * Live Integration Test Script - Standalone
 * 
 * This script tests real MongoDB + LLM integration without Jest dependencies
 * 
 * Run with: node scripts/live-test.js
 */

import { ResourceManager } from '@legion/tools';
import { DesignDatabaseService } from '../src/services/DesignDatabaseService.js';
import { RequirementParserTool } from '../src/tools/requirements/RequirementParserTool.js';
import SDModule from '../src/SDModule.js';

async function runLiveTests() {
  console.log('🚀 Starting Live Integration Tests...\n');
  
  try {
    // Initialize ResourceManager
    console.log('📋 Initializing ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Check environment variables
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    console.log('📊 Environment Check:');
    console.log(`  - MongoDB URL: ${mongoUrl ? '✅ Present' : '❌ Missing'}`);
    console.log(`  - Anthropic API Key: ${anthropicKey ? '✅ Present' : '❌ Missing'}`);
    
    if (!mongoUrl || !anthropicKey) {
      throw new Error('Missing required environment variables');
    }
    
    // Test 1: Database Integration
    console.log('\n🗄️  Testing Database Integration...');
    await testDatabaseIntegration(resourceManager);
    
    // Test 2: LLM Integration
    console.log('\n🤖 Testing LLM Integration...');
    await testLLMIntegration(resourceManager);
    
    // Test 3: End-to-End Workflow
    console.log('\n🔄 Testing End-to-End Workflow...');
    await testEndToEndWorkflow(resourceManager);
    
    console.log('\n✅ All Live Tests Passed! 🎉');
    
  } catch (error) {
    console.error('❌ Live Test Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function testDatabaseIntegration(resourceManager) {
  const databaseService = new DesignDatabaseService(resourceManager);
  await databaseService.initialize();
  
  const testProjectId = `live-test-${Date.now()}`;
  
  // Health check
  const health = await databaseService.healthCheck();
  if (health.status !== 'healthy') {
    throw new Error(`Database unhealthy: ${health.error}`);
  }
  console.log('  ✅ Database connection healthy');
  
  // Store artifact
  const testArtifact = {
    type: 'test_requirement',
    projectId: testProjectId,
    data: {
      requirements: ['User can login', 'System is secure'],
      priority: 'high'
    }
  };
  
  const stored = await databaseService.storeArtifact(testArtifact);
  if (!stored._id || !stored.id) {
    throw new Error('Artifact storage failed - no ID returned');
  }
  console.log(`  ✅ Artifact stored with ID: ${stored.id}`);
  
  // Retrieve artifact
  const retrieved = await databaseService.retrieveArtifacts('test_requirement', {
    projectId: testProjectId
  });
  
  if (retrieved.length !== 1) {
    throw new Error(`Expected 1 artifact, got ${retrieved.length}`);
  }
  
  if (retrieved[0].id !== stored.id) {
    throw new Error('Retrieved artifact ID mismatch');
  }
  console.log('  ✅ Artifact retrieval successful');
  
  // Project stats
  const stats = await databaseService.getProjectStats(testProjectId);
  if (stats.totalArtifacts !== 1) {
    throw new Error(`Expected 1 total artifact, got ${stats.totalArtifacts}`);
  }
  console.log(`  ✅ Project stats: ${stats.totalArtifacts} artifacts`);
  
  // Context storage
  const testContext = {
    contextType: 'requirements_context',
    projectId: testProjectId,
    data: { stakeholders: ['PM', 'Dev'] }
  };
  
  const contextStored = await databaseService.storeContext(testContext);
  if (!contextStored._id) {
    throw new Error('Context storage failed');
  }
  console.log('  ✅ Context storage successful');
  
  await databaseService.disconnect();
  console.log('  ✅ Database tests completed');
}

async function testLLMIntegration(resourceManager) {
  const sdModule = await SDModule.create(resourceManager);
  
  if (!sdModule.llmClient) {
    throw new Error('LLM client not initialized');
  }
  console.log('  ✅ LLM client initialized');
  
  // Test requirement parsing with live LLM
  const tool = new RequirementParserTool({
    llmClient: sdModule.llmClient,
    resourceManager: resourceManager
  });
  
  const testRequirements = `
    The e-commerce platform should allow customers to:
    - Browse products by category
    - Add items to shopping cart
    - Complete secure checkout with payment
    - Track order status and history
    - The system must handle 500 concurrent users
    - All payments must be PCI compliant
    - Response time should be under 3 seconds
  `;
  
  console.log('  🤖 Making live LLM API call...');
  const startTime = Date.now();
  
  const result = await tool.execute({
    requirementsText: testRequirements,
    projectId: `llm-test-${Date.now()}`,
    analysisDepth: 'detailed'
  });
  
  const duration = Date.now() - startTime;
  console.log(`  ⏱️  LLM call completed in ${duration}ms`);
  
  if (!result.success) {
    throw new Error(`LLM parsing failed: ${result.error}`);
  }
  
  const parsed = result.data.parsedRequirements;
  
  if (!parsed.functional || !Array.isArray(parsed.functional)) {
    throw new Error('Invalid functional requirements structure');
  }
  
  if (!parsed.nonFunctional || !Array.isArray(parsed.nonFunctional)) {
    throw new Error('Invalid non-functional requirements structure');
  }
  
  if (parsed.functional.length < 3) {
    throw new Error(`Expected at least 3 functional requirements, got ${parsed.functional.length}`);
  }
  
  if (parsed.nonFunctional.length < 2) {
    throw new Error(`Expected at least 2 non-functional requirements, got ${parsed.nonFunctional.length}`);
  }
  
  console.log(`  ✅ LLM extracted ${parsed.functional.length} functional requirements`);
  console.log(`  ✅ LLM extracted ${parsed.nonFunctional.length} non-functional requirements`);
  
  // Validate specific content
  const functionalText = JSON.stringify(parsed.functional);
  if (!functionalText.includes('cart') && !functionalText.includes('shopping')) {
    console.warn('  ⚠️  Shopping cart requirement may not have been identified correctly');
  }
  
  const nonFunctionalText = JSON.stringify(parsed.nonFunctional);
  if (!nonFunctionalText.includes('500') && !nonFunctionalText.includes('concurrent')) {
    console.warn('  ⚠️  Concurrent users requirement may not have been identified correctly');
  }
  
  console.log('  ✅ LLM integration tests completed');
}

async function testEndToEndWorkflow(resourceManager) {
  const databaseService = new DesignDatabaseService(resourceManager);
  await databaseService.initialize();
  
  const sdModule = await SDModule.create(resourceManager);
  const testProjectId = `e2e-test-${Date.now()}`;
  
  // Simulate a complete workflow
  const requirements = 'User registration system with email verification and password reset functionality';
  
  // Step 1: Parse requirements with LLM
  const parser = new RequirementParserTool({
    llmClient: sdModule.llmClient,
    resourceManager: resourceManager
  });
  
  const parseResult = await parser.execute({
    requirementsText: requirements,
    projectId: testProjectId,
    analysisDepth: 'comprehensive'
  });
  
  if (!parseResult.success) {
    throw new Error('Requirement parsing failed in E2E workflow');
  }
  
  // Step 2: Store the parsed requirements
  const artifact = {
    type: 'parsed_requirements',
    projectId: testProjectId,
    data: parseResult.data.parsedRequirements,
    metadata: {
      toolUsed: 'RequirementParserTool',
      timestamp: new Date().toISOString()
    }
  };
  
  const stored = await databaseService.storeArtifact(artifact);
  if (!stored.id) {
    throw new Error('Artifact storage failed in E2E workflow');
  }
  
  // Step 3: Verify workflow completion
  const stats = await databaseService.getProjectStats(testProjectId);
  if (stats.totalArtifacts !== 1) {
    throw new Error('E2E workflow did not create expected artifacts');
  }
  
  console.log('  ✅ Requirements parsed with LLM');
  console.log('  ✅ Artifacts stored in MongoDB');
  console.log('  ✅ Project statistics updated');
  console.log(`  📊 Final project stats: ${stats.totalArtifacts} artifacts`);
  
  await databaseService.disconnect();
  console.log('  ✅ End-to-end workflow completed');
}

// Run the tests
runLiveTests().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});