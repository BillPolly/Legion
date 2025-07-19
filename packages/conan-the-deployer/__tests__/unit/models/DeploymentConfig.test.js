import DeploymentConfig from '../../../src/models/DeploymentConfig.js';

describe('DeploymentConfig', () => {
  describe('Validation', () => {
    test('should validate minimal config', () => {
      const config = new DeploymentConfig({
        projectPath: '/path/to/project',
        provider: 'local',
        name: 'my-app'
      });

      expect(config.isValid()).toBe(true);
      expect(config.projectPath).toBe('/path/to/project');
      expect(config.provider).toBe('local');
      expect(config.name).toBe('my-app');
    });

    test('should validate full config', () => {
      const config = new DeploymentConfig({
        projectPath: '/path/to/project',
        provider: 'docker',
        name: 'my-app',
        env: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        port: 3000,
        startCommand: 'node server.js',
        buildCommand: 'npm run build',
        healthCheckPath: '/health',
        docker: {
          dockerfile: './Dockerfile',
          buildArgs: { VERSION: '1.0.0' },
          network: 'bridge'
        }
      });

      expect(config.isValid()).toBe(true);
      expect(config.env.NODE_ENV).toBe('production');
      expect(config.docker.dockerfile).toBe('./Dockerfile');
    });

    test('should throw error for missing required fields', () => {
      expect(() => new DeploymentConfig({}))
        .toThrow('Validation failed');

      expect(() => new DeploymentConfig({ projectPath: '/path' }))
        .toThrow('Validation failed');

      expect(() => new DeploymentConfig({ 
        projectPath: '/path',
        provider: 'local'
      })).toThrow('Validation failed');
    });

    test('should validate provider type', () => {
      expect(() => new DeploymentConfig({
        projectPath: '/path',
        provider: 'invalid',
        name: 'app'
      })).toThrow('Validation failed');
    });

    test('should validate port number', () => {
      expect(() => new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        port: 'invalid'
      })).toThrow('Validation failed');

      expect(() => new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        port: -1
      })).toThrow('Validation failed');

      expect(() => new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        port: 70000
      })).toThrow('Validation failed');
    });
  });

  describe('Provider-specific Configuration', () => {
    test('should validate docker config', () => {
      const config = new DeploymentConfig({
        projectPath: '/path',
        provider: 'docker',
        name: 'app',
        docker: {
          dockerfile: 'Dockerfile.prod',
          buildArgs: { NODE_VERSION: '18' },
          network: 'custom-network'
        }
      });

      expect(config.isValid()).toBe(true);
      expect(config.docker.dockerfile).toBe('Dockerfile.prod');
    });

    test('should validate railway config', () => {
      const config = new DeploymentConfig({
        projectPath: '/path',
        provider: 'railway',
        name: 'app',
        railway: {
          projectId: 'proj-123',
          environment: 'production',
          region: 'us-west-2'
        }
      });

      expect(config.isValid()).toBe(true);
      expect(config.railway.projectId).toBe('proj-123');
    });

    test('should not allow invalid provider config', () => {
      expect(() => new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        docker: { dockerfile: 'test' } // Docker config for local provider
      })).toThrow('Docker configuration is only valid for docker provider');
    });
  });

  describe('Environment Variables', () => {
    test('should normalize environment variables', () => {
      const config = new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        env: {
          PORT: 3000, // number
          DEBUG: true, // boolean
          NAME: 'test' // string
        }
      });

      // All values should be strings
      expect(config.env.PORT).toBe('3000');
      expect(config.env.DEBUG).toBe('true');
      expect(config.env.NAME).toBe('test');
    });

    test('should merge with default environment', () => {
      const config = new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        env: {
          CUSTOM: 'value'
        }
      });

      config.mergeDefaults({
        NODE_ENV: 'development',
        PORT: '3000'
      });

      expect(config.env.CUSTOM).toBe('value');
      expect(config.env.NODE_ENV).toBe('development');
      expect(config.env.PORT).toBe('3000');
    });
  });

  describe('Config Merging', () => {
    test('should merge configurations', () => {
      const base = new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        env: { NODE_ENV: 'development' },
        port: 3000
      });

      const updates = {
        env: { NODE_ENV: 'production', NEW_VAR: 'value' },
        port: 8080,
        startCommand: 'node index.js'
      };

      base.merge(updates);

      expect(base.env.NODE_ENV).toBe('production');
      expect(base.env.NEW_VAR).toBe('value');
      expect(base.port).toBe(8080);
      expect(base.startCommand).toBe('node index.js');
    });

    test('should deep merge nested objects', () => {
      const config = new DeploymentConfig({
        projectPath: '/path',
        provider: 'docker',
        name: 'app',
        docker: {
          dockerfile: 'Dockerfile',
          buildArgs: { VERSION: '1.0' }
        }
      });

      config.merge({
        docker: {
          buildArgs: { VERSION: '2.0', NEW_ARG: 'value' },
          network: 'custom'
        }
      });

      expect(config.docker.dockerfile).toBe('Dockerfile');
      expect(config.docker.buildArgs.VERSION).toBe('2.0');
      expect(config.docker.buildArgs.NEW_ARG).toBe('value');
      expect(config.docker.network).toBe('custom');
    });
  });

  describe('Config Export', () => {
    test('should export to plain object', () => {
      const config = new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        env: { TEST: 'value' }
      });

      const exported = config.toObject();
      expect(exported).toEqual({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        env: { TEST: 'value' }
      });
    });

    test('should clone configuration', () => {
      const config = new DeploymentConfig({
        projectPath: '/path',
        provider: 'local',
        name: 'app',
        env: { TEST: 'value' }
      });

      const cloned = config.clone();
      expect(cloned).toBeInstanceOf(DeploymentConfig);
      expect(cloned).not.toBe(config);
      expect(cloned.name).toBe('app');

      // Modifying clone should not affect original
      cloned.env.TEST = 'modified';
      expect(config.env.TEST).toBe('value');
    });
  });
});