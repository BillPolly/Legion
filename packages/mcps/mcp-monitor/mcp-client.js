import { spawn } from 'child_process';

export class MCPClient {
  constructor() {
    this.process = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async connect(command, args) {
    return new Promise((resolve, reject) => {
      this.process = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
      
      let buffer = '';
      this.process.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            this.handleMessage(line.trim());
          }
        }
      });
      
      this.process.on('error', reject);
      this.process.once('spawn', resolve);
    });
  }

  handleMessage(messageStr) {
    try {
      const message = JSON.parse(messageStr);
      
      // Only process JSON-RPC messages
      if (!message.jsonrpc) {
        return; // Skip non-JSON-RPC messages
      }
      
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
      }
    } catch (error) {
      // Silently ignore non-JSON messages (they're just console output from the monitor)
      // Only log if it looks like it should be JSON
      if (messageStr.startsWith('{') || messageStr.startsWith('[')) {
        console.error('Error parsing potential JSON message:', error.message);
      }
    }
  }

  async sendRequest(method, params = {}) {
    const id = ++this.messageId;
    const message = { jsonrpc: '2.0', id, method, params };
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(message) + '\n');
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  sendNotification(method, params = {}) {
    const message = { jsonrpc: '2.0', method, params };
    this.process.stdin.write(JSON.stringify(message) + '\n');
  }

  async initialize(clientInfo) {
    return this.sendRequest('initialize', { clientInfo });
  }

  async getTools() {
    const result = await this.sendRequest('tools/list');
    return result.tools;
  }

  async callTool(name, args) {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  async disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}