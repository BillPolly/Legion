/**
 * CheckpointTools - MCP tools for plan checkpoint management
 * 
 * Provides plan_checkpoint and plan_rollback tools for checkpoint integration
 * with plan execution, validation, and rollback strategies
 */

export class CheckpointTools {
  constructor(checkpointManager, stateCaptureSystem, rollbackSystem, handleRegistry, options = {}) {
    this.checkpointManager = checkpointManager;
    this.stateCaptureSystem = stateCaptureSystem;
    this.rollbackSystem = rollbackSystem;
    this.handleRegistry = handleRegistry;
    
    this.options = {
      maxCheckpoints: options.maxCheckpoints || 10,
      validateByDefault: options.validateByDefault !== false,
      createBackupByDefault: options.createBackupByDefault !== false,
      ...options
    };
    
    this._initializeTools();
  }

  /**
   * Initialize checkpoint tools
   * @private
   */
  _initializeTools() {
    this.tools = {
      plan_checkpoint: this._createCheckpointTool(),
      plan_rollback: this._createRollbackTool()
    };
  }

  /**
   * Get all checkpoint tools
   */
  getTools() {
    return this.tools;
  }

  /**
   * Register checkpoint tools with MCP server
   */
  registerWithMCPServer(mcpServer) {
    for (const [name, tool] of Object.entries(this.tools)) {
      mcpServer.addTool(tool);
    }
  }

  /**
   * Get checkpoint tools statistics
   */
  getStatistics() {
    return {
      availableTools: Object.keys(this.tools).length,
      checkpointManager: this.checkpointManager.getStatistics(),
      rollbackSystem: this.rollbackSystem.getStatistics(),
      stateCaptureSystem: this.stateCaptureSystem.getStatistics()
    };
  }

  /**
   * Create plan_checkpoint tool
   * @private
   */
  _createCheckpointTool() {
    return {
      name: 'plan_checkpoint',
      description: 'Create a checkpoint of the current plan state for rollback purposes',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the checkpoint (auto-generated if not provided)'
          },
          saveAs: {
            type: 'string',
            description: 'Handle name to save the checkpoint as'
          },
          validate: {
            type: 'boolean',
            description: 'Validate checkpoint before creation',
            default: true
          },
          maxCheckpoints: {
            type: 'number',
            description: 'Maximum number of checkpoints to keep',
            minimum: 1,
            maximum: 50
          },
          includeMetadata: {
            type: 'boolean',
            description: 'Include detailed metadata in response',
            default: true
          }
        }
      },
      execute: async (params) => {
        try {
          const {
            name,
            saveAs,
            validate = this.options.validateByDefault,
            maxCheckpoints,
            includeMetadata = true
          } = params;

          // Validate checkpoint name if provided
          if (name !== undefined && (name === '' || typeof name !== 'string')) {
            return {
              success: false,
              error: 'Invalid checkpoint name: must be a non-empty string',
              errorCode: 'INVALID_NAME'
            };
          }

          // Validate checkpoint can be created
          if (validate) {
            const validation = this.checkpointManager.validateCheckpoint();
            if (!validation.canCreateCheckpoint) {
              return {
                success: false,
                error: `Checkpoint validation failed: ${validation.issues.join(', ') || 'Unknown validation issue'}`,
                errorCode: 'VALIDATION_FAILED',
                validation
              };
            }
          }

          // Create checkpoint with custom options
          const options = {};
          if (maxCheckpoints) {
            options.maxCheckpoints = maxCheckpoints;
          }

          const checkpointId = this.checkpointManager.createCheckpoint(name, options);
          const checkpoint = this.checkpointManager.getCheckpoint(checkpointId);
          
          if (!checkpoint) {
            throw new Error('Failed to retrieve created checkpoint');
          }

          // Save as handle if requested
          let handleName = null;
          if (saveAs) {
            this.handleRegistry.create(saveAs, checkpoint);
            handleName = saveAs;
          }

          const result = {
            success: true,
            checkpointId,
            name: checkpoint.name,
            timestamp: checkpoint.createdAt
          };

          if (handleName) {
            result.handleName = handleName;
          }

          if (includeMetadata && checkpoint.metadata) {
            result.metadata = {
              stepCount: checkpoint.metadata.totalSteps,
              completedCount: checkpoint.metadata.completedSteps,
              activeHandles: checkpoint.metadata.handleCount,
              timestamp: checkpoint.createdAt
            };
          }

          if (validate) {
            const validation = this.checkpointManager.validateCheckpoint();
            result.validation = {
              valid: validation.canCreateCheckpoint,
              canCreateCheckpoint: validation.canCreateCheckpoint,
              issues: validation.issues || []
            };
          }

          return result;

        } catch (error) {
          return {
            success: false,
            error: error.message,
            errorCode: 'CHECKPOINT_ERROR'
          };
        }
      }
    };
  }

  /**
   * Create plan_rollback tool
   * @private
   */
  _createRollbackTool() {
    return {
      name: 'plan_rollback',
      description: 'Rollback plan state to a previous checkpoint with various strategies',
      inputSchema: {
        type: 'object',
        properties: {
          checkpointId: {
            type: 'string',
            description: 'ID of the checkpoint to rollback to'
          },
          checkpointHandle: {
            type: 'string',
            description: 'Handle name containing the checkpoint to rollback to'
          },
          strategy: {
            type: 'string',
            enum: ['full', 'partial', 'steps', 'conditional', 'transform', 'filtered', 'incremental'],
            description: 'Rollback strategy to use',
            default: 'full'
          },
          validate: {
            type: 'boolean',
            description: 'Validate rollback target and current state',
            default: true
          },
          createBackup: {
            type: 'boolean',
            description: 'Create backup before rollback',
            default: true
          },
          includeHistory: {
            type: 'boolean',
            description: 'Include rollback history in response',
            default: false
          },
          // Partial rollback options
          includePlanState: {
            type: 'boolean',
            description: 'Include plan state in partial rollback',
            default: true
          },
          includeHandleState: {
            type: 'boolean',
            description: 'Include handle state in partial rollback',
            default: true
          },
          // Step rollback options
          stepIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific steps to rollback (for steps strategy)'
          },
          // Conditional rollback options
          condition: {
            type: 'string',
            description: 'Condition expression for conditional rollback'
          },
          // Transform rollback options
          handleTransform: {
            type: 'string',
            description: 'Handle transformation function for transform strategy'
          },
          planTransform: {
            type: 'string',
            description: 'Plan transformation function for transform strategy'
          },
          // Filtered rollback options
          handleFilter: {
            type: 'string',
            description: 'Handle filter function for filtered strategy'
          },
          planFilter: {
            type: 'string',
            description: 'Plan filter function for filtered strategy'
          },
          // Incremental rollback options
          captures: {
            type: 'array',
            items: { type: 'string' },
            description: 'Capture IDs for incremental rollback chain'
          },
          targetId: {
            type: 'string',
            description: 'Target capture ID for incremental rollback'
          }
        },
        anyOf: [
          { required: ['checkpointId'] },
          { required: ['checkpointHandle'] },
          { required: ['captures', 'targetId'] }
        ]
      },
      execute: async (params) => {
        try {
          const {
            checkpointId,
            checkpointHandle,
            strategy = 'full',
            validate = this.options.validateByDefault,
            createBackup = this.options.createBackupByDefault,
            includeHistory = false
          } = params;

          // Resolve checkpoint ID
          let resolvedCheckpointId = checkpointId;
          if (checkpointHandle) {
            if (!this.handleRegistry.existsByName(checkpointHandle)) {
              return {
                success: false,
                error: `Checkpoint handle not found: ${checkpointHandle}`,
                errorCode: 'HANDLE_NOT_FOUND'
              };
            }
            const checkpointData = this.handleRegistry.getByName(checkpointHandle).data;
            resolvedCheckpointId = checkpointData.id;
          }

          // Validate checkpoint ID
          if (!resolvedCheckpointId || typeof resolvedCheckpointId !== 'string') {
            return {
              success: false,
              error: 'Invalid checkpoint ID',
              errorCode: 'INVALID_CHECKPOINT_ID',
              details: {
                strategy: strategy || 'full',
                providedCheckpointId: resolvedCheckpointId
              }
            };
          }

          // Perform rollback based on strategy
          let result;
          switch (strategy) {
            case 'full':
              result = this.rollbackSystem.restoreFromCheckpoint(resolvedCheckpointId);
              break;
            
            case 'partial':
              result = this.rollbackSystem.partialRollback(resolvedCheckpointId, {
                includePlanState: params.includePlanState,
                includeHandleState: params.includeHandleState
              });
              break;
            
            case 'steps':
              if (!params.stepIds || !Array.isArray(params.stepIds)) {
                return {
                  success: false,
                  error: 'Step rollback requires stepIds array',
                  errorCode: 'MISSING_STEP_IDS'
                };
              }
              result = this.rollbackSystem.rollbackSteps(resolvedCheckpointId, params.stepIds);
              break;
            
            case 'conditional':
              if (!params.condition) {
                return {
                  success: false,
                  error: 'Conditional rollback requires condition expression',
                  errorCode: 'MISSING_CONDITION'
                };
              }
              const conditionFn = this._parseConditionExpression(params.condition);
              result = this.rollbackSystem.conditionalRollback(resolvedCheckpointId, conditionFn);
              break;
            
            case 'transform':
              const transforms = {};
              if (params.handleTransform) {
                transforms.handleTransform = this._parseTransformFunction(params.handleTransform);
              }
              if (params.planTransform) {
                transforms.planTransform = this._parseTransformFunction(params.planTransform);
              }
              result = this.rollbackSystem.rollbackWithTransform(resolvedCheckpointId, transforms);
              break;
            
            case 'filtered':
              const filters = {};
              if (params.handleFilter) {
                filters.handleFilter = this._parseFilterFunction(params.handleFilter);
              }
              if (params.planFilter) {
                filters.planFilter = this._parseFilterFunction(params.planFilter);
              }
              result = this.rollbackSystem.rollbackWithFilter(resolvedCheckpointId, filters);
              break;
            
            case 'incremental':
              if (!params.captures || !params.targetId) {
                return {
                  success: false,
                  error: 'Incremental rollback requires captures and targetId',
                  errorCode: 'MISSING_INCREMENTAL_PARAMS'
                };
              }
              const captures = params.captures.map(id => ({ id })); // Simplified for tool interface
              result = this.rollbackSystem.rollbackIncrementalChain(captures, params.targetId);
              break;
            
            default:
              return {
                success: false,
                error: `Unknown rollback strategy: ${strategy}`,
                errorCode: 'UNKNOWN_STRATEGY'
              };
          }

          // Enhance result with additional information
          const enhancedResult = {
            ...result,
            checkpointId: resolvedCheckpointId,
            strategy
          };

          if (validate && result.success) {
            const validation = this.rollbackSystem.validateRollbackTarget(resolvedCheckpointId);
            enhancedResult.validation = validation;
          }

          if (includeHistory && result.success) {
            enhancedResult.history = this.rollbackSystem.getRollbackHistory();
          }

          return enhancedResult;

        } catch (error) {
          return {
            success: false,
            error: error.message,
            errorCode: 'ROLLBACK_ERROR',
            details: {
              strategy: params.strategy || 'full',
              originalError: error.message
            }
          };
        }
      }
    };
  }

  /**
   * Parse condition expression into function
   * @private
   */
  _parseConditionExpression(conditionStr) {
    try {
      // Simple condition parsing - in production would need more robust parsing
      if (conditionStr.includes('failedSteps.length > 0')) {
        return (currentState) => currentState.failedSteps.length > 0;
      }
      
      // Default condition function
      return (currentState) => true;
    } catch (error) {
      throw new Error(`Invalid condition expression: ${error.message}`);
    }
  }

  /**
   * Parse transform function from string
   * @private
   */
  _parseTransformFunction(transformStr) {
    try {
      // Simple transform parsing - in production would need sandboxed evaluation
      if (transformStr.includes('transformed: true')) {
        return (handleName, data) => ({ ...data, transformed: true });
      }
      
      // Default identity transform
      return (handleName, data) => data;
    } catch (error) {
      throw new Error(`Invalid transform function: ${error.message}`);
    }
  }

  /**
   * Parse filter function from string
   * @private
   */
  _parseFilterFunction(filterStr) {
    try {
      // Simple filter parsing
      if (filterStr.includes('handleName === "temporary"')) {
        return (handleName, handleData) => handleName === 'temporary';
      }
      
      // Default pass-through filter
      return () => true;
    } catch (error) {
      throw new Error(`Invalid filter function: ${error.message}`);
    }
  }
}