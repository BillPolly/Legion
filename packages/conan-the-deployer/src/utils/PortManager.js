import net from 'net';

/**
 * PortManager - Manages port allocation for local deployments
 */
class PortManager {
  constructor() {
    this.allocatedPorts = new Set();
  }
  
  /**
   * Allocate a port
   */
  async allocatePort(preferredPort = null, options = {}) {
    const { min = 1024, max = 65535 } = options;
    
    // If preferred port is specified and available, use it
    if (preferredPort) {
      if (!this.allocatedPorts.has(preferredPort) && await this.tryPort(preferredPort)) {
        this.allocatedPorts.add(preferredPort);
        return preferredPort;
      }
      
      // If preferred port is taken, find next available
      for (let port = preferredPort + 1; port <= max; port++) {
        if (!this.allocatedPorts.has(port) && await this.tryPort(port)) {
          this.allocatedPorts.add(port);
          return port;
        }
      }
    }
    
    // Find random available port
    if (!preferredPort) {
      const port = await this.findRandomPort();
      if (port >= min && port <= max) {
        this.allocatedPorts.add(port);
        return port;
      }
    }
    
    // Try to find any available port in range
    for (let port = min; port <= max; port++) {
      if (!this.allocatedPorts.has(port) && await this.tryPort(port)) {
        this.allocatedPorts.add(port);
        return port;
      }
    }
    
    throw new Error(`No available ports in range ${min}-${max}`);
  }
  
  /**
   * Release a port
   */
  releasePort(port) {
    this.allocatedPorts.delete(port);
  }
  
  /**
   * Release all allocated ports
   */
  releaseAll() {
    this.allocatedPorts.clear();
  }
  
  /**
   * Check if a port is allocated by this manager
   */
  isAllocated(port) {
    return this.allocatedPorts.has(port);
  }
  
  /**
   * Get all allocated ports
   */
  getAllocatedPorts() {
    return Array.from(this.allocatedPorts).sort((a, b) => a - b);
  }
  
  /**
   * Check if a port is in use
   */
  async isPortInUse(port) {
    return !(await this.tryPort(port));
  }
  
  /**
   * Try to bind to a port
   */
  async tryPort(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });
    });
  }
  
  /**
   * Find a random available port
   */
  async findRandomPort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      
      server.on('error', reject);
    });
  }
}

export default PortManager;