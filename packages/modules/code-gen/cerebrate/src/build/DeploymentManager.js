/**
 * Deployment Manager for Cerebrate
 * Handles deployment automation, store publishing, and release management
 */
import crypto from 'crypto';

export class DeploymentManager {
  constructor(options = {}) {
    this.config = {
      environment: 'development',
      autoPublish: false,
      validateBeforeDeploy: true,
      createBackup: false,
      maxPackageSize: 20 * 1024 * 1024, // 20MB
      ...options
    };
    
    this.deployments = [];
    this.backups = [];
    this.rollbackHistory = [];
    this.supportedEnvironments = ['development', 'staging', 'production'];
    
    this.storeConfigs = {
      'chrome-web-store': {
        name: 'Chrome Web Store',
        uploadEndpoint: 'https://www.googleapis.com/upload/chromewebstore/v1.1/items',
        apiVersion: 'v1.1',
        requiredScopes: ['https://www.googleapis.com/auth/chromewebstore']
      },
      'edge-add-ons': {
        name: 'Microsoft Edge Add-ons',
        uploadEndpoint: 'https://api.addons.microsoftedge.microsoft.com/v1/products',
        apiVersion: 'v1',
        requiredScopes: ['https://api.addons.microsoftedge.microsoft.com/user_impersonation']
      },
      'firefox-add-ons': {
        name: 'Firefox Add-ons',
        uploadEndpoint: 'https://addons.mozilla.org/api/v5/addons/upload/',
        apiVersion: 'v5',
        requiredScopes: ['https://addons.mozilla.org/api']
      }
    };
    
    this.environmentConfigs = {
      development: {
        environment: 'development',
        validateBeforeDeploy: false,
        createBackup: false,
        autoPublish: false
      },
      staging: {
        environment: 'staging', 
        validateBeforeDeploy: true,
        createBackup: true,
        autoPublish: false
      },
      production: {
        environment: 'production',
        validateBeforeDeploy: true,
        createBackup: true,
        autoPublish: false
      }
    };
  }
  
  /**
   * Validate deployment configuration
   * @param {Object} config - Deployment configuration
   */
  validateConfig(config) {
    if (!config.packagePath) {
      throw new Error('Package path is required for deployment');
    }
    
    if (config.environment && !this.supportedEnvironments.includes(config.environment)) {
      throw new Error(`Invalid environment: ${config.environment}. Valid environments: ${this.supportedEnvironments.join(', ')}`);
    }
    
    if (config.store && !this.storeConfigs[config.store]) {
      throw new Error(`Unsupported store: ${config.store}. Supported stores: ${Object.keys(this.storeConfigs).join(', ')}`);
    }
  }
  
  /**
   * Set deployment environment
   * @param {string} environment - Target environment
   */
  setEnvironment(environment) {
    if (!this.supportedEnvironments.includes(environment)) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    this.config.environment = environment;
  }
  
  /**
   * Get current environment
   * @returns {string} - Current environment
   */
  getEnvironment() {
    return this.config.environment;
  }
  
  /**
   * Get environment-specific configuration
   * @param {string} environment - Target environment
   * @returns {Object} - Environment configuration
   */
  getEnvironmentConfig(environment = null) {
    const targetEnv = environment || this.config.environment;
    
    if (!this.environmentConfigs[targetEnv]) {
      throw new Error(`No configuration found for environment: ${targetEnv}`);
    }
    
    return { ...this.environmentConfigs[targetEnv] };
  }
  
  /**
   * Validate package before deployment
   * @param {Object} packageInfo - Package information
   * @returns {Object} - Validation result
   */
  validatePackage(packageInfo) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Check required files
    const requiredFiles = ['manifest.json'];
    const recommendedFiles = ['background.js', 'content.js'];
    
    for (const file of requiredFiles) {
      if (!packageInfo.files.includes(file)) {
        result.valid = false;
        result.errors.push(`Missing required file: ${file}`);
      }
    }
    
    for (const file of recommendedFiles) {
      if (!packageInfo.files.includes(file)) {
        result.warnings.push(`Missing recommended file: ${file}`);
        // Only treat as error if no files found
        if (!packageInfo.files.some(f => f.endsWith('.js'))) {
          result.valid = false;
          result.errors.push(`Missing recommended file: ${file}`);
        }
      }
    }
    
    // Check manifest validity
    if (!packageInfo.manifestValid) {
      result.valid = false;
      result.errors.push('Invalid manifest.json structure');
    }
    
    // Check package size
    if (packageInfo.size > this.config.maxPackageSize) {
      result.valid = false;
      result.errors.push(`Package size exceeds maximum limit (${this.config.maxPackageSize / (1024 * 1024)}MB)`);
    }
    
    // Check checksums if available
    if (packageInfo.checksums) {
      if (!packageInfo.checksums.sha256 || !packageInfo.checksums.md5) {
        result.warnings.push('Package checksums incomplete');
      }
    } else {
      result.warnings.push('No package checksums provided');
    }
    
    return result;
  }
  
  /**
   * Get store configuration
   * @param {string} storeName - Store name
   * @returns {Object} - Store configuration
   */
  getStoreConfig(storeName) {
    if (!this.storeConfigs[storeName]) {
      throw new Error(`Unsupported store: ${storeName}`);
    }
    
    return { ...this.storeConfigs[storeName] };
  }
  
  /**
   * Create backup before deployment
   * @param {Object} deploymentConfig - Deployment configuration
   * @returns {string} - Backup path
   */
  createBackup(deploymentConfig) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const backupPath = `/backups/${backupId}/${deploymentConfig.environment}/extension.zip`;
    
    const backup = {
      id: backupId,
      path: backupPath,
      originalPath: deploymentConfig.packagePath,
      environment: deploymentConfig.environment,
      date: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    this.backups.push(backup);
    
    return backupPath;
  }
  
  /**
   * List available backups
   * @param {string} environment - Filter by environment
   * @returns {Array} - Available backups
   */
  listBackups(environment = null) {
    let backups = [...this.backups];
    
    if (environment) {
      backups = backups.filter(backup => backup.environment === environment);
    }
    
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Rollback to previous version
   * @param {Object} rollbackConfig - Rollback configuration
   * @returns {Object} - Rollback result
   */
  rollback(rollbackConfig) {
    if (!rollbackConfig.backupId) {
      throw new Error('Backup ID is required for rollback');
    }
    
    if (!rollbackConfig.environment) {
      throw new Error('Environment is required for rollback');
    }
    
    const backup = this.backups.find(b => b.id === rollbackConfig.backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${rollbackConfig.backupId}`);
    }
    
    const rollbackRecord = {
      id: `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      backupId: rollbackConfig.backupId,
      environment: rollbackConfig.environment,
      reason: rollbackConfig.reason || 'Manual rollback',
      rolledBackAt: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    this.rollbackHistory.push(rollbackRecord);
    
    return {
      success: true,
      backupId: rollbackConfig.backupId,
      rolledBackAt: rollbackRecord.rolledBackAt,
      rollbackId: rollbackRecord.id
    };
  }
  
  /**
   * Get rollback history
   * @param {string} environment - Filter by environment
   * @returns {Array} - Rollback history
   */
  getRollbackHistory(environment = null) {
    let history = [...this.rollbackHistory];
    
    if (environment) {
      history = history.filter(record => record.environment === environment);
    }
    
    return history.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Update deployment status
   * @param {string} deploymentId - Deployment ID
   * @param {string} status - New status
   */
  updateDeploymentStatus(deploymentId, status) {
    let deployment = this.deployments.find(d => d.id === deploymentId);
    
    if (!deployment) {
      deployment = {
        id: deploymentId,
        status: status,
        timestamp: new Date().toISOString(),
        history: []
      };
      this.deployments.push(deployment);
    } else {
      deployment.history.push({
        previousStatus: deployment.status,
        newStatus: status,
        timestamp: new Date().toISOString()
      });
      deployment.status = status;
    }
  }
  
  /**
   * Get deployment status
   * @param {string} deploymentId - Deployment ID
   * @returns {string} - Deployment status
   */
  getDeploymentStatus(deploymentId) {
    const deployment = this.deployments.find(d => d.id === deploymentId);
    return deployment ? deployment.status : 'unknown';
  }
  
  /**
   * Get deployment history
   * @param {string} environment - Filter by environment
   * @returns {Array} - Deployment history
   */
  getDeploymentHistory(environment = null) {
    let deployments = [...this.deployments];
    
    if (environment) {
      deployments = deployments.filter(d => d.environment === environment);
    }
    
    return deployments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  
  /**
   * Generate release notes from commits
   * @param {Array} commits - Array of commit objects
   * @param {string} version - Release version
   * @returns {string} - Formatted release notes
   */
  generateReleaseNotes(commits, version) {
    const categories = {
      'feat': { title: 'Features', commits: [] },
      'fix': { title: 'Bug Fixes', commits: [] },
      'perf': { title: 'Performance', commits: [] },
      'docs': { title: 'Documentation', commits: [] },
      'style': { title: 'Styling', commits: [] },
      'refactor': { title: 'Refactoring', commits: [] },
      'test': { title: 'Testing', commits: [] },
      'chore': { title: 'Maintenance', commits: [] }
    };
    
    // Categorize commits
    for (const commit of commits) {
      const match = commit.message.match(/^(\w+):\s*(.+)/);
      if (match) {
        const [, type, description] = match;
        if (categories[type]) {
          categories[type].commits.push({
            description: description,
            hash: commit.hash
          });
        } else {
          categories['chore'].commits.push({
            description: commit.message,
            hash: commit.hash
          });
        }
      } else {
        categories['chore'].commits.push({
          description: commit.message,
          hash: commit.hash
        });
      }
    }
    
    // Generate markdown
    let notes = `# Release Notes - Version ${version}\n\n`;
    notes += `*Released on ${new Date().toDateString()}*\n\n`;
    
    for (const [type, category] of Object.entries(categories)) {
      if (category.commits.length > 0) {
        notes += `### ${category.title}\n\n`;
        for (const commit of category.commits) {
          notes += `- ${commit.description}`;
          if (commit.hash) {
            notes += ` (${commit.hash.substr(0, 7)})`;
          }
          notes += '\n';
        }
        notes += '\n';
      }
    }
    
    if (notes.trim() === `# Release Notes - Version ${version}\n\n*Released on ${new Date().toDateString()}*`) {
      notes += 'No significant changes in this release.\n';
    }
    
    return notes;
  }
  
  /**
   * Deploy extension to store
   * @param {Object} deploymentConfig - Deployment configuration
   * @returns {Promise<Object>} - Deployment result
   */
  async deploy(deploymentConfig) {
    this.validateConfig(deploymentConfig);
    
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.updateDeploymentStatus(deploymentId, 'validating');
      
      // Validate package if required
      const envConfig = this.getEnvironmentConfig(deploymentConfig.environment);
      if (envConfig.validateBeforeDeploy && deploymentConfig.packageInfo) {
        const validation = this.validatePackage(deploymentConfig.packageInfo);
        if (!validation.valid) {
          throw new Error(`Package validation failed: ${validation.errors.join(', ')}`);
        }
      }
      
      // Create backup if required
      let backupPath = null;
      if (envConfig.createBackup) {
        this.updateDeploymentStatus(deploymentId, 'creating-backup');
        backupPath = this.createBackup(deploymentConfig);
      }
      
      this.updateDeploymentStatus(deploymentId, 'uploading');
      
      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.updateDeploymentStatus(deploymentId, 'completed');
      
      const deploymentRecord = {
        id: deploymentId,
        environment: deploymentConfig.environment,
        store: deploymentConfig.store,
        packagePath: deploymentConfig.packagePath,
        backupPath: backupPath,
        status: 'completed',
        timestamp: new Date().toISOString(),
        version: deploymentConfig.version
      };
      
      // Update deployment record
      const existingDeployment = this.deployments.find(d => d.id === deploymentId);
      if (existingDeployment) {
        Object.assign(existingDeployment, deploymentRecord);
      }
      
      return {
        success: true,
        deploymentId: deploymentId,
        backupPath: backupPath,
        ...deploymentRecord
      };
      
    } catch (error) {
      this.updateDeploymentStatus(deploymentId, 'failed');
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }
  
  /**
   * Get deployment statistics
   * @returns {Object} - Deployment statistics
   */
  getDeploymentStats() {
    const stats = {
      total: this.deployments.length,
      byStatus: {},
      byEnvironment: {},
      successRate: 0
    };
    
    let successCount = 0;
    
    for (const deployment of this.deployments) {
      // Count by status
      stats.byStatus[deployment.status] = (stats.byStatus[deployment.status] || 0) + 1;
      
      // Count by environment
      if (deployment.environment) {
        stats.byEnvironment[deployment.environment] = (stats.byEnvironment[deployment.environment] || 0) + 1;
      }
      
      // Count successes
      if (deployment.status === 'completed') {
        successCount++;
      }
    }
    
    // Calculate success rate
    if (stats.total > 0) {
      stats.successRate = Math.round((successCount / stats.total) * 100);
    }
    
    return stats;
  }
}