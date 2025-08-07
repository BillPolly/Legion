/**
 * MockAgentNode - BT-based mock agent for testing
 * 
 * A BT node that acts as a mock agent, using behavior trees to define
 * how it responds to messages. Much better than static mocks!
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class MockAgentNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'mock_agent';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.agentId = config.agentId || `mock-agent-${Date.now()}`;
    this.agentType = config.agentType || 'mock';
    
    // Define agent behavior as a BT configuration
    this.agentBehavior = config.agentBehavior || {
      type: 'message_handler',
      routes: {}
    };
    
    // Message history
    this.messageHistory = [];
    this.responseQueue = [];
    
    // State
    this.agentState = config.initialState || {};
  }

  async executeNode(context) {
    try {
      // This node creates a mock agent that can be registered for testing
      const mockAgent = this.createMockAgent(context);
      
      // Register the mock agent if test agents registry exists
      if (context.testAgents) {
        context.testAgents.set(this.agentId, mockAgent);
      }
      
      // Store in context for other nodes to use
      context[`mockAgent_${this.agentId}`] = mockAgent;
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          agentId: this.agentId,
          agentType: this.agentType,
          agentCreated: true,
          mockAgent
        }
      };
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          agentId: this.agentId
        }
      };
    }
  }
  
  /**
   * Create a mock agent with Actor interface
   */
  createMockAgent(context) {
    const self = this;
    
    return {
      // Actor interface
      async receive(payload, envelope) {
        // Record the message
        self.recordMessage(payload, envelope);
        
        // Generate response based on behavior tree
        const response = await self.generateResponse(payload, envelope, context);
        
        // Store response in history
        self.recordResponse(response);
        
        return response;
      },
      
      // Additional test methods
      getMessageHistory() {
        return self.messageHistory;
      },
      
      getResponseHistory() {
        return self.responseQueue;
      },
      
      getState() {
        return self.agentState;
      },
      
      setState(newState) {
        self.agentState = { ...self.agentState, ...newState };
      },
      
      reset() {
        self.messageHistory = [];
        self.responseQueue = [];
        self.agentState = {};
      },
      
      // Metadata
      getMetadata() {
        return {
          agentId: self.agentId,
          agentType: self.agentType,
          messageCount: self.messageHistory.length,
          responseCount: self.responseQueue.length,
          state: self.agentState
        };
      },
      
      // Event emitter compatibility (if needed)
      on() { return this; },
      once() { return this; },
      emit() { return this; },
      
      // Initialize (for compatibility)
      async initialize() {
        return true;
      },
      
      // Cleanup (for compatibility)
      async cleanup() {
        self.reset();
        return true;
      }
    };
  }
  
  /**
   * Generate response based on behavior tree
   */
  async generateResponse(payload, envelope, context) {
    // Create execution context for behavior tree
    const executionContext = {
      ...context,
      message: payload,
      envelope,
      agentState: this.agentState,
      messageHistory: this.messageHistory,
      agentId: this.agentId
    };
    
    // If we have a behavior tree executor, use it
    if (this.executor && this.agentBehavior) {
      try {
        const result = await this.executor.executeTree(this.agentBehavior, executionContext);
        if (result.data && result.data.response) {
          return result.data.response;
        }
      } catch (error) {
        console.warn(`MockAgentNode: Error executing behavior tree: ${error.message}`);
      }
    }
    
    // Fall back to simple response generation
    return this.generateDefaultResponse(payload);
  }
  
  /**
   * Generate default response based on message type
   */
  generateDefaultResponse(payload) {
    const messageType = payload.type || 'unknown';
    
    switch (messageType) {
      case 'ping':
        return {
          type: 'pong',
          content: 'pong',
          timestamp: Date.now()
        };
        
      case 'chat_message':
        return {
          type: 'chat_response',
          content: `Mock response to: ${payload.content || 'empty message'}`,
          sessionId: payload.sessionId,
          timestamp: Date.now()
        };
        
      case 'tool_request':
        return {
          type: 'tool_response',
          tool: payload.tool,
          result: {
            success: true,
            output: `Mock execution of ${payload.tool}`,
            mocked: true
          },
          timestamp: Date.now()
        };
        
      case 'get_artifacts':
        return {
          type: 'artifacts_list',
          artifacts: [],
          timestamp: Date.now()
        };
        
      default:
        return {
          type: 'mock_response',
          originalType: messageType,
          content: 'This is a mock response',
          timestamp: Date.now()
        };
    }
  }
  
  /**
   * Record incoming message
   */
  recordMessage(payload, envelope) {
    this.messageHistory.push({
      payload,
      envelope,
      timestamp: Date.now(),
      messageNumber: this.messageHistory.length + 1
    });
  }
  
  /**
   * Record outgoing response
   */
  recordResponse(response) {
    this.responseQueue.push({
      response,
      timestamp: Date.now(),
      responseNumber: this.responseQueue.length + 1
    });
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'mock_agent',
      agentId: this.agentId,
      agentType: this.agentType,
      messageCount: this.messageHistory.length,
      responseCount: this.responseQueue.length,
      capabilities: [
        'actor_interface',
        'behavior_tree_responses',
        'message_history',
        'state_management'
      ]
    };
  }
}