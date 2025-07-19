/**
 * Git Performance and Scalability Integration Tests
 * Phase 6.3: Performance testing and scalability validation
 * 
 * Tests the performance characteristics of Git operations including
 * large repositories, batch operations, and concurrent access.
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { CodeAgent } from '../../src/agent/CodeAgent.js';
import { EnhancedCodeAgent } from '../../src/agent/EnhancedCodeAgent.js';
import GitConfigValidator from '../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Git Performance and Scalability Tests', () => {
  let resourceManager;
  let tempDir;
  let codeAgent;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test environment variables
    resourceManager.register('GITHUB_USER', process.env.GITHUB_USER || 'TestUser');
    resourceManager.register('GITHUB_PAT', process.env.GITHUB_PAT || 'test_token');
    resourceManager.register('GITHUB_AGENT_ORG', process.env.GITHUB_AGENT_ORG || 'TestOrg');
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-perf-test-'));
  });

  afterEach(async () => {
    if (codeAgent) {
      await codeAgent.cleanup();
      codeAgent = null;
    }
    
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error.message);
      }
    }
  });

  test('should handle large file operations efficiently', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        user: {
          name: 'Performance Test',
          email: 'perf@codeagent.dev'
        }
      }
    };

    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    const startTime = Date.now();
    const fileCount = 100;
    const fileSizeKB = 10; // 10KB per file

    // Create many files
    const files = [];
    for (let i = 0; i < fileCount; i++) {
      const fileName = `large-file-${i}.js`;
      const content = '// Large file content\n'.repeat(fileSizeKB * 10); // Approximate KB
      
      await fs.writeFile(path.join(tempDir, fileName), content);
      await codeAgent.trackFile(fileName);
      files.push(fileName);
    }

    const creationTime = Date.now() - startTime;
    console.log(`📊 Created ${fileCount} files in ${creationTime}ms`);

    // Commit all files in batch
    const commitStartTime = Date.now();
    const result = await codeAgent.commitPhase('generation', files, `Add ${fileCount} large files`);
    const commitTime = Date.now() - commitStartTime;

    expect(result.success).toBe(true);
    console.log(`📊 Committed ${fileCount} files in ${commitTime}ms`);

    // Performance expectations
    expect(creationTime).toBeLessThan(10000); // Should complete within 10 seconds
    expect(commitTime).toBeLessThan(15000); // Commit should complete within 15 seconds

    // Get metrics
    const metrics = await codeAgent.getGitMetrics();
    expect(metrics.totalCommits).toBe(1);
    expect(metrics.averageCommitSize).toBe(fileCount);

    console.log('✅ Large file operations performance test passed');
  });

  test('should handle rapid sequential commits efficiently', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        autoCommit: true,
        user: {
          name: 'Sequential Test',
          email: 'sequential@codeagent.dev'
        }
      }
    };

    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    const commitCount = 50;
    const startTime = Date.now();

    // Perform rapid sequential commits
    for (let i = 0; i < commitCount; i++) {
      const fileName = `sequential-${i}.js`;
      const content = `// Sequential file ${i}\nexport const value${i} = ${i};`;
      
      await fs.writeFile(path.join(tempDir, fileName), content);
      await codeAgent.trackFile(fileName);
      
      const result = await codeAgent.commitPhase('generation', [fileName], `Add sequential file ${i}`);
      expect(result.success).toBe(true);
    }

    const totalTime = Date.now() - startTime;
    const avgTimePerCommit = totalTime / commitCount;

    console.log(`📊 Completed ${commitCount} sequential commits in ${totalTime}ms`);
    console.log(`📊 Average time per commit: ${avgTimePerCommit.toFixed(2)}ms`);

    // Performance expectations
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
    expect(avgTimePerCommit).toBeLessThan(600); // Average commit should be under 600ms

    // Verify all commits were made
    const metrics = await codeAgent.getGitMetrics();
    expect(metrics.totalCommits).toBe(commitCount);

    console.log('✅ Sequential commits performance test passed');
  });

  test('should handle concurrent Git operations', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        user: {
          name: 'Concurrent Test',
          email: 'concurrent@codeagent.dev'
        }
      }
    };

    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    const concurrentOperations = 10;
    const startTime = Date.now();

    // Perform concurrent file operations
    const operations = Array.from({ length: concurrentOperations }, async (_, i) => {
      const fileName = `concurrent-${i}.js`;
      const content = `// Concurrent file ${i}\nexport const concurrent${i} = true;`;
      
      await fs.writeFile(path.join(tempDir, fileName), content);
      await codeAgent.trackFile(fileName);
      
      return fileName;
    });

    const files = await Promise.all(operations);
    const operationTime = Date.now() - startTime;

    // Commit all files together
    const commitStartTime = Date.now();
    const result = await codeAgent.commitPhase('generation', files, 'Add concurrent files');
    const commitTime = Date.now() - commitStartTime;

    expect(result.success).toBe(true);
    
    console.log(`📊 Completed ${concurrentOperations} concurrent operations in ${operationTime}ms`);
    console.log(`📊 Batch commit took ${commitTime}ms`);

    // Performance expectations
    expect(operationTime).toBeLessThan(5000); // Concurrent ops should be faster
    expect(commitTime).toBeLessThan(3000); // Batch commit should be efficient

    console.log('✅ Concurrent operations performance test passed');
  });

  test('should handle memory usage efficiently with large commits', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        user: {
          name: 'Memory Test',
          email: 'memory@codeagent.dev'
        }
      }
    };

    // Use EnhancedCodeAgent for memory monitoring
    const enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    await enhancedAgent.initializeGitRepository();

    // Get initial memory usage
    const initialMemory = process.memoryUsage();
    console.log(`📊 Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    // Create large content
    const fileCount = 20;
    const largeSizeKB = 100; // 100KB per file
    const files = [];

    for (let i = 0; i < fileCount; i++) {
      const fileName = `memory-test-${i}.js`;
      const content = `// Large memory test file ${i}\n${'// filler content\n'.repeat(largeSizeKB * 10)}`;
      
      await fs.writeFile(path.join(tempDir, fileName), content);
      await enhancedAgent.trackFile(fileName);
      files.push(fileName);
    }

    // Get memory after file creation
    const afterCreationMemory = process.memoryUsage();
    console.log(`📊 Memory after creation: ${(afterCreationMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    // Perform commit with health metrics
    const healthMetrics = await enhancedAgent.getHealthMetrics();
    const result = await enhancedAgent.commitWithHealthMetrics(
      'testing',
      files,
      'Large memory test commit',
      healthMetrics
    );

    expect(result.success).toBe(true);

    // Get final memory usage
    const finalMemory = process.memoryUsage();
    console.log(`📊 Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    // Memory growth should be reasonable
    const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    console.log(`📊 Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);

    // Should not consume excessive memory (less than 200MB growth)
    expect(memoryGrowthMB).toBeLessThan(200);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      const afterGCMemory = process.memoryUsage();
      console.log(`📊 Memory after GC: ${(afterGCMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }

    await enhancedAgent.cleanup();
    console.log('✅ Memory usage efficiency test passed');
  });

  test('should handle repository with deep history efficiently', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        user: {
          name: 'History Test',
          email: 'history@codeagent.dev'
        }
      }
    };

    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    const historyDepth = 25;
    const startTime = Date.now();

    // Create deep commit history
    for (let i = 0; i < historyDepth; i++) {
      const fileName = `history-file.js`;
      const content = `// History version ${i}\nexport const version = ${i};\n// Updated at ${new Date().toISOString()}`;
      
      await fs.writeFile(path.join(tempDir, fileName), content);
      await codeAgent.trackFile(fileName);
      
      const result = await codeAgent.commitPhase('generation', [fileName], `Update to version ${i}`);
      expect(result.success).toBe(true);
    }

    const historyCreationTime = Date.now() - startTime;
    console.log(`📊 Created ${historyDepth} commits in history: ${historyCreationTime}ms`);

    // Test status retrieval performance with deep history
    const statusStartTime = Date.now();
    const status = await codeAgent.getGitStatus();
    const statusTime = Date.now() - statusStartTime;

    expect(status.initialized).toBe(true);
    expect(status.commits).toBe(historyDepth);
    
    console.log(`📊 Git status retrieval with deep history: ${statusTime}ms`);

    // Test metrics retrieval performance
    const metricsStartTime = Date.now();
    const metrics = await codeAgent.getGitMetrics();
    const metricsTime = Date.now() - metricsStartTime;

    expect(metrics.totalCommits).toBe(historyDepth);
    
    console.log(`📊 Git metrics retrieval: ${metricsTime}ms`);

    // Performance expectations
    expect(statusTime).toBeLessThan(1000); // Status should be fast even with history
    expect(metricsTime).toBeLessThan(1000); // Metrics should be fast

    console.log('✅ Deep history performance test passed');
  });

  test('should handle branch operations at scale', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        branchStrategy: 'phase',
        user: {
          name: 'Branch Scale Test',
          email: 'branches@codeagent.dev'
        }
      }
    };

    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    const branchCount = 15;
    const startTime = Date.now();

    // Create multiple phases/branches
    for (let i = 0; i < branchCount; i++) {
      const phaseName = `phase-${i}`;
      
      await codeAgent.startPhase(phaseName);
      
      const fileName = `phase-${i}.js`;
      const content = `// Phase ${i} implementation\nexport const phase${i} = true;`;
      
      await fs.writeFile(path.join(tempDir, fileName), content);
      await codeAgent.trackFile(fileName);
      
      await codeAgent.completePhase(phaseName);
    }

    const branchOperationTime = Date.now() - startTime;
    console.log(`📊 Completed ${branchCount} phase operations in ${branchOperationTime}ms`);

    // Get final metrics
    const metrics = await codeAgent.getGitMetrics();
    console.log(`📊 Total commits across all phases: ${metrics.totalCommits}`);
    console.log(`📊 Phases with commits:`, Object.keys(metrics.commitsByPhase));

    // Performance expectations
    expect(branchOperationTime).toBeLessThan(20000); // Should complete within 20 seconds
    expect(metrics.totalCommits).toBeGreaterThanOrEqual(branchCount);

    console.log('✅ Branch operations at scale test passed');
  });

  test('should handle enhanced features performance', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        includeTestResults: true,
        includePerformanceData: true,
        includeLogAnalysis: true,
        user: {
          name: 'Enhanced Performance Test',
          email: 'enhanced-perf@codeagent.dev'
        }
      },
      enhancedConfig: {
        enableRuntimeTesting: false,
        enableBrowserTesting: false,
        enableLogAnalysis: true,
        trackDetailedMetrics: true
      }
    };

    const enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    await enhancedAgent.initializeGitRepository();

    const operationCount = 10;
    const startTime = Date.now();

    // Perform enhanced operations with metadata
    for (let i = 0; i < operationCount; i++) {
      const fileName = `enhanced-${i}.js`;
      const content = `// Enhanced file ${i}\nexport const enhanced${i} = true;`;
      
      await fs.writeFile(path.join(tempDir, fileName), content);

      // Alternate between different enhanced commit types
      let result;
      if (i % 3 === 0) {
        // Test results commit
        const testResults = { passed: i + 1, failed: 0, coverage: 85 + i };
        result = await enhancedAgent.commitWithTestResults('testing', [fileName], `Test commit ${i}`, testResults);
      } else if (i % 3 === 1) {
        // Performance commit
        const performanceMetrics = { executionTime: 50 + i, memoryUsage: 10 + i, cpuUsage: 5 + i };
        result = await enhancedAgent.commitWithPerformanceData('optimization', [fileName], `Performance commit ${i}`, performanceMetrics);
      } else {
        // Log analysis commit
        const logAnalysis = { errors: 0, warnings: i, info: i * 2, patterns: [`Pattern ${i}`] };
        result = await enhancedAgent.commitWithLogAnalysis('debugging', [fileName], `Log analysis commit ${i}`, logAnalysis);
      }

      expect(result.success).toBe(true);
    }

    const enhancedOperationTime = Date.now() - startTime;
    console.log(`📊 Completed ${operationCount} enhanced operations in ${enhancedOperationTime}ms`);

    // Get enhanced metrics
    const metricsStartTime = Date.now();
    const enhancedMetrics = await enhancedAgent.getEnhancedGitMetrics();
    const metricsTime = Date.now() - metricsStartTime;

    expect(enhancedMetrics).toHaveProperty('phaseMetrics');
    expect(enhancedMetrics).toHaveProperty('recommendations');
    
    console.log(`📊 Enhanced metrics retrieval: ${metricsTime}ms`);
    console.log(`📊 Recommendations generated: ${enhancedMetrics.recommendations.length}`);

    // Performance expectations
    expect(enhancedOperationTime).toBeLessThan(15000); // Enhanced ops should be reasonable
    expect(metricsTime).toBeLessThan(2000); // Enhanced metrics should be fast

    await enhancedAgent.cleanup();
    console.log('✅ Enhanced features performance test passed');
  });
});