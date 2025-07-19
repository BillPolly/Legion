import { jest } from '@jest/globals';
import { Module } from '@jsenvoy/module-loader';
import ConanTheDeployer from '../../src/ConanTheDeployer.js';

describe('ConanTheDeployer', () => {
  let deployer;
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'RAILWAY_API_TOKEN') return 'test-railway-token';
        if (key === 'DOCKER_HOST') return 'unix:///var/run/docker.sock';
        return null;
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Setup', () => {
    test('should extend Module base class', () => {
      deployer = new ConanTheDeployer();
      expect(deployer).toBeInstanceOf(Module);
    });

    test('should have correct module name and description', () => {
      deployer = new ConanTheDeployer();
      expect(deployer.name).toBe('conan-the-deployer');
      expect(deployer.description).toBe('Deploy and monitor Node.js applications across multiple providers');
    });

    test('should initialize with default configuration', () => {
      deployer = new ConanTheDeployer();
      expect(deployer.config).toEqual({
        defaultProvider: 'local',
        monitoringEnabled: true,
        healthCheckInterval: 30000,
        metricsInterval: 60000,
        logBufferSize: 1000
      });
    });

    test('should accept custom configuration', () => {
      const customConfig = {
        defaultProvider: 'docker',
        monitoringEnabled: false,
        healthCheckInterval: 10000
      };
      deployer = new ConanTheDeployer(customConfig);
      expect(deployer.config.defaultProvider).toBe('docker');
      expect(deployer.config.monitoringEnabled).toBe(false);
      expect(deployer.config.healthCheckInterval).toBe(10000);
      expect(deployer.config.metricsInterval).toBe(60000); // default
    });

    test('should initialize providers', () => {
      deployer = new ConanTheDeployer({}, mockResourceManager);
      expect(deployer.providers).toBeDefined();
      expect(deployer.providers.local).toBeDefined();
      expect(deployer.providers.docker).toBeDefined();
      expect(deployer.providers.railway).toBeDefined();
    });

    test('should initialize deployment manager', () => {
      deployer = new ConanTheDeployer();
      expect(deployer.deploymentManager).toBeDefined();
    });

    test('should initialize monitoring system', () => {
      deployer = new ConanTheDeployer();
      expect(deployer.monitoringSystem).toBeDefined();
    });
  });

  describe('Tool Methods', () => {
    beforeEach(() => {
      deployer = new ConanTheDeployer({}, mockResourceManager);
    });

    test('should have deployApplication method', () => {
      expect(typeof deployer.deployApplication).toBe('function');
    });

    test('should have monitorDeployment method', () => {
      expect(typeof deployer.monitorDeployment).toBe('function');
    });

    test('should have updateDeployment method', () => {
      expect(typeof deployer.updateDeployment).toBe('function');
    });

    test('should have listDeployments method', () => {
      expect(typeof deployer.listDeployments).toBe('function');
    });

    test('should have stopDeployment method', () => {
      expect(typeof deployer.stopDeployment).toBe('function');
    });

    test('should have getDeploymentLogs method', () => {
      expect(typeof deployer.getDeploymentLogs).toBe('function');
    });

    test('should have removeDeployment method', () => {
      expect(typeof deployer.removeDeployment).toBe('function');
    });
  });
});