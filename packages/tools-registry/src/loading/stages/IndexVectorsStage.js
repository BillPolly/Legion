/**
 * IndexVectorsStage - Indexes perspective embeddings to Qdrant
 * 
 * Responsibilities:
 * - Load perspectives with embeddings from MongoDB
 * - Index vectors to Qdrant using MongoDB _id as vector ID
 * - Verify vector count matches perspectives
 * - Verify sample vectors match MongoDB data
 */

export class IndexVectorsStage {
  constructor(dependencies) {
    this.vectorStore = dependencies.vectorStore;
    this.mongoProvider = dependencies.mongoProvider;
    this.verifier = dependencies.verifier;
    this.stateManager = dependencies.stateManager;
    this.batchSize = dependencies.batchSize || 100; // Qdrant batch size
    this.collectionName = 'legion_tools'; // Qdrant collection name (not MongoDB collection name)
  }

  /**
   * Execute the vector indexing stage
   */
  async execute(options = {}) {
    console.log('🚀 Starting vector indexing stage...');
    
    // Get perspectives with embeddings
    const perspectivesWithEmbeddings = await this.getPerspectivesWithEmbeddings();
    console.log(`  Found ${perspectivesWithEmbeddings.length} perspectives to index`);
    
    if (perspectivesWithEmbeddings.length === 0) {
      console.log('  No perspectives with embeddings to index');
      return await this.verify(0);
    }
    
    // Check for resume capability
    const state = await this.stateManager.getCurrentState();
    const indexedBatches = state?.stages?.indexVectors?.indexedBatches || 0;
    
    if (indexedBatches > 0) {
      console.log(`  Resuming from batch ${indexedBatches + 1}`);
    }
    
    // Process in batches
    const batches = this.createBatches(perspectivesWithEmbeddings, this.batchSize);
    let totalIndexed = 0;
    let batchNumber = 0;
    
    for (const batch of batches) {
      batchNumber++;
      
      // Skip already indexed batches (for resume)
      if (batchNumber <= indexedBatches) {
        totalIndexed += batch.length;
        continue;
      }
      
      try {
        console.log(`  Indexing batch ${batchNumber}/${batches.length} (${batch.length} vectors)`);
        
        // Prepare vectors for Qdrant
        const vectors = this.prepareVectors(batch);
        
        // Index to Qdrant
        await this.indexBatchToQdrant(vectors);
        
        totalIndexed += batch.length;
        console.log(`    ✓ Batch ${batchNumber} indexed (${totalIndexed} total indexed)`);
        
        // Record checkpoint
        await this.stateManager.recordCheckpoint('indexVectors', {
          indexedBatches: batchNumber,
          totalIndexed
        });
        
      } catch (error) {
        console.error(`    ❌ Batch ${batchNumber} failed: ${error.message}`);
        throw error; // Stop on error - can resume from this batch
      }
    }
    
    console.log(`  Vector indexing complete: ${totalIndexed} vectors indexed`);
    
    // Verify
    const verificationResult = await this.verify(perspectivesWithEmbeddings.length);
    
    if (!verificationResult.success) {
      throw new Error(`Vector indexing verification failed: ${verificationResult.message}`);
    }
    
    return {
      ...verificationResult,
      vectorsIndexed: totalIndexed,
      batchesProcessed: batches.length
    };
  }

  /**
   * Get perspectives that have embeddings
   */
  async getPerspectivesWithEmbeddings() {
    return await this.mongoProvider.find('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    }, {
      sort: { toolId: 1, priority: 1 } // Process in consistent order
    });
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Prepare vectors for Qdrant
   */
  prepareVectors(perspectives) {
    return perspectives.map((perspective, index) => {
      // Validate embedding
      if (!perspective.embedding || !Array.isArray(perspective.embedding)) {
        throw new Error(`Perspective ${perspective._id} has invalid embedding`);
      }
      
      if (perspective.embedding.length !== 768) {
        throw new Error(`Perspective ${perspective._id} has wrong embedding dimension: ${perspective.embedding.length}`);
      }
      
      return {
        // Use hash of MongoDB _id for numeric ID (Qdrant prefers numeric or UUID)
        id: this.generateNumericId(perspective._id),
        
        // The embedding vector
        vector: perspective.embedding,
        
        // Minimal payload (lookup full data from MongoDB when needed)
        payload: {
          perspectiveId: perspective._id.toString(),
          toolId: perspective.toolId ? perspective.toolId.toString() : '',
          toolName: perspective.toolName || '',
          perspectiveType: perspective.perspectiveType || perspective.type || '',
          priority: perspective.priority || 100
        }
      };
    });
  }

  /**
   * Generate numeric ID from MongoDB ObjectId
   */
  generateNumericId(objectId) {
    // Convert ObjectId to a numeric hash
    const str = objectId.toString();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Index a batch of vectors to Qdrant
   */
  async indexBatchToQdrant(vectors) {
    try {
      // Upsert vectors to Qdrant - handle both upsert and upsertBatch methods
      const result = await (this.vectorStore.upsertBatch 
        ? this.vectorStore.upsertBatch(this.collectionName, vectors)
        : this.vectorStore.upsert(this.collectionName, vectors));
      
      // Check if operation was successful
      if (!result || result.status === 'error') {
        throw new Error(`Qdrant upsert failed: ${result?.error || 'Unknown error'}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('  Error indexing to Qdrant:', error.message);
      throw error;
    }
  }

  /**
   * Verify vector indexing
   */
  async verify(expectedCount) {
    console.log('  Verifying vector indexing...');
    
    // If no vectors were expected, that's valid (e.g., when no tools were loaded)
    if (expectedCount === 0) {
      console.log('  ✅ No vectors to verify (no tools loaded)');
      return {
        success: true,
        message: 'No vectors to verify',
        vectorCount: 0
      };
    }
    
    // Check vector count matches expected
    const countCheck = await this.verifier.verifyVectorCount(expectedCount);
    
    if (!countCheck.success) {
      return countCheck;
    }
    
    // Check perspective/vector sync
    const syncCheck = await this.verifier.verifyPerspectiveVectorSync();
    
    if (!syncCheck.success) {
      return syncCheck;
    }
    
    // Sample verification - check a few random vectors (only if there are vectors)
    if (expectedCount > 0) {
      const sampleCheck = await this.verifier.verifySampleVectorMatch();
      
      if (!sampleCheck.success) {
        return sampleCheck;
      }
    }
    
    // Get final counts
    const vectorCount = await this.vectorStore.count(this.collectionName);
    const perspectiveCount = await this.mongoProvider.count('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    });
    
    console.log('  ✅ Vector indexing verified successfully');
    console.log(`     Vectors in Qdrant: ${vectorCount}`);
    console.log(`     Perspectives with embeddings: ${perspectiveCount}`);
    console.log(`     Sync ratio: ${(vectorCount / perspectiveCount).toFixed(3)}`);
    
    return {
      success: true,
      message: `Successfully indexed ${vectorCount} vectors`,
      vectorCount,
      perspectiveCount,
      syncRatio: vectorCount / perspectiveCount
    };
  }
}