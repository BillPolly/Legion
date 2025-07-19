import BaseProvider from './BaseProvider.js';
import { Readable } from 'stream';

/**
 * DockerProvider - Deploys and manages Docker containers using Docker Engine API
 */
class DockerProvider extends BaseProvider {
  constructor(resourceManager) {
    super();
    this.resourceManager = resourceManager;
    
    // Get Docker client from ResourceManager
    this.docker = this.resourceManager.get('docker-client');
    if (!this.docker) {
      throw new Error('Docker client not available in ResourceManager. Ensure Docker is installed and running.');
    }
    
    this.name = 'docker';
    this.activeDeployments = new Map();
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      name: 'docker',
      displayName: 'Docker',
      description: 'Deploy applications as Docker containers',
      supports: {
        containerization: true,
        scaling: true,
        networking: true,
        volumes: true,
        buildFromSource: true,
        multiInstance: true,
        loadBalancing: false, // Would need additional setup
        ssl: false, // Would need additional setup
        customDomains: false, // Would need additional setup
        envVars: true,
        secrets: true,
        monitoring: true
      },
      requirements: {
        docker: '^20.0.0',
        dockerCompose: false // Optional
      }
    };
  }

  /**
   * Validate deployment configuration
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!config.image && !config.dockerfile) {
      errors.push('Either image or dockerfile is required for Docker deployments');
    }

    if (config.image && config.dockerfile) {
      warnings.push('Both image and dockerfile specified. Will build from dockerfile and ignore image.');
    }

    if (!config.port && !config.ports) {
      warnings.push('No port configuration specified. Container may not be accessible.');
    }

    // Validate port configuration
    if (config.port && (typeof config.port !== 'number' || config.port <= 0 || config.port > 65535)) {
      errors.push('Port must be a number between 1 and 65535');
    }

    // Validate environment variables
    if (config.environment && typeof config.environment !== 'object') {
      errors.push('Environment must be an object');
    }

    // Validate volumes
    if (config.volumes && !Array.isArray(config.volumes)) {
      errors.push('Volumes must be an array of strings');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if Docker image exists locally
   */
  async imageExists(imageName) {
    try {
      const image = this.docker.getImage(imageName);
      await image.inspect();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pull Docker image from registry
   */
  async pullImage(imageName) {
    try {
      const stream = await this.docker.pull(imageName);
      
      return new Promise((resolve, reject) => {
        const result = { success: true, image: imageName };
        
        stream.on('data', (chunk) => {
          try {
            const data = JSON.parse(chunk.toString());
            if (data.error) {
              result.success = false;
              result.error = data.error;
            }
          } catch (parseError) {
            // Ignore parse errors, continue processing
          }
        });
        
        stream.on('end', () => {
          resolve(result);
        });
        
        stream.on('error', (error) => {
          reject({ success: false, error: error.message });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build Docker image from source
   */
  async buildImage(config) {
    const { projectPath, imageName, dockerfile = 'Dockerfile' } = config;
    
    try {
      // Create tar stream from project directory
      const tarStream = await this.createTarStream(projectPath);
      
      const buildOptions = {
        t: imageName,
        dockerfile: dockerfile
      };
      
      const stream = await this.docker.buildImage(tarStream, buildOptions);
      
      return new Promise((resolve, reject) => {
        const result = { success: true, imageName };
        let imageId = null;
        
        stream.on('data', (chunk) => {
          try {
            const data = JSON.parse(chunk.toString());
            
            if (data.error || data.errorDetail) {
              result.success = false;
              result.error = data.error || data.errorDetail.message;
            }
            
            if (data.stream) {
              // Extract image ID from successful build
              const match = data.stream.match(/Successfully built ([a-f0-9]+)/);
              if (match) {
                imageId = match[1];
              }
            }
          } catch (parseError) {
            // Ignore parse errors, continue processing
          }
        });
        
        stream.on('end', () => {
          if (result.success) {
            result.imageId = imageId;
          }
          resolve(result);
        });
        
        stream.on('error', (error) => {
          reject({ success: false, error: error.message });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create tar stream from directory (simplified implementation)
   */
  async createTarStream(projectPath) {
    // In a real implementation, you would use tar-fs or similar library
    // For now, return a simple readable stream
    const stream = new Readable();
    stream.push(null); // End stream immediately
    return stream;
  }

  /**
   * Deploy application as Docker container
   */
  async deploy(config) {
    try {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Generate container name if not provided
      const containerName = config.name || this.generateContainerName();
      let imageName = config.image;

      // Build image if dockerfile is provided
      if (config.dockerfile) {
        const buildResult = await this.buildImage({
          projectPath: config.projectPath,
          imageName: containerName,
          dockerfile: config.dockerfile
        });
        
        if (!buildResult.success) {
          return buildResult;
        }
        
        imageName = containerName;
      } else {
        // Check if image exists locally, pull if not
        const exists = await this.imageExists(imageName);
        if (!exists) {
          const pullResult = await this.pullImage(imageName);
          if (!pullResult.success) {
            return pullResult;
          }
        }
      }

      // Prepare container configuration
      const containerConfig = this.buildContainerConfig(config, containerName, imageName);
      
      // Create container
      const container = await this.docker.createContainer(containerConfig);
      
      // Start container
      await container.start();
      
      // Get container details
      const inspection = await container.inspect();
      
      const deployment = {
        success: true,
        id: container.id,
        name: containerName,
        image: imageName,
        status: inspection.State.Running ? 'running' : 'stopped',
        internalIP: inspection.NetworkSettings.IPAddress,
        ports: inspection.NetworkSettings.Ports,
        environment: config.environment || {},
        volumes: config.volumes || [],
        createdAt: new Date(),
        provider: 'docker'
      };

      // Generate URL if port is exposed
      if (config.port && inspection.NetworkSettings.Ports[`${config.port}/tcp`]) {
        const hostPort = inspection.NetworkSettings.Ports[`${config.port}/tcp`][0]?.HostPort || config.port;
        deployment.url = `http://localhost:${hostPort}`;
      }

      // Store deployment info
      this.activeDeployments.set(container.id, deployment);

      return deployment;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build Docker container configuration
   */
  buildContainerConfig(config, containerName, imageName) {
    const containerConfig = {
      Image: imageName,
      name: containerName
    };

    // Environment variables
    if (config.environment) {
      containerConfig.Env = Object.entries(config.environment)
        .map(([key, value]) => `${key}=${value}`);
    }

    // Port configuration
    if (config.port) {
      containerConfig.ExposedPorts = { [`${config.port}/tcp`]: {} };
      containerConfig.HostConfig = {
        PortBindings: { [`${config.port}/tcp`]: [{ HostPort: config.port.toString() }] }
      };
    }

    // Volume mounts
    if (config.volumes && config.volumes.length > 0) {
      if (!containerConfig.HostConfig) {
        containerConfig.HostConfig = {};
      }
      containerConfig.HostConfig.Binds = config.volumes;
    }

    // Resource limits
    if (config.memory) {
      if (!containerConfig.HostConfig) {
        containerConfig.HostConfig = {};
      }
      containerConfig.HostConfig.Memory = this.parseMemory(config.memory);
    }

    if (config.cpus) {
      if (!containerConfig.HostConfig) {
        containerConfig.HostConfig = {};
      }
      containerConfig.HostConfig.CpuShares = Math.floor(config.cpus * 1024);
    }

    return containerConfig;
  }

  /**
   * Parse memory string to bytes
   */
  parseMemory(memory) {
    if (typeof memory === 'number') return memory;
    
    const match = memory.match(/^(\d+)(.*)?$/);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = (match[2] || '').toLowerCase();
    
    const multipliers = {
      '': 1,
      'b': 1,
      'k': 1024,
      'kb': 1024,
      'm': 1024 * 1024,
      'mb': 1024 * 1024,
      'g': 1024 * 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
  }

  /**
   * Generate unique container name
   */
  generateContainerName() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `docker-deploy-${timestamp}-${random}`;
  }

  /**
   * Stop container
   */
  async stop(deploymentId) {
    try {
      const container = this.docker.getContainer(deploymentId);
      await container.stop();
      
      return {
        success: true,
        id: deploymentId,
        status: 'stopped'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start container
   */
  async start(deploymentId) {
    try {
      const container = this.docker.getContainer(deploymentId);
      await container.start();
      
      return {
        success: true,
        id: deploymentId,
        status: 'running'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restart container
   */
  async restart(deploymentId) {
    try {
      const container = this.docker.getContainer(deploymentId);
      await container.restart();
      
      return {
        success: true,
        id: deploymentId,
        status: 'running'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove container
   */
  async remove(deploymentId) {
    try {
      const container = this.docker.getContainer(deploymentId);
      
      // Stop container if running
      try {
        const inspection = await container.inspect();
        if (inspection.State.Running) {
          await container.stop();
        }
      } catch (inspectError) {
        // Container might not exist, continue with removal
      }
      
      // Remove container
      await container.remove();
      
      // Remove from active deployments
      this.activeDeployments.delete(deploymentId);
      
      return {
        success: true,
        id: deploymentId,
        status: 'removed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get container status
   */
  async getStatus(deploymentId) {
    try {
      const container = this.docker.getContainer(deploymentId);
      const inspection = await container.inspect();
      
      return {
        id: deploymentId,
        status: inspection.State.Running ? 'running' : 'stopped',
        image: inspection.Config.Image,
        startedAt: inspection.State.StartedAt,
        finishedAt: inspection.State.FinishedAt !== '0001-01-01T00:00:00Z' ? inspection.State.FinishedAt : null,
        exitCode: inspection.State.ExitCode,
        ports: inspection.NetworkSettings.Ports,
        environment: inspection.Config.Env || [],
        volumes: inspection.Mounts || [],
        networkSettings: inspection.NetworkSettings
      };
    } catch (error) {
      if (error.message.includes('No such container')) {
        return {
          id: deploymentId,
          status: 'not_found',
          error: error.message
        };
      }
      
      return {
        id: deploymentId,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get container logs
   */
  async getLogs(deploymentId, options = {}) {
    try {
      const container = this.docker.getContainer(deploymentId);
      const logOptions = {
        stdout: true,
        stderr: true,
        tail: options.tail || 100,
        since: options.since || 0,
        ...options
      };
      
      const stream = await container.logs(logOptions);
      
      return new Promise((resolve, reject) => {
        const logs = [];
        
        stream.on('data', (chunk) => {
          // Docker log format includes header bytes, strip them
          const logLine = chunk.toString().substring(8);
          logs.push(logLine.trim());
        });
        
        stream.on('end', () => {
          resolve({
            success: true,
            logs: logs.filter(line => line.length > 0)
          });
        });
        
        stream.on('error', (error) => {
          reject({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update container deployment
   */
  async update(deploymentId, updateConfig) {
    try {
      // Get current container configuration
      const container = this.docker.getContainer(deploymentId);
      const inspection = await container.inspect();
      
      // Merge current config with updates
      const currentConfig = this.extractConfigFromInspection(inspection);
      const newConfig = { ...currentConfig, ...updateConfig };
      
      // If image is being updated, need to recreate container
      if (updateConfig.image && updateConfig.image !== currentConfig.image) {
        // Stop and remove current container
        await container.stop();
        await container.remove();
        
        try {
          // Deploy with new configuration
          const deployment = await this.deploy(newConfig);
          
          if (!deployment.success) {
            // Deploy returned failure, try rollback
            const rollbackDeployment = await this.deploy(currentConfig);
            
            if (rollbackDeployment.success) {
              return {
                success: false,
                error: `Update failed: ${deployment.error || deployment.errors?.join(', ')}. Rolled back to previous version.`,
                rolledBack: true,
                rollbackDeployment
              };
            } else {
              return {
                success: false,
                error: `Update failed and rollback failed: ${deployment.error || deployment.errors?.join(', ')}. Rollback error: ${rollbackDeployment.error || rollbackDeployment.errors?.join(', ')}`,
                rollbackFailed: true
              };
            }
          }
          
          return deployment;
        } catch (deployError) {
          // Deploy threw an exception, try rollback
          try {
            const rollbackDeployment = await this.deploy(currentConfig);
            return {
              success: false,
              error: `Update failed: ${deployError.message}. Rolled back to previous version.`,
              rolledBack: true,
              rollbackDeployment
            };
          } catch (rollbackError) {
            return {
              success: false,
              error: `Update failed and rollback failed: ${deployError.message}. Rollback error: ${rollbackError.message}`,
              rollbackFailed: true
            };
          }
        }
      }
      
      // For non-image updates (env vars, etc.), need to recreate container
      await container.stop();
      await container.remove();
      
      const deployment = await this.deploy(newConfig);
      return deployment;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract configuration from container inspection
   */
  extractConfigFromInspection(inspection) {
    const config = {
      name: inspection.Name.replace('/', ''),
      image: inspection.Config.Image
    };

    // Extract environment variables
    if (inspection.Config.Env) {
      config.environment = {};
      inspection.Config.Env.forEach(env => {
        const [key, ...valueParts] = env.split('=');
        config.environment[key] = valueParts.join('=');
      });
    }

    // Extract port configuration
    if (inspection.HostConfig.PortBindings) {
      const portBindings = Object.keys(inspection.HostConfig.PortBindings);
      if (portBindings.length > 0) {
        const portKey = portBindings[0];
        config.port = parseInt(portKey.split('/')[0]);
      }
    }

    // Extract volumes
    if (inspection.HostConfig.Binds) {
      config.volumes = inspection.HostConfig.Binds;
    }

    return config;
  }

  /**
   * Scale container deployment
   */
  async scale(deploymentName, instances) {
    try {
      // List existing containers for this deployment
      const containers = await this.docker.listContainers({ all: true });
      const deploymentContainers = containers.filter(container => 
        container.Names.some(name => name.includes(deploymentName))
      );

      const currentInstances = deploymentContainers.length;
      const result = {
        success: true,
        deployment: deploymentName,
        instances: instances,
        currentInstances,
        created: 0,
        removed: 0
      };

      if (instances > currentInstances) {
        // Scale up - create new containers
        const containersToCreate = instances - currentInstances;
        
        if (deploymentContainers.length > 0) {
          // Get configuration from existing container
          const existingContainer = this.docker.getContainer(deploymentContainers[0].Id);
          const inspection = await existingContainer.inspect();
          const config = this.extractConfigFromInspection(inspection);
          
          for (let i = 0; i < containersToCreate; i++) {
            config.name = `${deploymentName}-${currentInstances + i + 1}`;
            await this.deploy(config);
            result.created++;
          }
        }
      } else if (instances < currentInstances) {
        // Scale down - remove excess containers
        const containersToRemove = currentInstances - instances;
        const containersToDelete = deploymentContainers.slice(0, containersToRemove);
        
        for (const containerInfo of containersToDelete) {
          await this.remove(containerInfo.Id);
          result.removed++;
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all deployments
   */
  async listDeployments() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      
      const deployments = containers.map(container => ({
        id: container.Id,
        name: container.Names[0]?.replace('/', '') || 'unnamed',
        image: container.Image,
        status: container.State,
        ports: container.Ports,
        created: new Date(container.Created * 1000),
        provider: 'docker'
      }));

      return {
        success: true,
        deployments
      };
    } catch (error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('docker.sock')) {
        return {
          success: false,
          error: 'Docker daemon not available. Ensure Docker is running.'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List available images
   */
  async listImages() {
    try {
      const images = await this.docker.listImages();
      
      const imageList = images.map(image => ({
        id: image.Id,
        tags: image.RepoTags || [],
        size: image.Size,
        created: new Date(image.Created * 1000)
      }));

      return {
        success: true,
        images: imageList
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create Docker network
   */
  async createNetwork(config) {
    try {
      const network = await this.docker.createNetwork({
        Name: config.name,
        Driver: config.driver || 'bridge',
        Options: config.options || {}
      });

      return {
        success: true,
        networkId: network.id,
        name: config.name
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Connect container to network
   */
  async connectToNetwork(containerId, networkId) {
    try {
      const network = this.docker.getNetwork(networkId);
      await network.connect({
        Container: containerId
      });

      return {
        success: true,
        containerId,
        networkId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get container metrics (stub - would integrate with monitoring system)
   */
  async getMetrics(deploymentId) {
    try {
      const container = this.docker.getContainer(deploymentId);
      const stats = await container.stats({ stream: false });
      
      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = cpuDelta > 0 && systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

      // Calculate memory usage
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

      return {
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: {
          usage: memoryUsage,
          limit: memoryLimit,
          percent: Math.round(memoryPercent * 100) / 100
        },
        network: stats.networks || {},
        timestamp: new Date()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

export default DockerProvider;