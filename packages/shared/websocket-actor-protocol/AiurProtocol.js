/**
 * Aiur Protocol Implementation
 * 
 * Implements the Protocol interface for Aiur server communication
 */
import { Protocol } from './Protocol.js';

export class AiurProtocol extends Protocol {
  constructor() {
    super({
      name: 'AiurProtocol',
      version: '1.0.0'
    });
    
    this.sessionId = null;
    this.clientId = null;
    this.initialize();
  }

  /**
   * Initialize Aiur message types and schemas
   */
  initialize() {
    // Define all Aiur message types as a map for validation
    this.messageTypes = {
      // Client -> Server
      'session_create': true,
      'session_attach': true,
      'tool_request': true,
      'schema_request': true,
      
      // Server -> Client
      'welcome': true,
      'session_created': true,
      'tool_response': true,
      'schema_response': true,
      'error': true
    };
    
    // Define message type constants for convenience
    this.MESSAGE_TYPES = {
      // Client -> Server
      SESSION_CREATE: 'session_create',
      SESSION_ATTACH: 'session_attach',
      TOOL_REQUEST: 'tool_request',
      SCHEMA_REQUEST: 'schema_request',
      
      // Server -> Client
      WELCOME: 'welcome',
      SESSION_CREATED: 'session_created',
      TOOL_RESPONSE: 'tool_response',
      SCHEMA_RESPONSE: 'schema_response',
      ERROR: 'error'
    };

    // Define message schemas (simplified - could use Zod/Joi for validation)
    this.schemas = {
      session_create: {
        type: 'session_create',
        requestId: 'string'
      },
      tool_request: {
        type: 'tool_request',
        method: 'string',
        params: 'object',
        requestId: 'string'
      }
    };
  }

  /**
   * Transform actor message to Aiur protocol message
   */
  actorToProtocol(actorMessage) {
    const { type, payload, requestId } = actorMessage;
    
    switch (type) {
      case 'execute':
        // Parse command and create appropriate request
        return this.parseCommand(payload.command, requestId);
        
      case 'loadModule':
        return {
          type: this.MESSAGE_TYPES.TOOL_REQUEST,
          method: 'module/load',
          params: { name: payload.moduleName },
          requestId: requestId || `req_${Date.now()}`
        };
        
      case 'listTools':
        return {
          type: this.MESSAGE_TYPES.TOOL_REQUEST,
          method: 'tools/list',
          params: {},
          requestId: requestId || `req_${Date.now()}`
        };
        
      case 'callTool':
        return {
          type: this.MESSAGE_TYPES.TOOL_REQUEST,
          method: 'tools/call',
          params: {
            name: payload.toolName,
            arguments: payload.args || {}
          },
          requestId: requestId || `req_${Date.now()}`
        };
        
      case 'execute':
        // Handle command execution from terminal
        const command = payload.command || '';
        if (!command) {
          throw new Error('No command provided for execution');
        }
        return this.parseCommand(command, requestId);
        
      default:
        // Try parsing as a direct command
        console.warn(`Unknown actor message type: ${type}, attempting to parse as command`);
        if (payload && payload.command) {
          return this.parseCommand(payload.command, requestId);
        }
        throw new Error(`Unknown actor message type: ${type}`);
    }
  }

  /**
   * Transform Aiur protocol message to actor message
   */
  protocolToActor(protocolMessage) {
    const { type } = protocolMessage;
    
    switch (type) {
      case 'welcome':
        this.clientId = protocolMessage.clientId;
        return {
          type: 'serverConnected',
          payload: {
            version: protocolMessage.serverVersion,
            capabilities: protocolMessage.capabilities
          }
        };
        
      case 'session_created':
        this.sessionId = protocolMessage.sessionId;
        return {
          type: 'sessionCreated',
          payload: {
            sessionId: protocolMessage.sessionId,
            success: protocolMessage.success
          },
          requestId: protocolMessage.requestId
        };
        
      case 'tool_response':
        // Parse different types of tool responses
        if (protocolMessage.error) {
          return {
            type: 'toolError',
            payload: {
              error: protocolMessage.error
            },
            requestId: protocolMessage.requestId
          };
        }
        
        // Check for specific result types
        const result = protocolMessage.result;
        if (result?.tools) {
          return {
            type: 'toolsList',
            payload: {
              tools: result.tools
            },
            requestId: protocolMessage.requestId
          };
        }
        
        if (result?.module) {
          return {
            type: 'moduleLoaded',
            payload: {
              module: result.module
            },
            requestId: protocolMessage.requestId
          };
        }
        
        // Generic tool result
        return {
          type: 'toolResult',
          payload: {
            result: result
          },
          requestId: protocolMessage.requestId
        };
        
      case 'error':
        return {
          type: 'error',
          payload: {
            error: protocolMessage.error
          },
          requestId: protocolMessage.requestId
        };
        
      default:
        return {
          type: 'unknown',
          payload: protocolMessage
        };
    }
  }

  /**
   * Parse a command string into an Aiur protocol message
   */
  parseCommand(command, requestId) {
    const parts = command.split(' ');
    const cmdName = parts[0];
    
    // Special commands
    if (cmdName === 'module_load') {
      return {
        type: this.MESSAGE_TYPES.TOOL_REQUEST,
        method: 'module/load',
        params: { name: parts[1] },
        requestId: requestId || `req_${Date.now()}`
      };
    }
    
    if (cmdName === 'tools_list' || cmdName === 'module_list') {
      return {
        type: this.MESSAGE_TYPES.TOOL_REQUEST,
        method: 'tools/list',
        params: {},
        requestId: requestId || `req_${Date.now()}`
      };
    }
    
    // Assume it's a tool call - parse basic positional arguments
    const args = {};
    
    // Map positional arguments for known tools
    if (cmdName === 'file_read' && parts[1]) {
      args.path = parts[1];
    } else if (cmdName === 'module_info' && parts[1]) {
      args.module = parts[1];
    } else if (cmdName === 'context_get' && parts[1]) {
      args.name = parts[1];
    } else if (parts.length > 1) {
      // Check for key:value pairs
      let hasKeyValue = false;
      for (let i = 1; i < parts.length; i++) {
        const arg = parts[i];
        if (arg.includes(':')) {
          const [key, ...valueParts] = arg.split(':');
          args[key] = valueParts.join(':');
          hasKeyValue = true;
        }
      }
      
      // If no key:value pairs found, pass as generic args
      if (!hasKeyValue) {
        args.args = parts.slice(1);
      }
    }
    
    return {
      type: this.MESSAGE_TYPES.TOOL_REQUEST,
      method: 'tools/call',
      params: {
        name: cmdName,
        arguments: args
      },
      requestId: requestId || `req_${Date.now()}`
    };
  }

  /**
   * Get initial handshake message
   */
  getHandshakeMessage() {
    return {
      type: this.MESSAGE_TYPES.SESSION_CREATE,
      requestId: `req_${Date.now()}`
    };
  }

  /**
   * Handle connection established
   */
  handleConnectionEstablished(welcomeMessage) {
    // After welcome, we already sent session_create in handshake
    // Return empty array as no additional messages needed
    return [];
  }
}