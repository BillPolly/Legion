/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import NodeRunner from '../../src/NodeRunner.js';

describe('NodeRunner Unit Tests', () => {
  let runner;

  beforeEach(() => {
    runner = new NodeRunner({
      autoCleanup: false // Disable auto cleanup for tests
    });
  });

  afterEach(async () => {
    // Clean up any remaining processes
    await runner.cleanup();
  });

  describe('Process Management', () => {
    test('should start a simple Node.js process', async () => {
      const result = await runner.startNodeProcess('node --version');
      
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.pid).toBeDefined();
      expect(result.status).toBe('running');
      
      // Stop the process
      await runner.stopProcess(result.id);
    });

    test('should handle process start errors', async () => {
      const result = await runner.startNodeProcess('nonexistent-command');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should list running processes', async () => {
      // Start a process
      const process1 = await runner.startNodeProcess('node --version');
      
      const listResult = await runner.listProcesses();
      
      expect(listResult.success).toBe(true);
      expect(listResult.processes).toBeInstanceOf(Array);
      expect(listResult.count).toBeGreaterThan(0);
      
      // Clean up
      await runner.stopProcess(process1.id);
    });

    test('should stop a process gracefully', async () => {
      const startResult = await runner.startNodeProcess('node -e "setInterval(() => {}, 1000)"');
      expect(startResult.success).toBe(true);
      
      const stopResult = await runner.stopProcess(startResult.id);
      
      expect(stopResult.success).toBe(true);
      expect(stopResult.status).toBe('stopped');
    });

    test('should handle stopping non-existent process', async () => {
      const result = await runner.stopProcess('non-existent-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Environment and Configuration', () => {
    test('should check environment', async () => {
      const result = await runner.checkEnvironment();
      
      expect(result.success).toBe(true);
      expect(result.node).toBeDefined();
      expect(result.node.available).toBe(true);
      expect(result.node.version).toBeDefined();
      expect(result.packageManager).toBeDefined();
    });

    test('should find available port', async () => {
      const result = await runner.findAvailablePort(3000);
      
      expect(result.success).toBe(true);
      expect(result.port).toBeGreaterThanOrEqual(3000);
      expect(typeof result.port).toBe('number');
    });
  });

  describe('Command Execution', () => {
    test('should execute simple command', async () => {
      const result = await runner.executeCommand('echo "Hello World"');
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello World');
      expect(result.exitCode).toBe(0);
    });

    test('should handle command failure', async () => {
      const result = await runner.executeCommand('exit 1');
      
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Module Factory Integration', () => {
    test('should be loadable as constructor module', () => {
      expect(NodeRunner).toBeDefined();
      expect(typeof NodeRunner).toBe('function');
      
      const instance = new NodeRunner();
      expect(instance).toBeInstanceOf(NodeRunner);
      expect(typeof instance.startNodeProcess).toBe('function');
    });
  });
});