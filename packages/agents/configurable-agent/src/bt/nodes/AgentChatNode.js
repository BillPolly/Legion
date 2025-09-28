/**
 * AgentChatNode - Behavior tree node for handling chat interactions through ConfigurableAgent
 */

import { BehaviorTreeNode, NodeStatus } from '@legion/bt-task';

export class AgentChatNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'agent_chat';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Ensure config is defined
    if (!config) {
      throw new Error('AgentChatNode requires configuration');
    }
    
    // Agent will be injected by BoundNodeClass if not provided
    // Don't throw error if agent is missing, it will be injected
    
    this.agent = config.agent;
    this.messageContent = config.message || config.content;
    this.sessionId = config.sessionId || 'bt-session';
    this.from = config.from || 'behavior-tree';
  }

  async executeNode(context) {
    try {
      // Resolve message content from context or config
      let content = this.messageContent;
      if (!content && context.input) {
        content = typeof context.input === 'string' ? context.input : context.input.content;
      }
      
      if (!content) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: 'No message content provided for chat node',
            context: Object.keys(context)
          }
        };
      }

      // Resolve parameters with context substitution
      const resolvedContent = this.resolveParams({ content }, context).content;

      if (this.config && this.config.debugMode) {
        console.log(`[AgentChatNode:${this.id}] Sending chat message:`, resolvedContent);
      }

      // Create chat message for the agent
      const chatMessage = {
        type: 'chat',
        from: this.from,
        content: resolvedContent,
        sessionId: this.sessionId
      };

      // Send message to agent
      const startTime = Date.now();
      const response = await this.agent.receive(chatMessage);
      const executionTime = Date.now() - startTime;

      if (this.config && this.config.debugMode) {
        console.log(`[AgentChatNode:${this.id}] Agent response:`, {
          type: response.type,
          hasContent: !!response.content,
          executionTime
        });
      }

      // Store result in artifacts if outputVariable is specified
      if (this.config && this.config.outputVariable) {
        if (!context.artifacts) {
          context.artifacts = {};
        }
        
        context.artifacts[this.config.outputVariable] = {
          success: response.type === 'chat_response',
          content: response.content,
          error: response.error,
          nodeId: this.id,
          timestamp: Date.now(),
          executionTime
        };
      }

      // Transform agent response to BT result
      if (response.type === 'chat_response' && response.content) {
        return {
          status: NodeStatus.SUCCESS,
          data: {
            content: response.content,
            sessionId: response.sessionId,
            agentResponse: response,
            executionTime
          }
        };
      } else if (response.type === 'error' || response.error) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: response.error || 'Agent returned error response',
            agentResponse: response,
            executionTime
          }
        };
      } else {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: `Unexpected agent response type: ${response.type}`,
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
      errors.push('AgentChatNode agent must be an object if specified');
    } else if (config.agent && typeof config.agent.receive !== 'function') {
      errors.push('AgentChatNode agent must have a receive method if specified');
    }

    if (!config.message && !config.content) {
      warnings.push('AgentChatNode should specify message content (can be resolved from context)');
    }

    if (config.sessionId && typeof config.sessionId !== 'string') {
      warnings.push('AgentChatNode sessionId should be a string');
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
      coordinationPattern: 'agent_interaction',
      interactsWithAgent: true,
      agentName: this.agent?.name || 'unknown',
      sessionId: this.sessionId,
      messageType: 'chat'
    };
  }

  /**
   * Handle messages from parent
   */
  handleParentMessage(message) {
    super.handleParentMessage(message);

    switch (message.type) {
      case 'UPDATE_SESSION':
        if (message.sessionId) {
          this.sessionId = message.sessionId;
        }
        break;

      case 'UPDATE_MESSAGE':
        if (message.content) {
          this.messageContent = message.content;
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
      messageType: 'chat',
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

    return new AgentChatNode(newConfig, this.toolRegistry, this.executor);
  }
}