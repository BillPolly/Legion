import { jest } from '@jest/globals';

// Mock dependencies for performance testing
const mockResourceManager = {
  get: jest.fn(),
  register: jest.fn(),
  initialize: jest.fn()
};

const mockDeploymentManager = {
  deploy: jest.fn(),
  updateDeployment: jest.fn(),
  stopDeployment: jest.fn(),
  getDeployment: jest.fn(),
  listDeployments: jest.fn(),
  getDeploymentLogs: jest.fn(),
  initialize: jest.fn()
};

const mockMonitoringSystem = {
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn(),
  getHealth: jest.fn(),
  getMetrics: jest.fn(),
  getLogs: jest.fn()
};

jest.unstable_mockModule('../../src/core/ResourceManager.js', () => ({
  default: jest.fn(() => mockResourceManager)
}));

jest.unstable_mockModule('../../src/DeploymentManager.js', () => ({
  default: jest.fn(() => mockDeploymentManager)
}));

jest.unstable_mockModule('../../src/MonitoringSystem.js', () => ({
  default: jest.fn(() => mockMonitoringSystem)
}));

// Import tools after mocking
const DeployApplicationTool = (await import('../../src/tools/DeployApplicationTool.js')).default;
const ListDeploymentsTool = (await import('../../src/tools/ListDeploymentsTool.js')).default;
const GetDeploymentLogsTool = (await import('../../src/tools/GetDeploymentLogsTool.js')).default;

describe('Performance Tests', () => {
  let deployTool, listTool, logsTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock behavior
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      } else if (key === 'monitoring-system') {
        return mockMonitoringSystem;
      }
      return null;
    });
    
    deployTool = new DeployApplicationTool();
    listTool = new ListDeploymentsTool();
    logsTool = new GetDeploymentLogsTool();
  });

  describe('Concurrent Operations', () => {
    test('should handle 10 concurrent deployments', async () => {
      const startTime = Date.now();
      
      // Setup mock to simulate deployment time
      mockDeploymentManager.deploy.mockImplementation(async (provider, config) => {
        // Simulate 100ms deployment time
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          id: `deploy-${Math.random().toString(36).substr(2, 9)}`,
          name: config.name,
          provider: provider,
          status: 'running',
          url: `http://localhost:${3000 + Math.floor(Math.random() * 1000)}`
        };
      });

      // Create 10 concurrent deployment calls
      const deploymentCalls = Array.from({ length: 10 }, (_, i) => ({
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              name: `concurrent-app-${i}`,
              source: '/test/path',
              environment: { PORT: `${3000 + i}` }
            }
          })
        }
      }));

      // Execute all deployments concurrently
      const results = await Promise.all(
        deploymentCalls.map(call => deployTool.invoke(call))
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All deployments should succeed
      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      
      // Should complete concurrently (much faster than sequential)
      // Sequential would take ~1000ms, concurrent should be ~200ms
      expect(totalTime).toBeLessThan(300);
      
      // Verify all deployments were called
      expect(mockDeploymentManager.deploy).toHaveBeenCalledTimes(10);
      
      console.log(`✓ 10 concurrent deployments completed in ${totalTime}ms`);
    });

    test('should handle large deployment listings efficiently', async () => {
      const deploymentCount = 1000;
      
      // Create mock data for 1000 deployments
      const mockDeployments = Array.from({ length: deploymentCount }, (_, i) => ({
        id: `deploy-${i.toString().padStart(4, '0')}`,
        name: `app-${i}`,
        provider: ['local', 'docker', 'railway'][i % 3],
        status: ['running', 'stopped', 'building'][i % 3],
        url: `http://localhost:${3000 + i}`,
        createdAt: new Date(Date.now() - i * 60000).toISOString() // Spread over time
      }));

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const startTime = Date.now();

      const listCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            format: 'table',
            sortBy: 'createdAt',
            sortOrder: 'desc',
            limit: 50
          })
        }
      };

      const result = await listTool.invoke(listCall);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(50); // Paginated
      expect(result.data.summary.total).toBe(deploymentCount);
      
      // Should handle large datasets efficiently (< 100ms)
      expect(totalTime).toBeLessThan(100);
      
      console.log(`✓ Listed 1000 deployments (showing 50) in ${totalTime}ms`);
    });

    test('should handle concurrent log requests efficiently', async () => {
      const deploymentCount = 20;
      const logLinesPerRequest = 100;
      
      // Setup mock deployment data
      mockDeploymentManager.getDeployment.mockImplementation((id) => {
        return Promise.resolve({
          id: id,
          name: `app-${id}`,
          provider: 'local',
          status: 'running'
        });
      });

      // Setup mock log data
      mockDeploymentManager.getDeploymentLogs.mockImplementation(async (id, options) => {
        // Simulate log retrieval time proportional to lines requested
        const delay = Math.floor(options.lines / 10); // 10ms per 10 lines
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const logs = Array.from({ length: options.lines }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          level: ['info', 'warn', 'error'][i % 3],
          message: `Log message ${i} from ${id}`,
          source: 'app'
        }));

        return {
          success: true,
          logs: logs,
          totalLines: options.lines,
          format: 'structured'
        };
      });

      const startTime = Date.now();

      // Create concurrent log requests
      const logCalls = Array.from({ length: deploymentCount }, (_, i) => ({
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: `deploy-${i}`,
            lines: logLinesPerRequest,
            format: 'structured'
          })
        }
      }));

      // Execute all log requests concurrently
      const results = await Promise.all(
        logCalls.map(call => logsTool.invoke(call))
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      expect(results).toHaveLength(deploymentCount);
      expect(results.every(r => r.success)).toBe(true);
      
      // Each result should have the requested number of logs
      expect(results.every(r => r.data.logs.length === logLinesPerRequest)).toBe(true);
      
      // Should complete concurrently (much faster than sequential)
      // Sequential would take ~2000ms (20 * 100ms), concurrent should be ~200ms
      expect(totalTime).toBeLessThan(400);
      
      console.log(`✓ ${deploymentCount} concurrent log requests (${logLinesPerRequest} lines each) completed in ${totalTime}ms`);
    });
  });

  describe('Memory Usage', () => {
    test('should handle large log datasets without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Setup deployment
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: 'large-app',
        provider: 'local',
        status: 'running'
      });

      // Generate large log dataset (10,000 lines)
      const largeLogCount = 10000;
      const largeLogs = Array.from({ length: largeLogCount }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        level: 'info',
        message: `This is a log message ${i} with some content to make it realistic. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
        source: 'app'
      }));

      mockDeploymentManager.getDeploymentLogs.mockResolvedValue({
        success: true,
        logs: largeLogs,
        totalLines: largeLogCount,
        format: 'structured'
      });

      const logCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'large-app',
            lines: largeLogCount,
            format: 'structured'
          })
        }
      };

      const result = await logsTool.invoke(logCall);

      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(largeLogCount);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (< 50MB for 10k logs)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`✓ Handled ${largeLogCount} logs with ${Math.round(memoryIncrease / 1024 / 1024)}MB memory increase`);
    });

    test('should efficiently handle pagination with large datasets', async () => {
      const totalDeployments = 5000;
      const pageSize = 25;
      const iterations = 10;
      
      // Create large mock dataset
      const allDeployments = Array.from({ length: totalDeployments }, (_, i) => ({
        id: `deploy-${i.toString().padStart(5, '0')}`,
        name: `app-${i}`,
        provider: ['local', 'docker', 'railway'][i % 3],
        status: ['running', 'stopped'][i % 2],
        createdAt: new Date(Date.now() - i * 10000).toISOString()
      }));

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: allDeployments
      });

      const startTime = Date.now();
      const memoryStart = process.memoryUsage().heapUsed;

      // Simulate pagination through dataset
      const results = [];
      for (let i = 0; i < iterations; i++) {
        const offset = i * pageSize;
        
        const listCall = {
          function: {
            name: 'list_deployments',
            arguments: JSON.stringify({
              limit: pageSize,
              offset: offset,
              sortBy: 'createdAt',
              sortOrder: 'desc'
            })
          }
        };

        const result = await listTool.invoke(listCall);
        results.push(result);
        
        expect(result.success).toBe(true);
        expect(result.data.deployments).toHaveLength(pageSize);
        expect(result.data.pagination.offset).toBe(offset);
      }

      const endTime = Date.now();
      const memoryEnd = process.memoryUsage().heapUsed;
      
      const totalTime = endTime - startTime;
      const memoryIncrease = memoryEnd - memoryStart;

      // Should complete quickly even with large dataset
      expect(totalTime).toBeLessThan(200);
      
      // Memory usage should remain reasonable
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // < 10MB
      
      console.log(`✓ Paginated through ${totalDeployments} deployments (${iterations} pages) in ${totalTime}ms`);
      console.log(`✓ Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });
  });

  describe('Response Time Benchmarks', () => {
    test('should meet deployment tool response time requirements', async () => {
      // Setup fast mock response
      mockDeploymentManager.deploy.mockResolvedValue({
        success: true,
        id: 'deploy-123',
        name: 'benchmark-app',
        provider: 'local',
        status: 'running'
      });

      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const deployCall = {
          function: {
            name: 'deploy_application',
            arguments: JSON.stringify({
              provider: 'local',
              config: {
                name: `benchmark-app-${i}`,
                source: '/test/path'
              }
            })
          }
        };

        const result = await deployTool.invoke(deployCall);
        
        const endTime = Date.now();
        times.push(endTime - startTime);
        
        expect(result.success).toBe(true);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Performance requirements
      expect(avgTime).toBeLessThan(10); // Average < 10ms
      expect(maxTime).toBeLessThan(50); // Max < 50ms
      expect(minTime).toBeGreaterThanOrEqual(0); // Sanity check (can be 0 due to timing precision)

      console.log(`✓ Deployment tool performance: avg=${avgTime.toFixed(2)}ms, min=${minTime}ms, max=${maxTime}ms`);
    });

    test('should meet list tool response time requirements', async () => {
      // Setup mock data
      const mockDeployments = Array.from({ length: 100 }, (_, i) => ({
        id: `deploy-${i}`,
        name: `app-${i}`,
        provider: 'local',
        status: 'running',
        createdAt: new Date().toISOString()
      }));

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const listCall = {
          function: {
            name: 'list_deployments',
            arguments: JSON.stringify({
              limit: 20,
              format: 'table'
            })
          }
        };

        const result = await listTool.invoke(listCall);
        
        const endTime = Date.now();
        times.push(endTime - startTime);
        
        expect(result.success).toBe(true);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      // Performance requirements
      expect(avgTime).toBeLessThan(15); // Average < 15ms
      expect(maxTime).toBeLessThan(75); // Max < 75ms

      console.log(`✓ List tool performance: avg=${avgTime.toFixed(2)}ms, max=${maxTime}ms`);
    });
  });

  describe('Stress Testing', () => {
    test('should handle rapid sequential operations', async () => {
      const operationCount = 200;
      const startTime = Date.now();

      // Setup mocks for rapid operations
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: 'stress-test',
        provider: 'local',
        status: 'running'
      });

      mockDeploymentManager.getDeploymentLogs.mockResolvedValue({
        success: true,
        logs: [{ timestamp: new Date().toISOString(), message: 'test' }],
        totalLines: 1
      });

      // Perform rapid sequential log requests
      const results = [];
      for (let i = 0; i < operationCount; i++) {
        const logCall = {
          function: {
            name: 'get_deployment_logs',
            arguments: JSON.stringify({
              deploymentId: 'stress-test',
              lines: 1
            })
          }
        };

        const result = await logsTool.invoke(logCall);
        results.push(result);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const operationsPerSecond = Math.round((operationCount / totalTime) * 1000);

      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Should maintain reasonable throughput
      expect(operationsPerSecond).toBeGreaterThan(500); // > 500 ops/sec
      
      console.log(`✓ Stress test: ${operationCount} operations in ${totalTime}ms (${operationsPerSecond} ops/sec)`);
    });
  });
});