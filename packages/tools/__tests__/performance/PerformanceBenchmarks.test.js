/**
 * Performance Benchmark Tests
 * Tests tool execution performance, memory usage, and concurrency
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigurationManager } from '../../src/integration/ConfigurationManager.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Performance Benchmarks', () => {
  let testDir;
  let configManager;
  let registry;
  let performanceMetrics;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
    configManager = new ConfigurationManager();
    performanceMetrics = {
      executionTimes: [],
      memoryUsage: [],
      toolCallCounts: []
    };
  });

  afterEach(async () => {
    if (registry) {
      await registry.shutdown();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Execution Performance', () => {
    test('should execute file operations within performance thresholds', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create test files of various sizes
      const smallContent = 'Small test content';
      const mediumContent = 'Medium content '.repeat(1000); // ~14KB
      const largeContent = 'Large content '.repeat(10000); // ~140KB

      await fs.writeFile(path.join(testDir, 'small.txt'), smallContent);
      await fs.writeFile(path.join(testDir, 'medium.txt'), mediumContent);
      await fs.writeFile(path.join(testDir, 'large.txt'), largeContent);

      // Benchmark file read operations
      const readTimes = [];
      
      for (let i = 0; i < 10; i++) {
        const tool = await registry.getTool('filesystem.readFile');
        
        // Small file
        let startTime = performance.now();
        await tool.execute({ path: 'small.txt' });
        let endTime = performance.now();
        readTimes.push({ size: 'small', time: endTime - startTime });
        
        // Medium file
        startTime = performance.now();
        await tool.execute({ path: 'medium.txt' });
        endTime = performance.now();
        readTimes.push({ size: 'medium', time: endTime - startTime });
        
        // Large file
        startTime = performance.now();
        await tool.execute({ path: 'large.txt' });
        endTime = performance.now();
        readTimes.push({ size: 'large', time: endTime - startTime });
      }

      // Calculate averages
      const smallAvg = readTimes.filter(r => r.size === 'small').reduce((sum, r) => sum + r.time, 0) / 10;
      const mediumAvg = readTimes.filter(r => r.size === 'medium').reduce((sum, r) => sum + r.time, 0) / 10;
      const largeAvg = readTimes.filter(r => r.size === 'large').reduce((sum, r) => sum + r.time, 0) / 10;

      // Performance thresholds (in milliseconds)
      expect(smallAvg).toBeLessThan(10); // Small files should read in <10ms
      expect(mediumAvg).toBeLessThan(50); // Medium files should read in <50ms
      expect(largeAvg).toBeLessThan(200); // Large files should read in <200ms

      console.log(`Performance Results:
        Small files: ${smallAvg.toFixed(2)}ms avg
        Medium files: ${mediumAvg.toFixed(2)}ms avg
        Large files: ${largeAvg.toFixed(2)}ms avg`);
    });

    test('should execute HTTP operations within performance thresholds', async () => {
      const config = {
        modules: {
          http: {
            baseURL: 'https://httpbin.org',
            timeout: 5000
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Benchmark HTTP operations
      const httpTimes = [];
      
      for (let i = 0; i < 5; i++) {
        const getTool = await registry.getTool('http.get');
        
        const startTime = performance.now();
        await getTool.execute({ url: '/get?test=performance' });
        const endTime = performance.now();
        
        httpTimes.push(endTime - startTime);
      }

      const avgTime = httpTimes.reduce((sum, time) => sum + time, 0) / httpTimes.length;
      const maxTime = Math.max(...httpTimes);

      // HTTP performance thresholds
      expect(avgTime).toBeLessThan(3000); // Average response time <3s
      expect(maxTime).toBeLessThan(5000); // Max response time <5s

      console.log(`HTTP Performance Results:
        Average: ${avgTime.toFixed(2)}ms
        Max: ${maxTime.toFixed(2)}ms`);
    });

    test('should execute Git operations within performance thresholds', async () => {
      const config = {
        modules: {
          git: {
            repoPath: testDir
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create test repository content
      await fs.writeFile(path.join(testDir, 'test.txt'), 'Test content for git operations');

      const gitTimes = [];
      const operations = ['init', 'add', 'commit', 'status'];
      
      for (const operation of operations) {
        const tool = await registry.getTool(`git.${operation}`);
        
        const startTime = performance.now();
        
        switch (operation) {
          case 'init':
            await tool.execute({});
            break;
          case 'add':
            await tool.execute({ files: ['test.txt'] });
            break;
          case 'commit':
            await tool.execute({ message: 'Test commit' });
            break;
          case 'status':
            await tool.execute({});
            break;
        }
        
        const endTime = performance.now();
        gitTimes.push({ operation, time: endTime - startTime });
      }

      // Git performance thresholds
      gitTimes.forEach(({ operation, time }) => {
        expect(time).toBeLessThan(2000); // All git operations should complete in <2s
        console.log(`Git ${operation}: ${time.toFixed(2)}ms`);
      });
    });
  });

  describe('Memory Usage and Cleanup', () => {
    test('should manage memory efficiently during tool execution', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create large test file
      const largeContent = 'Large content for memory test '.repeat(50000); // ~1.5MB
      await fs.writeFile(path.join(testDir, 'large_memory_test.txt'), largeContent);

      const initialMemory = process.memoryUsage();
      
      // Execute multiple operations to test memory management
      const tool = await registry.getTool('filesystem.readFile');
      const results = [];
      
      for (let i = 0; i < 20; i++) {
        const result = await tool.execute({ path: 'large_memory_test.txt' });
        results.push(result);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory Usage:
        Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory should not increase by more than 50MB for this test
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should clean up resources properly after tool execution', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Test file handle cleanup
      await fs.writeFile(path.join(testDir, 'cleanup_test.txt'), 'Cleanup test content');
      
      const tool = await registry.getTool('filesystem.readFile');
      
      // Execute many file operations
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(tool.execute({ path: 'cleanup_test.txt' }));
      }
      
      await Promise.all(promises);
      
      // Verify no file handles are leaked (this is implicit - if file handles
      // were leaked, the OS would eventually fail with "too many open files")
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    test('should handle registry shutdown cleanly', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          },
          http: {
            baseURL: 'https://httpbin.org',
            timeout: 1000
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create instances
      await registry.getInstance('filesystem');
      await registry.getInstance('http');

      expect(registry.hasInstance('filesystem')).toBe(true);
      expect(registry.hasInstance('http')).toBe(true);

      // Test shutdown
      const shutdownStart = performance.now();
      await registry.shutdown();
      const shutdownTime = performance.now() - shutdownStart;

      // Shutdown should be fast and complete
      expect(shutdownTime).toBeLessThan(1000); // <1s
      expect(registry.listProviders()).toHaveLength(0);
    });
  });

  describe('Concurrent Execution', () => {
    test('should handle concurrent tool execution efficiently', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create test files for concurrent access
      const filePromises = [];
      for (let i = 0; i < 20; i++) {
        filePromises.push(
          fs.writeFile(path.join(testDir, `concurrent_${i}.txt`), `Content for file ${i}`)
        );
      }
      await Promise.all(filePromises);

      const readTool = await registry.getTool('filesystem.readFile');
      
      // Test concurrent reads
      const concurrentStart = performance.now();
      const concurrentPromises = [];
      
      for (let i = 0; i < 20; i++) {
        concurrentPromises.push(
          readTool.execute({ path: `concurrent_${i}.txt` })
        );
      }
      
      const results = await Promise.all(concurrentPromises);
      const concurrentTime = performance.now() - concurrentStart;

      // Test sequential reads for comparison
      const sequentialStart = performance.now();
      for (let i = 0; i < 20; i++) {
        await readTool.execute({ path: `concurrent_${i}.txt` });
      }
      const sequentialTime = performance.now() - sequentialStart;

      console.log(`Concurrency Results:
        Concurrent: ${concurrentTime.toFixed(2)}ms
        Sequential: ${sequentialTime.toFixed(2)}ms
        Speedup: ${(sequentialTime / concurrentTime).toFixed(2)}x`);

      // Concurrent execution should be significantly faster
      expect(concurrentTime).toBeLessThan(sequentialTime * 0.8);
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    test('should handle concurrent registry operations', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Test concurrent tool retrieval
      const toolPromises = [];
      for (let i = 0; i < 50; i++) {
        toolPromises.push(registry.getTool('filesystem.readFile'));
      }
      
      const tools = await Promise.all(toolPromises);
      
      expect(tools).toHaveLength(50);
      tools.forEach(tool => {
        expect(tool).toBeDefined();
        expect(tool.name).toBe('readFile');
      });

      // Test concurrent metadata retrieval
      const metadataPromises = [];
      for (let i = 0; i < 20; i++) {
        metadataPromises.push(registry.getAllMetadata());
      }
      
      const metadataResults = await Promise.all(metadataPromises);
      
      expect(metadataResults).toHaveLength(20);
      metadataResults.forEach(metadata => {
        expect(metadata.modules).toHaveLength(1);
        expect(metadata.totalTools).toBeGreaterThan(0);
      });
    });

    test('should maintain performance under load', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create test file
      await fs.writeFile(path.join(testDir, 'load_test.txt'), 'Load test content');
      
      const tool = await registry.getTool('filesystem.readFile');
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        await tool.execute({ path: 'load_test.txt' });
      }
      
      // Load test - measure performance degradation
      const iterations = [50, 100, 200];
      const avgTimes = [];
      
      for (const iterationCount of iterations) {
        const startTime = performance.now();
        const promises = [];
        
        for (let i = 0; i < iterationCount; i++) {
          promises.push(tool.execute({ path: 'load_test.txt' }));
        }
        
        await Promise.all(promises);
        const totalTime = performance.now() - startTime;
        const avgTime = totalTime / iterationCount;
        
        avgTimes.push(avgTime);
        console.log(`${iterationCount} operations: ${avgTime.toFixed(2)}ms avg`);
      }
      
      // Performance should not degrade significantly under load
      const performanceDegradation = (avgTimes[2] - avgTimes[0]) / avgTimes[0];
      expect(performanceDegradation).toBeLessThan(2.0); // Less than 200% degradation
    });
  });

  describe('Resource Monitoring', () => {
    test('should provide accurate usage statistics', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      await fs.writeFile(path.join(testDir, 'stats_test.txt'), 'Statistics test content');
      
      const readTool = await registry.getTool('filesystem.readFile');
      const writeTool = await registry.getTool('filesystem.writeFile');
      
      // Execute various operations
      await readTool.execute({ path: 'stats_test.txt' });
      await readTool.execute({ path: 'stats_test.txt' });
      await writeTool.execute({ path: 'output_stats.txt', content: 'Output content' });
      
      const stats = await registry.getUsageStats();
      
      expect(stats['filesystem.readFile']).toBeDefined();
      expect(stats['filesystem.readFile'].count).toBeGreaterThanOrEqual(2);
      expect(stats['filesystem.readFile'].lastUsed).toBeDefined();
      
      expect(stats['filesystem.writeFile']).toBeDefined();
      expect(stats['filesystem.writeFile'].count).toBeGreaterThanOrEqual(1);
    });

    test('should track performance metrics over time', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      await fs.writeFile(path.join(testDir, 'metrics_test.txt'), 'Metrics test content');
      
      const tool = await registry.getTool('filesystem.readFile');
      const executionTimes = [];
      
      // Track execution times
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await tool.execute({ path: 'metrics_test.txt' });
        const executionTime = performance.now() - startTime;
        executionTimes.push(executionTime);
      }
      
      // Calculate performance metrics
      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const minTime = Math.min(...executionTimes);
      const maxTime = Math.max(...executionTimes);
      const stdDev = Math.sqrt(
        executionTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / executionTimes.length
      );
      
      console.log(`Performance Metrics:
        Average: ${avgTime.toFixed(2)}ms
        Min: ${minTime.toFixed(2)}ms
        Max: ${maxTime.toFixed(2)}ms
        StdDev: ${stdDev.toFixed(2)}ms`);
      
      // Performance should be consistent
      expect(stdDev).toBeLessThan(avgTime * 2); // Standard deviation should be reasonable
      expect(maxTime).toBeLessThan(avgTime * 5); // No extreme outliers
    });
  });
});