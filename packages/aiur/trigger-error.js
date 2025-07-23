#!/usr/bin/env node

/**
 * Simple script to trigger an error in the Aiur server
 * Run this while the Aiur server is running to test error broadcasting
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001/ws';

async function triggerError() {
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    console.log('Connected to Aiur debug server');
    
    // Try to execute a non-existent tool
    const errorRequest = {
      type: 'execute-tool',
      id: 'test-error-' + Date.now(),
      data: {
        name: 'this_tool_does_not_exist',
        arguments: { test: true }
      }
    };
    
    console.log('Sending request for non-existent tool...');
    ws.send(JSON.stringify(errorRequest));
    
    // Try another error - invalid arguments
    setTimeout(() => {
      const invalidArgsRequest = {
        type: 'execute-tool',
        id: 'test-error-2-' + Date.now(),
        data: {
          name: 'context_add',
          arguments: {} // Missing required fields
        }
      };
      
      console.log('Sending request with invalid arguments...');
      ws.send(JSON.stringify(invalidArgsRequest));
    }, 1000);
    
    // Try a parameter resolution error
    setTimeout(() => {
      const resolutionErrorRequest = {
        type: 'execute-tool',
        id: 'test-error-3-' + Date.now(),
        data: {
          name: 'context_get',
          arguments: { name: '@undefined_context' }
        }
      };
      
      console.log('Sending request with undefined context reference...');
      ws.send(JSON.stringify(resolutionErrorRequest));
    }, 2000);
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', message.type);
    
    if (message.type === 'tool-result') {
      console.log('Result:', JSON.stringify(message.data, null, 2));
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  // Keep running for a bit
  setTimeout(() => {
    console.log('\nCheck the debug interface at http://localhost:3001 to see the errors');
    ws.close();
    process.exit(0);
  }, 5000);
}

triggerError().catch(console.error);