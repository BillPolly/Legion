/**
 * PortManager - Dynamic port assignment and management
 * Prevents port conflicts between tests and sessions
 */

import net from 'net';

export class PortManager {
  constructor() {
    // Port ranges for different services
    this.ranges = {
      app: { min: 3000, max: 3999 },        // Application servers
      websocket: { min: 9000, max: 9999 },  // WebSocket servers (Sidewinder)
      browser: { min: 4000, max: 4999 }     // Browser dev servers
    };
    
    // Track reserved ports to prevent conflicts
    this.reservedPorts = new Set();
    
    // Track ports by session for cleanup
    this.sessionPorts = new Map(); // sessionId -> Set<port>
  }

  /**
   * Find an available port in the specified range
   */
  async findAvailablePort(type = 'app') {
    const range = this.ranges[type];
    if (!range) {
      throw new Error(`Unknown port type: ${type}. Available: ${Object.keys(this.ranges).join(', ')}`);
    }

    // Try ports in random order to reduce conflicts
    const ports = this.shuffleArray(
      Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i)
    );

    for (const port of ports) {
      if (!this.reservedPorts.has(port) && await this.isPortAvailable(port)) {
        return port;
      }
    }

    throw new Error(`No available ports in ${type} range (${range.min}-${range.max})`);
  }

  /**
   * Reserve a port for a session
   */
  async reservePort(sessionId, type = 'app') {
    const port = await this.findAvailablePort(type);
    this.reservedPorts.add(port);
    
    if (!this.sessionPorts.has(sessionId)) {
      this.sessionPorts.set(sessionId, new Set());
    }
    this.sessionPorts.get(sessionId).add(port);
    
    console.log(`[PortManager] Reserved ${type} port ${port} for session: ${sessionId}`);
    return port;
  }

  /**
   * Release a specific port
   */
  releasePort(port, sessionId = null) {
    this.reservedPorts.delete(port);
    
    if (sessionId && this.sessionPorts.has(sessionId)) {
      this.sessionPorts.get(sessionId).delete(port);
    }
    
    console.log(`[PortManager] Released port ${port}`);
  }

  /**
   * Release all ports for a session
   */
  releaseSessionPorts(sessionId) {
    if (this.sessionPorts.has(sessionId)) {
      const ports = this.sessionPorts.get(sessionId);
      for (const port of ports) {
        this.reservedPorts.delete(port);
        console.log(`[PortManager] Released port ${port} for session: ${sessionId}`);
      }
      this.sessionPorts.delete(sessionId);
    }
  }

  /**
   * Get all ports for a session
   */
  getSessionPorts(sessionId) {
    return this.sessionPorts.get(sessionId) || new Set();
  }

  /**
   * Check if a specific port is available
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Wait for a port to become active (server listening)
   */
  async waitForPort(port, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.isPortListening(port)) {
        return true;
      }
      await this.sleep(200);
    }
    
    return false;
  }

  /**
   * Check if a port is listening (has a server)
   */
  async isPortListening(port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    });
  }

  /**
   * Get status of all managed ports
   */
  getPortStatus() {
    const status = {
      totalReserved: this.reservedPorts.size,
      reservedPorts: Array.from(this.reservedPorts).sort(),
      sessionCount: this.sessionPorts.size,
      sessions: {}
    };

    for (const [sessionId, ports] of this.sessionPorts.entries()) {
      status.sessions[sessionId] = Array.from(ports).sort();
    }

    return status;
  }

  /**
   * Clean up all reserved ports (for testing)
   */
  cleanup() {
    console.log(`[PortManager] Cleaning up ${this.reservedPorts.size} reserved ports`);
    this.reservedPorts.clear();
    this.sessionPorts.clear();
  }

  /**
   * Utility: Shuffle array for random port selection
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Utility: Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const portManager = new PortManager();