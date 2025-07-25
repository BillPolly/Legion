/**
 * WebSocket proxy server for MCP connections
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

/**
 * Create a WebSocket server that proxies connections to MCP servers
 * @param {Object} httpServer - HTTP server instance
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @returns {WebSocketServer} WebSocket server instance
 */
export function createWebSocketServer(httpServer, config, logger) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws'
  });
  
  // Track client connections
  const clients = new Map();
  
  wss.on('connection', (clientWs, request) => {
    const clientId = randomUUID();
    const clientLogger = logger.child({ clientId });
    
    // Get client info
    const clientIp = request.socket?.remoteAddress || 'unknown';
    const userAgent = request.headers?.['user-agent'] || 'unknown';
    
    clientLogger.info('Debug UI client connected', { ip: clientIp, userAgent });
    
    // Initialize client state
    const clientState = {
      id: clientId,
      ws: clientWs,
      mcpConnection: null,
      reconnectAttempts: 0,
      reconnectTimer: null,
      isConnecting: false,
      messageQueue: []
    };
    
    clients.set(clientId, clientState);
    
    // Send welcome message
    sendMessage(clientWs, {
      type: 'welcome',
      data: {
        clientId,
        defaultMcpUrl: config.mcp.defaultUrl,
        config: {
          reconnectInterval: config.mcp.reconnectInterval,
          maxReconnectAttempts: config.mcp.maxReconnectAttempts,
          autoStarted: config.mcp.autoStarted || false
        },
        serverInfo: {
          autoStartEnabled: config.mcp.autoStart !== false,
          mcpServerRunning: config.mcp.autoStarted || false
        }
      }
    });
    
    // Handle client messages
    clientWs.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleClientMessage(clientState, message, config, clientLogger);
      } catch (error) {
        clientLogger.error('Failed to handle client message:', error);
        sendMessage(clientWs, {
          type: 'error',
          data: {
            message: 'Invalid message format',
            error: error.message
          }
        });
      }
    });
    
    // Handle client disconnect
    clientWs.on('close', () => {
      clientLogger.info('Debug UI client disconnected');
      cleanupClient(clientState);
      clients.delete(clientId);
    });
    
    // Handle client errors
    clientWs.on('error', (error) => {
      clientLogger.error('WebSocket error:', error);
    });
  });
  
  return wss;
}

/**
 * Handle messages from debug UI clients
 * @param {Object} clientState - Client state object
 * @param {Object} message - Parsed message from client
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 */
async function handleClientMessage(clientState, message, config, logger) {
  const { type, data = {} } = message;
  
  switch (type) {
    case 'connect':
      await handleConnect(clientState, data, config, logger);
      break;
      
    case 'disconnect':
      handleDisconnect(clientState, logger);
      break;
      
    case 'mcp-request':
      handleMcpRequest(clientState, data, logger);
      break;
      
    case 'ping':
      sendMessage(clientState.ws, { type: 'pong' });
      break;
      
    default:
      logger.warn('Unknown message type:', type);
  }
}

/**
 * Handle connection requests to MCP servers
 * @param {Object} clientState - Client state object
 * @param {Object} data - Connection data
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 */
async function handleConnect(clientState, data, config, logger) {
  const url = data.url || config.mcp.defaultUrl;
  
  logger.info('Connecting to MCP server:', { 
    url, 
    userRequested: !!data.url,
    autoStarted: config.mcp.autoStarted 
  });
  
  // Close existing connection if any
  if (clientState.mcpConnection) {
    clientState.mcpConnection.close();
  }
  
  // Clear reconnection timer
  if (clientState.reconnectTimer) {
    clearTimeout(clientState.reconnectTimer);
    clientState.reconnectTimer = null;
  }
  
  // Reset connection state
  clientState.isConnecting = true;
  clientState.reconnectAttempts = 0;
  
  try {
    await establishMcpConnection(clientState, url, config, logger);
  } catch (error) {
    logger.error('Failed to establish MCP connection:', error);
    sendMessage(clientState.ws, {
      type: 'error',
      data: {
        message: 'Failed to connect to MCP server',
        error: error.message,
        url
      }
    });
    clientState.isConnecting = false;
  }
}

/**
 * Handle disconnection from MCP servers
 * @param {Object} clientState - Client state object
 * @param {Object} logger - Logger instance
 */
function handleDisconnect(clientState, logger) {
  logger.info('Disconnecting from MCP server');
  
  // Clear reconnection timer
  if (clientState.reconnectTimer) {
    clearTimeout(clientState.reconnectTimer);
    clientState.reconnectTimer = null;
  }
  
  // Close MCP connection
  if (clientState.mcpConnection) {
    clientState.mcpConnection.close();
    clientState.mcpConnection = null;
  }
  
  clientState.isConnecting = false;
  clientState.reconnectAttempts = 0;
  clientState.messageQueue = [];
}

/**
 * Handle MCP requests from clients
 * @param {Object} clientState - Client state object
 * @param {Object} data - Request data
 * @param {Object} logger - Logger instance
 */
function handleMcpRequest(clientState, data, logger) {
  if (!clientState.mcpConnection || clientState.mcpConnection.readyState !== WebSocket.OPEN) {
    // Queue the request if we're reconnecting
    if (clientState.isConnecting) {
      clientState.messageQueue.push(data);
      return;
    }
    
    // Reject if not connected and not reconnecting
    sendMessage(clientState.ws, {
      type: 'error',
      data: {
        message: 'Not connected to MCP server',
        id: data.id
      }
    });
    return;
  }
  
  // Forward the request to MCP server
  try {
    clientState.mcpConnection.send(JSON.stringify(data));
  } catch (error) {
    logger.error('Failed to send MCP request:', error);
    sendMessage(clientState.ws, {
      type: 'error',
      data: {
        message: 'Failed to send request to MCP server',
        error: error.message,
        id: data.id
      }
    });
  }
}

/**
 * Establish connection to MCP server
 * @param {Object} clientState - Client state object
 * @param {string} url - MCP server URL
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 */
function establishMcpConnection(clientState, url, config, logger) {
  return new Promise((resolve, reject) => {
    const mcpWs = new WebSocket(url);
    
    const connectionTimeout = setTimeout(() => {
      mcpWs.close();
      reject(new Error('Connection timeout'));
    }, 10000);
    
    mcpWs.on('open', () => {
      clearTimeout(connectionTimeout);
      logger.info('Connected to MCP server:', url);
      
      clientState.mcpConnection = mcpWs;
      clientState.isConnecting = false;
      clientState.reconnectAttempts = 0;
      
      // Send connection confirmation
      sendMessage(clientState.ws, {
        type: 'connected',
        data: { url }
      });
      
      // Process queued messages
      const queue = clientState.messageQueue.splice(0);
      queue.forEach(message => {
        handleMcpRequest(clientState, message, logger);
      });
      
      resolve();
    });
    
    mcpWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        sendMessage(clientState.ws, {
          type: 'mcp-response',
          data: message
        });
      } catch (error) {
        logger.error('Failed to parse MCP message:', error);
      }
    });
    
    mcpWs.on('close', () => {
      clearTimeout(connectionTimeout);
      logger.info('MCP connection closed');
      
      sendMessage(clientState.ws, {
        type: 'disconnected',
        data: { url }
      });
      
      // Attempt reconnection if configured
      if (clientState.reconnectAttempts < config.mcp.maxReconnectAttempts) {
        scheduleReconnection(clientState, url, config, logger);
      }
    });
    
    mcpWs.on('error', (error) => {
      clearTimeout(connectionTimeout);
      logger.error('MCP connection error:', error);
      
      sendMessage(clientState.ws, {
        type: 'error',
        data: {
          message: 'MCP connection error',
          error: error.message,
          url
        }
      });
      
      clientState.isConnecting = false;
      reject(error);
    });
  });
}

/**
 * Schedule reconnection attempt with exponential backoff
 * @param {Object} clientState - Client state object
 * @param {string} url - MCP server URL
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 */
function scheduleReconnection(clientState, url, config, logger) {
  clientState.reconnectAttempts++;
  const delay = config.mcp.reconnectInterval * Math.pow(2, clientState.reconnectAttempts - 1);
  
  logger.info(`Scheduling reconnection attempt ${clientState.reconnectAttempts} in ${delay}ms`);
  
  sendMessage(clientState.ws, {
    type: 'reconnecting',
    data: {
      attempt: clientState.reconnectAttempts,
      maxAttempts: config.mcp.maxReconnectAttempts,
      delay
    }
  });
  
  clientState.reconnectTimer = setTimeout(async () => {
    clientState.isConnecting = true;
    try {
      await establishMcpConnection(clientState, url, config, logger);
    } catch (error) {
      logger.error('Reconnection failed:', error);
      
      if (clientState.reconnectAttempts < config.mcp.maxReconnectAttempts) {
        scheduleReconnection(clientState, url, config, logger);
      } else {
        logger.error('Max reconnection attempts reached, giving up');
        clientState.isConnecting = false;
      }
    }
  }, delay);
}

/**
 * Send message to client WebSocket
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Message to send
 */
function sendMessage(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Clean up client resources
 * @param {Object} clientState - Client state object
 */
function cleanupClient(clientState) {
  // Clear reconnection timer
  if (clientState.reconnectTimer) {
    clearTimeout(clientState.reconnectTimer);
    clientState.reconnectTimer = null;
  }
  
  // Close MCP connection
  if (clientState.mcpConnection) {
    clientState.mcpConnection.close();
    clientState.mcpConnection = null;
  }
  
  // Clear message queue
  clientState.messageQueue = [];
}