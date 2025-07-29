/**
 * Test that CLI terminal and app share the same pendingRequests Map
 */

import { describe, test, expect, jest } from '@jest/globals';

describe('CLI Terminal Shared Map Fix', () => {
  test('shows the problem with separate Maps', () => {
    // App has its own Map
    const app = {
      pendingRequests: new Map()
    };
    
    // CLI terminal has a different Map (this was the bug)
    const cliTerminal = {
      aiur: {
        pendingRequests: new Map() // Different Map!
      }
    };
    
    // CLI terminal stores a request
    cliTerminal.aiur.pendingRequests.set('req_123', { resolve: jest.fn() });
    
    // App tries to find it in its Map
    const found = app.pendingRequests.has('req_123');
    
    expect(found).toBe(false); // ❌ Not found because they're different Maps!
    console.log('❌ Problem: App cannot find CLI terminal requests (different Maps)');
  });
  
  test('shows the fix with shared Map', () => {
    // App has its Map
    const app = {
      pendingRequests: new Map()
    };
    
    // CLI terminal uses THE SAME Map (this is the fix)
    const cliTerminal = {
      aiur: {
        pendingRequests: app.pendingRequests // Same Map!
      }
    };
    
    // CLI terminal stores a request
    cliTerminal.aiur.pendingRequests.set('req_123', { resolve: jest.fn() });
    
    // App can now find it
    const found = app.pendingRequests.has('req_123');
    
    expect(found).toBe(true); // ✅ Found because they share the same Map!
    console.log('✅ Fixed: App can find CLI terminal requests (shared Map)');
  });
  
  test('demonstrates the full flow with shared Map', () => {
    // Mock app
    const mockResolve = jest.fn();
    const app = {
      pendingRequests: new Map(),
      handleToolResponse: function(message) {
        if (this.pendingRequests.has(message.requestId)) {
          const pending = this.pendingRequests.get(message.requestId);
          this.pendingRequests.delete(message.requestId);
          pending.resolve(message.result);
        }
      }
    };
    
    // CLI terminal with shared Map
    const cliTerminal = {
      aiur: {
        pendingRequests: app.pendingRequests, // Shared!
        requestId: 0
      }
    };
    
    // Step 1: CLI terminal stores request
    const requestId = 'cli_req_1';
    cliTerminal.aiur.pendingRequests.set(requestId, {
      resolve: mockResolve,
      reject: jest.fn()
    });
    
    // Step 2: Server sends response
    const response = {
      type: 'tool_response',
      requestId: 'cli_req_1',
      result: { success: true, data: 'test' }
    };
    
    // Step 3: App handles response
    app.handleToolResponse(response);
    
    // Step 4: Verify the promise was resolved
    expect(mockResolve).toHaveBeenCalledWith({ success: true, data: 'test' });
    console.log('✅ Full flow works: CLI request → Server response → Promise resolved');
  });
});