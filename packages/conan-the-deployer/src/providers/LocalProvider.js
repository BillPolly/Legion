import BaseProvider from './BaseProvider.js';
import ProcessManager from '../utils/ProcessManager.js';
import PortManager from '../utils/PortManager.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * LocalProvider - Manages deployments on the local machine
 */
class LocalProvider extends BaseProvider {
  constructor() {
    super();
    this.processManager = new ProcessManager();
    this.portManager = new PortManager();
    this.deployments = new Map();
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      supportsRollingUpdate: true,
      supportsBlueGreen: false,
      supportsHealthChecks: true,
      supportsMetrics: true,
      supportsCustomDomains: false
    };
  }

  /**
   * Deploy an application locally
   */
  async deploy(config) {
    const { projectPath, name, env = {}, port, startCommand, healthCheckPath = '/health' } = config;

    // Validate project path
    try {
      await fs.access(projectPath);
    } catch (error) {
      throw new Error('Project path does not exist');
    }

    // Validate package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      await fs.access(packageJsonPath);
    } catch (error) {
      throw new Error('No package.json found');
    }

    // Read package.json
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    // Determine start command
    let command = startCommand;
    if (!command && packageJson.scripts?.start) {
      command = 'npm start';
    }

    // Allocate port
    const allocatedPort = await this.portManager.allocatePort(port);

    try {
      // Start process
      const processResult = await this.processManager.start({
        command,
        cwd: projectPath,
        env: {
          ...env,
          PORT: allocatedPort.toString()
        },
        captureOutput: true
      });

      // Create deployment record
      const deployment = {
        id: `local-${Date.now()}`,
        name,
        projectPath,
        port: allocatedPort,
        pid: processResult.pid,
        processId: processResult.id,
        status: processResult.status,
        url: `http://localhost:${allocatedPort}`,
        startTime: processResult.startTime,
        env,
        healthCheckPath,
        command
      };

      // Store deployment
      this.deployments.set(deployment.id, deployment);

      return deployment;
    } catch (error) {
      // Release port on failure
      await this.portManager.releasePort(allocatedPort);
      throw error;
    }
  }

  /**
   * Update a deployment
   */
  async update(deploymentId, config) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const previousConfig = {
      env: deployment.env,
      startCommand: deployment.command
    };

    // Update environment variables if provided
    if (config.env) {
      deployment.env = config.env;
    }

    // Restart process with new config
    await this.processManager.restart(deployment.processId);

    // Update deployment status
    deployment.status = 'running';

    return {
      success: true,
      deploymentId,
      strategy: 'rolling',
      previousConfig,
      newConfig: {
        env: deployment.env,
        startCommand: deployment.command
      }
    };
  }

  /**
   * Stop a deployment
   */
  async stop(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Stop process
    const result = await this.processManager.stop(deployment.processId, { graceful: true });

    // Release port
    await this.portManager.releasePort(deployment.port);

    // Update status
    deployment.status = 'stopped';

    return {
      success: true,
      deploymentId,
      exitCode: result.exitCode,
      signal: result.signal
    };
  }

  /**
   * Remove a deployment
   */
  async remove(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Stop if running
    if (deployment.status === 'running') {
      await this.stop(deploymentId);
    }

    // Release port
    await this.portManager.releasePort(deployment.port);

    // Remove from deployments
    this.deployments.delete(deploymentId);

    return {
      success: true,
      deploymentId,
      cleanedResources: ['process', 'port']
    };
  }

  /**
   * Get deployment status
   */
  async getStatus(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const processStatus = this.processManager.getStatus(deployment.processId);

    return {
      deploymentId,
      status: processStatus.status,
      uptime: processStatus.uptime,
      pid: processStatus.pid,
      health: { status: 'healthy' }
    };
  }

  /**
   * Get deployment logs
   */
  async getLogs(deploymentId, options = {}) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const processLogs = this.processManager.getLogs(deployment.processId);
    if (!processLogs) {
      return {
        deploymentId,
        logs: [],
        hasMore: false
      };
    }

    // Parse logs into structured format
    const logs = [];
    if (processLogs.stdout) {
      const lines = processLogs.stdout.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        logs.push({
          timestamp: new Date(),
          level: 'info',
          message: line.trim(),
          source: 'stdout'
        });
      });
    }

    if (processLogs.stderr) {
      const lines = processLogs.stderr.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        logs.push({
          timestamp: new Date(),
          level: 'error',
          message: line.trim(),
          source: 'stderr'
        });
      });
    }

    return {
      deploymentId,
      logs,
      hasMore: processLogs.truncated || false
    };
  }

  /**
   * Get deployment metrics
   */
  async getMetrics(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // For now, return mock metrics
    // In a real implementation, we would use systeminformation or similar
    return {
      deploymentId,
      timestamp: new Date(),
      cpu: {
        usage: Math.random() * 100
      },
      memory: {
        usage: Math.random() * 1024 * 1024 * 500, // Random up to 500MB
        limit: 1024 * 1024 * 1024 * 2 // 2GB
      },
      network: {
        rx: Math.random() * 1024 * 1024,
        tx: Math.random() * 1024 * 1024
      }
    };
  }

  /**
   * Check deployment health
   */
  async checkHealth(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const checks = [];

    // HTTP health check
    if (deployment.healthCheckPath) {
      const healthUrl = `http://localhost:${deployment.port}${deployment.healthCheckPath}`;
      const startTime = Date.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(healthUrl, {
            signal: controller.signal
          });

          checks.push({
            name: 'http',
            status: response.ok ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - startTime
          });
        } catch (error) {
          checks.push({
            name: 'http',
            status: 'unhealthy',
            error: error.message
          });
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        // Handle other setup errors
        checks.push({
          name: 'http',
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    const allHealthy = checks.every(check => check.status === 'healthy');
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks
    };
  }
}

export default LocalProvider;