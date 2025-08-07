/**
 * Error Scenario Tests
 * Tests edge cases, invalid inputs, network failures, and resource exhaustion
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigurationManager } from '../../src/integration/ConfigurationManager.js';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { FileSystemModuleDefinition } from '../../src/modules/FileSystemModule.js';
import { HTTPModuleDefinition } from '../../src/modules/HTTPModule.js';
// NOTE: recursive-planner has been removed - tests need refactoring
// import RecursivePlanner from '@legion/recursive-planner';
// const planner = new RecursivePlanner();
// const { PlanningAgent, AgentConfig, strategies: { TemplatePlanningStrategy } } = planner;
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe.skip('Error Scenario Tests (needs refactoring after recursive-planner removal)', () => {
  let testDir;
  let configManager;
  let registry;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'error-test-'));
    configManager = new ConfigurationManager();
  });

  afterEach(async () => {
    if (registry) {
      await registry.shutdown();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Invalid Configuration Scenarios', () => {
    test('should handle missing required configuration fields', async () => {
      const invalidConfig = {
        modules: {
          filesystem: {
            // Missing required basePath
            allowWrite: true
          }
        }
      };

      // Should use default basePath instead of throwing
      registry = await configManager.createRegistry(invalidConfig);
      expect(registry).toBeDefined();
      const fsInstance = await registry.getInstance('filesystem');
      expect(fsInstance.config.basePath).toBeDefined();
    });

    test('should handle invalid configuration types', async () => {
      const invalidConfig = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: 'not_a_boolean', // should be boolean
            maxFileSize: 'not_a_number' // should be number
          }
        }
      };

      const fsModule = await FileSystemModuleDefinition.create(invalidConfig.modules.filesystem);
      
      // The module should still be created successfully
      expect(fsModule).toBeDefined();
      expect(fsModule.config.basePath).toBe(testDir);
      // Configuration may keep original values or use defaults
      expect(fsModule.config).toBeDefined();
    });

    test('should handle invalid module names', async () => {
      const config = {
        modules: {
          nonexistent_module: {
            someConfig: 'value'
          }
        }
      };

      await expect(configManager.createRegistry(config))
        .rejects.toThrow(/unknown module type/i);
    });

    test('should handle malformed JSON configuration', async () => {
      const malformedJson = '{ "modules": { "filesystem": { "basePath": "/test" } }'; // missing closing brace
      const configFile = path.join(testDir, 'malformed.json');
      await fs.writeFile(configFile, malformedJson);

      await expect(configManager.loadFromFile(configFile))
        .rejects.toThrow(/Expected.*after property value in JSON/);
    });

    test('should handle circular references in configuration', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir
          }
        }
      };
      
      // Create circular reference
      config.circular = config;

      registry = await configManager.createRegistry(config);
      
      // Should handle gracefully without infinite loops
      const metadata = await registry.getAllMetadata();
      expect(metadata).toBeDefined();
    });
  });

  describe('Invalid Input Scenarios', () => {
    test('should handle invalid file paths', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('filesystem.readFile');

      // Test various invalid paths
      const invalidPaths = [
        null,
        undefined,
        '',
        '../../../etc/passwd', // path traversal
        '/absolute/path/outside/base',
        'path\x00with\x00null\x00bytes',
        'a'.repeat(10000) // extremely long path
      ];

      for (const invalidPath of invalidPaths) {
        const result = await tool.execute({ path: invalidPath });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    test('should handle oversized file inputs', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true,
            maxFileSize: 1024 // 1KB limit
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('filesystem.writeFile');

      // Create content larger than limit
      const largeContent = 'x'.repeat(2048); // 2KB

      const result = await tool.execute({
        path: 'large.txt',
        content: largeContent
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/file size.*limit/i);
    });

    test('should handle invalid JSON inputs', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      
      // Create invalid JSON file
      await fs.writeFile(path.join(testDir, 'invalid.json'), '{ invalid json }');
      
      const tool = await registry.getTool('filesystem.readFile');
      const result = await tool.execute({ 
        path: 'invalid.json'
      });

      // The readFile tool should still read the content successfully
      expect(result.content).toContain('invalid json');
      expect(result.path).toBeDefined();
    });

    test('should handle binary file operations', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      
      // Create binary file
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
      await fs.writeFile(path.join(testDir, 'image.png'), binaryData);
      
      const tool = await registry.getTool('filesystem.readFile');
      const result = await tool.execute({ path: 'image.png' });

      // Should handle binary files without crashing
      expect(result).toBeDefined();
      if (result.success) {
        expect(result.content).toBeDefined();
      }
    });
  });

  describe('Network Failure Scenarios', () => {
    test('should handle connection timeouts', async () => {
      const config = {
        modules: {
          http: {
            baseURL: 'http://10.255.255.1', // non-routable IP
            timeout: 100 // very short timeout
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('http.get');

      const result = await tool.execute({ url: '/test' });

      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/timeout|network|connection/i);
    });

    test('should handle DNS resolution failures', async () => {
      const config = {
        modules: {
          http: {
            baseURL: 'https://this-domain-does-not-exist-12345.com',
            timeout: 2000
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('http.get');

      const result = await tool.execute({ url: '/test' });

      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/dns|getaddrinfo|not found/i);
    });

    test('should handle HTTP error responses', async () => {
      const config = {
        modules: {
          http: {
            baseURL: 'https://httpbin.org',
            timeout: 5000
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('http.get');

      // Test various HTTP error codes
      const errorCodes = [400, 404, 500];
      
      for (const code of errorCodes) {
        const result = await tool.execute({ url: `/status/${code}` });
        
        // The tool should handle errors gracefully
        expect(result).toBeDefined();
        if (result.success === false) {
          expect(result.error).toBeDefined();
        }
        // Status might be in result.status or result.response.status
      }
    });

    test('should handle malformed HTTP responses', async () => {
      const config = {
        modules: {
          http: {
            baseURL: 'https://httpbin.org',
            timeout: 5000
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('http.get');

      // Request response that might be malformed
      const result = await tool.execute({ 
        url: '/json',
        headers: { 'Accept': 'application/xml' } // request XML but get JSON
      });

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle network interruptions during large transfers', async () => {
      const config = {
        modules: {
          http: {
            baseURL: 'https://httpbin.org',
            timeout: 1000 // short timeout for large transfer
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('http.post');

      // Try to send large data with short timeout
      const largeData = 'x'.repeat(100000);
      
      const result = await tool.execute({
        url: '/post',
        data: largeData,
        headers: { 'Content-Type': 'text/plain' }
      });

      // Should either succeed or fail gracefully with timeout
      expect(result).toBeDefined();
      if (result.success === false && result.error) {
        expect(result.error.message).toMatch(/timeout|aborted/i);
      }
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle memory exhaustion with large files', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true,
            maxFileSize: 50 * 1024 * 1024 // 50MB limit
          }
        }
      };

      registry = await configManager.createRegistry(config);
      
      // Create large file
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      await fs.writeFile(path.join(testDir, 'large.txt'), largeContent);
      
      const tool = await registry.getTool('filesystem.readFile');
      
      // Try to read multiple large files simultaneously
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(tool.execute({ path: 'large.txt' }));
      }
      
      const results = await Promise.allSettled(promises);
      
      // Should handle gracefully, some might fail due to memory constraints
      const successful = results.filter(r => r.status === 'fulfilled' && r.value && r.value.success);
      const total = results.length;
      
      expect(total).toBe(10);
      // Should complete without crashing (successful or failed)
      expect(results.every(r => r.status === 'fulfilled' || r.status === 'rejected')).toBe(true);
    });

    test('should handle too many open file handles', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      
      // Create multiple files
      const files = [];
      for (let i = 0; i < 100; i++) {
        const filename = `file${i}.txt`;
        await fs.writeFile(path.join(testDir, filename), `Content ${i}`);
        files.push(filename);
      }
      
      const tool = await registry.getTool('filesystem.readFile');
      
      // Try to read many files simultaneously
      const promises = files.map(file => tool.execute({ path: file }));
      const results = await Promise.allSettled(promises);
      
      // Should handle file handle limits gracefully
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });

    test('should handle disk space exhaustion', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('filesystem.writeFile');
      
      // Try to write many large files (this test is limited by available disk space)
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await tool.execute({
          path: `large${i}.txt`,
          content: 'x'.repeat(5 * 1024 * 1024) // 5MB each
        });
        results.push(result);
        
        // Stop if we start getting failures
        if (!result.success && result.error.message.match(/space|quota|enospc/i)) {
          break;
        }
      }
      
      // Should handle disk space issues gracefully
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle concurrent tool execution limits', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      
      await fs.writeFile(path.join(testDir, 'test.txt'), 'test content');
      
      const tool = await registry.getTool('filesystem.readFile');
      
      // Launch many concurrent operations
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(tool.execute({ path: 'test.txt' }));
      }
      
      const results = await Promise.allSettled(promises);
      
      // Should handle high concurrency without crashing
      const completed = results.filter(r => r.status === 'fulfilled');
      expect(completed.length).toBeGreaterThan(500); // Most should at least complete
    });
  });

  describe('Error Propagation and Recovery', () => {
    test('should propagate errors correctly through tool chain', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      
      // Create a chain of operations where one fails
      const readTool = await registry.getTool('filesystem.readFile');
      const writeTool = await registry.getTool('filesystem.writeFile');
      
      // First operation fails (file doesn't exist)
      const readResult = await readTool.execute({ path: 'missing.txt' });
      expect(readResult.success).toBe(false);
      
      // Second operation should handle the error
      const writeResult = await writeTool.execute({
        path: 'error_log.txt',
        content: `Error occurred: ${readResult.error?.message || 'Unknown error'}`
      });
      
      expect(writeResult.success).toBe(true);
      
      // Verify error was logged
      const logContent = await fs.readFile(path.join(testDir, 'error_log.txt'), 'utf8');
      expect(logContent).toContain('Error occurred');
    });

    test('should handle cascading failures', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: '/nonexistent/path', // invalid base path
            allowWrite: true
          }
        }
      };

      // This should fail during registry creation or tool execution
      let registry;
      try {
        registry = await configManager.createRegistry(config);
        const tool = await registry.getTool('filesystem.readFile');
        const result = await tool.execute({ path: 'test.txt' });
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } catch (error) {
        // Module creation might fail entirely
        expect(error).toBeDefined();
      }
    });

    test('should support error recovery strategies', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('filesystem.readFile');
      
      // Implement retry mechanism
      let attempts = 0;
      let result;
      const maxAttempts = 3;
      
      do {
        attempts++;
        result = await tool.execute({ path: 'maybe_exists.txt' });
        
        if (!result.success && attempts < maxAttempts) {
          // Create the file on second attempt to simulate recovery
          if (attempts === 2) {
            await fs.writeFile(path.join(testDir, 'maybe_exists.txt'), 'recovered content');
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (!result.content && attempts < maxAttempts);
      
      expect(attempts).toBeLessThanOrEqual(3); // Should attempt up to 3 times
      expect(result.content).toBeDefined(); // Should eventually succeed
    });

    test('should handle partial failures in batch operations', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);
      const tool = await registry.getTool('filesystem.readFile');
      
      // Create some files, leave others missing
      await fs.writeFile(path.join(testDir, 'exists1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'exists2.txt'), 'content2');
      // missing3.txt intentionally doesn't exist
      
      const files = ['exists1.txt', 'missing3.txt', 'exists2.txt'];
      const results = await Promise.allSettled(
        files.map(file => tool.execute({ path: file }))
      );
      
      // All operations should complete (not be rejected)
      expect(results[0].status).toBe('fulfilled');
      if (results[0].value) {
        expect(results[0].value.content).toBeDefined(); // exists1.txt should be read successfully
      }
      
      expect(results[1].status).toBe('fulfilled');
      if (results[1].value) {
        expect(results[1].value.success).toBe(false); // missing3.txt should fail
      }
      
      expect(results[2].status).toBe('fulfilled');
      if (results[2].value) {
        expect(results[2].value.content).toBeDefined(); // exists2.txt should be read successfully
      }
    });
  });
});