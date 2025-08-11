#!/usr/bin/env node

const server = {
  start() {
    process.stdin.on('data', (data) => {
      const lines = data.toString().split('\n');
      
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
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        } catch (err) {
          // Ignore invalid JSON
        }
      }
    });
  }
};

server.start();
