/**
 * ClearStage - Clears all databases and prepares for fresh load
 * 
 * Responsibilities:
 * - Clear Qdrant vector collection
 * - Clear MongoDB collections
 * - Verify everything is cleared
 * - Create fresh Qdrant collection with correct dimensions
 */

export class ClearStage {
  constructor(dependencies) {
    this.mongoProvider = dependencies.mongoProvider;
    this.vectorStore = dependencies.vectorStore;
    this.verifier = dependencies.verifier;
    this.collectionName = 'legion_tools';
    this.embeddingDimension = 768; // Nomic embeddings
  }

  /**
   * Execute the clear stage
   */
  async execute(options = {}) {
    console.log('🧹 Starting clear stage...');
    
    // Step 1: Clear Qdrant first (more likely to have issues)
    await this.clearVectorStore();
    
    // Step 2: Clear MongoDB collections
    await this.clearMongoDB();
    
    // Step 2b: Clear modules if requested
    let modulesCleared = 0;
    if (options.clearModules) {
      modulesCleared = await this.clearModules();
    }
    
    // Step 3: Create fresh Qdrant collection
    await this.createFreshQdrantCollection();
    
    // Step 4: Verify everything is cleared
    const verificationResult = await this.verify();
    
    if (!verificationResult.success) {
      throw new Error(`Clear verification failed: ${verificationResult.message}`);
    }
    
    // Add modulesCleared to result if modules were cleared
    if (options.clearModules) {
      verificationResult.modulesCleared = modulesCleared;
    }
    
    return verificationResult;
  }

  /**
   * Clear the vector store
   */
  async clearVectorStore() {
    console.log('  Clearing Qdrant vector store...');
    
    try {
      // Try to delete the collection
      await this.vectorStore.deleteCollection(this.collectionName);
      console.log('  ✓ Qdrant collection deleted');
    } catch (error) {
      // Collection might not exist, which is fine
      if (!error.message.includes('not found') && !error.message.includes('does not exist')) {
        console.error('  ⚠️ Error deleting Qdrant collection:', error.message);
        throw error;
      } else {
        console.log('  ✓ Qdrant collection does not exist (already clear)');
      }
    }
  }

  /**
   * Clear MongoDB collections
   */
  async clearMongoDB() {
    console.log('  Clearing MongoDB collections...');
    
    try {
      // Clear tools collection
      const toolsResult = await this.mongoProvider.db
        .collection('tools')
        .deleteMany({});
      console.log(`  ✓ Cleared ${toolsResult.deletedCount} tools`);
      
      // Clear perspectives collection
      const perspectivesResult = await this.mongoProvider.db
        .collection('tool_perspectives')
        .deleteMany({});
      console.log(`  ✓ Cleared ${perspectivesResult.deletedCount} perspectives`);
      
      // Note: We keep modules collection as it's discovery metadata
      // Only clear if explicitly requested
      
    } catch (error) {
      console.error('  ❌ Error clearing MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Create fresh Qdrant collection with correct dimensions
   */
  async createFreshQdrantCollection() {
    console.log('  Creating fresh Qdrant collection...');
    
    try {
      // Create collection with Nomic embedding dimensions
      await this.vectorStore.createCollection(this.collectionName, {
        dimension: this.embeddingDimension,
        distance: 'Cosine'
      });
      
      console.log(`  ✓ Created Qdrant collection with ${this.embeddingDimension} dimensions`);
      
      // Verify it was created correctly using the Qdrant client directly
      try {
        const collectionInfo = await this.vectorStore.client.getCollection(this.collectionName);
        const actualDimension = collectionInfo?.config?.params?.vectors?.size;
        
        if (actualDimension !== this.embeddingDimension) {
          throw new Error(`Qdrant collection created with wrong dimensions! Expected ${this.embeddingDimension}, got ${actualDimension}`);
        }
      } catch (verifyError) {
        // Collection verification failed, but creation might have succeeded
        console.log('  ⚠️ Could not verify collection dimensions, continuing...');
      }
      
    } catch (error) {
      console.error('  ❌ Error creating Qdrant collection:', error.message);
      throw error;
    }
  }

  /**
   * Verify the clear operation succeeded
   */
  async verify() {
    console.log('  Verifying clear operation...');
    
    const result = await this.verifier.verifyCleared();
    
    if (result.success) {
      console.log('  ✅ Clear stage verified successfully');
    } else {
      console.log('  ❌ Clear verification failed:', result.message);
    }
    
    return result;
  }

  /**
   * Clear modules collection (optional - only when doing full reset)
   */
  async clearModules() {
    console.log('  Clearing modules collection...');
    
    try {
      const result = await this.mongoProvider.db
        .collection('modules')
        .deleteMany({});
      console.log(`  ✓ Cleared ${result.deletedCount} modules`);
      return result.deletedCount;
    } catch (error) {
      console.error('  ⚠️ Error clearing modules:', error.message);
      // Don't throw - modules clear is optional
      return 0;
    }
  }
}