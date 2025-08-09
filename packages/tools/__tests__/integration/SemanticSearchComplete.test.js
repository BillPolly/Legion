/**
 * Complete Semantic Search Integration Test
 * 
 * Tests the full workflow:
 * 1. Database population with real modules
 * 2. Text-based search functionality
 * 3. Tool retrieval and execution
 * 
 * NO MOCKING - Uses real components throughout
 */

import { jest } from '@jest/globals';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ResourceManager } from '@legion/tools';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Semantic Search Complete Integration', () => {
  let resourceManager;
  let mongoProvider;
  let toolRegistry;
  let testDir;

  beforeAll(async () => {
    // Set longer timeout for database operations
    jest.setTimeout(30000);

    // Create test directory for tool execution
    testDir = path.join(__dirname, '../../../scratch/test-semantic-search-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create some test files/directories
    await fs.mkdir(path.join(testDir, 'subdir1'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'subdir2'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'test1.txt'), 'Test content 1');
    await fs.writeFile(path.join(testDir, 'test2.json'), '{"test": true}');
  });

  afterAll(async () => {
    // Cleanup test directory
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
    
    // Disconnect from MongoDB
    if (mongoProvider && mongoProvider.connected) {
      try {
        await mongoProvider.databaseService.cleanup();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('should populate database, search for tools, and execute directory_list', async () => {
    console.log('\n🧪 Starting Semantic Search Complete Integration Test\n');

    // Step 1: Initialize ResourceManager with real environment
    console.log('1️⃣ Initializing ResourceManager...');
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const dbName = resourceManager.get('env.TOOLS_DATABASE_NAME');
    expect(dbName).toBe('legion_tools');
    console.log(`   ✅ Using database: ${dbName}`);

    // Step 2: Create MongoDB provider (real connection)
    console.log('\n2️⃣ Creating MongoDB provider...');
    mongoProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: true
    });
    expect(mongoProvider).toBeDefined();
    expect(mongoProvider.connected).toBe(true);
    console.log('   ✅ MongoDB provider connected');

    // Step 3: Clear and populate database with real modules
    console.log('\n3️⃣ Populating database with real modules...');
    const populateResults = await mongoProvider.populateDatabase({
      clearExisting: true,
      includeEmbeddings: false, // Skip embeddings (requires packages)
      verbose: false,
      dryRun: false
    });
    
    expect(populateResults.modules.saved).toBeGreaterThan(0);
    expect(populateResults.tools.saved).toBeGreaterThan(0);
    console.log(`   ✅ Populated: ${populateResults.modules.saved} modules, ${populateResults.tools.saved} tools`);

    // Step 4: Create text indexes for search
    console.log('\n4️⃣ Creating text indexes...');
    const db = mongoProvider.databaseService.mongoProvider.db;
    
    try {
      await db.collection('tools').createIndex({
        name: 'text',
        description: 'text',
        summary: 'text',
        'tags': 'text'
      }, {
        weights: { name: 10, description: 5, summary: 3, tags: 2 },
        name: 'tools_text_search'
      });
      console.log('   ✅ Created text index on tools');
    } catch (error) {
      if (error.codeName !== 'IndexOptionsConflict') {
        throw error;
      }
      console.log('   ℹ️ Text index already exists');
    }

    // Step 5: Search for directory tools using text search
    console.log('\n5️⃣ Searching for directory tools...');
    const searchResults = await mongoProvider.searchTools('directory', { limit: 10 });
    
    expect(searchResults).toBeDefined();
    expect(searchResults.length).toBeGreaterThan(0);
    
    const directoryListTool = searchResults.find(t => t.name === 'directory_list');
    expect(directoryListTool).toBeDefined();
    
    console.log(`   ✅ Found ${searchResults.length} directory tools:`);
    searchResults.forEach(tool => {
      console.log(`      - ${tool.name}: ${tool.description?.substring(0, 50)}...`);
    });

    // Step 6: Verify tool has complete schema
    console.log('\n6️⃣ Verifying directory_list tool schema...');
    expect(directoryListTool.inputSchema).toBeDefined();
    expect(directoryListTool.inputSchema.type).toBe('object');
    expect(directoryListTool.inputSchema.properties).toBeDefined();
    expect(directoryListTool.inputSchema.properties.dirpath).toBeDefined();
    console.log('   ✅ Tool has complete inputSchema');

    // Step 7: Create ToolRegistry and load the tool
    console.log('\n7️⃣ Loading tool through ToolRegistry...');
    toolRegistry = new ToolRegistry({ provider: mongoProvider });
    await toolRegistry.initialize();
    
    // The tool should be available as 'file.directory_list' or just 'directory_list'
    let tool = await toolRegistry.getTool('directory_list');
    if (!tool) {
      tool = await toolRegistry.getTool('file.directory_list');
    }
    
    expect(tool).toBeDefined();
    expect(tool.execute).toBeDefined();
    expect(typeof tool.execute).toBe('function');
    console.log('   ✅ Tool loaded successfully');

    // Step 8: Execute the directory_list tool on real directory
    console.log('\n8️⃣ Executing directory_list tool...');
    console.log(`   📁 Listing contents of: ${testDir}`);
    
    const result = await tool.execute({ dirpath: testDir });
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.contents).toBeDefined();
    expect(Array.isArray(result.data.contents)).toBe(true);
    expect(result.data.contents.length).toBeGreaterThan(0);
    
    console.log(`   ✅ Tool executed successfully, found ${result.data.contents.length} entries:`);
    result.data.contents.forEach(entry => {
      console.log(`      - ${entry.name} (${entry.type})`);
    });

    // Step 9: Verify the results contain our test files/directories
    console.log('\n9️⃣ Verifying results contain expected entries...');
    
    const entryNames = result.data.contents.map(e => e.name);
    expect(entryNames).toContain('subdir1');
    expect(entryNames).toContain('subdir2');
    expect(entryNames).toContain('test1.txt');
    expect(entryNames).toContain('test2.json');
    
    const subdir1 = result.data.contents.find(e => e.name === 'subdir1');
    expect(subdir1).toBeDefined();
    expect(subdir1.type).toBe('directory');
    
    const test1 = result.data.contents.find(e => e.name === 'test1.txt');
    expect(test1).toBeDefined();
    expect(test1.type).toBe('file');
    
    console.log('   ✅ All expected entries found with correct types');

    // Step 10: Test searching with different queries
    console.log('\n🔟 Testing additional search queries...');
    
    const fileSearchResults = await mongoProvider.searchTools('file', { limit: 5 });
    expect(fileSearchResults.length).toBeGreaterThan(0);
    console.log(`   ✅ "file" search returned ${fileSearchResults.length} results`);
    
    const jsonSearchResults = await mongoProvider.searchTools('json', { limit: 5 });
    expect(jsonSearchResults.length).toBeGreaterThan(0);
    console.log(`   ✅ "json" search returned ${jsonSearchResults.length} results`);

    // Final summary
    console.log('\n✅ Complete Semantic Search Integration Test PASSED!');
    console.log('   - Database populated with real modules');
    console.log('   - Text search working correctly');
    console.log('   - Tool loaded and executed successfully');
    console.log('   - Real directory listing performed');
    console.log('   - NO MOCKING used throughout');
  });

  test('should handle tool execution errors gracefully', async () => {
    console.log('\n🧪 Testing error handling...\n');

    // Ensure toolRegistry is initialized
    if (!toolRegistry) {
      resourceManager = new ResourceManager();
      await resourceManager.initialize();
      
      mongoProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
        enableSemanticSearch: true
      });
      
      toolRegistry = new ToolRegistry({ provider: mongoProvider });
      await toolRegistry.initialize();
    }

    // Try to list a non-existent directory
    const tool = await toolRegistry.getTool('directory_list') || 
                  await toolRegistry.getTool('file.directory_list');
    
    expect(tool).toBeDefined();
    
    const nonExistentPath = '/this/path/definitely/does/not/exist/12345';
    console.log(`   Attempting to list non-existent path: ${nonExistentPath}`);
    
    const result = await tool.execute({ dirpath: nonExistentPath });
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    console.log(`   ✅ Error handled correctly: ${result.error}`);
  });

  test('should find tools by capability description', async () => {
    console.log('\n🧪 Testing capability-based search...\n');

    // Search for tools that can read files
    const readCapability = await mongoProvider.searchTools('read file', { limit: 5 });
    expect(readCapability.length).toBeGreaterThan(0);
    
    const fileReadTool = readCapability.find(t => t.name === 'file_read');
    expect(fileReadTool).toBeDefined();
    console.log(`   ✅ Found file_read tool via capability search`);

    // Search for tools that can parse data
    const parseCapability = await mongoProvider.searchTools('parse', { limit: 5 });
    expect(parseCapability.length).toBeGreaterThan(0);
    
    const jsonParseTool = parseCapability.find(t => t.name === 'json_parse');
    expect(jsonParseTool).toBeDefined();
    console.log(`   ✅ Found json_parse tool via capability search`);
  });
});