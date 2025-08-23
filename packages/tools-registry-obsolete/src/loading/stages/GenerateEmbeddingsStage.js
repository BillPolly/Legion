/**
 * GenerateEmbeddingsStage - Generates embeddings for all perspectives
 * 
 * Responsibilities:
 * - Load perspectives without embeddings
 * - Generate embeddings in batches
 * - Update perspectives with embeddings
 * - Verify all perspectives have correct embeddings
 */

export class GenerateEmbeddingsStage {
  constructor(dependencies) {
    this.embeddingService = dependencies.embeddingService;
    this.mongoProvider = dependencies.mongoProvider;
    this.verifier = dependencies.verifier;
    this.stateManager = dependencies.stateManager;
    this.batchSize = dependencies.batchSize || 50; // Process in batches
    this.embeddingDimension = 768; // Nomic embeddings
  }

  /**
   * Execute the embedding generation stage
   */
  async execute(options = {}) {
    console.log('🧮 Starting embedding generation stage...');
    
    // Get perspectives without embeddings
    const perspectivesWithoutEmbeddings = await this.getPerspectivesWithoutEmbeddings();
    console.log(`  Found ${perspectivesWithoutEmbeddings.length} perspectives needing embeddings`);
    
    if (perspectivesWithoutEmbeddings.length === 0) {
      console.log('  All perspectives already have embeddings');
      const verificationResult = await this.verify();
      return {
        ...verificationResult,
        embeddingsGenerated: 0,
        batchesProcessed: 0,
        perspectivesProcessed: 0
      };
    }
    
    // Check for resume capability
    const state = await this.stateManager.getCurrentState();
    const processedBatches = state?.stages?.generateEmbeddings?.processedBatches || 0;
    
    if (processedBatches > 0) {
      console.log(`  Resuming from batch ${processedBatches + 1}`);
    }
    
    // Process in batches
    const batches = this.createBatches(perspectivesWithoutEmbeddings, this.batchSize);
    let totalProcessed = 0;
    let batchNumber = 0;
    
    for (const batch of batches) {
      batchNumber++;
      
      // Skip already processed batches (for resume)
      if (batchNumber <= processedBatches) {
        continue;
      }
      
      try {
        console.log(`  Processing batch ${batchNumber}/${batches.length} (${batch.length} perspectives)`);
        
        // Extract texts for embedding
        const texts = batch.map(p => p.perspectiveText);
        
        // Generate embeddings
        const embeddings = await this.generateBatchEmbeddings(texts);
        
        if (embeddings.length !== batch.length) {
          throw new Error(`Embedding count mismatch! Expected ${batch.length}, got ${embeddings.length}`);
        }
        
        // Verify embedding dimensions
        for (const embedding of embeddings) {
          if (embedding.length !== this.embeddingDimension) {
            throw new Error(`Wrong embedding dimension! Expected ${this.embeddingDimension}, got ${embedding.length}`);
          }
        }
        
        // Update perspectives with embeddings
        await this.updatePerspectivesWithEmbeddings(batch, embeddings);
        
        totalProcessed += batch.length;
        console.log(`    ✓ Batch ${batchNumber} complete (${totalProcessed} total processed)`);
        
        // Record checkpoint
        await this.stateManager.recordCheckpoint('generateEmbeddings', {
          processedBatches: batchNumber,
          totalProcessed
        });
        
      } catch (error) {
        console.error(`    ❌ Batch ${batchNumber} failed: ${error.message}`);
        throw error; // Stop on error - can resume from this batch
      }
    }
    
    console.log(`  Embedding generation complete: ${totalProcessed} embeddings generated`);
    
    // Verify
    const verificationResult = await this.verify();
    
    if (!verificationResult.success) {
      throw new Error(`Embedding generation verification failed: ${verificationResult.message}`);
    }
    
    return {
      ...verificationResult,
      embeddingsGenerated: totalProcessed,
      batchesProcessed: batches.length,
      perspectivesProcessed: totalProcessed
    };
  }

  /**
   * Get perspectives that don't have embeddings yet
   */
  async getPerspectivesWithoutEmbeddings() {
    return await this.mongoProvider.find('tool_perspectives', {
      $or: [
        { embedding: { $exists: false } },
        { embedding: null },
        { embedding: [] }
      ]
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
   * Generate embeddings for a batch of texts
   */
  async generateBatchEmbeddings(texts) {
    try {
      // Use the embedding service (should be using Nomic)
      const embeddings = await this.embeddingService.generateEmbeddings(texts);
      
      // Verify we got the right number of embeddings
      if (embeddings.length !== texts.length) {
        throw new Error(`Embedding service returned wrong number of embeddings`);
      }
      
      return embeddings;
      
    } catch (error) {
      console.error('  Error generating embeddings:', error.message);
      throw error;
    }
  }

  /**
   * Update perspectives with their embeddings
   */
  async updatePerspectivesWithEmbeddings(perspectives, embeddings) {
    // Update each perspective with its embedding
    for (let i = 0; i < perspectives.length; i++) {
      const perspective = perspectives[i];
      const embedding = embeddings[i];
      
      try {
        await this.mongoProvider.update(
          'tool_perspectives',
          { _id: perspective._id },
          {
            $set: {
              embedding: embedding,
              embeddingModel: 'nomic-embed-text-v1',
              embeddingGeneratedAt: new Date()
            }
          }
        );
      } catch (error) {
        console.error(`    Failed to update perspective ${perspective._id}:`, error.message);
        throw error;
      }
    }
  }

  /**
   * Verify embedding generation
   */
  async verify() {
    console.log('  Verifying embedding generation...');
    
    // Get counts first
    const totalPerspectives = await this.mongoProvider.count('tool_perspectives', {});
    const withEmbeddings = await this.mongoProvider.count('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    });
    
    // If there are no perspectives at all, that's valid (e.g., when no tools were loaded)
    if (totalPerspectives === 0) {
      console.log('  ✅ No perspectives to verify (no tools loaded)');
      return {
        success: true,
        message: 'No perspectives to verify',
        perspectiveCount: 0,
        embeddingCount: 0
      };
    }
    
    // Check all perspectives have embeddings
    const embeddingCheck = await this.verifier.verifyAllPerspectivesHaveEmbeddings();
    
    if (!embeddingCheck.success) {
      return embeddingCheck;
    }
    
    // Check embedding dimensions (only if there are embeddings)
    if (withEmbeddings > 0) {
      const dimensionCheck = await this.verifier.verifyEmbeddingDimensions(this.embeddingDimension);
      
      if (!dimensionCheck.success) {
        return dimensionCheck;
      }
    }
    
    console.log('  ✅ Embedding generation verified successfully');
    console.log(`     Total perspectives: ${totalPerspectives}`);
    console.log(`     With embeddings: ${withEmbeddings}`);
    
    return {
      success: true,
      message: `All ${withEmbeddings} perspectives have valid embeddings`,
      perspectiveCount: totalPerspectives,
      embeddingCount: withEmbeddings
    };
  }
}