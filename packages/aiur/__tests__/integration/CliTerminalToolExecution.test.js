/**
 * Test to reproduce the CLI terminal tool execution error:
 * "Cannot read properties of undefined (reading 'set')"
 */

import { describe, test, expect, jest } from '@jest/globals';

// Mock the sendToolRequest method from CliTerminal to test the specific error
const mockSendToolRequest = function(toolName, args) {
  return new Promise((resolve, reject) => {
    const requestId = `cli_req_${++this.aiur.requestId}`;
    
    // Store the promise resolver - THIS IS WHERE THE ERROR OCCURS
    this.aiur.pendingRequests.set(requestId, {
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      timestamp: Date.now(),
      resolve: resolve,
      reject: reject
    });
    
    // Send the request
    const success = this.aiur.sendMessage({
      type: 'tool_request',
      requestId: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });
    
    if (!success) {
      this.aiur.pendingRequests.delete(requestId);
      reject(new Error('Failed to send request'));
    }
    
    // Set a timeout
    setTimeout(() => {
      if (this.aiur.pendingRequests.has(requestId)) {
        this.aiur.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
};

describe('CLI Terminal Tool Execution Error', () => {
  test('reproduces the exact error from app.js aiur connection object', async () => {
    // This is the exact aiur connection object created in app.js lines 245-252
    const aiurConnectionFromAppJs = {
      isConnected: () => true,
      sendMessage: jest.fn(() => true),
      sendToolRequest: jest.fn(),
      toolDefinitions: new Map()
      // MISSING: requestId and pendingRequests properties!
    };

    // Create a mock CLI terminal object with the problematic aiur connection
    const mockCliTerminal = {
      aiur: aiurConnectionFromAppJs,
      output: jest.fn()
    };

    // Bind the sendToolRequest method to our mock CLI terminal
    const boundSendToolRequest = mockSendToolRequest.bind(mockCliTerminal);

    try {
      await boundSendToolRequest('module_list', {});
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // This should reproduce the exact error the user is seeing
      expect(error.message).toMatch(/Cannot read properties of undefined.*reading.*set/);
      console.log('✓ REPRODUCED ERROR:', error.message);
    }
  });

  test('shows that the error is caused by missing properties in aiur connection', () => {
    const aiurConnectionFromAppJs = {
      isConnected: () => true,
      sendMessage: jest.fn(() => true),
      sendToolRequest: jest.fn(),
      toolDefinitions: new Map()
    };

    // These properties are missing and cause the error
    expect(aiurConnectionFromAppJs.requestId).toBeUndefined();
    expect(aiurConnectionFromAppJs.pendingRequests).toBeUndefined();
    
    console.log('✓ Confirmed: requestId and pendingRequests are missing from aiur connection object');
  });

  test('shows the fix: aiur connection needs requestId and pendingRequests', async () => {
    // Fixed aiur connection object with the missing properties
    const fixedAiurConnection = {
      isConnected: () => true,
      sendMessage: jest.fn(() => true),
      sendToolRequest: jest.fn(),
      toolDefinitions: new Map(),
      requestId: 0,           // ✓ Added missing property
      pendingRequests: new Map()  // ✓ Added missing property
    };

    const mockCliTerminal = {
      aiur: fixedAiurConnection,
      output: jest.fn()
    };

    const boundSendToolRequest = mockSendToolRequest.bind(mockCliTerminal);

    // This should now work without the error
    fixedAiurConnection.sendMessage.mockReturnValue(true);

    // Simulate successful response by immediately resolving
    setTimeout(() => {
      // Simulate a response being handled
      const pendingRequest = Array.from(fixedAiurConnection.pendingRequests.values())[0];
      if (pendingRequest) {
        pendingRequest.resolve({ success: true, result: 'test' });
      }
    }, 10);

    const result = await boundSendToolRequest('module_list', {});
    expect(result).toEqual({ success: true, result: 'test' });
    console.log('✓ Fixed version works correctly');
  });
});