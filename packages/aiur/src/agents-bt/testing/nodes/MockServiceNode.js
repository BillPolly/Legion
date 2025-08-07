/**
 * MockServiceNode - BT-based mock service provider
 * 
 * Uses behavior trees to provide mock services instead of Jest-style mocks.
 * Much more composable and configurable!
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class MockServiceNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'mock_service';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.serviceName = config.serviceName;
    this.serviceType = config.serviceType || 'custom';
    
    // Define mock behavior as a BT configuration
    this.mockBehavior = config.mockBehavior || {
      type: 'selector',
      children: []
    };
    
    // Store mock responses
    this.mockResponses = config.mockResponses || {};
    
    // Track service calls
    this.callHistory = [];
    this.callCount = 0;
  }

  async executeNode(context) {
    try {
      const method = context.method || context.serviceMethod;
      const args = context.args || context.serviceArgs || [];
      
      // Record the call
      this.recordCall(method, args);
      
      // Execute mock behavior tree if provided
      if (this.mockBehavior && this.mockBehavior.children && this.mockBehavior.children.length > 0) {
        const behaviorContext = {
          ...context,
          serviceName: this.serviceName,
          method,
          args,
          callCount: this.callCount,
          callHistory: this.callHistory
        };
        
        // Execute the mock behavior tree
        if (this.executor) {
          const result = await this.executor.executeTree(this.mockBehavior, behaviorContext);
          if (result.data) {
            return {
              status: NodeStatus.SUCCESS,
              data: result.data
            };
          }
        }
      }
      
      // Fall back to simple response lookup
      const response = await this.getMockResponse(method, args, context);
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          serviceName: this.serviceName,
          method,
          response,
          callCount: this.callCount
        }
      };
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          serviceName: this.serviceName
        }
      };
    }
  }
  
  /**
   * Get mock response for a method
   */
  async getMockResponse(method, args, context) {
    // Check for specific mock response
    if (this.mockResponses[method]) {
      const response = this.mockResponses[method];
      
      // If response is a function, call it with args
      if (typeof response === 'function') {
        return await response(args, context);
      }
      
      // If response is an array, return based on call count
      if (Array.isArray(response)) {
        const index = Math.min(this.callCount - 1, response.length - 1);
        return response[index];
      }
      
      return response;
    }
    
    // Default responses based on service type
    return this.getDefaultResponse(method);
  }
  
  /**
   * Get default response based on service type
   */
  getDefaultResponse(method) {
    switch (this.serviceType) {
      case 'session':
        return this.getSessionDefaultResponse(method);
      case 'module':
        return this.getModuleDefaultResponse(method);
      case 'storage':
        return this.getStorageDefaultResponse(method);
      case 'llm':
        return this.getLLMDefaultResponse(method);
      default:
        return { success: true, mocked: true };
    }
  }
  
  /**
   * Default responses for session service
   */
  getSessionDefaultResponse(method) {
    switch (method) {
      case 'createSession':
        return { id: `mock-session-${Date.now()}`, createdAt: new Date().toISOString() };
      case 'getSession':
        return { id: 'mock-session', messages: [] };
      case 'addMessage':
      case 'updateSession':
      case 'deleteSession':
        return true;
      case 'getMessages':
        return [];
      default:
        return { success: true };
    }
  }
  
  /**
   * Default responses for module service
   */
  getModuleDefaultResponse(method) {
    switch (method) {
      case 'loadModule':
        return { success: true, module: 'mock-module' };
      case 'getToolByName':
        return { 
          name: 'mock-tool',
          execute: async () => ({ success: true, result: 'mock result' })
        };
      case 'getAllTools':
        return [
          { name: 'file_read', type: 'tool' },
          { name: 'directory_list', type: 'tool' }
        ];
      case 'getLoadedModules':
        return ['file', 'web', 'mock'];
      default:
        return { success: true };
    }
  }
  
  /**
   * Default responses for storage service
   */
  getStorageDefaultResponse(method) {
    switch (method) {
      case 'store':
      case 'storeArtifact':
        return { success: true, id: `artifact-${Date.now()}` };
      case 'get':
      case 'getArtifact':
        return { id: 'mock-artifact', content: 'mock content' };
      case 'list':
      case 'getAllArtifacts':
        return [];
      case 'delete':
      case 'deleteArtifact':
        return { success: true };
      default:
        return { success: true };
    }
  }
  
  /**
   * Default responses for LLM service
   */
  getLLMDefaultResponse(method) {
    switch (method) {
      case 'complete':
      case 'chat':
        return {
          content: 'This is a mock LLM response.',
          role: 'assistant',
          model: 'mock-model'
        };
      case 'stream':
        return {
          chunks: ['This ', 'is ', 'a ', 'mock ', 'stream.'],
          complete: true
        };
      default:
        return { success: true };
    }
  }
  
  /**
   * Record a service call
   */
  recordCall(method, args) {
    this.callCount++;
    this.callHistory.push({
      method,
      args,
      timestamp: Date.now(),
      callNumber: this.callCount
    });
  }
  
  /**
   * Get call history for a specific method
   */
  getCallsForMethod(method) {
    return this.callHistory.filter(call => call.method === method);
  }
  
  /**
   * Reset mock state
   */
  reset() {
    this.callHistory = [];
    this.callCount = 0;
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'mock_service',
      serviceName: this.serviceName,
      serviceType: this.serviceType,
      callCount: this.callCount,
      totalCalls: this.callHistory.length,
      capabilities: [
        'behavior_tree_mocking',
        'call_tracking',
        'response_customization',
        'service_simulation'
      ]
    };
  }
}