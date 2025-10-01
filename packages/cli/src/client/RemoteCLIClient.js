/**
 * RemoteCLIClient - Remote Client Mode for CLI
 *
 * This is Mode 3 (Remote Client) - connects to CLIServer via WebSocket.
 * Uses stdin/readline for input, but commands are executed on remote server.
 *
 * Usage:
 *   const client = new RemoteCLIClient({ serverUrl: 'ws://localhost:4000' });
 *   await client.connect();
 *   await client.start();
 */

import { InputHandler } from '../handlers/InputHandler.js';
import { OutputHandler } from '../handlers/OutputHandler.js';
import WebSocket from 'ws';

export class RemoteCLIClient {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'ws://localhost:4000/ws?route=/cli';
    this.prompt = options.prompt || 'legion (remote)> ';
    this.historySize = options.historySize || 1000;
    this.useColors = options.useColors !== false;

    // State
    this.isConnected = false;
    this.isRunning = false;
    this.sessionId = null;

    // Components
    this.websocket = null;
    this.inputHandler = null;
    this.outputHandler = null;

    // Remote actor reference (from Actor handshake)
    this.remoteActor = null;
    this.clientId = `remote-client-${Date.now()}`;

    // Message callbacks
    this.pendingMessages = new Map(); // messageId -> { resolve, reject, timeout }
    this.messageIdCounter = 0;
  }

  /**
   * Connect to CLI server
   */
  async connect() {
    if (this.isConnected) {
      throw new Error('Already connected');
    }

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.serverUrl);

        this.websocket.on('open', () => {
          this.isConnected = true;
          console.log(`Connected to CLI server: ${this.serverUrl}`);

          // Send Actor handshake
          this.websocket.send(JSON.stringify({
            type: 'actor_handshake',
            clientRootActor: this.clientId,
            route: '/cli'
          }));

          resolve();
        });

        this.websocket.on('message', (data) => {
          this.handleMessage(JSON.parse(data.toString()));
        });

        this.websocket.on('close', () => {
          this.isConnected = false;
          console.log('Disconnected from CLI server');

          if (this.isRunning) {
            this.stop();
          }
        });

        this.websocket.on('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from server
   */
  handleMessage(message) {
    // Handle Actor protocol messages
    if (message.targetGuid && message.payload) {
      const [messageType, data] = message.payload;

      switch (messageType) {
        case 'session-ready':
          this.sessionId = data.sessionId;
          console.log(`Session ready: ${this.sessionId}`);
          break;

        default:
          // Handle message responses
          if (message.sourceGuid) {
            const pendingMsg = this.pendingMessages.get(message.sourceGuid);
            if (pendingMsg) {
              clearTimeout(pendingMsg.timeout);
              pendingMsg.resolve(data);
              this.pendingMessages.delete(message.sourceGuid);
            }
          }
      }
    }
  }

  /**
   * Send command to remote session
   */
  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    // Generate message ID
    const messageId = `msg-${++this.messageIdCounter}`;

    // Send via Actor protocol
    const message = {
      targetGuid: 'server',  // Will be routed to server actor
      payload: ['execute-command', { command }],
      sourceGuid: messageId
    };

    this.websocket.send(JSON.stringify(message));

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Command timeout'));
      }, 30000); // 30 second timeout

      this.pendingMessages.set(messageId, { resolve, reject, timeout });
    });
  }

  /**
   * Start interactive prompt
   */
  async start() {
    if (!this.isConnected) {
      throw new Error('Must connect() before start()');
    }

    if (this.isRunning) {
      throw new Error('Already running');
    }

    // Create OutputHandler
    this.outputHandler = new OutputHandler({
      useColors: this.useColors,
      showStackTrace: true
    });

    // Create InputHandler
    this.inputHandler = new InputHandler({
      prompt: this.prompt,
      historySize: this.historySize
    });

    this.isRunning = true;

    // Display welcome message
    this.outputHandler.blank();
    this.outputHandler.heading('Legion CLI (Remote Mode)');
    this.outputHandler.info(`Connected to: ${this.serverUrl}`);
    this.outputHandler.info(`Session: ${this.sessionId || 'pending'}`);
    this.outputHandler.info('Type commands or /help for assistance. Press Ctrl+C to exit.');
    this.outputHandler.blank();

    // Start interactive prompt
    this.inputHandler.start(async (input) => {
      await this.processInput(input);
    });
  }

  /**
   * Process user input
   */
  async processInput(input) {
    try {
      // Send command to remote server
      const result = await this.sendCommand(input);

      if (result.success) {
        // Display result
        if (result.result) {
          this.outputHandler.commandResult(result.result);
        } else if (result.message) {
          this.outputHandler.success(result.message);
        }
      } else {
        // Display error
        this.outputHandler.error(result.error || 'Command failed');
      }
    } catch (error) {
      this.outputHandler.formatError(error);
    }

    this.outputHandler.blank();
  }

  /**
   * Stop the client
   */
  stop() {
    this.isRunning = false;

    if (this.inputHandler) {
      this.inputHandler.stop();
      this.inputHandler.close();
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
  }

  /**
   * Shutdown - stop and disconnect
   */
  async shutdown() {
    this.stop();
    this.disconnect();
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      mode: 'remote-client',
      connected: this.isConnected,
      running: this.isRunning,
      serverUrl: this.serverUrl,
      sessionId: this.sessionId
    };
  }
}

export default RemoteCLIClient;
