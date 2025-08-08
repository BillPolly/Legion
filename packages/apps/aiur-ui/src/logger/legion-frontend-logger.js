/**
 * Legion Frontend Logger - Main entry point for frontend log capture
 * 
 * This script is designed to be injected into webapps to automatically
 * capture console logs, errors, and performance data, then transmit them
 * to the backend via WebSocket using the Actor protocol.
 * 
 * Usage:
 * <script src="/legion-log-capture.js"></script>
 * <script>
 *   LegionLogger.init({ 
 *     wsUrl: 'ws://localhost:8080/ws',
 *     sessionId: 'user-session-123'
 *   });
 * </script>
 */

// Import dependencies (these will be bundled)
import { LogCaptureActor } from './LogCaptureActor.js';
import { Actor } from '../../../../shared/actors/src/Actor.js';
import { ActorSpace } from '../../../../shared/actors/src/ActorSpace.js';

// Create a minimal ActorSpace for just the LogCapture actor
class LogCaptureActorSpace extends ActorSpace {
  constructor(config = {}) {
    super('frontend-logger', config);
    this.config = config;
    this.ws = null;
    this.logCaptureActor = null;
    this.serverLogCaptureGuid = null;
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
  }
  
  /**
   * Initialize and connect to the backend
   */
  async connect(wsUrl, sessionId = null) {
    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      return;
    }
    
    try {
      this.connectionState = 'connecting';
      console.log('LegionLogger: Connecting to', wsUrl);
      
      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      
      // Wait for connection to open
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000); // 10 second timeout
        
        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('LegionLogger: WebSocket connected');
          resolve();
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('LegionLogger: WebSocket connection error:', error);
          reject(error);
        };
      });
      
      // Create and register LogCaptureActor
      this.logCaptureActor = new LogCaptureActor(this.config);
      const actorGuid = this.spaceId + '-logCapture';
      this.register(this.logCaptureActor, actorGuid);
      
      // Setup handshake for just the log capture actor
      return new Promise((resolve, reject) => {
        const handleHandshake = (event) => {
          try {
            const msg = JSON.parse(event.data);
            
            if (msg.type === 'actor_handshake') {
              console.log('LegionLogger: Received handshake from server');
              
              // Store server's logCapture actor GUID
              this.serverLogCaptureGuid = msg.serverActors?.logCapture;
              
              if (!this.serverLogCaptureGuid) {
                reject(new Error('Server does not have logCapture actor'));
                return;
              }
              
              // Send handshake acknowledgment with our actor GUID
              ws.send(JSON.stringify({
                type: 'actor_handshake_ack',
                clientActors: {
                  logCapture: actorGuid
                }
              }));
              
              console.log('LegionLogger: Sent handshake ACK');
              
              // Create Channel - it will take over ws.onmessage
              const channel = this.addChannel(ws);
              
              // Wire our actor to the remote actor
              const remoteLogCaptureActor = channel.makeRemote(this.serverLogCaptureGuid);
              this.logCaptureActor.setRemoteActor(remoteLogCaptureActor);
              
              // Initialize the log capture actor
              this.logCaptureActor.initialize().then(() => {
                this.connectionState = 'connected';
                console.log('LegionLogger: Successfully connected and initialized');
                resolve(this);
              }).catch(reject);
              
            } else {
              console.log('LegionLogger: Waiting for handshake, got:', msg.type);
              ws.onmessage = handleHandshake; // Continue waiting
            }
          } catch (error) {
            console.error('LegionLogger: Handshake error:', error);
            reject(error);
          }
        };
        
        ws.onmessage = handleHandshake;
        
        // Set up error and close handlers
        ws.onerror = (error) => {
          this.connectionState = 'error';
          console.error('LegionLogger: WebSocket error:', error);
          reject(error);
        };
        
        ws.onclose = () => {
          this.connectionState = 'disconnected';
          console.log('LegionLogger: WebSocket connection closed');
          this.handleDisconnection();
        };
        
        // Connection timeout
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            reject(new Error('Handshake timeout'));
          }
        }, 15000); // 15 seconds for full handshake
      });
      
    } catch (error) {
      this.connectionState = 'error';
      console.error('LegionLogger: Connection failed:', error);
      throw error;
    }
  }
  
  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection() {
    if (this.logCaptureActor) {
      this.logCaptureActor.setRemoteActor(null);
    }
    
    // Attempt reconnection after a delay
    setTimeout(() => {
      if (this.connectionState === 'disconnected' && this.config.autoReconnect !== false) {
        console.log('LegionLogger: Attempting to reconnect...');
        this.connect(this.config.wsUrl, this.config.sessionId).catch(console.error);
      }
    }, 5000); // 5 second delay
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      connectionState: this.connectionState,
      connected: this.connectionState === 'connected',
      actorInitialized: !!this.logCaptureActor,
      serverGuid: this.serverLogCaptureGuid,
      config: this.config
    };
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect() {
    console.log('LegionLogger: Disconnecting...');
    
    if (this.logCaptureActor) {
      this.logCaptureActor.destroy();
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connectionState = 'disconnected';
  }
}

/**
 * Global LegionLogger API
 */
window.LegionLogger = {
  // Current instance
  instance: null,
  
  /**
   * Initialize the logger
   */
  async init(config = {}) {
    if (this.instance) {
      console.warn('LegionLogger: Already initialized');
      return this.instance;
    }
    
    try {
      // Default configuration
      const defaultConfig = {
        wsUrl: 'ws://localhost:8080/ws',
        sessionId: null,
        autoReconnect: true,
        batchSize: 25,
        batchInterval: 5000, // 5 seconds
        maxBufferSize: 500,
        enableConsoleCapture: true,
        enableErrorCapture: true,
        enablePerformanceCapture: true,
        ...config
      };
      
      // Get session ID from window config or generate one
      if (!defaultConfig.sessionId) {
        defaultConfig.sessionId = window.LEGION_CONFIG?.sessionId || 
          ('sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now());
      }
      
      // Override wsUrl from window config if available
      if (window.LEGION_CONFIG?.wsUrl) {
        defaultConfig.wsUrl = window.LEGION_CONFIG.wsUrl;
      }
      
      console.log('LegionLogger: Initializing with config:', defaultConfig);
      
      // Create and connect the logger
      this.instance = new LogCaptureActorSpace(defaultConfig);
      await this.instance.connect(defaultConfig.wsUrl, defaultConfig.sessionId);
      
      console.log('LegionLogger: Successfully initialized and connected');
      return this.instance;
      
    } catch (error) {
      console.error('LegionLogger: Initialization failed:', error);
      
      // Store failed instance for debugging
      this.instance = { error, config };
      throw error;
    }
  },
  
  /**
   * Get current status
   */
  getStatus() {
    if (!this.instance || this.instance.error) {
      return { 
        initialized: false, 
        error: this.instance?.error?.message || 'Not initialized' 
      };
    }
    
    return {
      initialized: true,
      ...this.instance.getStatus()
    };
  },
  
  /**
   * Manually flush logs
   */
  async flush() {
    if (this.instance && this.instance.logCaptureActor) {
      return await this.instance.logCaptureActor.flushLogs();
    }
  },
  
  /**
   * Update configuration
   */
  async updateConfig(newConfig) {
    if (this.instance && this.instance.logCaptureActor) {
      return await this.instance.logCaptureActor.handleConfigUpdate(newConfig);
    }
  },
  
  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.instance && this.instance.disconnect) {
      this.instance.disconnect();
    }
    this.instance = null;
  },
  
  /**
   * Version information
   */
  version: '1.0.0'
};

/**
 * Auto-initialize if window.LEGION_CONFIG is present
 */
if (window.LEGION_CONFIG && window.LEGION_CONFIG.autoInit !== false) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.LegionLogger.init(window.LEGION_CONFIG).catch(console.error);
    });
  } else {
    // DOM is already ready
    window.LegionLogger.init(window.LEGION_CONFIG).catch(console.error);
  }
}

// Also export for module usage
export default window.LegionLogger;