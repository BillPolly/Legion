/**
 * @fileoverview ServerHealthTool - System health monitoring and reporting
 */

import { Tool } from '../base/Tool.js';
import { jsonSchemaToZod } from '@legion/schema';
import os from 'os';

export class ServerHealthTool extends Tool {
  constructor(module) {
    super({
      name: 'server_health',
      description: 'Check health status of running processes, servers, and system resources',
      inputSchema: {
        type: 'object',
        properties: {
          includeProcesses: {
            type: 'boolean',
            description: 'Include process health information',
            default: true
          },
          includeSessions: {
            type: 'boolean',
            description: 'Include session statistics',
            default: true
          },
          includeStorage: {
            type: 'boolean',
            description: 'Include log storage statistics',
            default: true
          },
          includeServers: {
            type: 'boolean',
            description: 'Include web server health status',
            default: true
          },
          includeWebSocket: {
            type: 'boolean',
            description: 'Include WebSocket server status',
            default: true
          },
          includeSystemResources: {
            type: 'boolean',
            description: 'Include system resource usage (CPU, memory)',
            default: false
          }
        },
        additionalProperties: false
      }
    });
    
    this.module = module;
    this.validator = jsonSchemaToZod(this.inputSchema);
    this.startTime = Date.now();
  }

  async execute(args = {}) {
    // Validate input
    const validatedArgs = this.validator.parse(args);
    
    this.emit('progress', { percentage: 0, status: 'Starting health check...' });
    
    const issues = [];
    const healthReport = {
      success: true,
      overallStatus: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      issues: []
    };
    
    try {
      let checkCount = 0;
      const totalChecks = Object.values(validatedArgs).filter(v => v === true).length || 5;
      
      // Check processes
      if (validatedArgs.includeProcesses !== false) {
        this.emit('progress', { 
          percentage: Math.floor((++checkCount / totalChecks) * 100), 
          status: 'Checking processes...' 
        });
        
        try {
          const processHealth = await this.checkProcessHealth();
          healthReport.processes = processHealth;
          
          if (processHealth.running === 0) {
            issues.push('No processes running');
          } else if (processHealth.highMemoryProcesses > 0) {
            issues.push(`${processHealth.highMemoryProcesses} process(es) with high memory usage`);
          }
        } catch (error) {
          issues.push(`Failed to check processes: ${error.message}`);
        }
      }
      
      // Check sessions
      if (validatedArgs.includeSessions !== false) {
        this.emit('progress', { 
          percentage: Math.floor((++checkCount / totalChecks) * 100), 
          status: 'Checking sessions...' 
        });
        
        try {
          const sessionHealth = await this.checkSessionHealth();
          healthReport.sessions = sessionHealth;
        } catch (error) {
          issues.push(`Failed to check sessions: ${error.message}`);
        }
      }
      
      // Check storage
      if (validatedArgs.includeStorage !== false) {
        this.emit('progress', { 
          percentage: Math.floor((++checkCount / totalChecks) * 100), 
          status: 'Checking storage...' 
        });
        
        try {
          const storageHealth = await this.checkStorageHealth();
          healthReport.storage = storageHealth;
          
          if (storageHealth.totalSize > 1073741824) { // > 1GB
            issues.push('Log storage exceeds 1GB');
          }
        } catch (error) {
          issues.push(`Failed to check storage: ${error.message}`);
        }
      }
      
      // Check servers
      if (validatedArgs.includeServers !== false) {
        this.emit('progress', { 
          percentage: Math.floor((++checkCount / totalChecks) * 100), 
          status: 'Checking servers...' 
        });
        
        try {
          const serverHealth = await this.checkServerHealth();
          healthReport.servers = serverHealth;
          
          if (serverHealth.unhealthyServers > 0) {
            issues.push(`${serverHealth.unhealthyServers} unhealthy server(s)`);
          }
        } catch (error) {
          issues.push(`Failed to check servers: ${error.message}`);
        }
      }
      
      // Check WebSocket
      if (validatedArgs.includeWebSocket !== false) {
        this.emit('progress', { 
          percentage: Math.floor((++checkCount / totalChecks) * 100), 
          status: 'Checking WebSocket...' 
        });
        
        try {
          const webSocketHealth = await this.checkWebSocketHealth();
          healthReport.webSocket = webSocketHealth;
          
          if (!webSocketHealth.running) {
            issues.push('WebSocket server not running');
          }
        } catch (error) {
          issues.push(`Failed to check WebSocket: ${error.message}`);
        }
      }
      
      // Check system resources
      if (validatedArgs.includeSystemResources) {
        this.emit('progress', { 
          percentage: Math.floor((++checkCount / totalChecks) * 100), 
          status: 'Checking system resources...' 
        });
        
        const systemHealth = this.checkSystemResources();
        healthReport.systemResources = systemHealth;
        
        if (systemHealth.memoryUsagePercent > 90) {
          issues.push('System memory usage critical (>90%)');
        } else if (systemHealth.memoryUsagePercent > 75) {
          issues.push('System memory usage high (>75%)');
        }
      }
      
      // Determine overall status
      healthReport.issues = issues;
      if (issues.length === 0) {
        healthReport.overallStatus = 'healthy';
      } else if (issues.some(issue => 
        issue.includes('No processes') || 
        issue.includes('critical') ||
        issue.includes('WebSocket server not running')
      )) {
        healthReport.overallStatus = 'unhealthy';
      } else {
        healthReport.overallStatus = 'degraded';
      }
      
      // Emit warnings for any issues
      issues.forEach(issue => {
        this.emit('warning', { message: issue });
      });
      
      this.emit('progress', { percentage: 100, status: 'Health check complete' });
      this.emit('info', { 
        message: `Health check complete: ${healthReport.overallStatus}` 
      });
      
      return healthReport;
      
    } catch (error) {
      this.emit('error', {
        message: `Health check failed: ${error.message}`,
        error: error.name
      });
      throw error;
    }
  }

  async checkProcessHealth() {
    const runningProcesses = this.module.processManager.getRunningProcesses();
    const processDetails = [];
    let highMemoryProcesses = 0;
    
    for (const processId of runningProcesses) {
      const info = this.module.processManager.getProcessInfo(processId);
      processDetails.push(info);
      
      // Check for high memory usage (> 1GB)
      if (info.memoryUsage > 1073741824) {
        highMemoryProcesses++;
      }
    }
    
    return {
      running: runningProcesses.length,
      details: processDetails,
      highMemoryProcesses
    };
  }

  async checkSessionHealth() {
    const sessions = await this.module.sessionManager.listSessions();
    const byStatus = {};
    
    for (const session of sessions) {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    }
    
    return {
      total: sessions.length,
      active: byStatus.active || 0,
      completed: byStatus.completed || 0,
      failed: byStatus.failed || 0,
      terminated: byStatus.terminated || 0,
      byStatus
    };
  }

  async checkStorageHealth() {
    const stats = await this.module.logStorage.getStorageStats();
    
    return {
      ...stats,
      formattedSize: this.formatBytes(stats.totalSize)
    };
  }

  async checkServerHealth() {
    if (!this.module.serverManager) {
      return {
        running: 0,
        details: [],
        unhealthyServers: 0
      };
    }
    
    const servers = this.module.serverManager.getRunningServers();
    let unhealthyServers = 0;
    
    for (const server of servers) {
      if (server.healthCheck && server.healthCheck.status !== 'healthy') {
        unhealthyServers++;
      }
    }
    
    return {
      running: servers.length,
      details: servers,
      unhealthyServers
    };
  }

  async checkWebSocketHealth() {
    if (!this.module.webSocketServer) {
      return {
        running: false,
        port: null,
        connectedClients: 0
      };
    }
    
    const isRunning = this.module.webSocketServer.isRunning();
    
    return {
      running: isRunning,
      port: isRunning ? this.module.webSocketServer.getPort() : null,
      connectedClients: isRunning ? this.module.webSocketServer.getConnectedClients() : 0
    };
  }

  checkSystemResources() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    return {
      totalMemory,
      freeMemory,
      usedMemory,
      memoryUsagePercent,
      formattedTotalMemory: this.formatBytes(totalMemory),
      formattedFreeMemory: this.formatBytes(freeMemory),
      formattedUsedMemory: this.formatBytes(usedMemory),
      cpuCount: os.cpus().length,
      platform: os.platform(),
      nodeVersion: process.version
    };
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}