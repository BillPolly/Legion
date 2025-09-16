const { EventEmitter } = require('events');

const serverRegistry = new Map();

class StubWebSocket extends EventEmitter {
  constructor(url) {
    super();
    const target = new URL(url);
    this.url = url;
    this.readyState = StubWebSocket.OPEN;
    this._closed = false;

    const port = Number(target.port || 80);
    const server = serverRegistry.get(port);
    if (!server) {
      if (process.env.DEBUG_WS_STUB === 'true') {
        console.log('[wsStub] No server found for port', port);
      }
      throw new Error(`No WebSocketServer listening on port ${port}`);
    }

    const serverSocket = new EventEmitter();
    serverSocket.readyState = StubWebSocket.OPEN;
    serverSocket.send = (data) => {
      if (this._closed) {
        return;
      }
      const payload = typeof data === 'string' ? data : data?.toString?.() ?? data;
      this.emit('message', payload);
    };
    serverSocket.close = () => {
      if (this._closed) {
        return;
      }
      this._closed = true;
      serverSocket.emit('close');
      this.emit('close');
      server.removeClient(this);
    };

    this.send = (data) => {
      if (this._closed) {
        return;
      }
      const payload = typeof data === 'string' ? data : data?.toString?.() ?? data;
      serverSocket.emit('message', payload);
    };

    this.close = () => {
      if (this._closed) {
        return;
      }
      this._closed = true;
      serverSocket.emit('close');
      this.emit('close');
      server.removeClient(this);
    };

    setImmediate(() => {
      if (process.env.DEBUG_WS_STUB === 'true') {
        console.log('[wsStub] emitting connection for port', port);
      }
      server.addClient(this, serverSocket);
      this.emit('open');
      server.emit('connection', serverSocket);
    });
  }
}

StubWebSocket.OPEN = 1;

class StubWebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = Number(options.port || 0);
    this.path = options.path || '/';
    this.clients = new Set();

    if (serverRegistry.has(this.port)) {
      throw new Error(`Port ${this.port} is already in use`);
    }

    serverRegistry.set(this.port, this);
    if (process.env.DEBUG_WS_STUB === 'true') {
      console.log('[wsStub] Server registered on port', this.port);
    }
  }

  addClient(clientSocket, serverSocket) {
    this.clients.add(clientSocket);
    serverSocket.on('close', () => {
      this.clients.delete(clientSocket);
    });
  }

  removeClient(clientSocket) {
    this.clients.delete(clientSocket);
  }

  close() {
    serverRegistry.delete(this.port);
    for (const client of [...this.clients]) {
      client.close();
    }
    this.emit('close');
  }
}

StubWebSocketServer.prototype.handleUpgrade = function handleUpgrade() {
  // No-op in stub
};

module.exports = StubWebSocket;
module.exports.WebSocketServer = StubWebSocketServer;
