/**
 * Client actor for Counter Application
 * This file is served to the browser
 */

export default class CounterClientActor {
  constructor() {
    this.serverActor = null;
    this.remoteActor = null;
    this.ws = null;
    this.count = 0;
    this.createUI();
  }

  // Framework interface: called by the generated HTML template
  setRemoteActor(remoteActor) {
    console.log('[CLIENT ACTOR] setRemoteActor called with:', remoteActor);
    this.remoteActor = remoteActor;
    console.log('[CLIENT ACTOR] this.remoteActor now set to:', this.remoteActor);
    console.log('[CLIENT ACTOR] remoteActor type:', typeof remoteActor);
    console.log('[CLIENT ACTOR] remoteActor methods:', remoteActor ? Object.getOwnPropertyNames(remoteActor) : 'null');
    
    // Get initial count
    console.log('[CLIENT ACTOR] Getting initial count...');
    this.getCount();
  }

  // Legacy interface: for manual connection
  async connect(ws, serverActorId) {
    this.ws = ws;
    this.serverActor = serverActorId;
    
    // Listen for messages from server
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'actor_message') {
        this.handleServerMessage(message.message);
      }
    });
    
    // Update UI to show connection status
    this.updateUI();
    
    // Get initial count
    await this.getCount();
  }

  // Actor protocol method: called by ActorSpace
  async receive(messageType, data) {
    console.log('[CLIENT ACTOR] Received:', messageType, data);
    
    if (messageType === 'server_actor_ready') {
      console.log('[CLIENT ACTOR] Server actor ready, creating remote reference...');
      // Get the ActorSpace instance from global window
      const actorSpace = window.__legionActorSpace;
      if (actorSpace && actorSpace._channel) {
        const remoteActor = actorSpace._channel.makeRemote(data.serverActorId);
        console.log('[CLIENT ACTOR] Remote server actor created:', remoteActor);
        this.setRemoteActor(remoteActor);
      } else {
        console.error('[CLIENT ACTOR] ActorSpace or channel not available');
      }
      return;
    }
    
    // Handle other message types - data already contains the full message
    this.handleServerMessage(data);
  }

  // Handle messages from server
  handleServerMessage(message) {
    console.log('[CLIENT ACTOR] handleServerMessage called with:', message);
    console.log('[CLIENT ACTOR] message.type:', message.type);
    console.log('[CLIENT ACTOR] message.count:', message.count);
    
    if (message.type === 'count_updated') {
      console.log('[CLIENT ACTOR] Processing count_updated, setting count to:', message.count);
      this.count = message.count;
      console.log('[CLIENT ACTOR] this.count is now:', this.count);
      console.log('[CLIENT ACTOR] Calling updateUI...');
      this.updateUI();
    } else {
      console.log('[CLIENT ACTOR] Unknown message type:', message.type);
    }
  }

  // Send message to server
  async sendToServer(messageType, data = {}) {
    console.log('[CLIENT ACTOR] sendToServer called:', messageType, data);
    console.log('[CLIENT ACTOR] this.remoteActor:', this.remoteActor);
    
    // Use ActorSpace remoteActor interface
    if (this.remoteActor && typeof this.remoteActor.receive === 'function') {
      console.log('[CLIENT ACTOR] Using remoteActor interface');
      try {
        // Send message through ActorSpace - note: RemoteActor.receive actually sends!
        this.remoteActor.receive(messageType, data);
        console.log('[CLIENT ACTOR] Message sent via remoteActor');
      } catch (error) {
        console.error('[CLIENT ACTOR] Remote actor communication error:', error);
      }
    } else {
      console.warn('[CLIENT ACTOR] Remote actor not available, cannot send message:', messageType);
    }
  }

  // Counter operations
  async increment() {
    await this.sendToServer('increment');
  }

  async decrement() {
    await this.sendToServer('decrement');
  }

  async reset() {
    await this.sendToServer('reset');
  }

  async getCount() {
    await this.sendToServer('get_count');
  }

  // Create the UI
  createUI() {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="container">
          <h1>Legion Counter</h1>
          <div class="counter-display">
            <span id="count">0</span>
          </div>
          <div class="buttons">
            <button id="increment">+</button>
            <button id="decrement">-</button>
            <button id="reset">Reset</button>
          </div>
          <div class="status" id="status">Connecting...</div>
          <div class="info">
            Each browser tab has its own isolated counter.
            Open multiple tabs to see them work independently!
          </div>
        </div>
      `;
      
      // Add event listeners
      document.getElementById('increment').addEventListener('click', () => this.increment());
      document.getElementById('decrement').addEventListener('click', () => this.decrement());
      document.getElementById('reset').addEventListener('click', () => this.reset());
    }
  }

  // Update UI with current count
  updateUI() {
    const countElement = document.getElementById('count');
    if (countElement) {
      countElement.textContent = this.count;
    }
    
    // Enable/disable buttons based on count
    const decrementBtn = document.getElementById('decrement');
    if (decrementBtn) {
      decrementBtn.disabled = this.count <= 0;
    }
    
    // Update connection status
    const statusElement = document.getElementById('status');
    if (statusElement) {
      const isConnected = (this.remoteActor && typeof this.remoteActor.receive === 'function') ||
                         (this.ws && this.ws.readyState === WebSocket.OPEN);
      
      if (isConnected) {
        statusElement.textContent = 'Connected to server';
        statusElement.className = 'status connected';
      } else {
        statusElement.textContent = 'Disconnected from server';
        statusElement.className = 'status disconnected';
      }
    }
  }
}

// Make actor available globally for HTML buttons
window.CounterClientActor = CounterClientActor;