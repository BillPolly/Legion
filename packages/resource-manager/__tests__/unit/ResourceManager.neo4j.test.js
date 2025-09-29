/**
 * Unit tests for ResourceManager Neo4j integration
 * Tests the getNeo4jServer() method that provides Neo4j server handles
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';
import { execSync } from 'child_process';

// Mock child_process for Docker commands
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

// Mock node-fetch for connection testing
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

describe('ResourceManager Neo4j Integration', () => {
  let resourceManager;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset singleton instance for testing
    ResourceManager._instance = null;
    ResourceManager._initPromise = null;
    
    // Set test environment
    process.env = { 
      ...originalEnv,
      JEST_WORKER_ID: '1',
      NODE_ENV: 'test'
    };
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    
    // Clean up ResourceManager singleton
    if (ResourceManager._instance) {
      ResourceManager._instance = null;
      ResourceManager._initPromise = null;
    }
  });

  describe('getNeo4jServer()', () => {
    it('should create getNeo4jServer method on ResourceManager', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      expect(typeof resourceManager.getNeo4jServer).toBe('function');
    });

    it('should return Neo4j server handle with connection details', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      // Mock Docker commands to simulate Neo4j running
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return 'legion-neo4j\n';
        }
        if (command.includes('docker inspect')) {
          return JSON.stringify([{
            State: { Running: true },
            NetworkSettings: { IPAddress: '172.17.0.2' }
          }]);
        }
        return '';
      });

      const neo4jServer = await resourceManager.getNeo4jServer();
      
      expect(neo4jServer).toBeDefined();
      expect(neo4jServer).toHaveProperty('uri');
      expect(neo4jServer).toHaveProperty('user');
      expect(neo4jServer).toHaveProperty('password');
      expect(neo4jServer).toHaveProperty('database');
      
      // Default values
      expect(neo4jServer.uri).toMatch(/bolt:\/\//);
      expect(neo4jServer.user).toBe('neo4j');
      expect(neo4jServer.database).toBe('neo4j');
    });

    it('should use environment variables if provided', async () => {
      // Set environment variables
      process.env.NEO4J_URI = 'bolt://custom:7687';
      process.env.NEO4J_USER = 'custom_user';
      process.env.NEO4J_PASSWORD = 'custom_pass';
      process.env.NEO4J_DATABASE = 'custom_db';
      
      resourceManager = await ResourceManager.getInstance();
      
      // Mock Docker as running
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return 'legion-neo4j\n';
        }
        return '';
      });

      const neo4jServer = await resourceManager.getNeo4jServer();
      
      expect(neo4jServer.uri).toBe('bolt://custom:7687');
      expect(neo4jServer.user).toBe('custom_user');
      expect(neo4jServer.password).toBe('custom_pass');
      expect(neo4jServer.database).toBe('custom_db');
    });

    it('should start Neo4j Docker container if not running', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      let dockerStartCalled = false;
      
      // Mock Docker commands
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format') && command.includes('neo4j')) {
          // First call returns empty (not running)
          if (!dockerStartCalled) {
            return '';
          }
          // After starting, return container name
          return 'legion-neo4j\n';
        }
        if (command.includes('docker ps -a') && command.includes('neo4j')) {
          // No existing container
          return '';
        }
        if (command.includes('docker run') && command.includes('neo4j')) {
          // Starting new container
          dockerStartCalled = true;
          return 'container-id-123';
        }
        if (command.includes('docker ps') && !command.includes('format')) {
          // Docker is running
          return 'CONTAINER ID   IMAGE   COMMAND\n';
        }
        return '';
      });

      // Mock fetch for Neo4j readiness check
      const fetch = (await import('node-fetch')).default;
      fetch.mockResolvedValue({ ok: true });

      const neo4jServer = await resourceManager.getNeo4jServer();
      
      expect(neo4jServer).toBeDefined();
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('docker run'),
        expect.any(Object)
      );
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('neo4j'),
        expect.any(Object)
      );
    });

    it('should restart stopped Neo4j container', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      let containerStarted = false;
      
      // Mock Docker commands
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format') && command.includes('neo4j')) {
          // Not running initially
          if (!containerStarted) {
            return '';
          }
          return 'legion-neo4j\n';
        }
        if (command.includes('docker ps -a') && command.includes('neo4j')) {
          // Container exists but stopped
          return 'legion-neo4j\n';
        }
        if (command.includes('docker start')) {
          containerStarted = true;
          return '';
        }
        if (command.includes('docker ps') && !command.includes('format')) {
          // Docker is running
          return 'CONTAINER ID   IMAGE   COMMAND\n';
        }
        return '';
      });

      // Mock fetch for Neo4j readiness check
      const fetch = (await import('node-fetch')).default;
      fetch.mockResolvedValue({ ok: true });

      const neo4jServer = await resourceManager.getNeo4jServer();
      
      expect(neo4jServer).toBeDefined();
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('docker start'),
        expect.any(Object)
      );
    });

    it('should return same instance on multiple calls (singleton)', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      // Mock Docker as running
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return 'legion-neo4j\n';
        }
        return '';
      });

      const server1 = await resourceManager.getNeo4jServer();
      const server2 = await resourceManager.getNeo4jServer();
      
      expect(server1).toBe(server2);
      
      // Should only check Docker once
      const dockerCheckCalls = execSync.mock.calls.filter(
        call => call[0].includes('docker ps') && call[0].includes('neo4j')
      );
      expect(dockerCheckCalls.length).toBeLessThanOrEqual(2); // Initial check + verify running
    });

    it('should wait for Neo4j to be ready before returning', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      // Mock Docker commands
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return ''; // Not running initially
        }
        if (command.includes('docker ps -a')) {
          return ''; // No existing container
        }
        if (command.includes('docker run')) {
          return 'container-id-123';
        }
        if (command.includes('docker ps') && !command.includes('format')) {
          return 'CONTAINER ID   IMAGE   COMMAND\n';
        }
        return '';
      });

      // Mock fetch to simulate Neo4j becoming ready
      const fetch = (await import('node-fetch')).default;
      let fetchCallCount = 0;
      fetch.mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount < 3) {
          // Not ready initially
          throw new Error('Connection refused');
        }
        // Ready after 3 attempts
        return Promise.resolve({ ok: true });
      });

      const neo4jServer = await resourceManager.getNeo4jServer();
      
      expect(neo4jServer).toBeDefined();
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(':7474'),
        expect.any(Object)
      );
    });

    it('should handle Docker not available gracefully', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      // Mock Docker not available
      execSync.mockImplementation(() => {
        throw new Error('docker: command not found');
      });

      await expect(resourceManager.getNeo4jServer()).rejects.toThrow(
        'Docker is required but not available'
      );
    });

    it('should provide working connection pool', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      // Mock Docker as running
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return 'legion-neo4j\n';
        }
        return '';
      });

      const neo4jServer = await resourceManager.getNeo4jServer();
      
      expect(neo4jServer).toHaveProperty('getConnection');
      expect(typeof neo4jServer.getConnection).toBe('function');
      
      // Should be able to get connections
      const connection1 = neo4jServer.getConnection();
      const connection2 = neo4jServer.getConnection();
      
      expect(connection1).toBeDefined();
      expect(connection2).toBeDefined();
    });

    it('should properly close connections on ResourceManager shutdown', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      // Mock Docker as running
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return 'legion-neo4j\n';
        }
        return '';
      });

      const neo4jServer = await resourceManager.getNeo4jServer();
      const connection = neo4jServer.getConnection();
      
      // Simulate shutdown
      if (resourceManager.shutdown) {
        await resourceManager.shutdown();
      }
      
      // Connection should be closed
      expect(connection.isClosed).toBe(true);
    });
  });

  describe('Neo4j Docker Management', () => {
    it('should detect when Docker is starting up', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      let dockerStarting = true;
      let attempts = 0;
      
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && !command.includes('format')) {
          attempts++;
          if (attempts < 3 && dockerStarting) {
            throw new Error('Cannot connect to Docker daemon');
          }
          dockerStarting = false;
          return 'CONTAINER ID   IMAGE   COMMAND\n';
        }
        if (command.includes('colima start')) {
          return '';
        }
        return '';
      });

      const neo4jServer = await resourceManager.getNeo4jServer();
      
      expect(neo4jServer).toBeDefined();
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('colima start'),
        expect.any(Object)
      );
    });

    it('should create volume mount for Neo4j data persistence', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return ''; // Not running
        }
        if (command.includes('docker ps -a')) {
          return ''; // No existing container
        }
        if (command.includes('docker run')) {
          // Check for volume mount
          expect(command).toContain('-v');
          expect(command).toContain('neo4j_data:/data');
          return 'container-id-123';
        }
        if (command.includes('docker ps') && !command.includes('format')) {
          return 'CONTAINER ID   IMAGE   COMMAND\n';
        }
        return '';
      });

      const fetch = (await import('node-fetch')).default;
      fetch.mockResolvedValue({ ok: true });

      await resourceManager.getNeo4jServer();
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('-v'),
        expect.any(Object)
      );
    });

    it('should expose correct Neo4j ports', async () => {
      resourceManager = await ResourceManager.getInstance();
      
      execSync.mockImplementation((command) => {
        if (command.includes('docker ps') && command.includes('format')) {
          return ''; // Not running
        }
        if (command.includes('docker ps -a')) {
          return ''; // No existing container
        }
        if (command.includes('docker run')) {
          // Check for port mappings
          expect(command).toContain('-p 7474:7474'); // HTTP
          expect(command).toContain('-p 7687:7687'); // Bolt
          return 'container-id-123';
        }
        if (command.includes('docker ps') && !command.includes('format')) {
          return 'CONTAINER ID   IMAGE   COMMAND\n';
        }
        return '';
      });

      const fetch = (await import('node-fetch')).default;
      fetch.mockResolvedValue({ ok: true });

      await resourceManager.getNeo4jServer();
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('7474:7474'),
        expect.any(Object)
      );
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('7687:7687'),
        expect.any(Object)
      );
    });
  });
});