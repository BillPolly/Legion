#!/usr/bin/env node

import { SimpleSessionManager } from './handlers/SimpleSessionManager.js';
import { SimpleToolHandler } from './handlers/SimpleToolHandler.js';

class MCPServer {
  constructor() {
    this.sessionManager = new SimpleSessionManager();
    this.toolHandler = new SimpleToolHandler(this.sessionManager);
  }
  
  async start() {
    process.stdin.setEncoding('utf8');
    process.stdout.setEncoding('utf8');
    
    let buffer = '';
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim()).catch(console.error);
        }
      }
    });
    
    process.stdin.on('end', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
  }
  
  async handleMessage(messageStr) {
    try {
      const message = JSON.parse(messageStr);
      const response = await this.processMessage(message);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (error) {
      const parsed = JSON.parse(messageStr);
      if (parsed.id) {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: parsed.id,
          error: { code: -32603, message: error.message }
        }) + '\n');
      }
    }
  }
  
  async processMessage(message) {
    const { jsonrpc, id, method, params } = message;
    
    if (jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
    }
    
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, logging: {}, prompts: {} },
          serverInfo: { name: 'fullstack-monitor', version: '1.0.0' }
        };
        break;
        
      case 'tools/list':
        result = { tools: this.toolHandler.getAllTools() };
        break;
        
      case 'tools/call':
        result = await this.toolHandler.executeTool(params.name, params.arguments || {});
        break;
        
      case 'notifications/initialized':
        return null;
        
      case 'ping':
        result = { status: 'pong' };
        break;
        
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
    }
    
    return { jsonrpc: '2.0', id, result };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  new MCPServer().start();
}