/**
 * QdrantAutoStarter - Automatic Qdrant Docker container management
 * 
 * Handles automatic startup of Qdrant when connection fails.
 * Uses Docker/Colima to manage the Qdrant container lifecycle.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const QDRANT_CONTAINER_NAME = 'legion-qdrant';
const QDRANT_PORT = 6333;
const QDRANT_IMAGE = 'qdrant/qdrant:latest';

export class QdrantAutoStarter {
  constructor(config = {}) {
    this.config = {
      containerName: config.containerName || QDRANT_CONTAINER_NAME,
      port: config.port || QDRANT_PORT,
      image: config.image || QDRANT_IMAGE,
      autoStart: config.autoStart !== false, // Default true
      maxRetries: config.maxRetries || 30,
      retryDelay: config.retryDelay || 1000,
      verbose: config.verbose || false
    };
  }

  /**
   * Check if Docker is running
   */
  async isDockerRunning() {
    try {
      await execAsync('docker info');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start Docker (Colima on macOS or Docker Desktop)
   */
  async startDocker() {
    if (this.config.verbose) {
      console.log('🐳 Starting Docker runtime...');
    }
    
    // First check if Docker is already running
    if (await this.isDockerRunning()) {
      if (this.config.verbose) {
        console.log('   ✅ Docker is already running');
      }
      return true;
    }
    
    // Try different Docker runtime options
    const dockerOptions = [
      {
        name: 'Colima',
        check: 'which colima',
        status: 'colima status',
        start: 'colima start',
        wait: 15000
      },
      {
        name: 'Docker Desktop',
        check: process.platform === 'darwin' ? 'ls /Applications/Docker.app' : null,
        start: process.platform === 'darwin' ? 'open -a Docker' : null,
        wait: 30000
      },
      {
        name: 'Docker Machine',
        check: 'which docker-machine',
        status: 'docker-machine status default',
        start: 'docker-machine start default && eval $(docker-machine env default)',
        wait: 20000
      },
      {
        name: 'Podman',
        check: 'which podman',
        status: 'podman machine list',
        start: 'podman machine start',
        wait: 15000
      }
    ];
    
    for (const option of dockerOptions) {
      if (!option.check) continue;
      
      try {
        // Check if this Docker option is available
        await execAsync(option.check);
        console.log(`   Found ${option.name}, attempting to start...`);
        
        // Check status if command available
        if (option.status) {
          try {
            await execAsync(option.status);
            // If status succeeds, the runtime might just need Docker daemon
            if (await this.isDockerRunning()) {
              console.log(`   ✅ ${option.name} is running`);
              return true;
            }
          } catch {
            // Not running, try to start
          }
        }
        
        // Try to start
        if (option.start) {
          console.log(`   Starting ${option.name}...`);
          try {
            if (option.name === 'Docker Desktop' && process.platform === 'darwin') {
              // Special handling for Docker Desktop on macOS
              await execAsync(option.start);
              console.log(`   Waiting for Docker Desktop to start (up to ${option.wait/1000}s)...`);
              
              // Wait for Docker to be ready
              const startTime = Date.now();
              while (Date.now() - startTime < option.wait) {
                if (await this.isDockerRunning()) {
                  console.log(`   ✅ ${option.name} started successfully`);
                  return true;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            } else {
              // Regular start command
              await execAsync(option.start);
              
              // Wait for Docker to be ready
              console.log(`   Waiting for ${option.name} to be ready...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              if (await this.isDockerRunning()) {
                console.log(`   ✅ ${option.name} started successfully`);
                return true;
              }
            }
          } catch (error) {
            console.log(`   ⚠️ Failed to start ${option.name}: ${error.message}`);
          }
        }
      } catch {
        // This option is not available, try next
        continue;
      }
    }
    
    // If we get here, we couldn't start Docker
    throw new Error(
      'Could not start Docker automatically. Please start Docker manually:\n' +
      '  - macOS: Install Docker Desktop or Colima\n' +
      '  - Linux: Ensure Docker daemon is installed and can be started with systemctl\n' +
      '  - Windows: Install Docker Desktop\n' +
      'Then run this command again.'
    );
  }

  /**
   * Check if container is running
   */
  async isContainerRunning() {
    try {
      const { stdout } = await execAsync(`docker ps --filter name=${this.config.containerName} --format "{{.Names}}"`);
      return stdout.trim() === this.config.containerName;
    } catch {
      return false;
    }
  }

  /**
   * Check if container exists
   */
  async containerExists() {
    try {
      const { stdout } = await execAsync(`docker ps -a --filter name=${this.config.containerName} --format "{{.Names}}"`);
      return stdout.trim() === this.config.containerName;
    } catch {
      return false;
    }
  }

  /**
   * Start existing container
   */
  async startExistingContainer() {
    try {
      await execAsync(`docker start ${this.config.containerName}`);
      if (this.config.verbose) {
        console.log(`   ✅ Started existing container: ${this.config.containerName}`);
      }
      return true;
    } catch (error) {
      if (this.config.verbose) {
        console.log(`   ⚠️ Failed to start existing container: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Create and start new Qdrant container
   */
  async createAndStartContainer() {
    if (this.config.verbose) {
      console.log('🚀 Creating new Qdrant container...');
    }
    
    // Remove existing container if it exists
    if (await this.containerExists()) {
      try {
        await execAsync(`docker stop ${this.config.containerName}`);
      } catch {
        // Container might not be running
      }
      await execAsync(`docker rm ${this.config.containerName}`);
    }
    
    // Pull image if needed
    if (this.config.verbose) {
      console.log(`   📦 Ensuring Qdrant image: ${this.config.image}`);
    }
    
    try {
      await execAsync(`docker pull ${this.config.image}`);
    } catch (error) {
      if (this.config.verbose) {
        console.log('   ⚠️ Could not pull latest image, using cached version');
      }
    }
    
    // Create and start container
    const dockerArgs = [
      'run',
      '-d',
      '--name', this.config.containerName,
      '-p', `${this.config.port}:6333`,
      '-v', `${process.env.HOME}/.legion/qdrant:/qdrant/storage`,
      '--restart', 'unless-stopped',
      this.config.image
    ];
    
    const { stdout } = await execAsync(`docker ${dockerArgs.join(' ')}`);
    const containerId = stdout.trim().substring(0, 12);
    
    if (this.config.verbose) {
      console.log(`   ✅ Qdrant container created: ${containerId}`);
    }
    
    return containerId;
  }

  /**
   * Wait for Qdrant to be ready
   */
  async waitForQdrant() {
    if (this.config.verbose) {
      console.log('⏳ Waiting for Qdrant to be ready...');
    }
    
    for (let i = 0; i < this.config.maxRetries; i++) {
      try {
        const response = await fetch(`http://localhost:${this.config.port}/`);
        if (response.ok) {
          if (this.config.verbose) {
            console.log('   ✅ Qdrant is ready!');
          }
          return true;
        }
      } catch {
        // Connection failed, wait and retry
      }
      
      if (this.config.verbose && i % 5 === 0 && i > 0) {
        console.log(`   Still waiting... (${i}/${this.config.maxRetries})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    }
    
    throw new Error('Qdrant failed to start within timeout');
  }

  /**
   * Check if Qdrant is accessible
   */
  async isQdrantAccessible() {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ensure Qdrant is running and accessible
   */
  async ensureQdrantRunning() {
    // Check if already accessible
    if (await this.isQdrantAccessible()) {
      if (this.config.verbose) {
        console.log('✅ Qdrant is already accessible');
      }
      return true;
    }
    
    if (!this.config.autoStart) {
      throw new Error(`Qdrant is not accessible at http://localhost:${this.config.port} and auto-start is disabled`);
    }
    
    console.log('🔮 Qdrant not accessible, attempting to start...');
    
    // Ensure Docker is running
    const dockerRunning = await this.isDockerRunning();
    if (!dockerRunning) {
      await this.startDocker();
    }
    
    // Check if container exists and try to start it
    if (await this.containerExists()) {
      if (await this.isContainerRunning()) {
        // Container is running but not accessible, wait a bit
        if (this.config.verbose) {
          console.log('   Container is running, waiting for Qdrant to be ready...');
        }
      } else {
        // Try to start existing container
        if (!await this.startExistingContainer()) {
          // If starting existing container fails, create new one
          await this.createAndStartContainer();
        }
      }
    } else {
      // Create new container
      await this.createAndStartContainer();
    }
    
    // Wait for Qdrant to be ready
    await this.waitForQdrant();
    
    console.log('🎉 Qdrant is now running and accessible!');
    console.log(`   Web UI: http://localhost:${this.config.port}/dashboard`);
    console.log(`   API: http://localhost:${this.config.port}`);
    
    return true;
  }

  /**
   * Stop Qdrant container
   */
  async stopQdrant() {
    try {
      await execAsync(`docker stop ${this.config.containerName}`);
      console.log(`✅ Stopped Qdrant container: ${this.config.containerName}`);
      return true;
    } catch (error) {
      console.log(`⚠️ Could not stop container: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance with default config
export const qdrantAutoStarter = new QdrantAutoStarter();

export default QdrantAutoStarter;