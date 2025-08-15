/**
 * Focused test for perspective generation via LoadingManager
 * 
 * This test isolates the perspective generation functionality
 * to identify and fix issues with the generation process.
 */

import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/core';

describe('Perspective Generation via LoadingManager', () => {
  let loadingManager;
  let resourceManager;
  let mongoProvider;

  beforeAll(async () => {
    // Initialize ResourceManager with forced local embeddings
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    // No need to set embedding type - always uses Nomic

    // Create providers for direct database inspection
    mongoProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });

    // Create LoadingManager
    loadingManager = new LoadingManager({
      verbose: true, // Enable verbose logging to see what's happening
      resourceManager
    });

    await loadingManager.initialize();
  }, 30000);

  afterAll(async () => {
    if (loadingManager) {
      await loadingManager.close();
    }
    if (mongoProvider) {
      await mongoProvider.disconnect();
    }
  });

  beforeEach(async () => {
    // Clear databases before each test
    await loadingManager.clearAll();
  });

  test('should successfully generate perspectives for a single tool', async () => {
    console.log('\n=== Test: Perspective Generation for Single Tool ===\n');

    // Step 1: Load only the calculator tool from Calculator module
    console.log('Step 1: Loading single tool (calculator) from Calculator module...');
    const loadResult = await loadingManager.loadModules({ 
      module: 'Calculator', 
      tool: 'calculator' 
    });
    console.log(`  Modules loaded: ${loadResult.modulesLoaded}`);
    console.log(`  Tools added: ${loadResult.toolsAdded}`);
    
    expect(loadResult.modulesLoaded).toBe(1);
    expect(loadResult.toolsAdded).toBe(1);

    // Step 2: Verify tool is in database
    console.log('\nStep 2: Verifying tool in database...');
    const toolsInDb = await mongoProvider.listTools({ name: 'calculator' });
    console.log(`  Tools found in database: ${toolsInDb.length}`);
    
    if (toolsInDb.length > 0) {
      const tool = toolsInDb[0];
      console.log(`    - ${tool.name}: ${tool.description?.substring(0, 50)}...`);
      console.log(`      Has _id: ${!!tool._id}`);
      console.log(`      Has moduleId: ${!!tool.moduleId}`);
      console.log(`      Has description: ${!!tool.description}`);
      console.log(`      Has inputSchema: ${!!tool.inputSchema}`);
    }
    
    expect(toolsInDb.length).toBe(1);

    // Step 3: Generate perspectives for single tool
    console.log('\nStep 3: Generating perspectives for single tool...');
    const perspectiveResult = await loadingManager.generatePerspectives({ 
      module: 'Calculator', 
      tool: 'calculator' 
    });
    console.log(`  Tools processed: ${perspectiveResult.toolsProcessed}`);
    console.log(`  Perspectives generated: ${perspectiveResult.perspectivesGenerated}`);
    console.log(`  Tools failed: ${perspectiveResult.toolsFailed || 0}`);
    
    expect(perspectiveResult.toolsProcessed).toBe(1);
    expect(perspectiveResult.perspectivesGenerated).toBeGreaterThan(0);

    // Step 4: Verify perspectives in database
    console.log('\nStep 4: Verifying perspectives in database...');
    const perspectivesInDb = await mongoProvider.databaseService.mongoProvider.find(
      'tool_perspectives',
      { toolName: 'calculator' }
    );
    console.log(`  Perspectives in database: ${perspectivesInDb.length}`);
    
    if (perspectivesInDb.length > 0) {
      const sample = perspectivesInDb[0];
      console.log(`  Sample perspective:`);
      console.log(`    Tool: ${sample.toolName}`);
      console.log(`    Type: ${sample.perspectiveType}`);
      console.log(`    Has embedding: ${!!sample.embedding}`);
      console.log(`    Embedding dimensions: ${sample.embedding?.length}`);
    }
    
    expect(perspectivesInDb.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout - faster for single tool

  test('should debug tool structure when retrieved from database', async () => {
    console.log('\n=== Debug: Tool Structure from Database ===\n');

    // Load modules first
    await loadingManager.loadModules('Calculator');

    // Get tools from database (same way LoadingManager does)
    const tools = await mongoProvider.listTools({ moduleName: 'Calculator' });
    
    expect(tools.length).toBeGreaterThan(0);
    
    const firstTool = tools[0];
    console.log('First tool structure:');
    console.log('  Properties:', Object.keys(firstTool));
    console.log('  name:', firstTool.name);
    console.log('  description:', firstTool.description?.substring(0, 100));
    console.log('  _id type:', typeof firstTool._id);
    console.log('  Has execute function:', typeof firstTool.execute);
    console.log('  inputSchema type:', typeof firstTool.inputSchema);
    
    // Check if tool has the properties ToolIndexer expects
    expect(firstTool.name).toBeDefined();
    expect(firstTool.description).toBeDefined();
    expect(firstTool._id).toBeDefined();
  });

  test('should test direct ToolIndexer call with database tool', async () => {
    console.log('\n=== Test: Direct ToolIndexer Call ===\n');

    // Load modules first
    await loadingManager.loadModules('Calculator');

    // Get a tool from database
    const tools = await mongoProvider.listTools({ moduleName: 'Calculator' });
    expect(tools.length).toBeGreaterThan(0);
    
    const tool = tools[0];
    const toolId = tool._id || tool.toolId;
    const metadata = { module: tool.moduleName };
    
    console.log('Attempting to index tool directly:');
    console.log('  Tool name:', tool.name);
    console.log('  Tool ID:', toolId);
    console.log('  Metadata:', metadata);

    try {
      // Call ToolIndexer directly (same as LoadingManager does)
      const result = await loadingManager.toolIndexer.indexTool(tool, metadata, toolId);
      
      console.log('Indexing result:');
      console.log('  Success:', result.success);
      console.log('  Perspectives indexed:', result.perspectivesIndexed);
      console.log('  Embedding IDs:', result.embeddingIds?.length);
      
      expect(result.success).toBe(true);
      expect(result.perspectivesIndexed).toBeGreaterThan(0);
    } catch (error) {
      console.error('ToolIndexer error:', error.message);
      console.error('Error stack:', error.stack);
      
      // Log the tool structure that caused the error
      console.log('\nTool that caused error:');
      console.log(JSON.stringify(tool, null, 2));
      
      throw error;
    }
  }, 60000);

  test('should check if ToolIndexer collection exists', async () => {
    console.log('\n=== Check: Qdrant Collection ===\n');

    // Check if the vector collection exists
    const client = loadingManager.toolIndexer.vectorStore.client;
    const collections = await client.getCollections();
    
    console.log('Available Qdrant collections:');
    for (const collection of collections.collections) {
      console.log(`  - ${collection.name}`);
    }
    
    const toolsCollection = collections.collections.find(
      c => c.name === loadingManager.toolIndexer.collectionName
    );
    
    if (toolsCollection) {
      console.log(`\nTools collection '${loadingManager.toolIndexer.collectionName}' exists`);
      
      // Get collection info
      const collectionInfo = await client.getCollection(loadingManager.toolIndexer.collectionName);
      console.log('Collection configuration:');
      console.log('  Vectors count:', collectionInfo.vectors_count);
      console.log('  Indexed vectors:', collectionInfo.indexed_vectors_count);
      console.log('  Points count:', collectionInfo.points_count);
      
      if (collectionInfo.config) {
        console.log('  Vector size:', collectionInfo.config.params?.vectors?.size);
        console.log('  Distance metric:', collectionInfo.config.params?.vectors?.distance);
      }
    } else {
      console.log(`\n⚠️ Tools collection '${loadingManager.toolIndexer.collectionName}' does not exist`);
      console.log('This might be why vector indexing is failing');
    }
  });

  test('should test full pipeline with all three levels', async () => {
    console.log('\n=== Test: Full Pipeline at All Levels ===\n');

    // Test 1: Single tool
    console.log('Test 1: Single tool (calculator)');
    await loadingManager.clearAll();
    const singleToolResult = await loadingManager.fullPipeline({
      module: 'Calculator',
      tool: 'calculator',
      clearFirst: false,
      includePerspectives: true,
      includeVectors: false
    });
    
    expect(singleToolResult.loadResult.toolsAdded).toBe(1);
    expect(singleToolResult.perspectiveResult.toolsProcessed).toBe(1);
    console.log(`  ✅ Single tool: ${singleToolResult.loadResult.toolsAdded} tool, ${singleToolResult.perspectiveResult.perspectivesGenerated} perspectives`);

    // Test 2: Single module
    console.log('\nTest 2: Single module (Calculator)');
    await loadingManager.clearAll();
    const singleModuleResult = await loadingManager.fullPipeline({
      module: 'Calculator',
      clearFirst: false,
      includePerspectives: true,
      includeVectors: false
    });
    
    expect(singleModuleResult.loadResult.modulesLoaded).toBe(1);
    expect(singleModuleResult.perspectiveResult.toolsProcessed).toBeGreaterThan(0);
    console.log(`  ✅ Single module: ${singleModuleResult.loadResult.toolsAdded} tools, ${singleModuleResult.perspectiveResult.perspectivesGenerated} perspectives`);

    // Test 3: All modules (limited test - just check it works)
    console.log('\nTest 3: All modules (limited test)');
    await loadingManager.clearAll();
    const allModulesResult = await loadingManager.loadModules(); // Just load, don't generate perspectives for all
    
    expect(allModulesResult.modulesLoaded).toBeGreaterThan(1);
    console.log(`  ✅ All modules: ${allModulesResult.modulesLoaded} modules, ${allModulesResult.toolsAdded} tools`);
  }, 60000);

  test('should trace full perspective generation flow', async () => {
    console.log('\n=== Trace: Full Perspective Generation Flow ===\n');

    // Step 1: Clear and load
    console.log('Step 1: Clear and load modules');
    await loadingManager.clearAll();
    const loadResult = await loadingManager.loadModules('Calculator');
    console.log(`  Loaded ${loadResult.toolsAdded} tools`);

    // Step 2: Get pipeline state before generation
    console.log('\nStep 2: Pipeline state before generation');
    let state = loadingManager.getPipelineState();
    console.log('  modulesLoaded:', state.modulesLoaded);
    console.log('  perspectivesGenerated:', state.perspectivesGenerated);
    console.log('  toolCount:', state.toolCount);

    // Step 3: Call generatePerspectives with detailed logging
    console.log('\nStep 3: Calling generatePerspectives...');
    
    try {
      const result = await loadingManager.generatePerspectives('Calculator');
      
      console.log('\nGeneration result:');
      console.log('  perspectivesGenerated:', result.perspectivesGenerated);
      console.log('  toolsProcessed:', result.toolsProcessed);
      console.log('  toolsFailed:', result.toolsFailed);
      
      // Step 4: Check pipeline state after generation
      console.log('\nStep 4: Pipeline state after generation');
      state = loadingManager.getPipelineState();
      console.log('  perspectivesGenerated:', state.perspectivesGenerated);
      console.log('  perspectiveCount:', state.perspectiveCount);
      console.log('  errors:', state.errors);
      
      // Step 5: Verify database state
      console.log('\nStep 5: Database verification');
      const perspectiveCount = await mongoProvider.databaseService.mongoProvider.count(
        'tool_perspectives',
        {}
      );
      console.log('  Perspectives in database:', perspectiveCount);
      
      const perspectivesWithEmbeddings = await mongoProvider.databaseService.mongoProvider.count(
        'tool_perspectives',
        { embedding: { $exists: true, $ne: null } }
      );
      console.log('  Perspectives with embeddings:', perspectivesWithEmbeddings);
      
    } catch (error) {
      console.error('\n❌ Error during perspective generation:');
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
      
      // Check pipeline errors
      state = loadingManager.getPipelineState();
      if (state.errors.length > 0) {
        console.error('\nPipeline errors:');
        state.errors.forEach(err => console.error('  -', err));
      }
      
      throw error;
    }
  }, 60000);
});