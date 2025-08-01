/**
 * SessionManagerActor - Manages client sessions
 */

export class SessionManagerActor {
  constructor(sessionManager) {
    this.isActor = true;
    this.sessionManager = sessionManager;
  }

  /**
   * Receive and handle messages
   * @param {Object} message - Incoming message
   */
  receive(message) {
    switch (message.type) {
      case 'create_session':
        this.handleCreateSession(message);
        break;
        
      case 'restore_session':
        this.handleRestoreSession(message);
        break;
        
      case 'get_sessions':
        this.handleGetSessions(message);
        break;
        
      case 'delete_session':
        this.handleDeleteSession(message);
        break;
        
      case 'get_variables':
        this.handleGetVariables(message);
        break;
        
      case 'set_variable':
        this.handleSetVariable(message);
        break;
        
      case 'update_context':
        this.handleUpdateContext(message);
        break;
        
      default:
        console.warn('SessionManagerActor: Unknown message type', message.type);
    }
  }

  /**
   * Handle create session request
   * @private
   */
  handleCreateSession(message) {
    const { clientId, requestId } = message;
    
    const session = this.sessionManager.createSession(clientId);
    
    // Emit session created event
    this.emit('session_created', {
      sessionId: session.id,
      clientId: session.clientId
    });
    
    this.reply({
      type: 'session_created',
      requestId,
      sessionId: session.id,
      tools: session.tools || []
    });
  }

  /**
   * Handle restore session request
   * @private
   */
  handleRestoreSession(message) {
    const { sessionId, requestId } = message;
    
    const session = this.sessionManager.getSession(sessionId);
    
    if (!session) {
      this.reply({
        type: 'error',
        requestId,
        error: `Session not found: ${sessionId}`
      });
      return;
    }
    
    // Convert Map to object for serialization
    const variables = {};
    if (session.variables instanceof Map) {
      session.variables.forEach((value, key) => {
        variables[key] = value;
      });
    }
    
    this.reply({
      type: 'session_restored',
      requestId,
      session: {
        id: session.id,
        clientId: session.clientId,
        state: session.state,
        variables
      }
    });
  }

  /**
   * Handle get sessions request
   * @private
   */
  handleGetSessions(message) {
    const { requestId } = message;
    
    const sessions = this.sessionManager.getAllSessions();
    
    this.reply({
      type: 'sessions_list',
      requestId,
      sessions
    });
  }

  /**
   * Handle delete session request
   * @private
   */
  handleDeleteSession(message) {
    const { sessionId, requestId } = message;
    
    this.sessionManager.deleteSession(sessionId);
    
    // Emit session deleted event
    this.emit('session_deleted', {
      sessionId
    });
    
    this.reply({
      type: 'session_deleted',
      requestId,
      sessionId
    });
  }

  /**
   * Handle get variables request
   * @private
   */
  handleGetVariables(message) {
    const { sessionId, requestId } = message;
    
    const session = this.sessionManager.getSession(sessionId);
    
    if (!session) {
      this.reply({
        type: 'error',
        requestId,
        error: `Session not found: ${sessionId}`
      });
      return;
    }
    
    // Convert Map to object
    const variables = {};
    if (session.variables instanceof Map) {
      session.variables.forEach((value, key) => {
        variables[key] = value;
      });
    }
    
    this.reply({
      type: 'variables_list',
      requestId,
      variables
    });
  }

  /**
   * Handle set variable request
   * @private
   */
  handleSetVariable(message) {
    const { sessionId, name, value, requestId } = message;
    
    const session = this.sessionManager.getSession(sessionId);
    
    if (!session) {
      this.reply({
        type: 'error',
        requestId,
        error: `Session not found: ${sessionId}`
      });
      return;
    }
    
    // Ensure variables is a Map
    if (!session.variables) {
      session.variables = new Map();
    }
    
    session.variables.set(name, value);
    
    // Emit variable changed event
    this.emit('variable_changed', {
      sessionId,
      name,
      value
    });
    
    this.reply({
      type: 'variable_set',
      requestId,
      name,
      value
    });
  }

  /**
   * Handle update context request
   * @private
   */
  handleUpdateContext(message) {
    const { sessionId, context, requestId } = message;
    
    const session = this.sessionManager.getSession(sessionId);
    
    if (!session) {
      this.reply({
        type: 'error',
        requestId,
        error: `Session not found: ${sessionId}`
      });
      return;
    }
    
    this.sessionManager.updateSession(sessionId, { context });
    
    // Emit context updated event
    this.emit('context_updated', {
      sessionId,
      context
    });
    
    this.reply({
      type: 'context_updated',
      requestId,
      sessionId
    });
  }

  /**
   * Reply method (set by ActorSpace)
   */
  reply(message) {
    throw new Error('Reply method not initialized');
  }

  /**
   * Emit method (set by ActorSpace)
   */
  emit(event, data) {
    // Default no-op, overridden by ActorSpace
  }
}