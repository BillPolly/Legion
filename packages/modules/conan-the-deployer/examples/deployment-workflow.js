#!/usr/bin/env node

/**
 * Conan-the-Deployer - Complete Deployment Workflow Example
 * 
 * This script demonstrates a complete deployment workflow using all the tools:
 * 1. Deploy application
 * 2. Start monitoring
 * 3. Check health and metrics
 * 4. View logs
 * 5. Update deployment
 * 6. Stop deployment
 */

import path from 'path';
import { fileURLToPath } from 'url';

// Import all tools
import DeployApplicationTool from '../src/tools/DeployApplicationTool.js';
import MonitorDeploymentTool from '../src/tools/MonitorDeploymentTool.js';
import UpdateDeploymentTool from '../src/tools/UpdateDeploymentTool.js';
import ListDeploymentsTool from '../src/tools/ListDeploymentsTool.js';
import StopDeploymentTool from '../src/tools/StopDeploymentTool.js';
import GetDeploymentLogsTool from '../src/tools/GetDeploymentLogsTool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DeploymentWorkflowDemo {
  constructor() {
    this.deployTool = new DeployApplicationTool();
    this.monitorTool = new MonitorDeploymentTool();
    this.updateTool = new UpdateDeploymentTool();
    this.listTool = new ListDeploymentsTool();
    this.stopTool = new StopDeploymentTool();
    this.logsTool = new GetDeploymentLogsTool();
    
    this.deploymentId = null;
  }

  async run() {
    console.log('🚀 Conan-the-Deployer Workflow Demo\n');

    try {
      // Step 1: Deploy application
      await this.deployApplication();
      
      // Step 2: Start monitoring
      await this.startMonitoring();
      
      // Step 3: Check deployment status
      await this.checkStatus();
      
      // Step 4: View logs
      await this.viewLogs();
      
      // Step 5: Update deployment
      await this.updateDeployment();
      
      // Step 6: List all deployments
      await this.listDeployments();
      
      // Step 7: Stop deployment
      await this.stopDeployment();
      
      console.log('\n✅ Workflow completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Workflow failed:', error.message);
      
      // Cleanup on error
      if (this.deploymentId) {
        console.log('🧹 Cleaning up deployment...');
        await this.forceStop();
      }
    }
  }

  async deployApplication() {
    console.log('📦 Step 1: Deploying application...');
    
    const appPath = path.join(__dirname, 'simple-express-app');
    
    const deployCall = {
      function: {
        name: 'deploy_application',
        arguments: JSON.stringify({
          provider: 'local',
          config: {
            name: 'demo-express-app',
            source: appPath,
            environment: {
              NODE_ENV: 'demo',
              PORT: '3000',
              DEMO_MODE: 'true'
            },
            healthCheck: {
              path: '/health',
              interval: 30000,
              timeout: 5000
            }
          }
        })
      }
    };

    const result = await this.deployTool.invoke(deployCall);
    
    if (result.success) {
      this.deploymentId = result.data.deployment.id;
      console.log(`   ✅ Deployment successful!`);
      console.log(`   🆔 Deployment ID: ${this.deploymentId}`);
      console.log(`   🌐 URL: ${result.data.deployment.url}`);
      console.log(`   📄 Summary: ${result.data.summary}\n`);
    } else {
      throw new Error(`Deployment failed: ${result.error}`);
    }
  }

  async startMonitoring() {
    console.log('📊 Step 2: Starting monitoring...');
    
    const monitorCall = {
      function: {
        name: 'monitor_deployment',
        arguments: JSON.stringify({
          deploymentId: this.deploymentId,
          action: 'start',
          interval: 10000 // Check every 10 seconds for demo
        })
      }
    };

    const result = await this.monitorTool.invoke(monitorCall);
    
    if (result.success) {
      console.log(`   ✅ Monitoring started successfully`);
      console.log(`   📈 Status: ${result.data.monitoring.status}`);
      console.log(`   ⏱️  Interval: ${result.data.monitoring.interval}ms\n`);
    } else {
      console.log(`   ⚠️  Monitoring start failed: ${result.error}\n`);
    }
  }

  async checkStatus() {
    console.log('🔍 Step 3: Checking deployment status...');
    
    // Check health
    const healthCall = {
      function: {
        name: 'monitor_deployment',
        arguments: JSON.stringify({
          deploymentId: this.deploymentId,
          action: 'health'
        })
      }
    };

    const healthResult = await this.monitorTool.invoke(healthCall);
    
    if (healthResult.success && healthResult.data.health) {
      console.log(`   💚 Health Status: ${healthResult.data.health.status}`);
      console.log(`   🔍 Health Checks:`, healthResult.data.health.checks);
    }

    // Check metrics
    const metricsCall = {
      function: {
        name: 'monitor_deployment',
        arguments: JSON.stringify({
          deploymentId: this.deploymentId,
          action: 'metrics'
        })
      }
    };

    const metricsResult = await this.monitorTool.invoke(metricsCall);
    
    if (metricsResult.success && metricsResult.data.metrics) {
      console.log(`   📊 System Metrics:`, metricsResult.data.metrics.system);
      if (metricsResult.data.metrics.http) {
        console.log(`   🌐 HTTP Metrics:`, metricsResult.data.metrics.http);
      }
    }
    
    console.log();
  }

  async viewLogs() {
    console.log('📋 Step 4: Viewing deployment logs...');
    
    const logsCall = {
      function: {
        name: 'get_deployment_logs',
        arguments: JSON.stringify({
          deploymentId: this.deploymentId,
          lines: 10,
          format: 'structured'
        })
      }
    };

    const result = await this.logsTool.invoke(logsCall);
    
    if (result.success) {
      console.log(`   📄 Retrieved ${result.data.logs.length} log entries:`);
      result.data.logs.slice(-5).forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        console.log(`   ${timestamp} [${log.level.toUpperCase()}] ${log.message}`);
      });
      console.log(`   📊 Summary: ${result.data.summary.message}\n`);
    } else {
      console.log(`   ⚠️  Failed to retrieve logs: ${result.error}\n`);
    }
  }

  async updateDeployment() {
    console.log('🔄 Step 5: Updating deployment...');
    
    const updateCall = {
      function: {
        name: 'update_deployment',
        arguments: JSON.stringify({
          deploymentId: this.deploymentId,
          updates: {
            environment: {
              NODE_ENV: 'demo',
              PORT: '3000',
              DEMO_MODE: 'true',
              VERSION: '1.1.0',
              UPDATED_AT: new Date().toISOString()
            }
          },
          strategy: 'rolling',
          rollbackOnFailure: true,
          verifyUpdate: true
        })
      }
    };

    const result = await this.updateTool.invoke(updateCall);
    
    if (result.success) {
      console.log(`   ✅ Update completed successfully`);
      console.log(`   🔄 Strategy: ${result.data.update.strategy}`);
      console.log(`   ✔️  Verified: ${result.data.update.verified}`);
      console.log(`   📄 Summary: ${result.data.summary}\n`);
    } else {
      console.log(`   ⚠️  Update failed: ${result.error}`);
      if (result.rolledBack) {
        console.log(`   🔙 Automatically rolled back to previous version\n`);
      } else {
        console.log();
      }
    }
  }

  async listDeployments() {
    console.log('📋 Step 6: Listing all deployments...');
    
    const listCall = {
      function: {
        name: 'list_deployments',
        arguments: JSON.stringify({
          format: 'table',
          limit: 10
        })
      }
    };

    const result = await this.listTool.invoke(listCall);
    
    if (result.success) {
      console.log(`   📊 Found ${result.data.summary.total} deployments:`);
      console.log(`   🏭 By Provider:`, result.data.summary.byProvider);
      console.log(`   📈 By Status:`, result.data.summary.byStatus);
      
      if (result.data.table && result.data.table.rows.length > 0) {
        console.log('\n   📄 Deployment Table:');
        console.log('   ' + result.data.table.headers.join(' | '));
        console.log('   ' + '-'.repeat(result.data.table.headers.join(' | ').length));
        result.data.table.rows.forEach(row => {
          console.log('   ' + row.join(' | '));
        });
      }
      console.log();
    } else {
      console.log(`   ⚠️  Failed to list deployments: ${result.error}\n`);
    }
  }

  async stopDeployment() {
    console.log('🛑 Step 7: Stopping deployment...');
    
    const stopCall = {
      function: {
        name: 'stop_deployment',
        arguments: JSON.stringify({
          deploymentId: this.deploymentId,
          graceful: true,
          timeout: 10000,
          cleanup: true
        })
      }
    };

    const result = await this.stopTool.invoke(stopCall);
    
    if (result.success) {
      console.log(`   ✅ Deployment stopped successfully`);
      console.log(`   🕒 Shutdown time: ${result.data.stop.shutdownTime}ms`);
      console.log(`   🧹 Cleanup: ${result.data.stop.cleanup ? 'Performed' : 'Skipped'}`);
      console.log(`   📄 Summary: ${result.data.summary}\n`);
    } else {
      console.log(`   ⚠️  Failed to stop deployment: ${result.error}\n`);
    }
  }

  async forceStop() {
    try {
      const stopCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: this.deploymentId,
            graceful: false,
            force: true,
            cleanup: true
          })
        }
      };

      await this.stopTool.invoke(stopCall);
      console.log('   🧹 Cleanup completed');
    } catch (error) {
      console.error('   ❌ Cleanup failed:', error.message);
    }
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new DeploymentWorkflowDemo();
  
  console.log('Starting Conan-the-Deployer workflow demo...\n');
  console.log('This demo will:');
  console.log('1. Deploy a simple Express app locally');
  console.log('2. Start monitoring the deployment');
  console.log('3. Check health and metrics');
  console.log('4. View application logs');
  console.log('5. Update the deployment');
  console.log('6. List all deployments');
  console.log('7. Stop the deployment');
  console.log('\nPress Ctrl+C to cancel at any time.\n');
  
  // Wait a moment for user to read
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await demo.run();
}

export default DeploymentWorkflowDemo;