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
   * Comprehensive verification of specific module only
   * Runs validation checks only for the specified module
   * @param {string} moduleName - Name of module to verify
   * @returns {Promise<VerificationResult>}
   */
  async verifyModule(moduleName) {
    if (!moduleName || typeof moduleName !== 'string') {
      throw new Error('Module name is required and must be a string');
    }

    const result = {
      success: true,
      errors: [],
      warnings: [],
      counts: {},
      ratios: {},
      moduleName,
      timestamp: new Date().toISOString()
    };

    try {
      // Get counts for specific module
      result.counts = await this.getModuleCounts(moduleName);
      
      // Calculate ratios for this module
      result.ratios = this.calculateRatios(result.counts);
      
      // Run module-specific validations
      await this.validateModuleCounts(result, moduleName);
      await this.validateModuleRatios(result, moduleName);
      await this.validateModuleRelationships(result, moduleName);
      await this.validateModuleVectorSync(result, moduleName);
      
      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Module verification failed: ${error.message}`);
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
   * Get counts for specific module only
   * @param {string} moduleName - Name of module to get counts for
   * @returns {Promise<Object>}
   */
  async getModuleCounts(moduleName) {
    const counts = {};
    
    try {
      // Ensure MongoDB connection is established
      if (!this.mongoProvider.connected) {
        await this.mongoProvider.connect();
      }
      
      if (this.verbose) {
        console.log(`[Verifier] Getting counts for module: ${moduleName}`);
      }
      
      // MongoDB counts for specific module
      counts.modules = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('modules').countDocuments({ name: moduleName });
      
      counts.tools = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tools').countDocuments({ moduleName: moduleName });
      
      counts.perspectives = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tool_perspectives').countDocuments({ moduleName: moduleName });
      
      if (this.verbose) {
        console.log(`[Verifier] Module ${moduleName} counts: modules=${counts.modules}, tools=${counts.tools}, perspectives=${counts.perspectives}`);
      }
    } catch (error) {
      console.error(`Error getting MongoDB counts for module ${moduleName}:`, error.message);
      counts.modules = 0;
      counts.tools = 0;
      counts.perspectives = 0;
    }
    
    // Qdrant count for specific module
    if (this.semanticSearchProvider) {
      try {
        // Search for vectors with moduleName in payload
        const vectorSearchResult = await this.semanticSearchProvider.search('legion_tools', 
          Array(768).fill(0), // dummy vector for search
          {
            limit: 0, // We only want count
            filter: {
              must: [
                { key: 'moduleName', match: { value: moduleName } }
              ]
            }
          }
        );
        counts.vectors = vectorSearchResult?.totalCount || 0;
        
        if (this.verbose) {
          console.log(`[Verifier] Module ${moduleName} vector count: ${counts.vectors}`);
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(`[Verifier] Could not get vector count for module ${moduleName}:`, error.message);
        }
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
   * Validate basic counts for specific module
   * @param {VerificationResult} result 
   * @param {string} moduleName 
   */
  async validateModuleCounts(result, moduleName) {
    const { counts } = result;

    // Check for zero counts where we expect data for this module
    if (counts.modules === 0) {
      result.errors.push(`Module '${moduleName}' not found in database`);
      return; // No point checking further if module doesn't exist
    }
    
    if (counts.tools === 0) {
      result.warnings.push(`Module '${moduleName}' has no tools - may not have been loaded yet`);
    }

    if (counts.perspectives === 0 && counts.tools > 0) {
      result.errors.push(`Module '${moduleName}' has ${counts.tools} tools but no perspectives - perspective generation failed`);
    }

    if (counts.vectors === 0 && counts.perspectives > 0) {
      result.errors.push(`Module '${moduleName}' has ${counts.perspectives} perspectives but no vectors - vector indexing failed`);
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
   * Validate ratios are within expected ranges for specific module
   * @param {VerificationResult} result 
   * @param {string} moduleName 
   */
  async validateModuleRatios(result, moduleName) {
    const { ratios, counts } = result;

    // Expected: 8-12 perspectives per tool (different perspective types)
    if (ratios.perspectivesPerTool) {
      if (ratios.perspectivesPerTool < 6) {
        result.warnings.push(`Module '${moduleName}' has low perspectives per tool: ${ratios.perspectivesPerTool.toFixed(2)} (expected 8-12)`);
      } else if (ratios.perspectivesPerTool > 15) {
        result.errors.push(`Module '${moduleName}' has too many perspectives per tool: ${ratios.perspectivesPerTool.toFixed(2)} (expected 8-12) - possible accumulation`);
      }
    }

    // Expected: 1:1 perspectives to vectors
    if (ratios.vectorsPerPerspective) {
      const ratio = ratios.vectorsPerPerspective;
      if (Math.abs(ratio - 1.0) > 0.01) {
        result.errors.push(`Module '${moduleName}' Perspectives:Vectors not 1:1 - ratio: ${ratio.toFixed(3)} (${counts.perspectives} perspectives vs ${counts.vectors} vectors)`);
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
   * Validate relationships between entities for specific module
   * @param {VerificationResult} result 
   * @param {string} moduleName
   */
  async validateModuleRelationships(result, moduleName) {
    try {
      // Ensure MongoDB connection is established
      if (!this.mongoProvider.connected) {
        await this.mongoProvider.connect();
      }
      
      // Check for orphaned tools in this module (tools without valid module references)
      const orphanedTools = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tools').countDocuments({
          moduleName: moduleName,
          $or: [
            { moduleId: { $exists: false } },
            { moduleId: null }
          ]
        });

      if (orphanedTools > 0) {
        result.errors.push(`Module '${moduleName}' has ${orphanedTools} tools without moduleId references`);
      }

      // Check for orphaned perspectives in this module
      const orphanedPerspectives = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tool_perspectives').countDocuments({
          moduleName: moduleName,
          $or: [
            { toolName: { $exists: false } },
            { toolName: null },
            { toolName: '' }
          ]
        });

      if (orphanedPerspectives > 0) {
        result.errors.push(`Module '${moduleName}' has ${orphanedPerspectives} perspectives without tool references`);
      }

      // Check for perspective-tool mismatches in this module
      const mismatchedPerspectives = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('tool_perspectives').aggregate([
          { $match: { moduleName: moduleName } },
          {
            $lookup: {
              from: 'tools',
              localField: 'toolName',
              foreignField: 'name',
              as: 'tool'
            }
          },
          {
            $match: {
              'tool': { $size: 0 }
            }
          }
        ]).toArray();

      if (mismatchedPerspectives.length > 0) {
        result.errors.push(`Module '${moduleName}' has ${mismatchedPerspectives.length} perspectives referencing non-existent tools`);
      }

    } catch (error) {
      result.errors.push(`Module relationship validation failed: ${error.message}`);
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
   * Validate vector database sync for specific module
   * @param {VerificationResult} result 
   * @param {string} moduleName
   */
  async validateModuleVectorSync(result, moduleName) {
    if (!this.semanticSearchProvider) {
      result.warnings.push(`Module '${moduleName}': Semantic search provider not available - cannot verify vector sync`);
      return;
    }

    try {
      const { counts } = result;
      
      // Get actual vector count from Qdrant for this module
      const vectorSearchResult = await this.semanticSearchProvider.search('legion_tools', 
        Array(768).fill(0), // dummy vector for search
        {
          limit: 0, // We only want count
          filter: {
            must: [
              { key: 'moduleName', match: { value: moduleName } }
            ]
          }
        }
      );
      const actualVectorCount = vectorSearchResult?.totalCount || 0;
      
      if (actualVectorCount !== counts.vectors) {
        result.errors.push(`Module '${moduleName}' vector count mismatch: expected ${counts.vectors}, got ${actualVectorCount} in Qdrant`);
      }

      // Check for perspectives without corresponding vectors
      if (counts.perspectives > 0 && actualVectorCount === 0) {
        result.errors.push(`Module '${moduleName}' has ${counts.perspectives} perspectives but no vectors in Qdrant - indexing failed`);
      }

    } catch (error) {
      result.errors.push(`Module '${moduleName}' vector sync validation failed: ${error.message}`);
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

      // Verify module_registry still exists (permanent registry)
      const registryCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('module_registry').countDocuments();
      if (registryCount === 0) {
        result.errors.push(`Module registry was cleared - it should be preserved with statuses set to unloaded`);
      }
      
      // Verify modules collection was cleared
      if (expectEmptyTools && counts.modules > 0) {
        result.errors.push(`Modules collection not cleared: found ${counts.modules} remaining`);
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
   * Verify that modules in module_registry are in unloaded state after clearing
   * (The runtime modules collection should be cleared, but module_registry should be preserved with unloaded status)
   * @param {string|null} moduleFilter - Optional module filter for specific module verification
   * @returns {Promise<Object>}
   */
  async verifyModulesUnloaded(moduleFilter = null) {
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
        const target = moduleFilter ? ` for module '${moduleFilter}'` : '';
        console.log(`[Verifier] Checking module loading statuses${target}...`);
      }
      
      // Build queries based on module filter
      const baseQuery = moduleFilter ? { name: moduleFilter } : {};
      
      // Check module_registry (permanent registry) for status
      const loadedCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('module_registry').countDocuments({ ...baseQuery, loadingStatus: 'loaded' });
      
      const unloadedCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('module_registry').countDocuments({ ...baseQuery, loadingStatus: 'unloaded' });
      
      const pendingCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('module_registry').countDocuments({ ...baseQuery, loadingStatus: 'pending' });
        
      const failedCount = await this.mongoProvider.databaseService.mongoProvider.db
        .collection('module_registry').countDocuments({ ...baseQuery, loadingStatus: 'failed' });

      result.moduleStats = {
        loaded: loadedCount,
        unloaded: unloadedCount,
        pending: pendingCount,
        failed: failedCount,
        total: loadedCount + unloadedCount + pendingCount + failedCount
      };
      
      if (this.verbose) {
        const target = moduleFilter ? ` (${moduleFilter})` : '';
        console.log(`[Verifier] Module stats${target}: loaded=${loadedCount}, unloaded=${unloadedCount}, pending=${pendingCount}, failed=${failedCount}, total=${result.moduleStats.total}`);
      }

      if (moduleFilter) {
        // For module-specific verification, only check the specific module
        if (loadedCount > 0) {
          result.errors.push(`Module '${moduleFilter}' is still marked as loaded - should be unloaded after clearing`);
        }
        if (result.moduleStats.total === 0) {
          result.errors.push(`Module '${moduleFilter}' not found in database`);
        }
      } else {
        // For global verification, ALL modules should be unloaded
        if (loadedCount > 0) {
          result.errors.push(`Found ${loadedCount} modules still marked as loaded - should be pending/unloaded after clearing`);
        }
        if (result.moduleStats.total === 0) {
          if (this.verbose) {
            console.log(`[Verifier] ERROR: Total modules is 0, but we should have found modules in module_registry`);
          }
          result.errors.push(`No modules found in module_registry - discovery metadata should be preserved during clearing`);
        }
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
   * Comprehensive inconsistency detection across all databases
   * @returns {Promise<InconsistencyReport>}
   */
  async detectInconsistencies() {
    const report = {
      success: true,
      timestamp: new Date().toISOString(),
      inconsistencies: {
        orphanedRecords: [],
        duplicateRecords: [],
        invalidEmbeddings: [],
        schemaMismatches: [],
        referenceErrors: [],
        dataQualityIssues: []
      },
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warningIssues: 0
      },
      repairRecommendations: []
    };

    try {
      // Ensure connections
      if (!this.mongoProvider.connected) {
        await this.mongoProvider.connect();
      }

      // Run all inconsistency checks
      await this._detectOrphanedRecords(report);
      await this._detectDuplicateRecords(report);
      await this._detectInvalidEmbeddings(report);
      await this._detectSchemaMismatches(report);
      await this._detectReferenceErrors(report);
      await this._detectDataQualityIssues(report);

      // Generate summary and recommendations
      this._generateInconsistencySummary(report);
      this._generateRepairRecommendations(report);

    } catch (error) {
      report.success = false;
      report.error = `Inconsistency detection failed: ${error.message}`;
    }

    return report;
  }

  /**
   * Detect orphaned records across collections
   */
  async _detectOrphanedRecords(report) {
    try {
      const db = this.mongoProvider.databaseService.mongoProvider.db;

      // Orphaned tools (no parent module)
      const orphanedTools = await db.collection('tools').aggregate([
        {
          $lookup: {
            from: 'modules',
            localField: 'moduleName',
            foreignField: 'name',
            as: 'module'
          }
        },
        {
          $match: {
            'module': { $size: 0 }
          }
        }
      ]).toArray();

      orphanedTools.forEach(tool => {
        report.inconsistencies.orphanedRecords.push({
          type: 'orphaned_tool',
          severity: 'critical',
          record: { name: tool.name, moduleName: tool.moduleName },
          description: `Tool "${tool.name}" references non-existent module "${tool.moduleName}"`
        });
      });

      // Orphaned perspectives (no parent tool)
      const orphanedPerspectives = await db.collection('tool_perspectives').aggregate([
        {
          $lookup: {
            from: 'tools',
            localField: 'toolName',
            foreignField: 'name',
            as: 'tool'
          }
        },
        {
          $match: {
            'tool': { $size: 0 }
          }
        }
      ]).toArray();

      orphanedPerspectives.forEach(perspective => {
        report.inconsistencies.orphanedRecords.push({
          type: 'orphaned_perspective',
          severity: 'critical',
          record: { _id: perspective._id, toolName: perspective.toolName },
          description: `Perspective references non-existent tool "${perspective.toolName}"`
        });
      });

      if (this.verbose) {
        console.log(`[Verifier] Found ${orphanedTools.length} orphaned tools, ${orphanedPerspectives.length} orphaned perspectives`);
      }

    } catch (error) {
      if (this.verbose) {
        console.error('[Verifier] Error detecting orphaned records:', error.message);
      }
    }
  }

  /**
   * Detect duplicate records
   */
  async _detectDuplicateRecords(report) {
    try {
      const db = this.mongoProvider.databaseService.mongoProvider.db;

      // Duplicate tools (same name within module)
      const duplicateTools = await db.collection('tools').aggregate([
        {
          $group: {
            _id: { name: '$name', moduleName: '$moduleName' },
            count: { $sum: 1 },
            docs: { $push: '$_id' }
          }
        },
        {
          $match: {
            count: { $gt: 1 }
          }
        }
      ]).toArray();

      duplicateTools.forEach(duplicate => {
        report.inconsistencies.duplicateRecords.push({
          type: 'duplicate_tool',
          severity: 'critical',
          record: duplicate._id,
          count: duplicate.count,
          documentIds: duplicate.docs,
          description: `Tool "${duplicate._id.name}" has ${duplicate.count} duplicates in module "${duplicate._id.moduleName}"`
        });
      });

      // Duplicate perspective embeddings (same embeddingId)
      const duplicateEmbeddings = await db.collection('tool_perspectives').aggregate([
        {
          $match: {
            embeddingId: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$embeddingId',
            count: { $sum: 1 },
            docs: { $push: { _id: '$_id', toolName: '$toolName' } }
          }
        },
        {
          $match: {
            count: { $gt: 1 }
          }
        }
      ]).toArray();

      duplicateEmbeddings.forEach(duplicate => {
        report.inconsistencies.duplicateRecords.push({
          type: 'duplicate_embedding',
          severity: 'warning',
          embeddingId: duplicate._id,
          count: duplicate.count,
          records: duplicate.docs,
          description: `Embedding ID "${duplicate._id}" is used by ${duplicate.count} perspectives`
        });
      });

      if (this.verbose) {
        console.log(`[Verifier] Found ${duplicateTools.length} duplicate tools, ${duplicateEmbeddings.length} duplicate embeddings`);
      }

    } catch (error) {
      if (this.verbose) {
        console.error('[Verifier] Error detecting duplicates:', error.message);
      }
    }
  }

  /**
   * Detect invalid embeddings (wrong dimensions, NaN values, etc.)
   */
  async _detectInvalidEmbeddings(report) {
    try {
      const db = this.mongoProvider.databaseService.mongoProvider.db;

      // Check tool embeddings
      const invalidToolEmbeddings = await db.collection('tools').aggregate([
        {
          $match: {
            embedding: { $exists: true, $ne: null }
          }
        },
        {
          $project: {
            name: 1,
            embeddingLength: { $size: '$embedding' },
            hasNaN: {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: '$embedding',
                      cond: { $ne: ['$$this', '$$this'] } // NaN check
                    }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $match: {
            $or: [
              { embeddingLength: { $ne: 768 } }, // Wrong dimension for Nomic model
              { hasNaN: true }
            ]
          }
        }
      ]).toArray();

      invalidToolEmbeddings.forEach(tool => {
        const issues = [];
        if (tool.embeddingLength !== 768) {
          issues.push(`wrong dimension (${tool.embeddingLength}, expected 768)`);
        }
        if (tool.hasNaN) {
          issues.push('contains NaN values');
        }

        report.inconsistencies.invalidEmbeddings.push({
          type: 'invalid_tool_embedding',
          severity: 'critical',
          record: { name: tool.name },
          issues: issues,
          description: `Tool "${tool.name}" has invalid embedding: ${issues.join(', ')}`
        });
      });

      // Check perspective embeddings
      const invalidPerspectiveEmbeddings = await db.collection('tool_perspectives').aggregate([
        {
          $match: {
            embedding: { $exists: true, $ne: null }
          }
        },
        {
          $project: {
            toolName: 1,
            perspectiveType: 1,
            embeddingLength: { $size: '$embedding' },
            hasNaN: {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: '$embedding',
                      cond: { $ne: ['$$this', '$$this'] }
                    }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $match: {
            $or: [
              { embeddingLength: { $ne: 768 } },
              { hasNaN: true }
            ]
          }
        }
      ]).toArray();

      invalidPerspectiveEmbeddings.forEach(perspective => {
        const issues = [];
        if (perspective.embeddingLength !== 768) {
          issues.push(`wrong dimension (${perspective.embeddingLength}, expected 768)`);
        }
        if (perspective.hasNaN) {
          issues.push('contains NaN values');
        }

        report.inconsistencies.invalidEmbeddings.push({
          type: 'invalid_perspective_embedding',
          severity: 'critical',
          record: { toolName: perspective.toolName, perspectiveType: perspective.perspectiveType },
          issues: issues,
          description: `Perspective for "${perspective.toolName}" (${perspective.perspectiveType}) has invalid embedding: ${issues.join(', ')}`
        });
      });

      if (this.verbose) {
        console.log(`[Verifier] Found ${invalidToolEmbeddings.length} invalid tool embeddings, ${invalidPerspectiveEmbeddings.length} invalid perspective embeddings`);
      }

    } catch (error) {
      if (this.verbose) {
        console.error('[Verifier] Error detecting invalid embeddings:', error.message);
      }
    }
  }

  /**
   * Detect schema mismatches and validation issues
   */
  async _detectSchemaMismatches(report) {
    try {
      const db = this.mongoProvider.databaseService.mongoProvider.db;

      // Tools with invalid input/output schemas
      const invalidSchemas = await db.collection('tools').find({
        $or: [
          {
            inputSchema: { $exists: true },
            'inputSchema.type': { $exists: false }
          },
          {
            outputSchema: { $exists: true },
            'outputSchema.type': { $exists: false }
          },
          {
            'inputSchema.type': { $nin: ['object', 'string', 'number', 'boolean', 'array'] }
          },
          {
            'outputSchema.type': { $nin: ['object', 'string', 'number', 'boolean', 'array'] }
          }
        ]
      }).toArray();

      invalidSchemas.forEach(tool => {
        const issues = [];
        if (tool.inputSchema && !tool.inputSchema.type) {
          issues.push('inputSchema missing type field');
        }
        if (tool.outputSchema && !tool.outputSchema.type) {
          issues.push('outputSchema missing type field');
        }
        if (tool.inputSchema?.type && !['object', 'string', 'number', 'boolean', 'array'].includes(tool.inputSchema.type)) {
          issues.push(`invalid inputSchema type: ${tool.inputSchema.type}`);
        }
        if (tool.outputSchema?.type && !['object', 'string', 'number', 'boolean', 'array'].includes(tool.outputSchema.type)) {
          issues.push(`invalid outputSchema type: ${tool.outputSchema.type}`);
        }

        report.inconsistencies.schemaMismatches.push({
          type: 'invalid_schema',
          severity: 'warning',
          record: { name: tool.name, moduleName: tool.moduleName },
          issues: issues,
          description: `Tool "${tool.name}" has invalid schema: ${issues.join(', ')}`
        });
      });

      // Check for missing embedding models
      const missingEmbeddingModels = await db.collection('tool_perspectives').find({
        embedding: { $exists: true },
        embeddingModel: { $exists: false }
      }).toArray();

      missingEmbeddingModels.forEach(perspective => {
        report.inconsistencies.schemaMismatches.push({
          type: 'missing_embedding_model',
          severity: 'warning',
          record: { toolName: perspective.toolName, perspectiveType: perspective.perspectiveType },
          description: `Perspective for "${perspective.toolName}" has embedding but no embeddingModel field`
        });
      });

      if (this.verbose) {
        console.log(`[Verifier] Found ${invalidSchemas.length} schema issues, ${missingEmbeddingModels.length} missing embedding models`);
      }

    } catch (error) {
      if (this.verbose) {
        console.error('[Verifier] Error detecting schema mismatches:', error.message);
      }
    }
  }

  /**
   * Detect reference integrity errors
   */
  async _detectReferenceErrors(report) {
    try {
      const db = this.mongoProvider.databaseService.mongoProvider.db;

      // Tools with mismatched module references (moduleId vs moduleName)
      const mismatchedRefs = await db.collection('tools').aggregate([
        {
          $lookup: {
            from: 'modules',
            localField: 'moduleId',
            foreignField: '_id',
            as: 'moduleById'
          }
        },
        {
          $lookup: {
            from: 'modules',
            localField: 'moduleName',
            foreignField: 'name',
            as: 'moduleByName'
          }
        },
        {
          $match: {
            $expr: {
              $ne: [
                { $arrayElemAt: ['$moduleById.name', 0] },
                { $arrayElemAt: ['$moduleByName.name', 0] }
              ]
            }
          }
        }
      ]).toArray();

      mismatchedRefs.forEach(tool => {
        report.inconsistencies.referenceErrors.push({
          type: 'module_reference_mismatch',
          severity: 'critical',
          record: { name: tool.name, moduleId: tool.moduleId, moduleName: tool.moduleName },
          description: `Tool "${tool.name}" has mismatched module references: moduleId points to different module than moduleName`
        });
      });

      // Perspectives with missing toolId but existing toolName
      const missingToolIds = await db.collection('tool_perspectives').aggregate([
        {
          $match: {
            toolName: { $exists: true, $ne: null },
            toolId: { $exists: false }
          }
        },
        {
          $lookup: {
            from: 'tools',
            localField: 'toolName',
            foreignField: 'name',
            as: 'tool'
          }
        },
        {
          $match: {
            'tool': { $size: 1 }
          }
        }
      ]).toArray();

      missingToolIds.forEach(perspective => {
        report.inconsistencies.referenceErrors.push({
          type: 'missing_tool_id',
          severity: 'warning',
          record: { _id: perspective._id, toolName: perspective.toolName },
          description: `Perspective for "${perspective.toolName}" is missing toolId reference`
        });
      });

      if (this.verbose) {
        console.log(`[Verifier] Found ${mismatchedRefs.length} reference mismatches, ${missingToolIds.length} missing tool IDs`);
      }

    } catch (error) {
      if (this.verbose) {
        console.error('[Verifier] Error detecting reference errors:', error.message);
      }
    }
  }

  /**
   * Detect general data quality issues
   */
  async _detectDataQualityIssues(report) {
    try {
      const db = this.mongoProvider.databaseService.mongoProvider.db;

      // Tools/modules with poor quality descriptions
      const poorDescriptions = await db.collection('tools').find({
        $or: [
          { description: { $regex: /^.{1,20}$/ } }, // Too short
          { description: { $regex: /^test|TODO|FIXME|placeholder/i } }, // Placeholder text
          { description: { $exists: false } },
          { description: null },
          { description: '' }
        ]
      }).toArray();

      poorDescriptions.forEach(tool => {
        let issue = 'missing description';
        if (tool.description) {
          if (tool.description.length < 20) {
            issue = `description too short (${tool.description.length} chars)`;
          } else if (/^test|TODO|FIXME|placeholder/i.test(tool.description)) {
            issue = 'placeholder description';
          }
        }

        report.inconsistencies.dataQualityIssues.push({
          type: 'poor_description',
          severity: 'warning',
          record: { name: tool.name, moduleName: tool.moduleName },
          issue: issue,
          description: `Tool "${tool.name}" has ${issue}`
        });
      });

      // Tools with missing or invalid status
      const invalidStatuses = await db.collection('tools').find({
        $or: [
          { status: { $exists: false } },
          { status: { $nin: ['active', 'deprecated', 'experimental', 'maintenance'] } }
        ]
      }).toArray();

      invalidStatuses.forEach(tool => {
        report.inconsistencies.dataQualityIssues.push({
          type: 'invalid_status',
          severity: 'warning',
          record: { name: tool.name, moduleName: tool.moduleName },
          description: `Tool "${tool.name}" has invalid status: ${tool.status || 'missing'}`
        });
      });

      // Perspectives with missing or invalid types
      const invalidPerspectiveTypes = await db.collection('tool_perspectives').find({
        $or: [
          { perspectiveType: { $exists: false } },
          { perspectiveType: null },
          { perspectiveType: '' },
          { perspectiveText: { $exists: false } },
          { perspectiveText: null },
          { perspectiveText: '' }
        ]
      }).toArray();

      invalidPerspectiveTypes.forEach(perspective => {
        const issues = [];
        if (!perspective.perspectiveType) {
          issues.push('missing perspectiveType');
        }
        if (!perspective.perspectiveText) {
          issues.push('missing perspectiveText');
        }

        report.inconsistencies.dataQualityIssues.push({
          type: 'invalid_perspective',
          severity: 'warning',
          record: { _id: perspective._id, toolName: perspective.toolName },
          issues: issues,
          description: `Perspective for "${perspective.toolName}" has issues: ${issues.join(', ')}`
        });
      });

      if (this.verbose) {
        console.log(`[Verifier] Found ${poorDescriptions.length} poor descriptions, ${invalidStatuses.length} invalid statuses, ${invalidPerspectiveTypes.length} invalid perspectives`);
      }

    } catch (error) {
      if (this.verbose) {
        console.error('[Verifier] Error detecting data quality issues:', error.message);
      }
    }
  }

  /**
   * Generate summary statistics for inconsistencies
   */
  _generateInconsistencySummary(report) {
    let totalIssues = 0;
    let criticalIssues = 0;
    let warningIssues = 0;

    // Count all issues by severity
    Object.values(report.inconsistencies).forEach(category => {
      if (Array.isArray(category)) {
        category.forEach(issue => {
          totalIssues++;
          if (issue.severity === 'critical') {
            criticalIssues++;
          } else if (issue.severity === 'warning') {
            warningIssues++;
          }
        });
      }
    });

    report.summary = {
      totalIssues,
      criticalIssues,
      warningIssues,
      categoryCounts: {
        orphanedRecords: report.inconsistencies.orphanedRecords.length,
        duplicateRecords: report.inconsistencies.duplicateRecords.length,
        invalidEmbeddings: report.inconsistencies.invalidEmbeddings.length,
        schemaMismatches: report.inconsistencies.schemaMismatches.length,
        referenceErrors: report.inconsistencies.referenceErrors.length,
        dataQualityIssues: report.inconsistencies.dataQualityIssues.length
      }
    };

    if (criticalIssues > 0) {
      report.success = false;
    }
  }

  /**
   * Generate repair recommendations based on found inconsistencies
   */
  _generateRepairRecommendations(report) {
    const recommendations = [];

    if (report.inconsistencies.orphanedRecords.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'clean_orphaned_records',
        description: 'Remove orphaned tools and perspectives that reference non-existent parents',
        affectedRecords: report.inconsistencies.orphanedRecords.length
      });
    }

    if (report.inconsistencies.duplicateRecords.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'merge_or_remove_duplicates',
        description: 'Merge or remove duplicate tools and perspective embeddings',
        affectedRecords: report.inconsistencies.duplicateRecords.length
      });
    }

    if (report.inconsistencies.invalidEmbeddings.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'regenerate_embeddings',
        description: 'Regenerate embeddings with wrong dimensions or NaN values',
        affectedRecords: report.inconsistencies.invalidEmbeddings.length
      });
    }

    if (report.inconsistencies.referenceErrors.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'fix_reference_integrity',
        description: 'Sync moduleId/moduleName references and add missing toolId references',
        affectedRecords: report.inconsistencies.referenceErrors.length
      });
    }

    if (report.inconsistencies.schemaMismatches.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'validate_and_fix_schemas',
        description: 'Fix invalid JSON schemas and add missing embedding model references',
        affectedRecords: report.inconsistencies.schemaMismatches.length
      });
    }

    if (report.inconsistencies.dataQualityIssues.length > 0) {
      recommendations.push({
        priority: 'low',
        action: 'improve_data_quality',
        description: 'Update poor quality descriptions, invalid statuses, and missing metadata',
        affectedRecords: report.inconsistencies.dataQualityIssues.length
      });
    }

    report.repairRecommendations = recommendations;
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

  /**
   * Log inconsistency report
   * @param {InconsistencyReport} report 
   */
  logInconsistencies(report) {
    if (!this.verbose) return;

    console.log('\n🔍 Inconsistency Detection Results:');
    console.log(`   Overall Status: ${report.success ? '✅ CLEAN' : '❌ ISSUES FOUND'}`);
    console.log(`   Total Issues: ${report.summary.totalIssues}`);
    console.log(`   Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`   Warning Issues: ${report.summary.warningIssues}`);

    console.log('\n📊 Issues by Category:');
    Object.entries(report.summary.categoryCounts).forEach(([category, count]) => {
      if (count > 0) {
        console.log(`   ${category}: ${count}`);
      }
    });

    if (report.repairRecommendations.length > 0) {
      console.log('\n🔧 Repair Recommendations:');
      report.repairRecommendations.forEach(rec => {
        console.log(`   [${rec.priority.toUpperCase()}] ${rec.description} (${rec.affectedRecords} records)`);
      });
    }

    // Show some example issues
    if (report.summary.criticalIssues > 0) {
      console.log('\n❌ Critical Issues (examples):');
      let shown = 0;
      for (const [category, issues] of Object.entries(report.inconsistencies)) {
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (issue.severity === 'critical' && shown < 5) {
              console.log(`   • ${issue.description}`);
              shown++;
            }
          }
        }
      }
    }
  }
}