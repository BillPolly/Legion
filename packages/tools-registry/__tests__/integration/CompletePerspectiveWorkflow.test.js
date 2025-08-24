/**
 * Complete Perspective Workflow Integration Test
 * 
 * This test performs a complete end-to-end workflow for perspective generation:
 * 1. Clears database (except perspective_types to preserve registry)
 * 2. Loads calculator module from tools-collection
 * 3. Generates real perspectives using LLM
 * 4. Verifies generated content quality
 * 5. Leaves database intact for user viewing
 * 
 * Requirements:
 * - ANTHROPIC_API_KEY must be configured
 * - MongoDB must be running
 * - Calculator module must exist in tools-collection
 */

import { ResourceManager } from '@legion/resource-manager';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { Perspectives } from '../../src/search/Perspectives.js';
import { DatabaseInitializer } from '../../src/core/DatabaseInitializer.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Complete Perspective Workflow Integration', () => {
  let resourceManager;
  let databaseStorage;
  let moduleLoader;
  let perspectives;
  let llmClient;
  
  // 30 second timeout for LLM operations
  const LLM_TIMEOUT = 30000;
  
  beforeAll(async () => {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();
    
    // Verify ANTHROPIC_API_KEY is available
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not found in ResourceManager - required for integration test');
    }
    
    // Initialize DatabaseStorage
    databaseStorage = new DatabaseStorage({ 
      resourceManager,
      databaseName: 'legion_tools'
    });
    await databaseStorage.initialize();
    resourceManager.set('databaseStorage', databaseStorage);
    
    // Initialize ModuleLoader
    moduleLoader = new ModuleLoader({ resourceManager });
    
    // Create LLM client
    llmClient = await resourceManager.createLLMClient();
    resourceManager.set('llmClient', llmClient);
    
    console.log('✅ Test environment initialized');
  }, 15000);
  
  afterAll(async () => {
    if (databaseStorage) {
      await databaseStorage.close();
    }
  });
  
  test('should complete full perspective workflow with real LLM', async () => {
    const db = databaseStorage.db;
    
    // ========================================
    // STEP 1: Clear database (preserve perspective_types registry)
    // ========================================
    console.log('\n🗑️  STEP 1: Clearing database (preserving perspective_types)...');
    
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
    
    // Verify perspective_types still exist (registry preserved)
    const perspectiveTypesCount = await db.collection('perspective_types').countDocuments();
    
    if (perspectiveTypesCount === 0) {
      console.log('⚠️  Perspective types not found - initializing...');
      const dbInit = new DatabaseInitializer({ databaseStorage });
      await dbInit.initialize();
    }
    
    // Verify clear state
    const toolsCount = await db.collection('tools').countDocuments();
    const perspectivesCount = await db.collection('tool_perspectives').countDocuments();
    const finalPerspectiveTypesCount = await db.collection('perspective_types').countDocuments();
    
    expect(toolsCount).toBe(0);
    expect(perspectivesCount).toBe(0);
    expect(finalPerspectiveTypesCount).toBeGreaterThanOrEqual(4);
    
    console.log(`  ✅ Database cleared: ${toolsCount} tools, ${perspectivesCount} perspectives`);
    console.log(`  ✅ Perspective types preserved: ${finalPerspectiveTypesCount} types`);
    
    // ========================================
    // STEP 2: Load calculator module
    // ========================================
    console.log('\n📦 STEP 2: Loading calculator module...');
    
    // Calculate path to calculator module
    const calculatorModulePath = path.resolve(__dirname, '../../../tools-collection/src/calculator');
    
    // Load the module
    const calculatorModule = await moduleLoader.loadModule(calculatorModulePath);
    expect(calculatorModule).toBeDefined();
    
    // Get module metadata
    const metadata = await moduleLoader.getModuleMetadata(calculatorModule);
    expect(metadata.name).toBeDefined();
    console.log(`  ✅ Loaded module: ${metadata.name} v${metadata.version}`);
    
    // Get tools from module
    const tools = await moduleLoader.getTools(calculatorModule);
    expect(tools.length).toBeGreaterThan(0);
    console.log(`  ✅ Found ${tools.length} tools`);
    
    // Save tools to database
    for (const tool of tools) {
      const toolDoc = {
        _id: `${metadata.name.toLowerCase()}:${tool.name}`,
        name: tool.name,
        description: tool.description || '',
        moduleName: metadata.name,
        inputSchema: tool.inputSchema || {},
        outputSchema: tool.outputSchema || {},
        category: tool.category || 'general',
        tags: tool.tags || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('tools').replaceOne(
        { _id: toolDoc._id },
        toolDoc,
        { upsert: true }
      );
    }
    
    // Verify tools saved
    const savedToolsCount = await db.collection('tools').countDocuments();
    expect(savedToolsCount).toBe(tools.length);
    console.log(`  ✅ Saved ${savedToolsCount} tools to database`);
    
    // Verify calculator tool exists
    const calculatorTool = tools.find(t => t.name === 'calculator');
    expect(calculatorTool).toBeDefined();
    console.log(`  ✅ Calculator tool found: ${calculatorTool.name}`);
    
    // Note: Tool execution testing is handled separately in the module's own tests
    // This integration test focuses on the perspective generation workflow
    
    // ========================================
    // STEP 3: Generate real perspectives using LLM
    // ========================================
    console.log('\n🤖 STEP 3: Generating real perspectives with LLM...');
    
    // Initialize Perspectives system (NOT in mock mode)
    perspectives = new Perspectives({
      resourceManager,
      options: { verbose: false, mockMode: false }
    });
    await perspectives.initialize();
    
    // Verify we're not in mock mode
    expect(perspectives.mockMode).toBe(false);
    console.log('  ✅ Perspectives system initialized in REAL LLM mode');
    
    // Generate perspectives for calculator tool
    console.log('  🔄 Calling LLM to generate perspectives...');
    const generatedPerspectives = await perspectives.generatePerspectivesForTool('calculator', {
      forceRegenerate: true
    });
    
    expect(generatedPerspectives).toBeDefined();
    expect(Array.isArray(generatedPerspectives)).toBe(true);
    expect(generatedPerspectives.length).toBeGreaterThan(0);
    
    console.log(`  ✅ Generated ${generatedPerspectives.length} perspectives`);
    
    // ========================================
    // STEP 4: Verify generated content quality
    // ========================================
    console.log('\n🔍 STEP 4: Verifying generated content quality...');
    
    // Check database state
    const finalPerspectivesCount = await db.collection('tool_perspectives').countDocuments();
    expect(finalPerspectivesCount).toBe(generatedPerspectives.length);
    console.log(`  ✅ Database contains ${finalPerspectivesCount} perspectives`);
    
    // Verify perspective content quality
    for (const perspective of generatedPerspectives) {
      expect(perspective.tool_name).toBe('calculator');
      expect(perspective.perspective_type_name).toBeDefined();
      expect(perspective.content).toBeDefined();
      expect(perspective.content.length).toBeGreaterThan(50); // Meaningful content
      expect(perspective.batch_id).toBeDefined();
      expect(perspective.generated_at).toBeDefined();
      
      // Keywords should be present for most perspectives
      if (perspective.keywords) {
        expect(Array.isArray(perspective.keywords)).toBe(true);
        expect(perspective.keywords.length).toBeGreaterThan(0);
      }
    }
    
    console.log('  ✅ All perspectives have quality content');
    
    // Check perspective type coverage
    const perspectiveTypes = [...new Set(generatedPerspectives.map(p => p.perspective_type_name))];
    expect(perspectiveTypes.length).toBeGreaterThanOrEqual(3); // Should have multiple types
    console.log(`  ✅ Coverage: ${perspectiveTypes.length} perspective types`);
    console.log(`    Types: ${perspectiveTypes.join(', ')}`);
    
    // ========================================
    // STEP 5: Display sample generated content
    // ========================================
    console.log('\n📝 STEP 5: Sample generated content:');
    
    const samplePerspectives = generatedPerspectives.slice(0, 2);
    for (const [index, sample] of samplePerspectives.entries()) {
      console.log(`\n  📌 Sample ${index + 1}: ${sample.perspective_type_name}`);
      
      const preview = sample.content.length > 200 ? 
        sample.content.substring(0, 200) + '...' : 
        sample.content;
      console.log(`     Content: ${preview.replace(/\n/g, ' ')}`);
      
      if (sample.keywords && sample.keywords.length > 0) {
        console.log(`     Keywords: ${sample.keywords.slice(0, 8).join(', ')}${sample.keywords.length > 8 ? '...' : ''}`);
      }
      
      console.log(`     Batch ID: ${sample.batch_id}`);
      console.log(`     Generated: ${sample.generated_at}`);
    }
    
    // ========================================
    // FINAL: Database state summary (left intact for user)
    // ========================================
    console.log('\n📊 Final database state (left intact for viewing):');
    console.log(`  ✅ Perspective Types: ${finalPerspectiveTypesCount}`);
    console.log(`  ✅ Tools: ${savedToolsCount}`);
    console.log(`  ✅ Tool Perspectives: ${finalPerspectivesCount}`);
    console.log(`  ✅ Perspective Type Coverage: ${perspectiveTypes.length} types`);
    
    console.log('\n🎉 Complete perspective workflow successful!');
    console.log('\n💡 View results with:');
    console.log('   node scripts/verify-perspectives.js --verbose --samples');
    
    // Test passes - database is left intact for user viewing
    
  }, LLM_TIMEOUT);
});