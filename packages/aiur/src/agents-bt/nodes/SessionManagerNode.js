/**
 * SessionManagerNode - Handles session lifecycle management
 * 
 * Manages session creation, attachment, and lifecycle operations
 * within agent workflows.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class SessionManagerNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'session_manager';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.action = config.action || 'create_session';
  }

  async executeNode(context) {
    try {
      switch (this.action) {
        case 'create_session':
          return await this.createSession(context);
        case 'attach_session':
          return await this.attachSession(context);
        case 'get_session':
          return await this.getSession(context);
        case 'destroy_session':
          return await this.destroySession(context);
        default:
          return {
            status: NodeStatus.FAILURE,
            data: { error: `Unknown action: ${this.action}` }
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
   * Create new session
   */
  async createSession(context) {
    if (!context.sessionManager) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'Session manager not available' }
      };
    }
    
    try {
      const sessionInfo = await context.sessionManager.createSession();
      
      // Send response to remote actor
      if (context.remoteActor) {
        const response = {
          type: 'session_created',
          requestId: context.message?.requestId,
          sessionId: sessionInfo.sessionId,
          success: true,
          created: sessionInfo.created,
          capabilities: sessionInfo.capabilities || []
        };
        
        context.remoteActor.receive(response);
        
        // Store response for other nodes
        context.response = response;
      }
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          sessionInfo: sessionInfo,
          sessionCreated: true
        }
      };
      
    } catch (error) {
      const errorResponse = {
        type: 'session_error',
        requestId: context.message?.requestId,
        error: error.message
      };
      
      if (context.remoteActor) {
        context.remoteActor.receive(errorResponse);
      }
      
      return {
        status: NodeStatus.FAILURE,
        data: { error: error.message }
      };
    }
  }
  
  /**
   * Attach to existing session
   */
  async attachSession(context) {
    if (!context.sessionManager) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'Session manager not available' }
      };
    }
    
    const sessionId = context.message?.sessionId;
    if (!sessionId) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'Session ID required for attachment' }
      };
    }
    
    try {
      const session = context.sessionManager.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // Send response to remote actor
      if (context.remoteActor) {
        const response = {
          type: 'session_attached',
          requestId: context.message?.requestId,
          sessionId: sessionId,
          success: true
        };
        
        context.remoteActor.receive(response);
        context.response = response;
      }
      
      // Update context with session info
      context.session = session;
      context.sessionId = sessionId;
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          sessionId: sessionId,
          sessionAttached: true,
          session: session
        }
      };
      
    } catch (error) {
      const errorResponse = {
        type: 'session_error',
        requestId: context.message?.requestId,
        error: error.message
      };
      
      if (context.remoteActor) {
        context.remoteActor.receive(errorResponse);
      }
      
      return {
        status: NodeStatus.FAILURE,
        data: { error: error.message }
      };
    }
  }
  
  /**
   * Get session information
   */
  async getSession(context) {
    if (!context.sessionManager) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'Session manager not available' }
      };
    }
    
    const sessionId = context.sessionId || context.message?.sessionId;
    if (!sessionId) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'No session ID available' }
      };
    }
    
    const session = context.sessionManager.getSession(sessionId);
    
    if (!session) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: `Session ${sessionId} not found` }
      };
    }
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        sessionId: sessionId,
        session: session,
        sessionFound: true
      }
    };
  }
  
  /**
   * Destroy session
   */
  async destroySession(context) {
    if (!context.sessionManager) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'Session manager not available' }
      };
    }
    
    const sessionId = context.sessionId || context.message?.sessionId;
    if (!sessionId) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'No session ID to destroy' }
      };
    }
    
    try {
      await context.sessionManager.destroySession(sessionId);
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          sessionId: sessionId,
          sessionDestroyed: true
        }
      };
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: error.message }
      };
    }
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'session_management',
      action: this.action,
      supportsActions: [
        'create_session',
        'attach_session',
        'get_session',
        'destroy_session'
      ]
    };
  }
}