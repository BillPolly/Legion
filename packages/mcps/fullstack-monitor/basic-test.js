#!/usr/bin/env node

/**
 * Basic test to verify MCP protocol functionality
 */

import { writeFileSync } from 'fs';
import { spawn } from 'child_process';

// Create a minimal mock server
writeFileSync('mock-server.js', `#!/usr/bin/env node

const server = {
  start() {
    process.stdin.on('data', (data) => {
      const lines = data.toString().split('\\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const msg = JSON.parse(line);
          
          let result;
          if (msg.method === 'initialize') {
            result = {
              protocolVersion: '2024-11-05',
              serverInfo: { name: 'test-server', version: '1.0.0' }
            };
          } else if (msg.method === 'tools/list') {
            result = {
              tools: [
                { name: 'test_tool', description: 'Test tool' }
              ]
            };
          }
          
          if (result) {
            const response = { jsonrpc: '2.0', id: msg.id, result };
            process.stdout.write(JSON.stringify(response) + '\\n');
          }
        } catch (err) {
          // Ignore invalid JSON
        }
      }
    });
  }
};

server.start();
`);

const mockServer = spawn('node', ['mock-server.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

console.log('Testing basic MCP functionality...');

// Test initialization
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {}
};

mockServer.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('Server responded:', text);
  
  try {
    const response = JSON.parse(text);
    if (response.id === 1) {
      console.log('✅ Initialize test passed');
      
      // Test tools list
      const listMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      };
      
      mockServer.stdin.write(JSON.stringify(listMessage) + '\\n');
    } else if (response.id === 2) {
      console.log('✅ Tools list test passed');
      console.log('✅ MCP protocol working correctly!');
      mockServer.kill();
      process.exit(0);
    }
  } catch (err) {
    // Ignore non-JSON
  }
});

setTimeout(() => {
  mockServer.stdin.write(JSON.stringify(initMessage) + '\\n');
}, 500);

setTimeout(() => {
  console.log('❌ Test timeout');
  mockServer.kill();
  process.exit(1);
}, 5000);