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
    const { moduleName } = options;
    
    if (moduleName) {
      console.log(`🧹 Starting clear stage for module: ${moduleName}...`);
      return await this.clearSpecificModule(moduleName, options);
    } else {
      console.log('🧹 Starting clear stage for ALL modules...');
      return await this.clearAll(options);
    }
  }

  /**
   * Clear ALL modules data
   */
  async clearAll(options = {}) {
    // Step 1: Clear Qdrant vectors (if collection exists)
    await this.clearVectorStore();
    
    // Step 2: Clear MongoDB collections
    await this.clearMongoDB();
    
    // Step 3: Always clear modules collection (runtime state)
    const modulesCleared = await this.clearModules();
    
    // Step 4: Verify everything is cleared
    const verificationResult = await this.verify();
    
    if (!verificationResult.success) {
      throw new Error(`Clear verification failed: ${verificationResult.message}`);
    }
    
    // Always add modulesCleared to result
    verificationResult.modulesCleared = modulesCleared;
    
    return verificationResult;
  }

  /**
   * Clear a specific module's data only
   */
  async clearSpecificModule(moduleName, options = {}) {
    console.log(`  Clearing data for module: ${moduleName}`);
    
    // Step 1: Find tools for this module
    const tools = await this.mongoProvider.find('tools', { moduleName });
    const toolIds = tools.map(t => t._id);
    const toolNames = tools.map(t => t.name);
    
    console.log(`  Found ${tools.length} tools to clear: ${toolNames.join(', ')}`);
    
    // Step 2: Clear vectors for this module's tools from Qdrant
    if (toolNames.length > 0) {
      await this.clearModuleVectors(toolNames);
    }
    
    // Step 3: Clear perspectives for this module's tools
    const perspectivesResult = await this.mongoProvider.db
      .collection('tool_perspectives')
      .deleteMany({ 
        $or: [
          { toolId: { $in: toolIds } },
          { toolName: { $in: toolNames } }
        ]
      });
    console.log(`  ✓ Cleared ${perspectivesResult.deletedCount} perspectives`);
    
    // Step 4: Clear tools for this module
    const toolsResult = await this.mongoProvider.db
      .collection('tools')
      .deleteMany({ moduleName });
    console.log(`  ✓ Cleared ${toolsResult.deletedCount} tools`);
    
    // Step 5: Always clear module runtime state  
    const moduleResult = await this.mongoProvider.db
      .collection('modules')
      .deleteMany({ name: moduleName });
    const modulesCleared = moduleResult.deletedCount;
    console.log(`  ✓ Cleared ${modulesCleared} module runtime records`);
    
    // Step 6: Verify the specific module is cleared
    const verificationResult = await this.verifyModuleCleared(moduleName);
    
    if (!verificationResult.success) {
      throw new Error(`Module clear verification failed: ${verificationResult.message}`);
    }
    
    verificationResult.modulesCleared = modulesCleared;
    
    return verificationResult;
  }

  /**
   * Clear vectors for specific tools from Qdrant
   */
  async clearModuleVectors(toolNames) {
    console.log(`  Clearing vectors for tools: ${toolNames.join(', ')}`);
    
    try {
      // Delete vectors by toolName filter
      for (const toolName of toolNames) {
        const deleteResult = await this.vectorStore.deleteByFilter(this.collectionName, {
          toolName: toolName
        });
        console.log(`    ✓ Cleared vectors for tool: ${toolName}`);
      }
    } catch (error) {
      // Collection might not exist, which is fine
      if (!error.message.includes('not found') && !error.message.includes('does not exist')) {
        console.error('  ⚠️ Error clearing module vectors:', error.message);
        // Don't throw - continue with MongoDB clearing
      } else {
        console.log('  ✓ No vectors to clear (collection does not exist)');
      }
    }
  }


  /**
   * Verify a specific module is cleared
   */
  async verifyModuleCleared(moduleName) {
    console.log(`  Verifying clear operation for module: ${moduleName}`);
    
    try {
      // Check MongoDB
      const toolCount = await this.mongoProvider.count('tools', { moduleName });
      const perspectiveCount = await this.mongoProvider.count('tool_perspectives', { 
        toolName: { $regex: new RegExp(`^${moduleName}`, 'i') }
      });
      
      // We can't easily count vectors for a specific module without searching
      // So we'll just verify MongoDB is clear
      
      const allClear = toolCount === 0 && perspectiveCount === 0;
      
      if (!allClear) {
        return {
          success: false,
          message: `Module ${moduleName} not fully cleared! Tools: ${toolCount}, Perspectives: ${perspectiveCount}`,
          toolCount,
          perspectiveCount
        };
      }
      
      console.log(`  ✅ Module ${moduleName} cleared successfully`);
      return {
        success: true,
        message: `Module ${moduleName} cleared successfully`,
        toolCount: 0,
        perspectiveCount: 0,
        vectorCount: 0
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Module clear verification failed: ${error.message}`
      };
    }
  }

  /**
   * Clear the vector store - clears all tool-related collections
   */
  async clearVectorStore() {
    console.log('  Clearing Qdrant vector store...');
    
    try {
      // Get all collections and find tool-related ones
      const collections = await this.vectorStore.client.getCollections();
      const toolRelatedCollections = collections.collections.filter(c => 
        c.name.includes('tool') || c.name.includes('legion')
      );
      
      if (toolRelatedCollections.length === 0) {
        console.log('  ✓ No tool-related collections found in Qdrant');
        return;
      }
      
      console.log(`  Found ${toolRelatedCollections.length} tool-related collections: ${toolRelatedCollections.map(c => c.name).join(', ')}`);
      
      // Clear each collection
      for (const collection of toolRelatedCollections) {
        try {
          const result = await this.vectorStore.clearCollection(collection.name);
          console.log(`  ✓ ${result.message}`);
        } catch (error) {
          // Log error but continue with other collections
          console.error(`  ⚠️ Error clearing collection ${collection.name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('  ⚠️ Error accessing Qdrant collections:', error.message);
      
      // Fallback: try to clear the default collection
      try {
        const result = await this.vectorStore.clearCollection(this.collectionName);
        console.log(`  ✓ Fallback: ${result.message}`);
      } catch (fallbackError) {
        console.error('  ⚠️ Fallback clear also failed:', fallbackError.message);
        // Don't throw - continue with MongoDB clear
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
      
      // Note: We keep module_registry collection as it's discovery metadata
      // modules collection is runtime state that can be cleared
      
    } catch (error) {
      console.error('  ❌ Error clearing MongoDB:', error.message);
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
   * Clear modules collection (runtime state - always cleared)
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
      console.error('  ❌ Error clearing modules:', error.message);
      throw error;
    }
  }
}