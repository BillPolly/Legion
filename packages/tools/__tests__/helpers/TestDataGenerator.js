/**
 * Test Data Generator Helper
 * 
 * Provides utilities for generating test data with embeddings
 * for use in various test suites.
 */

import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/tools';

export class TestDataGenerator {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.resourceManager = options.resourceManager;
    this.loadingManager = null;
    this.mongoProvider = null;
  }

  /**
   * Initialize the test data generator
   */
  async initialize() {
    if (!this.resourceManager) {
      this.resourceManager = new ResourceManager();
      await this.resourceManager.initialize();
    }

    // Force local embeddings for tests
    this.resourceManager.set('env.USE_LOCAL_EMBEDDINGS', 'true');

    this.loadingManager = new LoadingManager({
      verbose: this.verbose,
      resourceManager: this.resourceManager
    });

    this.mongoProvider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
      enableSemanticSearch: false
    });

    await this.loadingManager.initialize();
  }

  /**
   * Generate test data with embeddings
   * @param {Object} options Generation options
   * @returns {Object} Summary of generated data
   */
  async generateTestData(options = {}) {
    const {
      moduleFilter = 'Calculator',
      clearFirst = true,
      generatePerspectives = true,
      indexVectors = false
    } = options;

    const result = {
      cleared: false,
      modulesLoaded: 0,
      toolsAdded: 0,
      perspectivesGenerated: 0,
      vectorsIndexed: 0
    };

    // Clear if requested
    if (clearFirst) {
      const clearResult = await this.loadingManager.clearAll();
      result.cleared = true;
      result.clearedCount = clearResult.totalCleared;
    }

    // Load modules
    const loadResult = await this.loadingManager.loadModules(moduleFilter);
    result.modulesLoaded = loadResult.modulesLoaded;
    result.toolsAdded = loadResult.toolsAdded;

    // Generate perspectives with embeddings
    if (generatePerspectives) {
      const perspectiveResult = await this.loadingManager.generatePerspectives(moduleFilter);
      result.perspectivesGenerated = perspectiveResult.perspectivesGenerated;
    }

    // Index vectors if requested
    if (indexVectors) {
      const vectorResult = await this.loadingManager.indexVectors(moduleFilter);
      result.vectorsIndexed = vectorResult.perspectivesIndexed;
    }

    return result;
  }

  /**
   * Get test perspectives with embeddings
   * @param {number} limit Number of perspectives to retrieve
   * @returns {Array} Array of perspectives with embeddings
   */
  async getTestPerspectives(limit = 5) {
    return await this.mongoProvider.databaseService.mongoProvider.find('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    }, { limit });
  }

  /**
   * Get test tools
   * @param {number} limit Number of tools to retrieve
   * @returns {Array} Array of tools
   */
  async getTestTools(limit = 5) {
    return await this.mongoProvider.listTools({ limit });
  }

  /**
   * Verify data was generated correctly
   * @returns {Object} Verification results
   */
  async verifyTestData() {
    const moduleCount = await this.mongoProvider.databaseService.mongoProvider.count('modules', {});
    const toolCount = await this.mongoProvider.databaseService.mongoProvider.count('tools', {});
    const perspectiveCount = await this.mongoProvider.databaseService.mongoProvider.count('tool_perspectives', {});
    const perspectivesWithEmbeddings = await this.mongoProvider.databaseService.mongoProvider.count('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    });

    return {
      modules: moduleCount,
      tools: toolCount,
      perspectives: perspectiveCount,
      perspectivesWithEmbeddings,
      hasData: moduleCount > 0 && toolCount > 0,
      hasEmbeddings: perspectivesWithEmbeddings > 0
    };
  }

  /**
   * Create a sample vector for Qdrant testing
   * @param {Object} perspective Perspective object with embedding
   * @returns {Object} Formatted vector for Qdrant
   */
  createQdrantVector(perspective, id = null) {
    return {
      id: id || `test_${perspective.toolName}_${Date.now()}`,
      vector: Array.from(perspective.embedding),
      payload: {
        perspectiveId: perspective._id?.toString(),
        toolId: perspective.toolId?.toString(),
        toolName: perspective.toolName,
        perspectiveType: perspective.perspectiveType
      }
    };
  }

  /**
   * Create multiple test vectors
   * @param {number} count Number of vectors to create
   * @returns {Array} Array of formatted vectors
   */
  async createTestVectors(count = 5) {
    const perspectives = await this.getTestPerspectives(count);
    return perspectives.map((p, i) => this.createQdrantVector(p, `test_vector_${i}_${Date.now()}`));
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.loadingManager) {
      await this.loadingManager.close();
    }
    if (this.mongoProvider) {
      await this.mongoProvider.disconnect();
    }
  }
}

/**
 * Quick helper function to generate test data
 * @param {Object} options Generation options
 * @returns {TestDataGenerator} Initialized generator with data
 */
export async function generateQuickTestData(options = {}) {
  const generator = new TestDataGenerator(options);
  await generator.initialize();
  await generator.generateTestData(options);
  return generator;
}

/**
 * Shared test data generator for reuse across test suites
 */
let sharedGenerator = null;

export async function getSharedTestDataGenerator() {
  if (!sharedGenerator) {
    sharedGenerator = new TestDataGenerator({ verbose: false });
    await sharedGenerator.initialize();
  }
  return sharedGenerator;
}

export async function cleanupSharedGenerator() {
  if (sharedGenerator) {
    await sharedGenerator.cleanup();
    sharedGenerator = null;
  }
}