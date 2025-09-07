/**
 * AgentToolNode - Behavior tree node for executing tools through ConfigurableAgent's CapabilityManager
 */

import { BehaviorTreeNode, NodeStatus } from '@legion/actor-bt';

export class AgentToolNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'agent_tool';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Ensure config is defined
    if (!config) {
      throw new Error('AgentToolNode requires configuration');
    }
    
    // Agent will be injected by BoundNodeClass if not provided
    // Don't throw error if agent is missing, it will be injected
    
    if (!config.tool) {
      throw new Error('AgentToolNode requires tool specification');
    }

    this.agent = config.agent;
    this.toolName = config.tool;
    this.operation = config.operation;
    this.params = config.params || {};
    this.sessionId = config.sessionId || 'bt-session';
    this.from = config.from || 'behavior-tree';
  }

  async executeNode(context) {
    try {
      // Resolve parameters with context substitution
      const resolvedParams = this.resolveParams(this.params, context);
      
      if (this.config && this.config.debugMode) {
        console.log(`[AgentToolNode:${this.id}] Executing tool '${this.toolName}' operation '${this.operation}':`, resolvedParams);
      }

      // Create tool request message for the agent
      const toolMessage = {
        type: 'tool_request',
        from: this.from,
        tool: this.toolName,
        operation: this.operation || 'execute',
        params: resolvedParams,
        sessionId: this.sessionId
      };

      // Send message to agent
      const startTime = Date.now();
      const response = await this.agent.receive(toolMessage);
      const executionTime = Date.now() - startTime;

      if (this.config && this.config.debugMode) {
        console.log(`[AgentToolNode:${this.id}] Tool response:`, {
          type: response.type,
          success: response.success,
          hasResult: !!response.result,
          executionTime
        });
      }

      // Store result in artifacts if outputVariable is specified
      if (this.config && this.config.outputVariable) {
        if (!context.artifacts) {
          context.artifacts = {};
        }
        
        context.artifacts[this.config.outputVariable] = {
          success: response.success,
          result: response.result,
          error: response.error,
          toolName: this.toolName,
          operation: this.operation,
          nodeId: this.id,
          timestamp: Date.now(),
          executionTime
        };
      }

      // Transform agent response to BT result
      if (response.type === 'tool_response' && response.success) {
        return {
          status: NodeStatus.SUCCESS,
          data: {
            result: response.result,
            toolName: this.toolName,
            operation: this.operation,
            agentResponse: response,
            executionTime
          }
        };
      } else if (response.type === 'tool_response' && !response.success) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: response.error || 'Tool execution failed',
            toolName: this.toolName,
            operation: this.operation,
            agentResponse: response,
            executionTime
          }
        };
      } else if (response.type === 'error' || response.error) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: response.error || 'Agent returned error response',
            toolName: this.toolName,
            agentResponse: response,
            executionTime
          }
        };
      } else {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: `Unexpected agent response type: ${response.type}`,
            toolName: this.toolName,
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
          toolName: this.toolName,
          operation: this.operation,
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
      errors.push('AgentToolNode agent must be an object if specified');
    } else if (config.agent && typeof config.agent.receive !== 'function') {
      errors.push('AgentToolNode agent must have a receive method if specified');
    }

    if (!config.tool) {
      errors.push('AgentToolNode must specify tool name');
    }

    if (config.params && typeof config.params !== 'object') {
      errors.push('AgentToolNode params must be an object');
    }

    if (!config.operation) {
      warnings.push('AgentToolNode should specify operation (defaults to "execute")');
    }

    if (config.sessionId && typeof config.sessionId !== 'string') {
      warnings.push('AgentToolNode sessionId should be a string');
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
      coordinationPattern: 'agent_tool_execution',
      interactsWithAgent: true,
      agentName: this.agent?.name || 'unknown',
      toolName: this.toolName,
      operation: this.operation,
      sessionId: this.sessionId,
      messageType: 'tool_request',
      isLeafNode: true,
      executesTool: true
    };
  }

  /**
   * Handle messages from parent
   */
  handleParentMessage(message) {
    super.handleParentMessage(message);

    switch (message.type) {
      case 'UPDATE_TOOL_PARAMS':
        if (message.params) {
          this.params = { ...this.params, ...message.params };
        }
        break;

      case 'UPDATE_SESSION':
        if (message.sessionId) {
          this.sessionId = message.sessionId;
        }
        break;

      case 'CANCEL_TOOL':
        // Could implement tool cancellation through agent if supported
        this.sendToParent({
          type: 'TOOL_CANCEL_REQUESTED',
          toolName: this.toolName,
          reason: 'Parent requested cancellation'
        });
        break;
    }
  }

  /**
   * Get tool dependencies for planning
   */
  async getToolDependencies() {
    const dependencies = [this.toolName];
    
    // Get tool metadata from agent's capability manager if available
    if (this.agent && this.agent.capabilityManager) {
      const tool = this.agent.capabilityManager.getTool(this.toolName);
      if (tool && tool.getMetadata) {
        const metadata = tool.getMetadata();
        if (metadata.dependencies) {
          dependencies.push(...metadata.dependencies);
        }
      }
    }

    return dependencies;
  }

  /**
   * Get agent dependencies for planning
   */
  async getAgentDependencies() {
    return [{
      agent: this.agent?.name || 'unknown',
      messageType: 'tool_request',
      tool: this.toolName,
      operation: this.operation,
      required: true
    }];
  }

  /**
   * Check if tool is available through agent
   */
  async isToolAvailable() {
    if (!this.agent || !this.agent.capabilityManager) {
      return false;
    }

    try {
      return await this.agent.capabilityManager.hasToolAccess(this.toolName, this.operation);
    } catch (error) {
      return false;
    }
  }

  /**
   * Clone node with different parameters
   */
  clone(newParams = {}) {
    const newConfig = {
      ...this.config,
      params: { ...this.params, ...newParams.params },
      ...newParams
    };

    return new AgentToolNode(newConfig, this.toolRegistry, this.executor);
  }
}