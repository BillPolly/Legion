/**
 * MockActorSystem - Simulates actor communication without WebSocket
 */

export class MockActor {
  constructor(name) {
    this.name = name;
    this.messages = [];
    this.remoteActor = null;
    this.receiveHandler = null;
  }
  
  setRemoteActor(actor) {
    this.remoteActor = actor;
  }
  
  send(message) {
    this.messages.push({ type: 'sent', message });
    
    // Simulate async message delivery
    if (this.remoteActor && this.remoteActor.receiveHandler) {
      setTimeout(() => {
        this.remoteActor.receiveHandler(message);
      }, 0);
    }
  }
  
  receive(handler) {
    this.receiveHandler = handler;
  }
  
  // Test utilities
  getSentMessages() {
    return this.messages.filter(m => m.type === 'sent').map(m => m.message);
  }
  
  simulateReceive(message) {
    if (this.receiveHandler) {
      this.receiveHandler(message);
    }
  }
  
  reset() {
    this.messages = [];
  }
}

export class MockActorSystem {
  constructor() {
    this.actors = new Map();
    this.connections = new Map();
  }
  
  createActor(name, ActorClass) {
    const actor = new ActorClass();
    actor.name = name;
    this.actors.set(name, actor);
    return actor;
  }
  
  connect(actor1Name, actor2Name) {
    const actor1 = this.actors.get(actor1Name);
    const actor2 = this.actors.get(actor2Name);
    
    if (actor1 && actor2) {
      // Create mock remote actors
      const mockRemote1 = new MockRemoteActor(actor2);
      const mockRemote2 = new MockRemoteActor(actor1);
      
      actor1.setRemoteActor(mockRemote1);
      actor2.setRemoteActor(mockRemote2);
      
      this.connections.set(`${actor1Name}-${actor2Name}`, true);
      
      return true;
    }
    
    return false;
  }
  
  getActor(name) {
    return this.actors.get(name);
  }
  
  reset() {
    this.actors.clear();
    this.connections.clear();
  }
}

class MockRemoteActor {
  constructor(targetActor) {
    this.targetActor = targetActor;
  }
  
  send(message) {
    // Simulate async message delivery
    setTimeout(() => {
      this.targetActor.receive(message);
    }, 0);
  }
}

// Mock WebSocket connection for actor testing
export class MockWebSocketConnection {
  constructor() {
    this.ws = null;
    this.messages = [];
    this.isConnected = false;
    this.callbacks = {
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };
  }
  
  connect(url) {
    return new Promise((resolve) => {
      this.ws = new global.WebSocket(url);
      this.isConnected = false;
      
      this.ws.onopen = (event) => {
        this.isConnected = true;
        if (this.callbacks.onopen) this.callbacks.onopen(event);
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.messages.push(event.data);
        if (this.callbacks.onmessage) this.callbacks.onmessage(event);
      };
      
      this.ws.onerror = (event) => {
        if (this.callbacks.onerror) this.callbacks.onerror(event);
      };
      
      this.ws.onclose = (event) => {
        this.isConnected = false;
        if (this.callbacks.onclose) this.callbacks.onclose(event);
      };
    });
  }
  
  send(data) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(data);
    
    // Echo the message back for testing (simulating server response)
    if (this.callbacks.onmessage) {
      setTimeout(() => {
        const response = this.generateMockResponse(data);
        this.ws.simulateMessage(response);
      }, 10);
    }
  }
  
  generateMockResponse(data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Generate appropriate mock responses based on message type
      switch (message.type) {
        case 'plan-informal':
          return JSON.stringify({
            type: 'planning-progress',
            data: { message: 'Planning in progress...' }
          });
          
        case 'discover-tools':
          return JSON.stringify({
            type: 'tool-discovery-complete',
            data: { 
              tools: [
                { name: 'tool1', description: 'Test tool 1' },
                { name: 'tool2', description: 'Test tool 2' }
              ]
            }
          });
          
        default:
          return JSON.stringify({
            type: 'ack',
            data: { received: message.type }
          });
      }
    } catch (e) {
      return JSON.stringify({ type: 'error', error: 'Invalid message' });
    }
  }
  
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
  
  on(event, callback) {
    this.callbacks[`on${event}`] = callback;
  }
  
  getSentMessages() {
    return this.ws ? this.ws.messages : [];
  }
  
  getReceivedMessages() {
    return this.messages;
  }
}