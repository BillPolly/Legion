/**
 * FileSystem Protocol Implementation
 * 
 * Implements the Protocol interface for filesystem server communication
 * using the WebSocket-Actor bridge pattern.
 */
import { Protocol } from '@legion/websocket-actor-protocol';

export class FileSystemProtocol extends Protocol {
  constructor() {
    super({
      name: 'FileSystemProtocol',
      version: '1.0.0'
    });
    
    this.sessionId = null;
    this.clientId = null;
    this.initialize();
  }

  /**
   * Initialize filesystem message types and schemas
   */
  initialize() {
    // Define all filesystem message types as a map for validation
    this.messageTypes = {
      // Client -> Server
      'fs_connect': true,
      'fs_query': true,
      'fs_update': true,
      'fs_subscribe': true,
      'fs_unsubscribe': true,
      'fs_stream_read': true,
      'fs_stream_write': true,
      
      // Server -> Client
      'fs_welcome': true,
      'fs_connected': true,
      'fs_connect_response': true,
      'fs_query_result': true,
      'fs_query_response': true,
      'fs_update_result': true,
      'fs_update_response': true,
      'fs_subscribed': true,
      'fs_unsubscribed': true,
      'fs_file_change': true,
      'fs_stream_data': true,
      'fs_stream_end': true,
      'fs_error': true
    };
    
    // Define message type constants for convenience
    this.MESSAGE_TYPES = {
      // Client -> Server
      FS_CONNECT: 'fs_connect',
      FS_QUERY: 'fs_query',
      FS_UPDATE: 'fs_update',
      FS_SUBSCRIBE: 'fs_subscribe',
      FS_UNSUBSCRIBE: 'fs_unsubscribe',
      FS_STREAM_READ: 'fs_stream_read',
      FS_STREAM_WRITE: 'fs_stream_write',
      
      // Server -> Client
      FS_WELCOME: 'fs_welcome',
      FS_CONNECTED: 'fs_connected',
      FS_QUERY_RESULT: 'fs_query_result',
      FS_UPDATE_RESULT: 'fs_update_result',
      FS_SUBSCRIBED: 'fs_subscribed',
      FS_UNSUBSCRIBED: 'fs_unsubscribed',
      FS_FILE_CHANGE: 'fs_file_change',
      FS_STREAM_DATA: 'fs_stream_data',
      FS_STREAM_END: 'fs_stream_end',
      FS_ERROR: 'fs_error'
    };

    // Define message schemas (simplified)
    this.schemas = {
      fs_connect: {
        type: 'fs_connect',
        requestId: 'string',
        authToken: 'string?' // optional
      },
      fs_query: {
        type: 'fs_query',
        query: 'object',
        requestId: 'string'
      },
      fs_update: {
        type: 'fs_update',
        path: 'string?',
        data: 'object',
        requestId: 'string'
      },
      fs_subscribe: {
        type: 'fs_subscribe',
        query: 'object',
        subscriptionId: 'string',
        requestId: 'string'
      }
    };
  }

  /**
   * Transform actor message to FileSystem protocol message
   */
  actorToProtocol(actorMessage) {
    const { type, payload, requestId } = actorMessage;
    
    switch (type) {
      case 'filesystemConnect':
        return {
          type: this.MESSAGE_TYPES.FS_CONNECT,
          authToken: payload.authToken,
          requestId: requestId || `req_${Date.now()}`
        };
        
      case 'filesystemQuery':
        return {
          type: this.MESSAGE_TYPES.FS_QUERY,
          query: payload.querySpec,
          requestId: requestId || `req_${Date.now()}`
        };
        
      case 'filesystemUpdate':
        return {
          type: this.MESSAGE_TYPES.FS_UPDATE,
          path: payload.path,
          data: payload.data,
          requestId: requestId || `req_${Date.now()}`
        };
        
      case 'filesystemSubscribe':
        return {
          type: this.MESSAGE_TYPES.FS_SUBSCRIBE,
          query: payload.querySpec,
          subscriptionId: payload.subscriptionId
        };
        
      case 'filesystemUnsubscribe':
        return {
          type: this.MESSAGE_TYPES.FS_UNSUBSCRIBE,
          subscriptionId: payload.subscriptionId
        };
        
      case 'filesystemStreamRead':
        return {
          type: this.MESSAGE_TYPES.FS_STREAM_READ,
          path: payload.path,
          options: payload.options || {},
          requestId: requestId || `req_${Date.now()}`
        };
        
      case 'filesystemStreamWrite':
        return {
          type: this.MESSAGE_TYPES.FS_STREAM_WRITE,
          path: payload.path,
          data: payload.data,
          options: payload.options || {},
          requestId: requestId || `req_${Date.now()}`
        };
        
      default:
        throw new Error(`Unknown actor message type: ${type}`);
    }
  }

  /**
   * Transform FileSystem protocol message to actor message
   */
  protocolToActor(protocolMessage) {
    const { type } = protocolMessage;
    
    switch (type) {
      case 'fs_welcome':
        this.clientId = protocolMessage.clientId;
        return {
          type: 'filesystemServerConnected',
          payload: {
            version: protocolMessage.serverVersion,
            capabilities: protocolMessage.capabilities,
            clientId: protocolMessage.clientId
          }
        };
        
      case 'fs_connected':
      case 'fs_connect_response':
        this.sessionId = protocolMessage.sessionId;
        return {
          type: 'filesystemConnected',
          payload: {
            success: protocolMessage.success,
            sessionId: protocolMessage.sessionId,
            capabilities: protocolMessage.capabilities
          },
          requestId: protocolMessage.requestId
        };
        
      case 'fs_query_result':
      case 'fs_query_response':
        if (protocolMessage.error) {
          return {
            type: 'filesystemQueryError',
            payload: {
              error: protocolMessage.error
            },
            requestId: protocolMessage.requestId
          };
        }
        
        return {
          type: 'filesystemQueryResult',
          payload: {
            success: protocolMessage.success,
            results: protocolMessage.results || []
          },
          requestId: protocolMessage.requestId
        };
        
      case 'fs_update_result':
      case 'fs_update_response':
        if (protocolMessage.error) {
          return {
            type: 'filesystemUpdateError',
            payload: {
              error: protocolMessage.error
            },
            requestId: protocolMessage.requestId
          };
        }
        
        return {
          type: 'filesystemUpdateResult',
          payload: {
            success: protocolMessage.success,
            path: protocolMessage.path
          },
          requestId: protocolMessage.requestId
        };
        
      case 'fs_subscribed':
        return {
          type: 'filesystemSubscribed',
          payload: {
            subscriptionId: protocolMessage.subscriptionId,
            success: protocolMessage.success
          },
          requestId: protocolMessage.requestId
        };
        
      case 'fs_unsubscribed':
        return {
          type: 'filesystemUnsubscribed',
          payload: {
            subscriptionId: protocolMessage.subscriptionId,
            success: protocolMessage.success
          },
          requestId: protocolMessage.requestId
        };
        
      case 'fs_file_change':
        return {
          type: 'filesystemFileChange',
          payload: {
            subscriptionId: protocolMessage.subscriptionId,
            changes: protocolMessage.changes || {
              path: protocolMessage.path,
              event: protocolMessage.event,
              timestamp: protocolMessage.timestamp,
              data: protocolMessage.data
            }
          }
        };
        
      case 'fs_stream_data':
        return {
          type: 'filesystemStreamData',
          payload: {
            data: protocolMessage.data,
            chunk: protocolMessage.chunk,
            encoding: protocolMessage.encoding
          },
          requestId: protocolMessage.requestId
        };
        
      case 'fs_stream_end':
        return {
          type: 'filesystemStreamEnd',
          payload: {
            success: protocolMessage.success,
            totalBytes: protocolMessage.totalBytes
          },
          requestId: protocolMessage.requestId
        };
        
      case 'fs_error':
        return {
          type: 'filesystemError',
          payload: {
            error: protocolMessage.error
          },
          requestId: protocolMessage.requestId
        };
        
      default:
        throw new Error(`Unknown protocol message type: ${type}`);
    }
  }

  /**
   * Validate a message against the protocol schema
   * Overrides base Protocol.validate() to throw errors instead of returning boolean
   */
  validate(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }
    
    if (!message.type) {
      throw new Error('Message type is required');
    }
    
    // Check if message type is known
    if (!this.messageTypes[message.type]) {
      throw new Error(`Invalid message type: ${message.type}`);
    }
    
    // Validate specific message types
    switch (message.type) {
      case 'fs_query':
        if (!message.query || typeof message.query !== 'object') {
          throw new Error('Query must be an object');
        }
        if (!message.requestId) {
          throw new Error('Request ID is required');
        }
        break;
        
      case 'fs_update':
        if (!message.requestId) {
          throw new Error('Request ID is required');
        }
        if (!message.path && !message.data) {
          throw new Error('Path and data are required');
        }
        break;
        
      case 'fs_subscribe':
        if (!message.query || typeof message.query !== 'object') {
          throw new Error('Query must be an object');
        }
        if (!message.subscriptionId) {
          throw new Error('Subscription ID is required');
        }
        break;
        
      case 'fs_connect':
        if (!message.requestId) {
          throw new Error('Request ID is required');
        }
        break;
        
      case 'fs_unsubscribe':
        if (!message.subscriptionId) {
          throw new Error('Subscription ID is required');
        }
        break;
        
      default:
        // For response types, validation is less strict
        if (message.type.startsWith('fs_') && 
            !message.type.endsWith('_response') &&
            !message.type.endsWith('_result') &&
            message.type !== 'fs_welcome' &&
            message.type !== 'fs_connected' &&
            message.type !== 'fs_subscribed' &&
            message.type !== 'fs_unsubscribed' &&
            message.type !== 'fs_file_change' &&
            message.type !== 'fs_stream_data' &&
            message.type !== 'fs_stream_end' &&
            message.type !== 'fs_error') {
          if (!message.requestId) {
            throw new Error('Request ID is required');
          }
        }
    }
    
    return true;
  }

  /**
   * Get initial handshake message
   */
  getHandshakeMessage() {
    return {
      type: this.MESSAGE_TYPES.FS_CONNECT,
      requestId: `req_${Date.now()}`
    };
  }

  /**
   * Handle connection established
   */
  handleConnectionEstablished(welcomeMessage) {
    // After welcome, we already sent fs_connect in handshake
    // Return empty array as no additional messages needed
    return [];
  }

  /**
   * Check if a message is an error
   */
  isError(message) {
    return message.type === 'fs_error' || message.error !== undefined;
  }

  /**
   * Extract error details from a message
   */
  extractError(message) {
    return {
      code: message.error?.code || -1,
      message: message.error?.message || message.error || 'Filesystem operation failed',
      data: message.error?.data
    };
  }
}