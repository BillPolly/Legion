/**
 * Shared test setup utilities for Web Debug Interface tests
 * 
 * This module provides shared server instances and utilities to avoid
 * excessive console logging and server creation/destruction in tests.
 */

import { WebDebugServer } from '../../WebDebugServer.js';
import { DebugTool } from '../../DebugTool.js';
import { mockResourceManager } from './mockData.js';

/**
 * Shared test server instances to reduce console noise
 */
let sharedWebDebugServer = null;
let sharedDebugTool = null;
let sharedServerPort = null;
let originalConsoleLog = null;

/**
 * Get or create shared WebDebugServer instance
 * @returns {Promise<WebDebugServer>} Shared server instance
 */
export async function getSharedWebDebugServer() {
  if (sharedWebDebugServer && sharedWebDebugServer.isRunning) {
    return sharedWebDebugServer;
  }

  // Suppress console logs during server creation
  if (!originalConsoleLog) {
    originalConsoleLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      if (!message.includes('🐛') && !message.includes('Debug client')) {
        originalConsoleLog(...args);
      }
    };
  }

  // Create new server instance
  const mockRM = {
    ...mockResourceManager,
    get: mockResourceManager.get
  };
  
  sharedWebDebugServer = await WebDebugServer.create(mockRM);
  await sharedWebDebugServer.start({ 
    openBrowser: false 
  });
  
  sharedServerPort = sharedWebDebugServer.port;
  
  return sharedWebDebugServer;
}

/**
 * Get or create shared DebugTool instance
 * @returns {Promise<DebugTool>} Shared debug tool instance
 */
export async function getSharedDebugTool() {
  if (sharedDebugTool) {
    return sharedDebugTool;
  }

  // Ensure we have a shared server first
  if (!sharedWebDebugServer) {
    await getSharedWebDebugServer();
  }

  const mockRM = {
    ...mockResourceManager,
    get: (key) => {
      if (key === 'webDebugServer') {
        return sharedWebDebugServer;
      }
      return mockResourceManager.get(key);
    }
  };
  
  sharedDebugTool = await DebugTool.create(mockRM);
  return sharedDebugTool;
}

/**
 * Get the shared server port
 * @returns {number} Server port
 */
export function getSharedServerPort() {
  return sharedServerPort;
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function waitForAsync(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a WebSocket helper for testing
 * @param {WebSocket} ws - WebSocket instance
 * @returns {Object} Helper methods for WebSocket testing
 */
export function createWebSocketHelper(ws) {
  const receivedMessages = [];
  
  ws.on('message', (data) => {
    receivedMessages.push(JSON.parse(data.toString()));
  });
  
  return {
    getMessages: () => receivedMessages,
    clearMessages: () => { receivedMessages.length = 0; },
    waitForMessage: (predicate, timeout = 1000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkMessage = () => {
          const message = receivedMessages.find(predicate);
          if (message) {
            resolve(message);
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error('Timeout waiting for message'));
            return;
          }
          
          setTimeout(checkMessage, 10);
        };
        
        checkMessage();
      });
    },
    sendMessage: (message) => {
      ws.send(JSON.stringify(message));
    }
  };
}

// Global test utilities (keeping some existing functionality)
global.testUtils = {
  // Wait for condition with timeout
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  },

  // Generate test data
  generateTestData: {
    contextItem: (name = 'test-context') => ({
      name,
      data: { test: 'data', timestamp: Date.now() },
      description: `Test context: ${name}`
    }),
    
    mcpToolResult: (success = true) => ({
      content: [{
        type: "text",
        text: JSON.stringify({ success, message: 'Test result' }, null, 2)
      }],
      isError: !success
    }),
    
    serverEvent: (type = 'test-event') => ({
      type: 'event',
      data: {
        eventType: type,
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: { test: 'event data' }
      }
    })
  }
};

/**
 * Global cleanup function for all tests
 */
export async function cleanupSharedResources() {
  if (sharedWebDebugServer && sharedWebDebugServer.isRunning) {
    await sharedWebDebugServer.stop();
  }
  
  // Restore console.log
  if (originalConsoleLog) {
    console.log = originalConsoleLog;
    originalConsoleLog = null;
  }
  
  sharedWebDebugServer = null;
  sharedDebugTool = null;
  sharedServerPort = null;
}

// Global teardown at the end of all tests
if (global.afterAll) {
  afterAll(async () => {
    await cleanupSharedResources();
  });
}

// Custom matchers for our mock functions
expect.extend({
  toBeArray(received) {
    const pass = Array.isArray(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be an array`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be an array`,
        pass: false,
      };
    }
  },
  
  toHaveBeenCalled(received) {
    if (typeof received === 'function' && received.mock) {
      const pass = received.mock.calls.length > 0;
      return {
        message: () => pass 
          ? `expected mock function not to have been called`
          : `expected mock function to have been called`,
        pass
      };
    }
    throw new Error('toHaveBeenCalled must be used with a mock function');
  },
  
  toHaveBeenCalledWith(received, ...expectedArgs) {
    if (typeof received === 'function' && received.mock) {
      const pass = received.mock.calls.some(callArgs => 
        JSON.stringify(callArgs) === JSON.stringify(expectedArgs)
      );
      return {
        message: () => pass
          ? `expected mock function not to have been called with ${JSON.stringify(expectedArgs)}`
          : `expected mock function to have been called with ${JSON.stringify(expectedArgs)}`,
        pass
      };
    }
    throw new Error('toHaveBeenCalledWith must be used with a mock function');
  },
  
  toHaveBeenCalledTimes(received, expectedTimes) {
    if (typeof received === 'function' && received.mock) {
      const pass = received.mock.calls.length === expectedTimes;
      return {
        message: () => pass
          ? `expected mock function not to have been called ${expectedTimes} times`
          : `expected mock function to have been called ${expectedTimes} times, but was called ${received.mock.calls.length} times`,
        pass
      };
    }
    throw new Error('toHaveBeenCalledTimes must be used with a mock function');
  }
});