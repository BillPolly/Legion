/**
 * ArtifactSyncNode - Synchronizes artifacts between different stores or systems
 * 
 * Handles synchronization of artifacts between local storage, remote systems,
 * sessions, or different artifact managers with conflict resolution.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ArtifactSyncNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'artifact_sync';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.syncMode = config.syncMode || 'bidirectional'; // bidirectional, push, pull
    this.conflictResolution = config.conflictResolution || 'newer_wins'; // newer_wins, manual, source_wins, target_wins
    this.includeMetadata = config.includeMetadata !== false;
    this.syncFilter = config.syncFilter || null; // Filter artifacts by type, label, etc.
    this.dryRun = config.dryRun || false;
    this.batchSize = config.batchSize || 10;
  }

  async executeNode(context) {
    try {
      // Get artifact managers or sync targets
      const syncTargets = await this.getSyncTargets(context);
      if (!syncTargets.source || !syncTargets.target) {
        return this.createFailureResult('Source or target artifact store not available');
      }

      // Perform synchronization
      const syncResult = await this.performSync(syncTargets, context);
      
      return this.createSuccessResult(syncResult);

    } catch (error) {
      return this.createFailureResult(`Artifact synchronization failed: ${error.message}`, error);
    }
  }

  /**
   * Get sync targets (source and target artifact stores)
   */
  async getSyncTargets(context) {
    const targets = {
      source: null,
      target: null
    };

    // Get source (usually current context)
    if (context.artifactManager) {
      targets.source = context.artifactManager;
    } else if (context.sourceArtifactManager) {
      targets.source = context.sourceArtifactManager;
    }

    // Get target from context
    if (context.targetArtifactManager) {
      targets.target = context.targetArtifactManager;
    } else if (context.remoteArtifactManager) {
      targets.target = context.remoteArtifactManager;
    } else if (context.sessionManager) {
      // Try to get artifact manager from a different session
      const targetSessionId = context.targetSessionId;
      if (targetSessionId) {
        // This would require session-aware artifact management
        targets.target = await this.getSessionArtifactManager(context.sessionManager, targetSessionId);
      }
    }

    return targets;
  }

  /**
   * Get artifact manager for a specific session
   */
  async getSessionArtifactManager(sessionManager, sessionId) {
    // This would depend on how artifact managers are associated with sessions
    // For now, return null indicating this feature needs implementation
    return null;
  }

  /**
   * Perform the actual synchronization
   */
  async performSync(syncTargets, context) {
    const { source, target } = syncTargets;
    
    // Get artifacts from both sides
    const sourceArtifacts = await this.getFilteredArtifacts(source, 'source');
    const targetArtifacts = await this.getFilteredArtifacts(target, 'target');

    // Create sync plan
    const syncPlan = await this.createSyncPlan(sourceArtifacts, targetArtifacts);
    
    // Execute sync plan (unless dry run)
    const syncResults = {
      dryRun: this.dryRun,
      syncMode: this.syncMode,
      conflictResolution: this.conflictResolution,
      sourceArtifactCount: sourceArtifacts.length,
      targetArtifactCount: targetArtifacts.length,
      operations: syncPlan,
      executed: [],
      errors: [],
      summary: {
        created: 0,
        updated: 0,
        deleted: 0,
        conflicts: 0,
        skipped: 0
      }
    };

    if (!this.dryRun) {
      syncResults.executed = await this.executeSyncPlan(syncPlan, syncTargets, syncResults.summary);
    } else {
      // For dry run, just count what would happen
      this.countSyncOperations(syncPlan, syncResults.summary);
    }

    return syncResults;
  }

  /**
   * Get filtered artifacts from a store
   */
  async getFilteredArtifacts(artifactStore, storeName) {
    if (!artifactStore || !artifactStore.getAllArtifacts) {
      console.warn(`Artifact store (${storeName}) does not support getAllArtifacts`);
      return [];
    }

    try {
      const allArtifacts = await artifactStore.getAllArtifacts();
      
      if (!this.syncFilter) {
        return allArtifacts;
      }

      // Apply filters
      return allArtifacts.filter(artifact => this.matchesFilter(artifact, this.syncFilter));

    } catch (error) {
      console.warn(`Failed to get artifacts from ${storeName}:`, error.message);
      return [];
    }
  }

  /**
   * Check if artifact matches sync filter
   */
  matchesFilter(artifact, filter) {
    if (!filter) return true;

    // Type filter
    if (filter.types && !filter.types.includes(artifact.type)) {
      return false;
    }

    // Label pattern filter
    if (filter.labelPattern) {
      const pattern = new RegExp(filter.labelPattern, 'i');
      if (!pattern.test(artifact.label)) {
        return false;
      }
    }

    // Metadata filters
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (artifact.metadata?.[key] !== value) {
          return false;
        }
      }
    }

    // Age filter
    if (filter.maxAge && artifact.metadata?.storedAt) {
      const storedAt = new Date(artifact.metadata.storedAt);
      const cutoff = new Date(Date.now() - filter.maxAge);
      if (storedAt < cutoff) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create synchronization plan
   */
  async createSyncPlan(sourceArtifacts, targetArtifacts) {
    const operations = [];
    
    // Create lookup maps
    const sourceMap = new Map(sourceArtifacts.map(a => [a.id, a]));
    const targetMap = new Map(targetArtifacts.map(a => [a.id, a]));
    
    // Find all unique artifact IDs
    const allIds = new Set([...sourceMap.keys(), ...targetMap.keys()]);
    
    for (const id of allIds) {
      const sourceArtifact = sourceMap.get(id);
      const targetArtifact = targetMap.get(id);
      
      if (sourceArtifact && targetArtifact) {
        // Artifact exists in both - check for conflicts
        const conflict = this.detectConflict(sourceArtifact, targetArtifact);
        if (conflict) {
          operations.push({
            type: 'conflict',
            artifactId: id,
            sourceArtifact,
            targetArtifact,
            conflict,
            resolution: this.resolveConflict(sourceArtifact, targetArtifact, conflict)
          });
        } else {
          operations.push({
            type: 'no_change',
            artifactId: id,
            artifact: sourceArtifact
          });
        }
      } else if (sourceArtifact && !targetArtifact) {
        // Only in source
        if (this.syncMode === 'bidirectional' || this.syncMode === 'push') {
          operations.push({
            type: 'create_in_target',
            artifactId: id,
            artifact: sourceArtifact
          });
        }
      } else if (!sourceArtifact && targetArtifact) {
        // Only in target
        if (this.syncMode === 'bidirectional' || this.syncMode === 'pull') {
          operations.push({
            type: 'create_in_source',
            artifactId: id,
            artifact: targetArtifact
          });
        }
      }
    }
    
    return operations;
  }

  /**
   * Detect conflicts between artifacts
   */
  detectConflict(sourceArtifact, targetArtifact) {
    const conflicts = [];
    
    // Content conflict
    if (sourceArtifact.content !== targetArtifact.content) {
      conflicts.push({
        type: 'content',
        source: sourceArtifact.content?.length || 0,
        target: targetArtifact.content?.length || 0
      });
    }
    
    // Metadata conflicts
    const sourceVersion = sourceArtifact.metadata?.version || 0;
    const targetVersion = targetArtifact.metadata?.version || 0;
    
    if (sourceVersion !== targetVersion) {
      conflicts.push({
        type: 'version',
        source: sourceVersion,
        target: targetVersion
      });
    }
    
    // Timestamp conflicts
    const sourceUpdated = sourceArtifact.metadata?.updatedAt || sourceArtifact.metadata?.storedAt;
    const targetUpdated = targetArtifact.metadata?.updatedAt || targetArtifact.metadata?.storedAt;
    
    if (sourceUpdated && targetUpdated && sourceUpdated !== targetUpdated) {
      conflicts.push({
        type: 'timestamp',
        source: sourceUpdated,
        target: targetUpdated
      });
    }
    
    return conflicts.length > 0 ? conflicts : null;
  }

  /**
   * Resolve conflict based on strategy
   */
  resolveConflict(sourceArtifact, targetArtifact, conflicts) {
    switch (this.conflictResolution) {
      case 'source_wins':
        return {
          strategy: 'source_wins',
          action: 'update_target',
          artifact: sourceArtifact
        };
        
      case 'target_wins':
        return {
          strategy: 'target_wins',
          action: 'update_source',
          artifact: targetArtifact
        };
        
      case 'newer_wins':
        const sourceTime = this.getArtifactTimestamp(sourceArtifact);
        const targetTime = this.getArtifactTimestamp(targetArtifact);
        
        if (sourceTime >= targetTime) {
          return {
            strategy: 'newer_wins',
            action: 'update_target',
            artifact: sourceArtifact,
            reason: `Source is newer (${sourceTime} >= ${targetTime})`
          };
        } else {
          return {
            strategy: 'newer_wins',
            action: 'update_source', 
            artifact: targetArtifact,
            reason: `Target is newer (${targetTime} > ${sourceTime})`
          };
        }
        
      case 'manual':
        return {
          strategy: 'manual',
          action: 'skip',
          reason: 'Manual resolution required',
          conflicts
        };
        
      default:
        return {
          strategy: 'unknown',
          action: 'skip',
          reason: `Unknown conflict resolution strategy: ${this.conflictResolution}`
        };
    }
  }

  /**
   * Get artifact timestamp for comparison
   */
  getArtifactTimestamp(artifact) {
    const updated = artifact.metadata?.updatedAt;
    const stored = artifact.metadata?.storedAt;
    
    if (updated) return new Date(updated).getTime();
    if (stored) return new Date(stored).getTime();
    
    return 0; // No timestamp available
  }

  /**
   * Execute the synchronization plan
   */
  async executeSyncPlan(operations, syncTargets, summary) {
    const executed = [];
    const { source, target } = syncTargets;
    
    for (const operation of operations) {
      try {
        let result = null;
        
        switch (operation.type) {
          case 'create_in_target':
            if (target.storeArtifact) {
              await target.storeArtifact(operation.artifactId, operation.artifact);
              result = { action: 'created_in_target', success: true };
              summary.created++;
            }
            break;
            
          case 'create_in_source':
            if (source.storeArtifact) {
              await source.storeArtifact(operation.artifactId, operation.artifact);
              result = { action: 'created_in_source', success: true };
              summary.created++;
            }
            break;
            
          case 'conflict':
            result = await this.executeConflictResolution(operation, syncTargets, summary);
            break;
            
          case 'no_change':
            result = { action: 'no_change', success: true };
            summary.skipped++;
            break;
            
          default:
            result = { action: 'unknown_operation', success: false };
            summary.skipped++;
            break;
        }
        
        executed.push({
          ...operation,
          result,
          executedAt: new Date().toISOString()
        });
        
      } catch (error) {
        executed.push({
          ...operation,
          result: { action: 'error', success: false, error: error.message },
          executedAt: new Date().toISOString()
        });
        
        console.warn(`Sync operation failed for ${operation.artifactId}:`, error.message);
      }
    }
    
    return executed;
  }

  /**
   * Execute conflict resolution
   */
  async executeConflictResolution(operation, syncTargets, summary) {
    const { source, target } = syncTargets;
    const { resolution } = operation;
    
    if (resolution.action === 'skip') {
      summary.conflicts++;
      return { action: 'conflict_skipped', success: true, reason: resolution.reason };
    }
    
    try {
      if (resolution.action === 'update_target' && target.updateArtifact) {
        await target.updateArtifact(operation.artifactId, resolution.artifact);
        summary.updated++;
        return { action: 'conflict_resolved_target_updated', success: true };
      }
      
      if (resolution.action === 'update_source' && source.updateArtifact) {
        await source.updateArtifact(operation.artifactId, resolution.artifact);
        summary.updated++;
        return { action: 'conflict_resolved_source_updated', success: true };
      }
      
      summary.conflicts++;
      return { action: 'conflict_resolution_failed', success: false, reason: 'Update method not available' };
      
    } catch (error) {
      summary.conflicts++;
      return { action: 'conflict_resolution_error', success: false, error: error.message };
    }
  }

  /**
   * Count operations for dry run
   */
  countSyncOperations(operations, summary) {
    for (const operation of operations) {
      switch (operation.type) {
        case 'create_in_target':
        case 'create_in_source':
          summary.created++;
          break;
        case 'conflict':
          if (operation.resolution.action === 'skip') {
            summary.conflicts++;
          } else {
            summary.updated++;
          }
          break;
        case 'no_change':
          summary.skipped++;
          break;
      }
    }
  }

  /**
   * Create success result
   */
  createSuccessResult(data) {
    return {
      status: NodeStatus.SUCCESS,
      data: {
        artifactSync: true,
        ...data
      }
    };
  }

  /**
   * Create failure result
   */
  createFailureResult(message, error = null) {
    return {
      status: NodeStatus.FAILURE,
      data: {
        artifactSync: false,
        error: message,
        details: error ? {
          message: error.message,
          stack: error.stack
        } : undefined
      }
    };
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'artifact_sync',
      purpose: 'Cross-store artifact synchronization',
      syncModes: ['bidirectional', 'push', 'pull'],
      conflictResolution: ['newer_wins', 'manual', 'source_wins', 'target_wins'],
      capabilities: [
        'bidirectional_sync',
        'conflict_detection',
        'conflict_resolution',
        'filtered_sync',
        'dry_run_support'
      ]
    };
  }
}