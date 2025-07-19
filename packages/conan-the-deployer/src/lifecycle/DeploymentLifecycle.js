import { EventEmitter } from 'events';
import ProjectValidator from '../validation/ProjectValidator.js';

/**
 * DeploymentLifecycle - Manages deployment lifecycle with hooks and validation
 */
class DeploymentLifecycle extends EventEmitter {
  constructor() {
    super();
    this.hooks = new Map();
    this.deploymentHistory = new Map();
    this.validator = new ProjectValidator();
    
    // Initialize hook types
    const hookTypes = [
      'pre-deploy', 'post-deploy', 'pre-update', 'post-update',
      'pre-rollback', 'post-rollback', 'cleanup', 'validation'
    ];
    
    hookTypes.forEach(type => {
      this.hooks.set(type, []);
    });
  }

  /**
   * Add a hook for a specific lifecycle event
   */
  addHook(type, hook) {
    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }
    this.hooks.get(type).push(hook);
  }

  /**
   * Remove a hook
   */
  removeHook(type, hook) {
    const hooks = this.hooks.get(type);
    if (hooks) {
      const index = hooks.indexOf(hook);
      if (index > -1) {
        hooks.splice(index, 1);
      }
    }
  }

  /**
   * Execute hooks for a specific type
   */
  async executeHooks(type, context) {
    const hooks = this.hooks.get(type) || [];
    const results = [];
    const errors = [];

    for (const hook of hooks) {
      try {
        const result = await hook(context);
        results.push(result);
      } catch (error) {
        errors.push(error);
        this.emit('hook:error', { type, hook, error, context });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }

  /**
   * Execute complete deployment lifecycle
   */
  async executeDeployment(config, provider) {
    const context = {
      config,
      operation: 'deploy',
      startTime: new Date()
    };

    try {
      // Emit start event
      this.emit('lifecycle:start', context);

      // 1. Validation phase
      this.emit('lifecycle:validation', context);
      const validationResult = await this.validator.validateProject(config.projectPath);
      context.validation = validationResult;

      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          context
        };
      }

      // Execute validation hooks
      const validationHooks = await this.executeHooks('validation', context);
      if (!validationHooks.success) {
        return {
          success: false,
          errors: validationHooks.errors.map(e => e.message),
          context
        };
      }

      // 2. Pre-deployment hooks
      const preDeployHooks = await this.executeHooks('pre-deploy', context);
      if (!preDeployHooks.success) {
        return {
          success: false,
          errors: preDeployHooks.errors.map(e => e.message),
          context
        };
      }

      // 3. Deployment phase
      this.emit('lifecycle:deploy', context);
      let deployment;
      
      try {
        deployment = await provider.deploy(config);
        context.deployment = deployment;
        
        // Add to deployment history
        this.addDeploymentHistory(deployment.id, {
          version: config.version || 'latest',
          timestamp: new Date(),
          config: { ...config }
        });

      } catch (deployError) {
        context.error = deployError;
        
        // Execute cleanup hooks on deployment failure
        await this.executeHooks('cleanup', context);
        
        // Still execute post-deploy hooks for cleanup/notification
        await this.executeHooks('post-deploy', context);
        
        return {
          success: false,
          errors: [deployError.message],
          context
        };
      }

      // 4. Post-deployment hooks (verification, health checks, etc.)
      const postDeployHooks = await this.executeHooks('post-deploy', context);
      
      // If post-deploy hooks fail, we still have a deployment but with issues
      if (!postDeployHooks.success) {
        context.error = new Error('Post-deployment verification failed');
        await this.executeHooks('cleanup', context);
        
        return {
          success: false,
          deployment,
          errors: postDeployHooks.errors.map(e => e.message),
          warnings: ['Deployment completed but post-deployment checks failed'],
          context
        };
      }

      // 5. Complete
      this.emit('lifecycle:complete', context);

      return {
        success: true,
        deployment,
        validation: validationResult,
        context
      };

    } catch (error) {
      context.error = error;
      await this.executeHooks('cleanup', context);
      
      return {
        success: false,
        errors: [error.message],
        context
      };
    }
  }

  /**
   * Execute update lifecycle
   */
  async executeUpdate(deploymentId, updateConfig, provider) {
    const context = {
      deploymentId,
      config: updateConfig,
      operation: 'update',
      startTime: new Date()
    };

    try {
      // 1. Pre-update hooks
      const preUpdateHooks = await this.executeHooks('pre-update', context);
      if (!preUpdateHooks.success) {
        return {
          success: false,
          errors: preUpdateHooks.errors.map(e => e.message),
          context
        };
      }

      // 2. Update execution
      let updateResult;
      try {
        updateResult = await provider.update(deploymentId, updateConfig);
        context.result = updateResult;

        // Add to deployment history
        this.addDeploymentHistory(deploymentId, {
          version: updateConfig.version || 'updated',
          timestamp: new Date(),
          config: { ...updateConfig },
          operation: 'update'
        });

      } catch (updateError) {
        context.error = updateError;
        
        // Check if rollback is needed
        const status = await provider.getStatus(deploymentId);
        if (status.status === 'failed') {
          await this.executeHooks('rollback', context);
        }
        
        return {
          success: false,
          errors: [updateError.message],
          context
        };
      }

      // 3. Post-update hooks
      const postUpdateHooks = await this.executeHooks('post-update', context);

      return {
        success: postUpdateHooks.success,
        result: updateResult,
        errors: postUpdateHooks.errors.map(e => e.message),
        context
      };

    } catch (error) {
      context.error = error;
      return {
        success: false,
        errors: [error.message],
        context
      };
    }
  }

  /**
   * Execute rollback lifecycle
   */
  async executeRollback(deploymentId, rollbackConfig, provider) {
    const context = {
      deploymentId,
      config: rollbackConfig,
      operation: 'rollback',
      startTime: new Date()
    };

    try {
      // 1. Pre-rollback hooks
      const preRollbackHooks = await this.executeHooks('pre-rollback', context);
      if (!preRollbackHooks.success) {
        return {
          success: false,
          errors: preRollbackHooks.errors.map(e => e.message),
          context
        };
      }

      // 2. Get previous version if not specified
      if (!rollbackConfig.version) {
        const previous = this.getPreviousVersion(deploymentId);
        if (previous) {
          rollbackConfig = { ...previous.config, version: previous.version };
          context.config = rollbackConfig;
        }
      }

      // 3. Execute rollback (as an update operation)
      const rollbackResult = await provider.update(deploymentId, rollbackConfig);
      context.result = rollbackResult;

      // 4. Post-rollback hooks
      const postRollbackHooks = await this.executeHooks('post-rollback', context);

      return {
        success: postRollbackHooks.success,
        result: rollbackResult,
        errors: postRollbackHooks.errors.map(e => e.message),
        context
      };

    } catch (error) {
      context.error = error;
      return {
        success: false,
        errors: [error.message],
        context
      };
    }
  }

  /**
   * Add deployment to history
   */
  addDeploymentHistory(deploymentId, historyEntry) {
    if (!this.deploymentHistory.has(deploymentId)) {
      this.deploymentHistory.set(deploymentId, []);
    }
    
    const history = this.deploymentHistory.get(deploymentId);
    history.push({
      ...historyEntry,
      timestamp: historyEntry.timestamp || new Date()
    });

    // Keep only last 10 entries
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Get deployment history
   */
  getDeploymentHistory(deploymentId) {
    return this.deploymentHistory.get(deploymentId) || [];
  }

  /**
   * Get previous version for rollback
   */
  getPreviousVersion(deploymentId) {
    const history = this.getDeploymentHistory(deploymentId);
    if (history.length < 2) {
      return null;
    }
    
    // Return second-to-last entry (previous version)
    return history[history.length - 2];
  }

  /**
   * Clear deployment history
   */
  clearDeploymentHistory(deploymentId) {
    this.deploymentHistory.delete(deploymentId);
  }

  /**
   * Get all hooks for a type
   */
  getHooks(type) {
    return this.hooks.get(type) || [];
  }

  /**
   * Clear all hooks for a type
   */
  clearHooks(type) {
    this.hooks.set(type, []);
  }

  /**
   * Register default hooks for common scenarios
   */
  registerDefaultHooks() {
    // Health check hook
    this.addHook('post-deploy', async (context) => {
      if (context.deployment && context.deployment.url) {
        try {
          const healthUrl = `${context.deployment.url}/health`;
          const response = await fetch(healthUrl, {
            signal: AbortSignal.timeout(5000)
          });
          
          return {
            type: 'health-check',
            healthy: response.ok,
            status: response.status,
            url: healthUrl
          };
        } catch (error) {
          return {
            type: 'health-check',
            healthy: false,
            error: error.message
          };
        }
      }
    });

    // Readiness check hook
    this.addHook('post-deploy', async (context) => {
      if (context.deployment) {
        let attempts = 0;
        const maxAttempts = 30;
        const checkInterval = 2000; // 2 seconds

        while (attempts < maxAttempts) {
          try {
            // This would need the provider passed in context
            // For now, just simulate readiness check
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            attempts++;
            
            // In real implementation, would check actual deployment status
            if (attempts >= 3) { // Simulate becoming ready after 6 seconds
              return {
                type: 'readiness-check',
                ready: true,
                attempts
              };
            }
          } catch (error) {
            attempts++;
          }
        }

        return {
          type: 'readiness-check',
          ready: false,
          attempts,
          timeout: true
        };
      }
    });

    // Cleanup hook for failed deployments
    this.addHook('cleanup', async (context) => {
      if (context.deployment && context.error) {
        // Log cleanup action
        return {
          type: 'cleanup',
          action: 'logged-failure',
          deploymentId: context.deployment.id,
          error: context.error.message
        };
      }
    });
  }
}

export default DeploymentLifecycle;