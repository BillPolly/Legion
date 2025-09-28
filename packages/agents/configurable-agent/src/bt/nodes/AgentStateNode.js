/**
 * AgentStateNode - Behavior tree node for managing ConfigurableAgent state operations
 */

import { BehaviorTreeNode, NodeStatus } from '@legion/bt-task';

export class AgentStateNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'agent_state';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Ensure config is defined
    if (!config) {
      throw new Error('AgentStateNode requires configuration');
    }
    
    // Agent will be injected by BoundNodeClass if not provided
    // Don't throw error if agent is missing, it will be injected
    
    if (!config.action) {
      throw new Error('AgentStateNode requires action specification (update, save, load, export)');
    }

    this.agent = config.agent;
    this.action = config.action;
    this.updates = config.updates || {};
    this.stateId = config.stateId;
    this.from = config.from || 'behavior-tree';
  }

  async executeNode(context) {
    try {
      const startTime = Date.now();
      let message, response;
      let resolvedUpdates = null;  // Declare at function scope

      switch (this.action) {
        case 'update':
          // Resolve state updates from context or config
          resolvedUpdates = this.resolveParams(this.updates, context);
          
          if (this.config && this.config.debugMode) {
            console.log(`[AgentStateNode:${this.id}] Updating agent state:`, resolvedUpdates);
          }

          message = {
            type: 'state_update',
            from: this.from,
            updates: resolvedUpdates
          };
          break;

        case 'save':
          if (this.config && this.config.debugMode) {
            console.log(`[AgentStateNode:${this.id}] Saving agent state`);
          }

          message = {
            type: 'save_state',
            from: this.from
          };
          break;

        case 'load':
          const resolvedStateId = this.resolveParams({ stateId: this.stateId }, context).stateId;
          
          if (!resolvedStateId) {
            return {
              status: NodeStatus.FAILURE,
              data: {
                error: 'stateId is required for load action',
                action: this.action
              }
            };
          }

          if (this.config && this.config.debugMode) {
            console.log(`[AgentStateNode:${this.id}] Loading agent state:`, resolvedStateId);
          }

          message = {
            type: 'load_state',
            from: this.from,
            stateId: resolvedStateId
          };
          break;

        case 'export':
          if (this.config && this.config.debugMode) {
            console.log(`[AgentStateNode:${this.id}] Exporting agent state`);
          }

          message = {
            type: 'export_state',
            from: this.from
          };
          break;

        default:
          return {
            status: NodeStatus.FAILURE,
            data: {
              error: `Unknown state action: ${this.action}`,
              supportedActions: ['update', 'save', 'load', 'export']
            }
          };
      }

      // Send message to agent
      response = await this.agent.receive(message);
      const executionTime = Date.now() - startTime;

      if (this.config && this.config.debugMode) {
        console.log(`[AgentStateNode:${this.id}] State operation response:`, {
          type: response.type,
          success: response.success,
          executionTime
        });
      }

      // Store result in artifacts if outputVariable is specified
      if (this.config && this.config.outputVariable) {
        if (!context.artifacts) {
          context.artifacts = {};
        }
        
        // For update action, store the updates directly as the artifact
        if (this.action === 'update' && resolvedUpdates) {
          context.artifacts[this.config.outputVariable] = {
            ...resolvedUpdates,  // Include the actual updates
            success: this.isSuccessResponse(response),
            action: this.action,
            nodeId: this.id,
            timestamp: Date.now(),
            executionTime
          };
        } else {
          context.artifacts[this.config.outputVariable] = {
            success: this.isSuccessResponse(response),
            action: this.action,
            response,
            nodeId: this.id,
            timestamp: Date.now(),
            executionTime
          };
        }
      }

      // Transform agent response to BT result
      if (this.isSuccessResponse(response)) {
        return {
          status: NodeStatus.SUCCESS,
          data: {
            action: this.action,
            result: response.data || response,
            agentResponse: response,
            executionTime
          }
        };
      } else {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: response.error || 'State operation failed',
            action: this.action,
            agentResponse: response,
            executionTime
          }
        };
      }

    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          action: this.action,
          stackTrace: error.stack
        }
      };
    }
  }

  /**
   * Check if agent response indicates success
   */
  isSuccessResponse(response) {
    // Different response types have different success indicators
    switch (response.type) {
      case 'state_updated':
        return response.success !== false;
      case 'state_saved':
        return response.success !== false;
      case 'state_loaded':
        return response.success !== false;
      case 'state_export':
        return !response.error;
      case 'error':
        return false;
      default:
        return !response.error;
    }
  }

  /**
   * Validate configuration
   */
  static validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    // Agent will be injected by BoundNodeClass, so don't require it in config
    // Only warn if explicitly set to something invalid
    if (config.agent === null || config.agent === undefined) {
      // Agent will be injected later, this is fine
    } else if (config.agent && typeof config.agent !== 'object') {
      // If agent is provided but not an object, it's invalid
      errors.push('AgentStateNode agent must be an object if specified');
    } else if (config.agent && typeof config.agent.receive !== 'function') {
      errors.push('AgentStateNode agent must have a receive method if specified');
    }

    if (!config.action) {
      errors.push('AgentStateNode must specify action (update, save, load, export)');
    }

    const validActions = ['update', 'save', 'load', 'export'];
    if (config.action && !validActions.includes(config.action)) {
      errors.push(`AgentStateNode action must be one of: ${validActions.join(', ')}`);
    }

    if (config.action === 'update' && !config.updates) {
      warnings.push('AgentStateNode with "update" action should specify updates object');
    }

    if (config.action === 'load' && !config.stateId) {
      warnings.push('AgentStateNode with "load" action should specify stateId');
    }

    if (config.updates && typeof config.updates !== 'object') {
      errors.push('AgentStateNode updates must be an object');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    const baseMetadata = super.getMetadata();
    
    return {
      ...baseMetadata,
      coordinationPattern: 'agent_state_management',
      interactsWithAgent: true,
      agentName: this.agent?.name || 'unknown',
      stateAction: this.action,
      messageType: this.getMessageTypeForAction(),
      isLeafNode: true,
      managesState: true
    };
  }

  /**
   * Get message type based on action
   */
  getMessageTypeForAction() {
    const actionToMessageType = {
      update: 'state_update',
      save: 'save_state',
      load: 'load_state',
      export: 'export_state'
    };
    return actionToMessageType[this.action] || 'state_operation';
  }

  /**
   * Handle messages from parent
   */
  handleParentMessage(message) {
    super.handleParentMessage(message);

    switch (message.type) {
      case 'UPDATE_STATE_UPDATES':
        if (message.updates) {
          this.updates = { ...this.updates, ...message.updates };
        }
        break;

      case 'UPDATE_STATE_ID':
        if (message.stateId) {
          this.stateId = message.stateId;
        }
        break;

      case 'CHANGE_STATE_ACTION':
        if (message.action && ['update', 'save', 'load', 'export'].includes(message.action)) {
          this.action = message.action;
        }
        break;
    }
  }

  /**
   * Get agent dependencies for planning
   */
  async getAgentDependencies() {
    return [{
      agent: this.agent?.name || 'unknown',
      messageType: this.getMessageTypeForAction(),
      action: this.action,
      required: true
    }];
  }

  /**
   * Clone node with different parameters
   */
  clone(newParams = {}) {
    const newConfig = {
      ...this.config,
      updates: { ...this.updates, ...newParams.updates },
      ...newParams
    };

    return new AgentStateNode(newConfig, this.toolRegistry, this.executor);
  }

  /**
   * Get state action presets for configuration
   */
  static getActionPresets() {
    return {
      save_current: { action: 'save' },
      export_full: { action: 'export' },
      load_checkpoint: { action: 'load', stateId: 'checkpoint' },
      update_context: { action: 'update', updates: {} }
    };
  }
}