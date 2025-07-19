import { jest } from '@jest/globals';

// Mock ResourceManager
const mockResourceManager = {
  get: jest.fn(),
  register: jest.fn()
};

// Mock Docker client
const mockDockerClient = {
  listContainers: jest.fn(),
  createContainer: jest.fn(),
  getContainer: jest.fn(),
  buildImage: jest.fn(),
  listImages: jest.fn(),
  getImage: jest.fn(),
  pull: jest.fn()
};

jest.unstable_mockModule('../../../src/core/ResourceManager.js', () => ({
  default: jest.fn(() => mockResourceManager)
}));

// Import after mocking
const DockerProvider = (await import('../../../src/providers/DockerProvider.js')).default;

describe('DockerProvider', () => {
  let dockerProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager to return Docker client
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'docker-client') {
        return mockDockerClient;
      }
      return null;
    });

    dockerProvider = new DockerProvider(mockResourceManager);
  });

  describe('Provider Capabilities', () => {
    test('should declare correct capabilities', () => {
      const capabilities = dockerProvider.getCapabilities();
      
      expect(capabilities.name).toBe('docker');
      expect(capabilities.supports.containerization).toBe(true);
      expect(capabilities.supports.scaling).toBe(true);
      expect(capabilities.supports.networking).toBe(true);
      expect(capabilities.supports.volumes).toBe(true);
    });

    test('should validate deployment configuration', () => {
      const validConfig = {
        name: 'test-app',
        image: 'node:18',
        port: 3000,
        environment: { NODE_ENV: 'production' }
      };

      const result = dockerProvider.validateConfig(validConfig);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid configuration', () => {
      const invalidConfig = {
        name: 'test-app'
        // Missing required image
      };

      const result = dockerProvider.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Either image or dockerfile is required for Docker deployments');
    });
  });

  describe('Docker Image Management', () => {
    test('should build image from Dockerfile', async () => {
      const mockBuildStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate build progress
            callback(Buffer.from('{"stream":"Step 1/5 : FROM node:18\\n"}'));
            callback(Buffer.from('{"stream":"Successfully built abc123\\n"}'));
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockDockerClient.buildImage.mockResolvedValue(mockBuildStream);

      const result = await dockerProvider.buildImage({
        projectPath: '/test/project',
        imageName: 'test-app:latest',
        dockerfile: 'Dockerfile'
      });

      expect(result.success).toBe(true);
      expect(result.imageId).toBe('abc123');
      expect(mockDockerClient.buildImage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          t: 'test-app:latest'
        })
      );
    });

    test('should handle build failures', async () => {
      const mockBuildStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('{"errorDetail":{"message":"Build failed"},"error":"Build failed"}'));
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockDockerClient.buildImage.mockResolvedValue(mockBuildStream);

      const result = await dockerProvider.buildImage({
        projectPath: '/test/project',
        imageName: 'test-app:latest'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Build failed');
    });

    test('should pull image from registry', async () => {
      const mockPullStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('{"status":"Pull complete","id":"abc123"}'));
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockDockerClient.pull.mockResolvedValue(mockPullStream);

      const result = await dockerProvider.pullImage('node:18');

      expect(result.success).toBe(true);
      expect(mockDockerClient.pull).toHaveBeenCalledWith('node:18');
    });

    test('should check if image exists locally', async () => {
      mockDockerClient.getImage.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({
          Id: 'sha256:abc123',
          RepoTags: ['node:18']
        })
      });

      const exists = await dockerProvider.imageExists('node:18');
      expect(exists).toBe(true);
    });

    test('should handle missing image', async () => {
      mockDockerClient.getImage.mockReturnValue({
        inspect: jest.fn().mockRejectedValue(new Error('No such image'))
      });

      const exists = await dockerProvider.imageExists('nonexistent:latest');
      expect(exists).toBe(false);
    });
  });

  describe('Container Lifecycle', () => {
    test('should deploy container successfully', async () => {
      const mockContainer = {
        id: 'container123',
        start: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: {
            Ports: { '3000/tcp': [{ HostPort: '3000' }] },
            IPAddress: '172.17.0.2'
          }
        })
      };

      mockDockerClient.createContainer.mockResolvedValue(mockContainer);
      mockDockerClient.getImage.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: 'image123' })
      });

      const config = {
        name: 'test-app',
        image: 'node:18',
        port: 3000,
        environment: { NODE_ENV: 'production' },
        volumes: ['/host/data:/app/data']
      };

      const result = await dockerProvider.deploy(config);

      expect(result.success).toBe(true);
      expect(result.id).toBe('container123');
      expect(result.status).toBe('running');
      expect(result.url).toBe('http://localhost:3000');
      expect(result.internalIP).toBe('172.17.0.2');

      expect(mockDockerClient.createContainer).toHaveBeenCalledWith({
        Image: 'node:18',
        name: 'test-app',
        Env: ['NODE_ENV=production'],
        ExposedPorts: { '3000/tcp': {} },
        HostConfig: {
          PortBindings: { '3000/tcp': [{ HostPort: '3000' }] },
          Binds: ['/host/data:/app/data']
        }
      });
    });

    test('should handle deployment with auto-generated name', async () => {
      const mockContainer = {
        id: 'container123',
        start: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: {}, IPAddress: '172.17.0.2' }
        })
      };

      mockDockerClient.createContainer.mockResolvedValue(mockContainer);
      mockDockerClient.getImage.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: 'image123' })
      });

      const config = {
        image: 'nginx:latest',
        port: 80
      };

      const result = await dockerProvider.deploy(config);

      expect(result.success).toBe(true);
      expect(mockDockerClient.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^docker-deploy-\d+-\w+$/)
        })
      );
    });

    test('should stop container', async () => {
      const mockContainer = {
        stop: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: false }
        })
      };

      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const result = await dockerProvider.stop('container123');

      expect(result.success).toBe(true);
      expect(mockContainer.stop).toHaveBeenCalled();
    });

    test('should restart container', async () => {
      const mockContainer = {
        restart: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true }
        })
      };

      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const result = await dockerProvider.restart('container123');

      expect(result.success).toBe(true);
      expect(mockContainer.restart).toHaveBeenCalled();
    });

    test('should remove container', async () => {
      const mockContainer = {
        stop: jest.fn().mockResolvedValue(),
        remove: jest.fn().mockResolvedValue(),
        inspect: jest.fn()
          .mockResolvedValueOnce({ State: { Running: true } })
          .mockRejectedValueOnce(new Error('No such container'))
      };

      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const result = await dockerProvider.remove('container123');

      expect(result.success).toBe(true);
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalled();
    });
  });

  describe('Container Status and Monitoring', () => {
    test('should get container status', async () => {
      const mockContainer = {
        inspect: jest.fn().mockResolvedValue({
          State: {
            Running: true,
            StartedAt: '2024-01-01T10:00:00Z',
            FinishedAt: '0001-01-01T00:00:00Z'
          },
          NetworkSettings: {
            Ports: { '3000/tcp': [{ HostPort: '3000' }] },
            IPAddress: '172.17.0.2'
          },
          Config: {
            Image: 'node:18',
            Env: ['NODE_ENV=production']
          }
        })
      };

      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const status = await dockerProvider.getStatus('container123');

      expect(status.status).toBe('running');
      expect(status.image).toBe('node:18');
      expect(status.startedAt).toBe('2024-01-01T10:00:00Z');
      expect(status.ports).toEqual({ '3000/tcp': [{ HostPort: '3000' }] });
    });

    test('should handle stopped container status', async () => {
      const mockContainer = {
        inspect: jest.fn().mockResolvedValue({
          State: {
            Running: false,
            ExitCode: 0,
            FinishedAt: '2024-01-01T11:00:00Z'
          },
          Config: {
            Image: 'node:18',
            Env: []
          },
          NetworkSettings: {
            Ports: {}
          }
        })
      };

      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const status = await dockerProvider.getStatus('container123');

      expect(status.status).toBe('stopped');
      expect(status.exitCode).toBe(0);
    });

    test('should get container logs', async () => {
      const mockLogStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Docker logs include 8-byte header, so we need to add those bytes
            const header = Buffer.alloc(8);
            callback(Buffer.concat([header, Buffer.from('App started on port 3000\n')]));
            callback(Buffer.concat([header, Buffer.from('Ready to accept connections\n')]));
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockContainer = {
        logs: jest.fn().mockResolvedValue(mockLogStream)
      };

      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const logs = await dockerProvider.getLogs('container123', { tail: 100 });

      expect(logs.success).toBe(true);
      expect(logs.logs).toContain('App started on port 3000');
      expect(logs.logs).toContain('Ready to accept connections');
    });
  });

  describe('Container Scaling', () => {
    test('should scale container deployment', async () => {
      // Mock existing containers
      mockDockerClient.listContainers.mockResolvedValue([
        { Id: 'container1', Names: ['/test-app-1'] },
        { Id: 'container2', Names: ['/test-app-2'] }
      ]);

      // Mock container creation for scaling up
      const mockNewContainer = {
        id: 'container3',
        start: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { IPAddress: '172.17.0.4' }
        })
      };

      mockDockerClient.createContainer.mockResolvedValue(mockNewContainer);
      mockDockerClient.getContainer.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({
          Config: { Image: 'node:18', Env: [] },
          HostConfig: { PortBindings: {} },
          Name: '/test-app-1'
        })
      });
      mockDockerClient.getImage.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: 'image123' })
      });

      const result = await dockerProvider.scale('test-app', 3);

      expect(result.success).toBe(true);
      expect(result.instances).toBe(3);
      expect(result.created).toBe(1);
      expect(mockDockerClient.createContainer).toHaveBeenCalledTimes(1);
    });

    test('should scale down container deployment', async () => {
      // Mock existing containers
      const mockContainers = [
        { Id: 'container1', Names: ['/test-app-1'] },
        { Id: 'container2', Names: ['/test-app-2'] },
        { Id: 'container3', Names: ['/test-app-3'] }
      ];

      mockDockerClient.listContainers.mockResolvedValue(mockContainers);

      // Mock container for removal
      const mockContainer = {
        stop: jest.fn().mockResolvedValue(),
        remove: jest.fn().mockResolvedValue()
      };

      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const result = await dockerProvider.scale('test-app', 2);

      expect(result.success).toBe(true);
      expect(result.instances).toBe(2);
      expect(result.removed).toBe(1);
    });
  });

  describe('Update and Rollback', () => {
    test('should update container with new image', async () => {
      const existingContainer = {
        stop: jest.fn().mockResolvedValue(),
        remove: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          Name: '/existing-container',
          Config: {
            Image: 'node:18',
            Env: ['NODE_ENV=production'],
            ExposedPorts: { '3000/tcp': {} }
          },
          HostConfig: {
            PortBindings: { '3000/tcp': [{ HostPort: '3000' }] }
          }
        })
      };

      const newContainer = {
        id: 'newcontainer123',
        start: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { 
            IPAddress: '172.17.0.3',
            Ports: { '3000/tcp': [{ HostPort: '3000' }] }
          }
        })
      };

      mockDockerClient.getContainer.mockReturnValue(existingContainer);
      mockDockerClient.createContainer.mockResolvedValue(newContainer);
      mockDockerClient.getImage.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: 'newimage123' })
      });

      const result = await dockerProvider.update('container123', {
        image: 'node:20'
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('newcontainer123');
      expect(existingContainer.stop).toHaveBeenCalled();
      expect(existingContainer.remove).toHaveBeenCalled();
    });

    test('should rollback to previous image on update failure', async () => {
      const existingContainer = {
        stop: jest.fn().mockResolvedValue(),
        remove: jest.fn().mockResolvedValue(),
        start: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          Name: '/existing-container',
          Config: { Image: 'node:18' },
          HostConfig: {}
        })
      };

      const rollbackContainer = {
        id: 'rollback123',
        start: jest.fn().mockResolvedValue(),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { IPAddress: '172.17.0.2' }
        })
      };

      mockDockerClient.getContainer.mockReturnValue(existingContainer);
      mockDockerClient.createContainer
        .mockRejectedValueOnce(new Error('Failed to create container'))
        .mockResolvedValueOnce(rollbackContainer);
      mockDockerClient.getImage.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: 'image123' })
      });

      const result = await dockerProvider.update('container123', {
        image: 'node:20'
      });

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(result.error).toContain('Failed to create container');
    });
  });

  describe('Network Management', () => {
    test('should create custom network', async () => {
      const mockNetwork = {
        id: 'network123'
      };

      mockDockerClient.createNetwork = jest.fn().mockResolvedValue(mockNetwork);

      const result = await dockerProvider.createNetwork({
        name: 'test-network',
        driver: 'bridge'
      });

      expect(result.success).toBe(true);
      expect(result.networkId).toBe('network123');
    });

    test('should connect container to network', async () => {
      const mockNetwork = {
        connect: jest.fn().mockResolvedValue()
      };

      mockDockerClient.getNetwork = jest.fn().mockReturnValue(mockNetwork);

      const result = await dockerProvider.connectToNetwork('container123', 'network123');

      expect(result.success).toBe(true);
      expect(mockNetwork.connect).toHaveBeenCalledWith({
        Container: 'container123'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle Docker daemon not running', async () => {
      mockDockerClient.listContainers.mockRejectedValue(
        new Error('connect ECONNREFUSED /var/run/docker.sock')
      );

      const result = await dockerProvider.listDeployments();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Docker daemon not available');
    });

    test('should handle container not found', async () => {
      mockDockerClient.getContainer.mockReturnValue({
        inspect: jest.fn().mockRejectedValue(new Error('No such container'))
      });

      const status = await dockerProvider.getStatus('nonexistent');

      expect(status.status).toBe('not_found');
      expect(status.error).toContain('No such container');
    });

    test('should validate resource manager has Docker client', () => {
      mockResourceManager.get.mockReturnValue(null);

      expect(() => {
        new DockerProvider(mockResourceManager);
      }).toThrow('Docker client not available in ResourceManager');
    });
  });

  describe('List Operations', () => {
    test('should list all deployments', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Names: ['/test-app-1'],
          Image: 'node:18',
          State: 'running',
          Status: 'Up 2 hours',
          Ports: [{ PublicPort: 3000, PrivatePort: 3000 }]
        },
        {
          Id: 'container2',
          Names: ['/test-app-2'],
          Image: 'nginx:latest',
          State: 'exited',
          Status: 'Exited (0) 5 minutes ago'
        }
      ];

      mockDockerClient.listContainers.mockResolvedValue(mockContainers);

      const result = await dockerProvider.listDeployments();

      expect(result.success).toBe(true);
      expect(result.deployments).toHaveLength(2);
      expect(result.deployments[0].id).toBe('container1');
      expect(result.deployments[0].name).toBe('test-app-1');
      expect(result.deployments[0].status).toBe('running');
    });

    test('should list available images', async () => {
      const mockImages = [
        {
          Id: 'image1',
          RepoTags: ['node:18', 'node:latest'],
          Size: 1024000000,
          Created: 1640995200
        },
        {
          Id: 'image2',
          RepoTags: ['nginx:latest'],
          Size: 512000000,
          Created: 1640995100
        }
      ];

      mockDockerClient.listImages.mockResolvedValue(mockImages);

      const result = await dockerProvider.listImages();

      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(2);
      expect(result.images[0].tags).toEqual(['node:18', 'node:latest']);
    });
  });
});