/**
 * Mock WebSocket that properly implements the actor handshake protocol
 */

export class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    this.originalOnMessage = null; // Store original before Channel takes over
    
    // Message tracking
    this.sentMessages = [];
    this.receivedMessages = [];
    
    // Handshake state
    this.handshakeComplete = false;
    this.clientActorGuids = null;
    this.serverActorGuids = null;
    
    // Simulate connection opening after a brief delay
    setTimeout(() => this._simulateOpen(), 10);
  }
  
  _simulateOpen() {
    this.readyState = this.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }
  
  send(data) {
    if (this.readyState !== this.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    this.sentMessages.push(data);
    
    // Parse the message to handle actor handshake
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'actor_handshake') {
        // Store client actor GUIDs for response routing
        this.clientActorGuids = message.clientActors;
        // Simulate server responding to handshake
        setTimeout(() => {
          this._simulateServerHandshakeResponse(message);
        }, 50);
      } else if (message.targetGuid) {
        // This is an actor message - simulate a response
        // Add sourceGuid from the stored client actors
        const enrichedMessage = {
          ...message,
          sourceGuid: this._findSourceGuid(message.targetGuid)
        };
        setTimeout(() => {
          this._simulateActorResponse(enrichedMessage);
        }, 20);
      }
    } catch (error) {
      console.error('Error parsing sent message:', error);
    }
  }
  
  _findSourceGuid(targetGuid) {
    // Map server GUID back to client GUID
    if (!this.clientActorGuids) return 'client';
    
    if (targetGuid.includes('tools')) {
      return this.clientActorGuids.tools;
    } else if (targetGuid.includes('database')) {
      return this.clientActorGuids.database;
    } else if (targetGuid.includes('search')) {
      return this.clientActorGuids.search;
    }
    return 'client';
  }
  
  _simulateServerHandshakeResponse(clientHandshake) {
    this.serverActorGuids = {
      tools: 'server-tools-' + Date.now(),
      database: 'server-database-' + Date.now(),
      search: 'server-search-' + Date.now()
    };
    
    const serverResponse = {
      type: 'actor_handshake_ack',
      serverActors: this.serverActorGuids
    };
    
    // Store the original onmessage handler before Channel takes over
    this.originalOnMessage = this.onmessage;
    
    this._receiveMessage(serverResponse);
    
    // Mark handshake as complete after a delay (Channel will be set up)
    setTimeout(() => {
      this.handshakeComplete = true;
    }, 100);
  }
  
  _simulateActorResponse(message) {
    const { targetGuid, payload } = message;
    
    // The targetGuid is the server actor, we need to find the client actor that sent this
    // In the Channel implementation, messages have sourceGuid and targetGuid
    const clientGuid = message.sourceGuid || this._findClientGuid(targetGuid);
    
    // Simulate different responses based on the message type
    let response = null;
    
    if (payload.type === 'tools:load') {
      response = {
        targetGuid: clientGuid,
        payload: {
          type: 'tools:list',
          data: {
            tools: [
              { name: 'file_write', module: 'file', description: 'Write to file' },
              { name: 'calculator', module: 'calculator', description: 'Calculate math' }
            ]
          }
        }
      };
    } else if (payload.type === 'modules:load') {
      response = {
        targetGuid: clientGuid,
        payload: {
          type: 'modules:list',
          data: {
            modules: [
              { name: 'file', tools: ['file_write', 'file_read'] },
              { name: 'calculator', tools: ['calculator'] }
            ]
          }
        }
      };
    } else if (payload.type === 'tool:execute') {
      response = {
        targetGuid: clientGuid,
        payload: {
          type: 'tool:execute:result',
          data: {
            toolName: payload.data.toolName,
            result: { success: true, output: 'Tool executed successfully' }
          }
        }
      };
    }
    
    if (response) {
      this._receiveMessage(response);
    }
  }
  
  _findClientGuid(serverGuid) {
    // Extract the client actor type from server GUID and map to client GUID
    // This is a simplified mapping - in reality the Channel tracks this
    if (serverGuid.includes('tools')) {
      return this.clientActorGuids?.tools || 'client-tools';
    } else if (serverGuid.includes('database')) {
      return this.clientActorGuids?.database || 'client-database';
    } else if (serverGuid.includes('search')) {
      return this.clientActorGuids?.search || 'client-search';
    }
    return 'client';
  }
  
  _receiveMessage(message) {
    this.receivedMessages.push(message);
    
    if (this.onmessage) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(message)
      });
      this.onmessage(event);
    }
  }
  
  close(code = 1000, reason = '') {
    if (this.readyState === this.CLOSED) {
      return;
    }
    
    this.readyState = this.CLOSING;
    
    setTimeout(() => {
      this.readyState = this.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code, reason }));
      }
    }, 10);
  }
  
  // Helper methods for testing
  simulateError(error) {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
  
  simulateMessage(data) {
    this._receiveMessage(data);
  }
  
  getLastSentMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }
  
  getSentMessages() {
    return this.sentMessages.map(msg => {
      try {
        return JSON.parse(msg);
      } catch {
        return msg;
      }
    });
  }
}

// Helper to replace global WebSocket with mock
export function setupMockWebSocket() {
  if (typeof global !== 'undefined') {
    global.WebSocket = MockWebSocket;
  } else if (typeof window !== 'undefined') {
    window.WebSocket = MockWebSocket;
  }
}

// Helper to restore original WebSocket
export function restoreWebSocket() {
  // In Jest environment, we can't easily restore the original
  // but tests should be isolated anyway
}