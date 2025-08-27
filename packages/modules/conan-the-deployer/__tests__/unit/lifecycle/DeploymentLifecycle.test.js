import { jest } from '@jest/globals';

// Mock dependencies
const mockValidator = {
  validateProject: jest.fn()
};

const mockProvider = {
  deploy: jest.fn(),
  update: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn()
};

jest.unstable_mockModule('../../../src/validation/ProjectValidator.js', () => ({
  default: jest.fn(() => mockValidator)
}));

// Import after mocking
const DeploymentLifecycle = (await import('../../../src/lifecycle/DeploymentLifecycle.js')).default;

describe('DeploymentLifecycle', () => {
  let lifecycle;

  beforeEach(() => {
    jest.clearAllMocks();
    lifecycle = new DeploymentLifecycle();
  });

  describe('Hook System', () => {
    test('should register pre-deployment hooks', () => {
      const hook = jest.fn();
      lifecycle.addHook('pre-deploy', hook);

      expect(lifecycle.hooks.get('pre-deploy')).toContain(hook);
    });

    test('should register post-deployment hooks', () => {
      const hook = jest.fn();
      lifecycle.addHook('post-deploy', hook);

      expect(lifecycle.hooks.get('post-deploy')).toContain(hook);
    });

    test('should execute hooks in registration order', async () => {
      const executionOrder = [];
      const hook1 = jest.fn(() => executionOrder.push('hook1'));
      const hook2 = jest.fn(() => executionOrder.push('hook2'));
      const hook3 = jest.fn(() => executionOrder.push('hook3'));

      lifecycle.addHook('pre-deploy', hook1);
      lifecycle.addHook('pre-deploy', hook2);
      lifecycle.addHook('pre-deploy', hook3);

      await lifecycle.executeHooks('pre-deploy', { deployment: 'test' });

      expect(executionOrder).toEqual(['hook1', 'hook2', 'hook3']);
    });

    test('should pass context to hooks', async () => {
      const hook = jest.fn();
      const context = { deploymentId: 'test-123', config: { name: 'test-app' } };

      lifecycle.addHook('pre-deploy', hook);
      await lifecycle.executeHooks('pre-deploy', context);

      expect(hook).toHaveBeenCalledWith(context);
    });

    test('should handle hook errors gracefully', async () => {
      const failingHook = jest.fn(() => { throw new Error('Hook failed'); });
      const successHook = jest.fn();

      lifecycle.addHook('pre-deploy', failingHook);
      lifecycle.addHook('pre-deploy', successHook);

      const result = await lifecycle.executeHooks('pre-deploy', {});

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Hook failed');
      expect(successHook).toHaveBeenCalled(); // Should continue executing other hooks
    });

    test('should support async hooks', async () => {
      const asyncHook = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });

      lifecycle.addHook('pre-deploy', asyncHook);
      const result = await lifecycle.executeHooks('pre-deploy', {});

      expect(result.success).toBe(true);
      expect(asyncHook).toHaveBeenCalled();
    });
  });

  describe('Deployment Execution Flow', () => {
    test('should execute complete deployment lifecycle', async () => {
      const config = {
        name: 'test-app',
        projectPath: '/test/project',
        provider: 'local'
      };

      // Mock validation
      mockValidator.validateProject.mockResolvedValue({
        valid: true,
        projectInfo: { name: 'test-app' },
        recommendations: []
      });

      // Mock deployment
      mockProvider.deploy.mockResolvedValue({
        id: 'deploy-123',
        status: 'running',
        url: 'http://localhost:3000'
      });

      // Add lifecycle hooks
      const preDeployHook = jest.fn();
      const postDeployHook = jest.fn();
      lifecycle.addHook('pre-deploy', preDeployHook);
      lifecycle.addHook('post-deploy', postDeployHook);

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(true);
      expect(result.deployment.id).toBe('deploy-123');
      expect(preDeployHook).toHaveBeenCalled();
      expect(postDeployHook).toHaveBeenCalled();
      expect(mockValidator.validateProject).toHaveBeenCalledWith('/test/project');
      expect(mockProvider.deploy).toHaveBeenCalled();
    });

    test('should abort deployment if validation fails', async () => {
      const config = {
        name: 'test-app',
        projectPath: '/test/project'
      };

      mockValidator.validateProject.mockResolvedValue({
        valid: false,
        errors: ['Invalid project structure']
      });

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid project structure');
      expect(mockProvider.deploy).not.toHaveBeenCalled();
    });

    test('should abort deployment if pre-deploy hooks fail', async () => {
      const config = { name: 'test-app', projectPath: '/test/project' };

      mockValidator.validateProject.mockResolvedValue({ valid: true });

      const failingHook = jest.fn(() => { throw new Error('Pre-deploy check failed'); });
      lifecycle.addHook('pre-deploy', failingHook);

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe('Pre-deploy check failed');
      expect(mockProvider.deploy).not.toHaveBeenCalled();
    });

    test('should execute post-deploy hooks even if deployment fails', async () => {
      const config = { name: 'test-app', projectPath: '/test/project' };

      mockValidator.validateProject.mockResolvedValue({ valid: true });
      mockProvider.deploy.mockRejectedValue(new Error('Deployment failed'));

      const postDeployHook = jest.fn();
      lifecycle.addHook('post-deploy', postDeployHook);

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(false);
      expect(postDeployHook).toHaveBeenCalled();
    });
  });

  describe('Update Lifecycle', () => {
    test('should execute update with hooks', async () => {
      const deploymentId = 'deploy-123';
      const updateConfig = { env: { NODE_ENV: 'staging' } };

      mockProvider.update.mockResolvedValue({
        success: true,
        deploymentId,
        strategy: 'rolling'
      });

      const preUpdateHook = jest.fn();
      const postUpdateHook = jest.fn();
      lifecycle.addHook('pre-update', preUpdateHook);
      lifecycle.addHook('post-update', postUpdateHook);

      const result = await lifecycle.executeUpdate(deploymentId, updateConfig, mockProvider);

      expect(result.success).toBe(true);
      expect(preUpdateHook).toHaveBeenCalledWith(expect.objectContaining({
        deploymentId,
        config: updateConfig,
        operation: 'update'
      }));
      expect(postUpdateHook).toHaveBeenCalledWith(expect.objectContaining({
        deploymentId,
        config: updateConfig,
        operation: 'update',
        result: expect.any(Object)
      }));
    });

    test('should support rollback on update failure', async () => {
      const deploymentId = 'deploy-123';
      const updateConfig = { env: { NODE_ENV: 'staging' } };

      mockProvider.update.mockRejectedValue(new Error('Update failed'));
      mockProvider.getStatus.mockResolvedValue({ status: 'failed' });

      const rollbackHook = jest.fn();
      lifecycle.addHook('rollback', rollbackHook);

      const result = await lifecycle.executeUpdate(deploymentId, updateConfig, mockProvider);

      expect(result.success).toBe(false);
      expect(rollbackHook).toHaveBeenCalled();
    });
  });

  describe('Rollback Mechanisms', () => {
    test('should execute rollback lifecycle', async () => {
      const deploymentId = 'deploy-123';
      const rollbackConfig = { version: 'previous' };

      const preRollbackHook = jest.fn();
      const postRollbackHook = jest.fn();
      lifecycle.addHook('pre-rollback', preRollbackHook);
      lifecycle.addHook('post-rollback', postRollbackHook);

      mockProvider.update.mockResolvedValue({
        success: true,
        deploymentId,
        strategy: 'rollback'
      });

      const result = await lifecycle.executeRollback(deploymentId, rollbackConfig, mockProvider);

      expect(result.success).toBe(true);
      expect(preRollbackHook).toHaveBeenCalled();
      expect(postRollbackHook).toHaveBeenCalled();
    });

    test('should maintain rollback history', async () => {
      const deploymentId = 'deploy-123';

      // Simulate deployment history
      lifecycle.addDeploymentHistory(deploymentId, {
        version: 'v1.0.0',
        timestamp: new Date('2024-01-01'),
        config: { env: { NODE_ENV: 'production' } }
      });

      lifecycle.addDeploymentHistory(deploymentId, {
        version: 'v1.1.0',
        timestamp: new Date('2024-01-02'),
        config: { env: { NODE_ENV: 'production', DEBUG: 'true' } }
      });

      const history = lifecycle.getDeploymentHistory(deploymentId);

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe('v1.0.0');
      expect(history[1].version).toBe('v1.1.0');
    });

    test('should get previous deployment version for rollback', async () => {
      const deploymentId = 'deploy-123';

      lifecycle.addDeploymentHistory(deploymentId, {
        version: 'v1.0.0',
        config: { env: { NODE_ENV: 'production' } }
      });

      lifecycle.addDeploymentHistory(deploymentId, {
        version: 'v1.1.0',
        config: { env: { NODE_ENV: 'production', DEBUG: 'true' } }
      });

      const previous = lifecycle.getPreviousVersion(deploymentId);

      expect(previous.version).toBe('v1.0.0');
      expect(previous.config.env.DEBUG).toBeUndefined();
    });
  });

  describe('Health Check Integration', () => {
    test('should perform post-deployment health checks', async () => {
      const config = { name: 'test-app', projectPath: '/test/project' };

      mockValidator.validateProject.mockResolvedValue({ valid: true });
      mockProvider.deploy.mockResolvedValue({
        id: 'deploy-123',
        status: 'running',
        url: 'http://localhost:3000'
      });

      // Mock health check
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const healthCheckHook = jest.fn(async (context) => {
        const response = await fetch(`${context.deployment.url}/health`);
        return { healthy: response.ok };
      });

      lifecycle.addHook('post-deploy', healthCheckHook);

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(true);
      expect(healthCheckHook).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/health');
    });

    test('should wait for deployment readiness', async () => {
      const config = { name: 'test-app', projectPath: '/test/project' };

      mockValidator.validateProject.mockResolvedValue({ valid: true });
      mockProvider.deploy.mockResolvedValue({
        id: 'deploy-123',
        status: 'running'
      });

      // Simulate deployment taking time to be ready
      mockProvider.getStatus
        .mockResolvedValueOnce({ status: 'starting' })
        .mockResolvedValueOnce({ status: 'starting' })
        .mockResolvedValueOnce({ status: 'running' });

      const readinessHook = jest.fn(async (context) => {
        let attempts = 0;
        let status;
        do {
          status = await mockProvider.getStatus(context.deployment.id);
          attempts++;
        } while (status.status !== 'running' && attempts < 10);
        
        return { ready: status.status === 'running', attempts };
      });

      lifecycle.addHook('post-deploy', readinessHook);

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(true);
      expect(readinessHook).toHaveBeenCalled();
      expect(mockProvider.getStatus).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources on deployment failure', async () => {
      const config = { name: 'test-app', projectPath: '/test/project' };

      mockValidator.validateProject.mockResolvedValue({ valid: true });
      mockProvider.deploy.mockRejectedValue(new Error('Deployment failed'));

      const cleanupHook = jest.fn();
      lifecycle.addHook('cleanup', cleanupHook);

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(false);
      expect(cleanupHook).toHaveBeenCalledWith(expect.objectContaining({
        config,
        error: expect.any(Error),
        operation: 'deploy'
      }));
    });

    test('should cleanup partial deployments', async () => {
      const config = { name: 'test-app', projectPath: '/test/project' };

      mockValidator.validateProject.mockResolvedValue({ valid: true });
      
      // Simulate partial deployment (starts but fails later)
      mockProvider.deploy.mockResolvedValue({
        id: 'deploy-123',
        status: 'starting'
      });

      const verificationHook = jest.fn(() => { 
        throw new Error('Health check failed'); 
      });
      
      const cleanupHook = jest.fn();

      lifecycle.addHook('post-deploy', verificationHook);
      lifecycle.addHook('cleanup', cleanupHook);

      const result = await lifecycle.executeDeployment(config, mockProvider);

      expect(result.success).toBe(false);
      expect(cleanupHook).toHaveBeenCalledWith(expect.objectContaining({
        config,
        deployment: expect.objectContaining({ id: 'deploy-123' }),
        error: expect.any(Error),
        operation: 'deploy'
      }));
    });
  });

  describe('Event Emission', () => {
    test('should emit lifecycle events', async () => {
      const config = { name: 'test-app', projectPath: '/test/project' };

      mockValidator.validateProject.mockResolvedValue({ valid: true });
      mockProvider.deploy.mockResolvedValue({
        id: 'deploy-123',
        status: 'running'
      });

      const events = [];
      lifecycle.on('lifecycle:start', (data) => events.push({ type: 'start', data }));
      lifecycle.on('lifecycle:validation', (data) => events.push({ type: 'validation', data }));
      lifecycle.on('lifecycle:deploy', (data) => events.push({ type: 'deploy', data }));
      lifecycle.on('lifecycle:complete', (data) => events.push({ type: 'complete', data }));

      await lifecycle.executeDeployment(config, mockProvider);

      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('validation');
      expect(events[2].type).toBe('deploy');
      expect(events[3].type).toBe('complete');
    });
  });
});