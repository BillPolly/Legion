#!/usr/bin/env node

/**
 * Verify Complete Pipeline Script
 * 
 * Standalone verification script to test the complete pipeline:
 * - Database connectivity (MongoDB)
 * - Vector database connectivity (Qdrant) 
 * - Nomic embeddings service
 * - ToolRegistry singleton functionality
 * - Semantic search with real embeddings
 * 
 * Usage:
 *   node scripts/verify-complete-pipeline.js
 *   node scripts/verify-complete-pipeline.js --verbose
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { ToolRegistry } from '../src/integration/ToolRegistry.js';
import { NomicEmbeddings } from '@legion/nomic';

class PipelineVerifier {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      ...options
    };
    
    this.resourceManager = null;
    this.toolRegistry = null;
    this.nomicEmbeddings = null;
    this.checks = {
      resourceManager: false,
      mongoDb: false,
      qdrant: false,
      nomic: false,
      toolRegistry: false,
      perspectives: false,
      embeddings: false,
      semanticSearch: false
    };
  }

  async run() {
    console.log('🔍 Verifying Complete Pipeline Setup...\n');
    
    try {
      await this.checkResourceManager();
      await this.checkMongoDb();
      await this.checkQdrant();
      await this.checkNomic();
      await this.checkToolRegistry();
      await this.checkPerspectives();
      await this.checkEmbeddings();
      await this.checkSemanticSearch();
      
      this.printSummary();
      
    } catch (error) {
      console.error('\n❌ Pipeline verification failed:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async checkResourceManager() {
    console.log('📋 Checking ResourceManager singleton...');
    
    try {
      this.resourceManager = await ResourceManager.getResourceManager();
      
      // Check required environment variables
      const requiredVars = [
        'MONGODB_URL',
        'QDRANT_URL',
        'ANTHROPIC_API_KEY'
      ];
      
      const missing = [];
      for (const varName of requiredVars) {
        const value = this.resourceManager.get(`env.${varName}`);
        if (!value) {
          missing.push(varName);
        }
      }
      
      if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
      }
      
      console.log('  ✅ ResourceManager singleton initialized');
      console.log('  ✅ All required environment variables present');
      this.checks.resourceManager = true;
      
    } catch (error) {
      console.log('  ❌ ResourceManager check failed:', error.message);
      throw error;
    }
  }

  async checkMongoDb() {
    console.log('🗄️  Checking MongoDB connectivity...');
    
    try {
      const mongoUrl = this.resourceManager.get('env.MONGODB_URL');
      const { MongoClient } = await import('mongodb');
      
      const client = new MongoClient(mongoUrl);
      await client.connect();
      
      const db = client.db('legion_tools');
      
      // Check collections exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      const expectedCollections = ['tools', 'tool_perspectives', 'perspective_types'];
      const missingCollections = expectedCollections.filter(name => !collectionNames.includes(name));
      
      if (missingCollections.length > 0) {
        console.log(`  ⚠️  Missing collections: ${missingCollections.join(', ')} (will be created automatically)`);
      }
      
      // Check collection counts
      const toolCount = await db.collection('tools').countDocuments();
      const perspectiveCount = await db.collection('tool_perspectives').countDocuments();
      
      console.log('  ✅ MongoDB connection successful');
      console.log(`  📊 Database statistics: ${toolCount} tools, ${perspectiveCount} perspectives`);
      
      await client.close();
      this.checks.mongoDb = true;
      
    } catch (error) {
      console.log('  ❌ MongoDB check failed:', error.message);
      throw error;
    }
  }

  async checkQdrant() {
    console.log('🔍 Checking Qdrant vector database...');
    
    try {
      const qdrantUrl = this.resourceManager.get('env.QDRANT_URL');
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      
      const client = new QdrantClient({ url: qdrantUrl });
      
      // Test connection
      const collections = await client.getCollections();
      
      console.log('  ✅ Qdrant connection successful');
      console.log(`  📊 Collections available: ${collections.collections.length}`);
      
      // Check for tool vector collections
      const toolCollections = collections.collections.filter(c => 
        c.name.includes('tool') || c.name.includes('perspective')
      );
      
      if (toolCollections.length > 0) {
        console.log(`  🔍 Tool-related collections: ${toolCollections.map(c => c.name).join(', ')}`);
        
        // Get statistics for first tool collection
        const firstCollection = toolCollections[0];
        try {
          const info = await client.getCollection(firstCollection.name);
          console.log(`  📊 ${firstCollection.name}: ${info.points_count} vectors`);
        } catch (error) {
          // Collection might be empty, ignore error
        }
      }
      
      this.checks.qdrant = true;
      
    } catch (error) {
      console.log('  ❌ Qdrant check failed:', error.message);
      throw error;
    }
  }

  async checkNomic() {
    console.log('🧠 Checking Nomic embeddings service...');
    
    try {
      this.nomicEmbeddings = new NomicEmbeddings();
      await this.nomicEmbeddings.initialize();
      
      // Test embedding generation
      const testText = 'This is a test for embedding generation';
      const embedding = await this.nomicEmbeddings.embed(testText);
      
      if (!Array.isArray(embedding)) {
        throw new Error('Embedding result is not an array');
      }
      
      if (embedding.length !== 768) {
        throw new Error(`Expected 768 dimensions, got ${embedding.length}`);
      }
      
      // Test batch embedding
      const batchTexts = ['test 1', 'test 2', 'test 3'];
      const batchEmbeddings = await this.nomicEmbeddings.embedBatch(batchTexts);
      
      if (batchEmbeddings.length !== 3) {
        throw new Error(`Expected 3 batch embeddings, got ${batchEmbeddings.length}`);
      }
      
      console.log('  ✅ Nomic embeddings service initialized');
      console.log(`  📊 Embedding dimensions: ${embedding.length}`);
      console.log(`  🔄 Batch processing: ${batchEmbeddings.length} embeddings generated`);
      this.checks.nomic = true;
      
    } catch (error) {
      console.log('  ❌ Nomic check failed:', error.message);
      throw error;
    }
  }

  async checkToolRegistry() {
    console.log('🔧 Checking ToolRegistry singleton...');
    
    try {
      this.toolRegistry = new ToolRegistry({
        resourceManager: this.resourceManager,
        options: {
          enablePerspectives: false,  // Skip LLM-dependent features for verification
          enableVectorSearch: false,  // We'll test vector functionality separately
          dimensions: 768
        }
      });
      
      await this.toolRegistry.initialize();
      
      // Test tool listing
      const tools = await this.toolRegistry.listTools({ limit: 5 });
      
      console.log('  ✅ ToolRegistry singleton initialized');
      console.log(`  📊 Sample tools available: ${tools.length}`);
      
      if (tools.length > 0 && this.options.verbose) {
        console.log('  🔧 Sample tools:');
        tools.forEach(tool => {
          console.log(`    - ${tool.name} (${tool.moduleName})`);
        });
      }
      
      this.checks.toolRegistry = true;
      
    } catch (error) {
      console.log('  ❌ ToolRegistry check failed:', error.message);
      throw error;
    }
  }

  async checkPerspectives() {
    console.log('👁️  Checking perspectives system...');
    
    try {
      // Check perspectives directly from database since we disabled LLM features
      const totalPerspectives = await this.toolRegistry.databaseStorage.db
        .collection('tool_perspectives')
        .countDocuments();
      
      const perspectiveTypes = await this.toolRegistry.databaseStorage.db
        .collection('perspective_types')
        .countDocuments();
      
      console.log('  ✅ Perspectives system available');
      console.log(`  📊 Perspective types: ${perspectiveTypes}`);
      console.log(`  📊 Total perspectives: ${totalPerspectives}`);
      
      if (this.options.verbose && totalPerspectives > 0) {
        // Group perspectives by module
        const byModule = await this.toolRegistry.databaseStorage.db
          .collection('tool_perspectives')
          .aggregate([
            { $group: { _id: '$module_name', count: { $sum: 1 } } }
          ]).toArray();
        
        if (byModule.length > 0) {
          console.log('  📦 By module:');
          byModule.forEach(({ _id, count }) => {
            console.log(`    - ${_id || 'Unknown'}: ${count}`);
          });
        }
      }
      
      this.checks.perspectives = true;
      
    } catch (error) {
      console.log('  ❌ Perspectives check failed:', error.message);
      throw error;
    }
  }

  async checkEmbeddings() {
    console.log('🎯 Checking embedding integration...');
    
    try {
      // Check if perspectives have embeddings
      const perspectivesWithEmbeddings = await this.toolRegistry.databaseStorage.db
        .collection('tool_perspectives')
        .countDocuments({ embedding: { $exists: true, $ne: null } });
      
      const totalPerspectives = await this.toolRegistry.databaseStorage.db
        .collection('tool_perspectives')
        .countDocuments();
      
      console.log('  ✅ Embedding integration check completed');
      console.log(`  📊 Perspectives with embeddings: ${perspectivesWithEmbeddings}/${totalPerspectives}`);
      
      if (perspectivesWithEmbeddings === 0) {
        console.log('  ⚠️  No embeddings found - run load-complete-pipeline.js to generate');
      } else {
        // Sample an embedding to verify format
        const samplePerspective = await this.toolRegistry.databaseStorage.db
          .collection('tool_perspectives')
          .findOne({ embedding: { $exists: true } });
        
        if (samplePerspective && samplePerspective.embedding) {
          console.log(`  🔍 Sample embedding dimensions: ${samplePerspective.embedding.length}`);
          
          if (samplePerspective.embedding.length !== 768) {
            console.log(`  ⚠️  Expected 768 dimensions, found ${samplePerspective.embedding.length}`);
          }
        }
      }
      
      this.checks.embeddings = true;
      
    } catch (error) {
      console.log('  ❌ Embeddings check failed:', error.message);
      throw error;
    }
  }

  async checkSemanticSearch() {
    console.log('🔍 Checking semantic search capabilities...');
    
    try {
      // Create vector store directly for testing since we disabled it in ToolRegistry
      const { QdrantVectorDatabase } = await import('../src/search/QdrantVectorDatabase.js');
      const { VectorStore } = await import('../src/search/VectorStore.js');
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      
      const qdrantUrl = this.resourceManager.get('env.QDRANT_URL');
      const qdrantClient = new QdrantClient({ url: qdrantUrl });
      const qdrantVectorDb = new QdrantVectorDatabase(qdrantClient, {
        dimensions: 768,
        distance: 'cosine'
      });

      // Create adapter for Nomic embeddings
      const nomicEmbeddingService = {
        generateEmbedding: async (text) => {
          return await this.nomicEmbeddings.embed(text);
        },
        generateBatch: async (texts) => {
          return await this.nomicEmbeddings.embedBatch(texts);
        }
      };

      const vectorStore = new VectorStore({
        embeddingClient: nomicEmbeddingService,
        vectorDatabase: qdrantVectorDb,
        collectionName: 'tool_perspectives',  // Check existing collection
        dimensions: 768
      });
      
      // Check vector database statistics
      const vectorStats = await vectorStore.getStatistics();
      
      console.log('  ✅ Semantic search system available');
      console.log(`  📊 Vectors indexed: ${vectorStats.vectors_count}`);
      console.log(`  📊 Dimensions: ${vectorStats.dimensions}`);
      
      if (vectorStats.vectors_count > 0) {
        // Test semantic search
        const testQueries = [
          'mathematical calculations',
          'read files',
          'parse JSON'
        ];
        
        for (const query of testQueries) {
          try {
            const results = await vectorStore.search(query, { limit: 3 });
            console.log(`  🔍 "${query}": ${results.length} results`);
            
            if (results.length > 0 && this.options.verbose) {
              const topResult = results[0];
              console.log(`    Top: ${topResult.toolName} (score: ${topResult.score.toFixed(4)})`);
            }
          } catch (searchError) {
            console.log(`  ⚠️  Search query failed: ${searchError.message}`);
          }
        }
        
        this.checks.semanticSearch = true;
      } else {
        console.log('  ⚠️  No vectors indexed - run load-complete-pipeline.js to index');
        this.checks.semanticSearch = false;
      }
      
    } catch (error) {
      console.log('  ❌ Semantic search check failed:', error.message);
      throw error;
    }
  }

  printSummary() {
    console.log('\n📊 Pipeline Verification Summary:');
    console.log('=====================================');
    
    const checkResults = [
      ['ResourceManager', this.checks.resourceManager],
      ['MongoDB', this.checks.mongoDb],
      ['Qdrant', this.checks.qdrant],
      ['Nomic Embeddings', this.checks.nomic],
      ['ToolRegistry', this.checks.toolRegistry],
      ['Perspectives', this.checks.perspectives],
      ['Embeddings', this.checks.embeddings],
      ['Semantic Search', this.checks.semanticSearch]
    ];
    
    let passed = 0;
    let total = checkResults.length;
    
    checkResults.forEach(([name, status]) => {
      const icon = status ? '✅' : '❌';
      console.log(`${icon} ${name.padEnd(20)} ${status ? 'PASS' : 'FAIL'}`);
      if (status) passed++;
    });
    
    console.log('=====================================');
    console.log(`Overall Status: ${passed}/${total} checks passed`);
    
    if (passed === total) {
      console.log('🎉 Complete pipeline is ready for production use!');
    } else {
      console.log('⚠️  Some components need attention before production use.');
      console.log('\nRecommended actions:');
      if (!this.checks.embeddings) {
        console.log('- Run: node scripts/load-complete-pipeline.js --clear');
      }
      if (!this.checks.semanticSearch) {
        console.log('- Ensure tools are loaded and indexed in vector database');
      }
    }
  }

  async cleanup() {
    if (this.nomicEmbeddings) {
      await this.nomicEmbeddings.close();
    }
    if (this.toolRegistry) {
      await this.toolRegistry.cleanup();
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Verify Complete Pipeline Script

Usage:
  node scripts/verify-complete-pipeline.js [options]

Options:
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

This script verifies all components of the production pipeline:
- ResourceManager singleton
- MongoDB connectivity
- Qdrant vector database
- Nomic embeddings service
- ToolRegistry functionality
- Perspectives system
- Embedding generation
- Semantic search capabilities
    `);
    process.exit(0);
  }
}

// Run the verification
const verifier = new PipelineVerifier(options);
verifier.run().catch(console.error);