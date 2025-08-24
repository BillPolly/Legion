/**
 * EmbeddingWorkflow.test.js - Integration test for Nomic embedding functionality
 * 
 * Tests the complete embedding workflow:
 * 1. Generate perspectives with embeddings
 * 2. Retroactively add embeddings to existing perspectives
 * 3. Verify embedding storage and retrieval
 * 4. Test embedding statistics
 */

import { ResourceManager } from '@legion/resource-manager';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';  
import { Perspectives } from '../../src/search/Perspectives.js';
import { EmbeddingService } from '../../src/search/EmbeddingService.js';
import { NomicEmbeddings } from '@legion/nomic';

describe('EmbeddingWorkflow Integration', () => {
  let resourceManager;
  let databaseStorage;
  let moduleLoader;
  let perspectives;

  beforeAll(async () => {
    // Create ResourceManager and initialize
    resourceManager = await ResourceManager.getResourceManager();
    
    // Use test database
    resourceManager.set('test.database.name', `test_embedding_workflow_${Date.now()}`);
    
    // Create LLM client for real embedding generation
    const llmClient = await resourceManager.createLLMClient();
    resourceManager.set('llmClient', llmClient);
    
    // Initialize database storage
    databaseStorage = new DatabaseStorage({ resourceManager });
    await databaseStorage.initialize();
    resourceManager.set('databaseStorage', databaseStorage);
    
    // Initialize module loader  
    moduleLoader = new ModuleLoader({ resourceManager });
    resourceManager.set('moduleLoader', moduleLoader);

    // Load Calculator module for testing
    const calculatorPath = '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/calculator/CalculatorModule.js';
    const calculatorModule = await moduleLoader.loadModule(calculatorPath);
    
    // Save module and its tools to database 
    const databaseOperations = await import('../../src/core/DatabaseOperations.js');
    const dbOps = new databaseOperations.DatabaseOperations({
      databaseStorage,
      resourceManager,
      verbose: false
    });
    await dbOps.loadModule(calculatorPath);
    
    // Initialize Perspectives system
    perspectives = new Perspectives({ 
      resourceManager, 
      options: { 
        verbose: true,
        generateEmbeddings: true // Enable embeddings by default
      } 
    });
    await perspectives.initialize();

    // Register the embedding service in ResourceManager for ToolRegistry VectorStore
    // Use the same approach as the Perspectives class to get existing embedding service
    const existingEmbeddingService = perspectives.embeddingService;
    if (existingEmbeddingService) {
      resourceManager.set('embeddingService', existingEmbeddingService);
    } else {
      // Fallback: create new embedding service with already initialized LLM client
      const embeddingService = new EmbeddingService({
        resourceManager,
        options: { dimensions: 768 }
      });
      await embeddingService.initialize();
      resourceManager.set('embeddingService', embeddingService);
    }
  }, 30000);

  afterAll(async () => {
    if (databaseStorage) {
      await databaseStorage.clearAll();
      await databaseStorage.close();
    }
  });

  describe('Embedding Generation Workflow', () => {
    
    test('should generate perspectives with Nomic embeddings', async () => {
      // Generate perspectives for calculator tool
      const perspectiveDocs = await perspectives.generatePerspectivesForTool('calculator');
      
      expect(perspectiveDocs).toBeDefined();
      expect(perspectiveDocs.length).toBeGreaterThan(0);
      
      // Check that each perspective has an embedding
      for (const perspective of perspectiveDocs) {
        expect(perspective.embedding).toBeDefined();
        expect(perspective.embedding).not.toBeNull();
        expect(Array.isArray(perspective.embedding)).toBe(true);
        expect(perspective.embedding.length).toBe(768); // Nomic dimensions
        expect(perspective.embedding_model).toBeDefined();
        expect(perspective.embedding_dimensions).toBe(768);
        
        // Verify embedding values are valid numbers
        for (const value of perspective.embedding) {
          expect(typeof value).toBe('number');
          expect(isFinite(value)).toBe(true);
        }
      }
      
      console.log(`✅ Generated ${perspectiveDocs.length} perspectives with 768-dimensional embeddings`);
    }, 60000);

    test('should retrieve perspectives with embeddings from database', async () => {
      // Retrieve perspectives from database
      const storedPerspectives = await perspectives.getToolPerspectives('calculator');
      
      expect(storedPerspectives).toBeDefined();
      expect(storedPerspectives.length).toBeGreaterThan(0);
      
      // Check that stored perspectives have embeddings
      for (const perspective of storedPerspectives) {
        expect(perspective.embedding).toBeDefined();
        expect(perspective.embedding).not.toBeNull();
        expect(Array.isArray(perspective.embedding)).toBe(true);
        expect(perspective.embedding.length).toBe(768);
        expect(perspective.embedding_model).toContain('nomic');
        expect(perspective.embedding_dimensions).toBe(768);
      }
      
      console.log(`✅ Retrieved ${storedPerspectives.length} perspectives with embeddings from database`);
    }, 15000);

    test('should get embedding statistics', async () => {
      const stats = await perspectives.getEmbeddingStats();
      
      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.withEmbeddings).toBeGreaterThan(0);
      expect(stats.withoutEmbeddings).toBeGreaterThanOrEqual(0);
      expect(stats.embeddingCoverage).toBeGreaterThan(0);
      expect(stats.embeddingCoverage).toBeLessThanOrEqual(1);
      
      console.log('📊 Embedding stats:', JSON.stringify(stats, null, 2));
    }, 15000);

  });

  describe('Retroactive Embedding Generation', () => {
    
    test('should handle perspectives without embeddings', async () => {
      // First, clear existing perspectives for calculator  
      await databaseStorage.deleteToolPerspectivesByTool('calculator');
      
      // Generate perspectives for calculator WITHOUT embeddings
      await perspectives.generatePerspectivesForTool('calculator', {
        forceRegenerate: true,
        generateEmbeddings: false // Disable embeddings for this call
      });
      
      // Check that these perspectives don't have embeddings
      const perspectivesWithoutEmb = await perspectives.getPerspectivesWithoutEmbeddings('calculator');
      expect(perspectivesWithoutEmb.length).toBeGreaterThan(0);
      
      for (const perspective of perspectivesWithoutEmb) {
        expect(perspective.embedding === null || perspective.embedding === undefined).toBe(true);
      }
      
      console.log(`✅ Created ${perspectivesWithoutEmb.length} perspectives without embeddings`);
    }, 30000);

    test('should generate embeddings for existing perspectives', async () => {
      // Generate embeddings for existing perspectives without them
      const stats = await perspectives.generateEmbeddingsForExisting('calculator');
      
      expect(stats).toBeDefined();
      expect(stats.processed).toBeGreaterThan(0);
      expect(stats.updated).toBeGreaterThan(0);
      expect(stats.failed).toBe(0);
      
      // Verify perspectives now have embeddings
      const updatedPerspectives = await perspectives.getToolPerspectives('calculator');
      for (const perspective of updatedPerspectives) {
        expect(perspective.embedding).toBeDefined();
        expect(perspective.embedding).not.toBeNull();
        expect(Array.isArray(perspective.embedding)).toBe(true);
        expect(perspective.embedding.length).toBe(768);
      }
      
      console.log('✅ Retroactive embedding generation stats:', JSON.stringify(stats, null, 2));
    }, 60000);

    test('should show improved embedding coverage after retroactive generation', async () => {
      const finalStats = await perspectives.getEmbeddingStats();
      
      expect(finalStats.withoutEmbeddings).toBe(0); // Should be 0 after retroactive generation
      expect(finalStats.embeddingCoverage).toBe(1); // Should be 100% coverage
      
      console.log('📊 Final embedding stats:', JSON.stringify(finalStats, null, 2));
    }, 15000);

  });

  describe('Embedding Vector Operations', () => {
    
    test('should be able to perform similarity operations', async () => {
      // Get all perspectives with embeddings
      const allPerspectives = await databaseStorage.findToolPerspectives({
        embedding: { $ne: null }
      });
      
      expect(allPerspectives.length).toBeGreaterThanOrEqual(2);
      
      // Test similarity calculation using Nomic service
      const nomicService = new NomicEmbeddings();
      await nomicService.initialize();
      
      const embedding1 = allPerspectives[0].embedding;
      const embedding2 = allPerspectives[1].embedding;
      
      const similarity = await nomicService.similarity(embedding1, embedding2);
      
      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      expect(isFinite(similarity)).toBe(true);
      
      console.log(`✅ Similarity between perspectives: ${similarity.toFixed(4)}`);
      
      await nomicService.close();
    }, 30000);

    test('should verify embedding persistence and retrieval', async () => {
      // Direct database query to verify embedding storage
      const collection = databaseStorage.getCollection('tool_perspectives');
      const perspectiveWithEmbedding = await collection.findOne({ 
        embedding: { $ne: null } 
      });
      
      expect(perspectiveWithEmbedding).toBeDefined();
      expect(perspectiveWithEmbedding.embedding).toBeDefined();
      expect(Array.isArray(perspectiveWithEmbedding.embedding)).toBe(true);
      expect(perspectiveWithEmbedding.embedding.length).toBe(768);
      expect(perspectiveWithEmbedding.embedding_model).toBeDefined();
      expect(perspectiveWithEmbedding.embedding_dimensions).toBe(768);
      
      console.log('✅ Verified embedding persistence in MongoDB');
      console.log(`   - Tool: ${perspectiveWithEmbedding.tool_name}`);
      console.log(`   - Type: ${perspectiveWithEmbedding.perspective_type_name}`);
      console.log(`   - Model: ${perspectiveWithEmbedding.embedding_model}`);
      console.log(`   - Dimensions: ${perspectiveWithEmbedding.embedding_dimensions}`);
      console.log(`   - First 5 values: [${perspectiveWithEmbedding.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    }, 15000);

  });

  describe('Vector Database Integration', () => {
    
    test('should automatically index perspectives in Qdrant vector database', async () => {
      // Get ToolRegistry singleton to access VectorStore
      const toolRegistry = resourceManager.get('toolRegistry');
      if (!toolRegistry) {
        console.warn('⚠️  ToolRegistry not available - creating for test');
        const { ToolRegistry } = await import('../../src/integration/ToolRegistry.js');
        const registry = new ToolRegistry({ resourceManager });
        await registry.initialize();
        resourceManager.set('toolRegistry', registry);
      }

      // Get VectorStore instance
      const vectorStore = await resourceManager.get('toolRegistry').getVectorStore();
      expect(vectorStore).toBeDefined();

      // Generate perspectives for calculator with automatic vector indexing
      await perspectives.generatePerspectivesForTool('calculator', {
        forceRegenerate: true,
        generateEmbeddings: true,
        enableVectorIndexing: true // Ensure vector indexing is enabled
      });

      // Check that perspectives were indexed in Qdrant
      const searchResults = await vectorStore.search('mathematical calculations', {
        limit: 5,
        minScore: 0.3
      });

      expect(searchResults).toBeDefined();
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Verify search results contain calculator perspectives
      const calculatorResults = searchResults.filter(r => 
        r.toolName === 'calculator' || 
        r.description?.includes('calculator') ||
        r.context?.includes('calculation')
      );
      
      expect(calculatorResults.length).toBeGreaterThan(0);

      // Verify result structure
      for (const result of calculatorResults) {
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('toolName');
        expect(result).toHaveProperty('description');
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }

      console.log(`✅ Found ${calculatorResults.length} calculator perspectives in Qdrant vector database`);
      console.log(`   - Top result score: ${calculatorResults[0].score.toFixed(4)}`);
      console.log(`   - Top result: ${calculatorResults[0].toolName} - ${calculatorResults[0].description}`);
    }, 60000);

    test('should search for semantically similar tools using vector database', async () => {
      const vectorStore = await resourceManager.get('toolRegistry').getVectorStore();
      
      // Search for different types of functionality
      const queries = [
        'arithmetic operations and math',
        'numerical computations', 
        'solving equations'
      ];

      for (const query of queries) {
        const searchResults = await vectorStore.search(query, {
          limit: 3,
          minScore: 0.2
        });

        expect(searchResults).toBeDefined();
        expect(searchResults.length).toBeGreaterThan(0);

        // Verify all results have required properties
        for (const result of searchResults) {
          expect(result).toHaveProperty('score');
          expect(result).toHaveProperty('toolName');
          expect(result.score).toBeGreaterThan(0.2);
        }

        console.log(`✅ Query "${query}" returned ${searchResults.length} results`);
        if (searchResults.length > 0) {
          console.log(`   - Best match: ${searchResults[0].toolName} (score: ${searchResults[0].score.toFixed(4)})`);
        }
      }
    }, 30000);

    test('should verify vector database statistics', async () => {
      const vectorStore = await resourceManager.get('toolRegistry').getVectorStore();
      
      // Get collection statistics
      const stats = await vectorStore.getCollectionInfo();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('collection');
      expect(stats).toHaveProperty('vectors_count');
      expect(stats).toHaveProperty('dimensions');
      expect(stats).toHaveProperty('status');
      
      expect(stats.vectors_count).toBeGreaterThan(0);
      expect(stats.dimensions).toBe(768); // Nomic embedding dimensions
      expect(stats.status).toBe('connected');

      console.log('📊 Qdrant Vector Database Stats:');
      console.log(`   - Collection: ${stats.collection}`);
      console.log(`   - Vectors: ${stats.vectors_count}`);
      console.log(`   - Dimensions: ${stats.dimensions}`);
      console.log(`   - Status: ${stats.status}`);
    }, 15000);

    test('should handle tool perspective removal from vector database', async () => {
      const toolRegistry = resourceManager.get('toolRegistry');
      const vectorStore = await toolRegistry.getVectorStore();

      // Get initial vector count
      const initialStats = await vectorStore.getCollectionInfo();
      const initialCount = initialStats.vectors_count;

      // Remove calculator tool vectors
      const removeResult = await toolRegistry.removeToolVectors('calculator');
      expect(removeResult).toBeDefined();
      expect(removeResult.success).toBe(true);

      // Verify vectors were removed
      const finalStats = await vectorStore.getCollectionInfo();
      expect(finalStats.vectors_count).toBeLessThan(initialCount);

      // Verify calculator no longer appears in search results
      const searchResults = await vectorStore.search('mathematical calculations', {
        limit: 10,
        minScore: 0.1
      });

      const calculatorResults = searchResults.filter(r => r.toolName === 'calculator');
      expect(calculatorResults.length).toBe(0);

      console.log(`✅ Removed calculator vectors from Qdrant`);
      console.log(`   - Vectors before: ${initialCount}`);
      console.log(`   - Vectors after: ${finalStats.vectors_count}`);
      console.log(`   - Removed: ${initialCount - finalStats.vectors_count}`);
    }, 30000);

  });
});