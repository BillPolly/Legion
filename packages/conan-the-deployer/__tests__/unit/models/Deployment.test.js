import Deployment from '../../../src/models/Deployment.js';
import { DeploymentStatus } from '../../../src/models/DeploymentStatus.js';

describe('Deployment Model', () => {
  describe('Constructor', () => {
    test('should create deployment with required fields', () => {
      const deployment = new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'local',
        projectPath: '/path/to/project'
      });

      expect(deployment.id).toBe('dep-123');
      expect(deployment.name).toBe('my-app');
      expect(deployment.provider).toBe('local');
      expect(deployment.projectPath).toBe('/path/to/project');
      expect(deployment.status).toBe(DeploymentStatus.PENDING);
      expect(deployment.createdAt).toBeInstanceOf(Date);
    });

    test('should accept optional fields', () => {
      const config = { port: 3000, env: { NODE_ENV: 'production' } };
      const deployment = new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'docker',
        projectPath: '/path/to/project',
        status: DeploymentStatus.RUNNING,
        url: 'http://localhost:3000',
        port: 3000,
        config,
        metadata: { version: '1.0.0' }
      });

      expect(deployment.status).toBe(DeploymentStatus.RUNNING);
      expect(deployment.url).toBe('http://localhost:3000');
      expect(deployment.port).toBe(3000);
      expect(deployment.config).toEqual(config);
      expect(deployment.metadata).toEqual({ version: '1.0.0' });
    });

    test('should throw error for missing required fields', () => {
      expect(() => new Deployment({})).toThrow('Missing required field: id');
      expect(() => new Deployment({ id: '123' })).toThrow('Missing required field: name');
      expect(() => new Deployment({ id: '123', name: 'app' })).toThrow('Missing required field: provider');
      expect(() => new Deployment({ id: '123', name: 'app', provider: 'local' }))
        .toThrow('Missing required field: projectPath');
    });

    test('should validate provider type', () => {
      expect(() => new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'invalid',
        projectPath: '/path'
      })).toThrow('Invalid provider: invalid');
    });
  });

  describe('Status Management', () => {
    let deployment;

    beforeEach(() => {
      deployment = new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'local',
        projectPath: '/path/to/project'
      });
    });

    test('should update status with valid transition', () => {
      expect(deployment.status).toBe(DeploymentStatus.PENDING);
      
      deployment.updateStatus(DeploymentStatus.DEPLOYING);
      expect(deployment.status).toBe(DeploymentStatus.DEPLOYING);
      expect(deployment.updatedAt).toBeInstanceOf(Date);
      
      deployment.updateStatus(DeploymentStatus.RUNNING);
      expect(deployment.status).toBe(DeploymentStatus.RUNNING);
    });

    test('should throw error for invalid status transition', () => {
      deployment.updateStatus(DeploymentStatus.DEPLOYING);
      expect(() => deployment.updateStatus(DeploymentStatus.PENDING))
        .toThrow('Invalid status transition: DEPLOYING -> PENDING');
    });

    test('should allow force status update', () => {
      deployment.updateStatus(DeploymentStatus.DEPLOYING);
      deployment.updateStatus(DeploymentStatus.RUNNING);
      deployment.updateStatus(DeploymentStatus.PENDING, true); // force
      expect(deployment.status).toBe(DeploymentStatus.PENDING);
    });

    test('should track status history', () => {
      deployment.updateStatus(DeploymentStatus.DEPLOYING);
      deployment.updateStatus(DeploymentStatus.RUNNING);
      
      const history = deployment.getStatusHistory();
      expect(history).toHaveLength(3); // PENDING, DEPLOYING, RUNNING
      expect(history[0].status).toBe(DeploymentStatus.PENDING);
      expect(history[1].status).toBe(DeploymentStatus.DEPLOYING);
      expect(history[2].status).toBe(DeploymentStatus.RUNNING);
    });
  });

  describe('Serialization', () => {
    test('should convert to JSON', () => {
      const deployment = new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'local',
        projectPath: '/path/to/project',
        config: { port: 3000 }
      });

      const json = deployment.toJSON();
      expect(json).toHaveProperty('id', 'dep-123');
      expect(json).toHaveProperty('name', 'my-app');
      expect(json).toHaveProperty('provider', 'local');
      expect(json).toHaveProperty('projectPath', '/path/to/project');
      expect(json).toHaveProperty('status', DeploymentStatus.PENDING);
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('config');
    });

    test('should create from JSON', () => {
      const json = {
        id: 'dep-123',
        name: 'my-app',
        provider: 'docker',
        projectPath: '/path/to/project',
        status: DeploymentStatus.RUNNING,
        createdAt: new Date().toISOString(),
        config: { port: 8080 }
      };

      const deployment = Deployment.fromJSON(json);
      expect(deployment).toBeInstanceOf(Deployment);
      expect(deployment.id).toBe('dep-123');
      expect(deployment.status).toBe(DeploymentStatus.RUNNING);
      expect(deployment.config.port).toBe(8080);
    });
  });

  describe('Helpers', () => {
    test('should check if deployment is running', () => {
      const deployment = new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'local',
        projectPath: '/path'
      });

      expect(deployment.isRunning()).toBe(false);
      
      deployment.updateStatus(DeploymentStatus.DEPLOYING);
      expect(deployment.isRunning()).toBe(false);
      
      deployment.updateStatus(DeploymentStatus.RUNNING);
      expect(deployment.isRunning()).toBe(true);
      
      deployment.updateStatus(DeploymentStatus.STOPPING);
      deployment.updateStatus(DeploymentStatus.STOPPED);
      expect(deployment.isRunning()).toBe(false);
    });

    test('should check if deployment has failed', () => {
      const deployment = new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'local',
        projectPath: '/path'
      });

      expect(deployment.hasFailed()).toBe(false);
      
      deployment.updateStatus(DeploymentStatus.DEPLOYING);
      deployment.updateStatus(DeploymentStatus.FAILED, true);
      expect(deployment.hasFailed()).toBe(true);
    });

    test('should calculate uptime', () => {
      const deployment = new Deployment({
        id: 'dep-123',
        name: 'my-app',
        provider: 'local',
        projectPath: '/path'
      });

      expect(deployment.getUptime()).toBe(0);
      
      deployment.updateStatus(DeploymentStatus.DEPLOYING);
      deployment.updateStatus(DeploymentStatus.RUNNING);
      
      // Mock time passage
      const startTime = deployment.startedAt;
      deployment.startedAt = new Date(Date.now() - 3600000); // 1 hour ago
      
      const uptime = deployment.getUptime();
      expect(uptime).toBeGreaterThan(3590000); // Close to 1 hour
      expect(uptime).toBeLessThan(3610000);
    });
  });
});