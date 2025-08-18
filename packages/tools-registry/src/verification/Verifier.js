/**
 * @fileoverview Verifier - Comprehensive validation for tool registry integrity
 * 
 * Provides centralized validation logic for:
 * - Tool:perspective:vector count ratios
 * - Database consistency
 * - Pipeline clearing verification
 * - Relationship integrity
 */

export class Verifier {
  constructor(mongoProvider, semanticSearchProvider, verbose = false) {
    this.mongoProvider = mongoProvider;
    this.semanticSearchProvider = semanticSearchProvider;
    this.verbose = verbose;
  }

  /**
   * Comprehensive verification of entire system
   * @returns {Promise<VerificationResult>}
   */
  async verifySystem() {
    const result = {
      success: true,
      errors: [],
      warnings: [],
      counts: {},
      ratios: {},
      timestamp: new Date().toISOString()
    };

    try {
      // Get all counts
      result.counts = await this.getCounts();
      
      // Calculate ratios
      result.ratios = this.calculateRatios(result.counts);
      
      // Run all validations
      await this.validateCounts(result);
      await this.validateRatios(result);
      await this.validateRelationships(result);
      await this.validateVectorSync(result);
      
      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`System verification failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Get counts from all data sources
   * @returns {Promise<Object>}
   */
  async getCounts() {
    const counts = {};
    
    try {
      // Ensure MongoDB connection is established
      if (this.verbose) {
        console.log(`[Verifier] MongoProvider connected: ${this.mongoProvider.connected}`);
      }
      if (!this.mongoProvider.connected) {
        await this.mongoProvider.connect();
        if (this.verbose) {
          console.log(`[Verifier] Connected to MongoDB`);
        }
      }
      
      // MongoDB counts
      if (this.verbose) {
        console.log(`[Verifier] Getting module count...`);
      }
      counts.modules = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('modules').countDocuments({});
      if (this.verbose) {
        console.log(`[Verifier] Module count: ${counts.modules}`);
      }
      
      counts.tools = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tools').countDocuments({});
      counts.perspectives = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tool_perspectives').countDocuments({});
    } catch (error) {
      console.error('Error getting MongoDB counts:', error.message);
      console.error('Error stack:', error.stack);
      counts.modules = 0;
      counts.tools = 0;
      counts.perspectives = 0;
    }
    
    // Qdrant count
    if (this.semanticSearchProvider) {
      try {
        counts.vectors = await this.semanticSearchProvider.count('legion_tools');
      } catch (error) {
        counts.vectors = 0;
      }
    } else {
      counts.vectors = 0;
    }

    return counts;
  }

  /**
   * Calculate key ratios for validation
   * @param {Object} counts 
   * @returns {Object}
   */
  calculateRatios(counts) {
    const ratios = {};
    
    if (counts.tools > 0) {
      ratios.perspectivesPerTool = counts.perspectives / counts.tools;
      ratios.vectorsPerTool = counts.vectors / counts.tools;
    }
    
    if (counts.perspectives > 0) {
      ratios.vectorsPerPerspective = counts.vectors / counts.perspectives;
    }

    return ratios;
  }

  /**
   * Validate basic counts are reasonable
   * @param {VerificationResult} result 
   */
  async validateCounts(result) {
    const { counts } = result;

    // Check for zero counts where we expect data
    if (counts.modules === 0) {
      result.warnings.push('No modules found - system may not be initialized');
    }
    
    if (counts.tools === 0) {
      result.warnings.push('No tools found - modules may not have been loaded');
    }

    if (counts.perspectives === 0 && counts.tools > 0) {
      result.errors.push('No perspectives found but tools exist - perspective generation failed');
    }

    if (counts.vectors === 0 && counts.perspectives > 0) {
      result.errors.push('No vectors found but perspectives exist - vector indexing failed');
    }
  }

  /**
   * Validate ratios are within expected ranges
   * @param {VerificationResult} result 
   */
  async validateRatios(result) {
    const { ratios, counts } = result;

    // Expected: 8-12 perspectives per tool (different perspective types)
    if (ratios.perspectivesPerTool) {
      if (ratios.perspectivesPerTool < 6) {
        result.warnings.push(`Low perspectives per tool: ${ratios.perspectivesPerTool.toFixed(2)} (expected 8-12)`);
      } else if (ratios.perspectivesPerTool > 15) {
        result.errors.push(`Too many perspectives per tool: ${ratios.perspectivesPerTool.toFixed(2)} (expected 8-12) - possible accumulation`);
      }
    }

    // Expected: 1:1 perspectives to vectors
    if (ratios.vectorsPerPerspective) {
      const ratio = ratios.vectorsPerPerspective;
      if (Math.abs(ratio - 1.0) > 0.01) {
        result.errors.push(`Perspectives:Vectors not 1:1 - ratio: ${ratio.toFixed(3)} (${counts.perspectives} perspectives vs ${counts.vectors} vectors)`);
      }
    }
  }

  /**
   * Validate relationships between entities
   * @param {VerificationResult} result 
   */
  async validateRelationships(result) {
    try {
      // Ensure MongoDB connection is established
      if (!this.mongoProvider.connected) {
        await this.mongoProvider.connect();
      }
      
      // Check for orphaned tools (tools without valid module references)
      const orphanedTools = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tools').countDocuments({
          $or: [
            { moduleId: { $exists: false } },
            { moduleId: null },
            { moduleName: { $exists: false } },
            { moduleName: null }
          ]
        });

      if (orphanedTools > 0) {
        result.errors.push(`Found ${orphanedTools} orphaned tools without module references`);
      }

      // Check for orphaned perspectives
      const orphanedPerspectives = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tool_perspectives').countDocuments({
          $or: [
            { toolName: { $exists: false } },
            { toolName: null },
            { toolName: '' }
          ]
        });

      if (orphanedPerspectives > 0) {
        result.errors.push(`Found ${orphanedPerspectives} orphaned perspectives without tool references`);
      }

    } catch (error) {
      result.errors.push(`Relationship validation failed: ${error.message}`);
    }
  }

  /**
   * Validate vector database sync
   * @param {VerificationResult} result 
   */
  async validateVectorSync(result) {
    if (!this.semanticSearchProvider) {
      result.warnings.push('Semantic search provider not available - cannot verify vector sync');
      return;
    }

    try {
      const { counts } = result;
      const vectorCount = await this.semanticSearchProvider.count('legion_tools');
      
      if (vectorCount !== counts.vectors) {
        result.errors.push(`Vector count mismatch: expected ${counts.vectors}, got ${vectorCount}`);
      }

    } catch (error) {
      result.errors.push(`Vector sync validation failed: ${error.message}`);
    }
  }

  /**
   * Verify that clearing actually worked
   * @param {Object} options - Verification options
   * @param {boolean} options.expectEmptyTools - Whether tools should be cleared (default: true)
   * @param {boolean} options.expectEmptyPerspectives - Whether perspectives should be cleared (default: true) 
   * @param {boolean} options.expectEmptyVectors - Whether vectors should be cleared (default: true)
   * @returns {Promise<ClearingVerificationResult>}
   */
  async verifyClearingWorked(options = {}) {
    const {
      expectEmptyTools = true,
      expectEmptyPerspectives = true,
      expectEmptyVectors = true
    } = options;

    const result = {
      success: true,
      errors: [],
      clearedCounts: {}
    };

    try {
      const counts = await this.getCounts();
      
      if (expectEmptyTools && counts.tools > 0) {
        result.errors.push(`Tools not cleared: found ${counts.tools} remaining`);
      }
      
      if (expectEmptyPerspectives && counts.perspectives > 0) {
        result.errors.push(`Perspectives not cleared: found ${counts.perspectives} remaining`);
      }
      
      if (expectEmptyVectors && counts.vectors > 0) {
        result.errors.push(`Vectors not cleared: found ${counts.vectors} remaining`);
      }

      // Verify modules still exist but are in unloaded state
      if (counts.modules === 0) {
        result.errors.push(`Modules were cleared - they should be preserved but set to unloaded`);
      }

      result.clearedCounts = counts;
      result.success = result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push(`Clearing verification failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Verify that modules are in unloaded state after clearing
   * @returns {Promise<Object>}
   */
  async verifyModulesUnloaded() {
    const result = {
      success: true,
      errors: [],
      warnings: [],
      moduleStats: {}
    };

    try {
      // Ensure MongoDB connection is established
      if (!this.mongoProvider.connected) {
        await this.mongoProvider.connect();
      }
      
      // Count modules by loading status
      if (this.verbose) {
        console.log(`[Verifier] Checking module loading statuses...`);
      }
      
      const loadedCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('modules').countDocuments({ loadingStatus: 'loaded' });
      
      const unloadedCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('modules').countDocuments({ loadingStatus: 'unloaded' });
      
      const pendingCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('modules').countDocuments({ loadingStatus: 'pending' });
        
      const failedCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('modules').countDocuments({ loadingStatus: 'failed' });

      result.moduleStats = {
        loaded: loadedCount,
        unloaded: unloadedCount,
        pending: pendingCount,
        failed: failedCount,
        total: loadedCount + unloadedCount + pendingCount + failedCount
      };
      
      if (this.verbose) {
        console.log(`[Verifier] Module stats: loaded=${loadedCount}, unloaded=${unloadedCount}, pending=${pendingCount}, failed=${failedCount}, total=${result.moduleStats.total}`);
      }

      if (loadedCount > 0) {
        result.errors.push(`Found ${loadedCount} modules still marked as loaded - should be pending/unloaded after clearing`);
      }

      if (result.moduleStats.total === 0) {
        if (this.verbose) {
          console.log(`[Verifier] ERROR: Total modules is 0, but we should have found modules`);
        }
        result.errors.push(`No modules found - modules should be preserved during clearing`);
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push(`Module status verification failed: ${error.message}`);
      if (this.verbose) {
        console.log(`[Verifier] Exception in verifyModulesUnloaded:`, error.message);
      }
    }

    return result;
  }

  /**
   * Quick health check - just the essential validations
   * @returns {Promise<Object>}
   */
  async quickHealthCheck() {
    try {
      const counts = await this.getCounts();
      const ratios = this.calculateRatios(counts);
      
      const health = {
        healthy: true,
        issues: [],
        counts,
        ratios
      };

      // Critical checks only
      if (counts.perspectives !== counts.vectors) {
        health.healthy = false;
        health.issues.push(`Perspective/Vector mismatch: ${counts.perspectives} vs ${counts.vectors}`);
      }

      if (ratios.perspectivesPerTool > 15) {
        health.healthy = false;
        health.issues.push(`Excessive perspectives per tool: ${ratios.perspectivesPerTool.toFixed(2)} - possible accumulation`);
      }

      return health;
    } catch (error) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error.message}`],
        counts: {},
        ratios: {}
      };
    }
  }

  /**
   * Log verification results
   * @param {VerificationResult} result 
   */
  logResults(result) {
    if (!this.verbose) return;

    console.log('\n🔍 Verification Results:');
    console.log(`   Overall Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log('\n📊 Counts:');
    Object.entries(result.counts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    console.log('\n📈 Ratios:');
    Object.entries(result.ratios).forEach(([key, value]) => {
      console.log(`   ${key}: ${value.toFixed(2)}`);
    });

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
  }
}