/**
 * AgentQueryNode - Behavior tree node for handling query operations through ConfigurableAgent
 */

import { BehaviorTreeNode, NodeStatus } from '@legion/actor-bt';

export class AgentQueryNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'agent_query';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Ensure config is defined
    if (!config) {
      throw new Error('AgentQueryNode requires configuration');
    }
    
    // Agent will be injected by BoundNodeClass if not provided
    // Don't throw error if agent is missing, it will be injected
    
    this.agent = config.agent;
    this.query = config.query;
    this.queryType = config.queryType || 'general';
    this.sessionId = config.sessionId || 'bt-session';
    this.from = config.from || 'behavior-tree';
  }

  async executeNode(context) {
    try {
      // Resolve query content from context or config
      let queryContent = this.query;
      if (!queryContent && context.input) {
        queryContent = typeof context.input === 'string' ? context.input : context.input.query;
      }
      
      if (!queryContent) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: 'No query content provided',
            context: Object.keys(context)
          }
        };
      }

      // Resolve parameters with context substitution
      const resolvedQuery = this.resolveParams({ query: queryContent }, context).query;

      if (this.config && this.config.debugMode) {
        console.log(`[AgentQueryNode:${this.id}] Sending query:`, resolvedQuery);
      }

      // Create query message for the agent
      const queryMessage = {
        type: 'query',
        from: this.from,
        query: resolvedQuery,
        queryType: this.queryType,
        sessionId: this.sessionId
      };

      // Send message to agent
      const startTime = Date.now();
      const response = await this.agent.receive(queryMessage);
      const executionTime = Date.now() - startTime;

      if (this.config && this.config.debugMode) {
        console.log(`[AgentQueryNode:${this.id}] Query response:`, {
          type: response.type,
          hasData: !!response.data,
          executionTime
        });
      }

      // Store result in artifacts if outputVariable is specified
      if (this.config && this.config.outputVariable) {
        if (!context.artifacts) {
          context.artifacts = {};
        }
        
        context.artifacts[this.config.outputVariable] = {
          success: response.type === 'query_response' && !response.error,
          data: response.data,
          error: response.error,
          query: resolvedQuery,
          queryType: this.queryType,
          nodeId: this.id,
          timestamp: Date.now(),
          executionTime
        };
      }

      // Transform agent response to BT result
      if (response.type === 'query_response' && response.data) {
        return {
          status: NodeStatus.SUCCESS,
          data: {
            result: response.data,
            query: resolvedQuery,
            queryType: this.queryType,
            agentResponse: response,
            executionTime
          }
        };
      } else if (response.type === 'query_response' && response.error) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: response.error,
            query: resolvedQuery,
            queryType: this.queryType,
            agentResponse: response,
            executionTime
          }
        };
      } else if (response.type === 'error' || response.error) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: response.error || 'Agent returned error response',
            query: resolvedQuery,
            agentResponse: response,
            executionTime
          }
        };
      } else {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: `Unexpected agent response type: ${response.type}`,
            query: resolvedQuery,
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
          query: this.query,
          stackTrace: error.stack
        }
      };
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
      errors.push('AgentQueryNode agent must be an object if specified');
    } else if (config.agent && typeof config.agent.receive !== 'function') {
      errors.push('AgentQueryNode agent must have a receive method if specified');
    }

    if (!config.query) {
      warnings.push('AgentQueryNode should specify query content (can be resolved from context)');
    }

    if (config.queryType && !['general', 'capabilities', 'configuration', 'state'].includes(config.queryType)) {
      warnings.push('AgentQueryNode queryType should be one of: general, capabilities, configuration, state');
    }

    if (config.sessionId && typeof config.sessionId !== 'string') {
      warnings.push('AgentQueryNode sessionId should be a string');
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
      coordinationPattern: 'agent_query',
      interactsWithAgent: true,
      agentName: this.agent?.name || 'unknown',
      queryType: this.queryType,
      sessionId: this.sessionId,
      messageType: 'query',
      isLeafNode: true
    };
  }

  /**
   * Handle messages from parent
   */
  handleParentMessage(message) {
    super.handleParentMessage(message);

    switch (message.type) {
      case 'UPDATE_QUERY':
        if (message.query) {
          this.query = message.query;
        }
        if (message.queryType) {
          this.queryType = message.queryType;
        }
        break;

      case 'UPDATE_SESSION':
        if (message.sessionId) {
          this.sessionId = message.sessionId;
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
      messageType: 'query',
      queryType: this.queryType,
      required: true
    }];
  }

  /**
   * Clone node with different parameters
   */
  clone(newParams = {}) {
    const newConfig = {
      ...this.config,
      ...newParams
    };

    return new AgentQueryNode(newConfig, this.toolRegistry, this.executor);
  }

  /**
   * Get common query presets for configuration
   */
  static getQueryPresets() {
    return {
      capabilities: 'What tools are available?',
      configuration: 'What is your configuration?',
      tools: 'What tools are available?',
      status: 'What is your current status?'
    };
  }
}