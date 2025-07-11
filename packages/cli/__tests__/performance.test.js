import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import { performance } from 'perf_hooks';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../bin/jsenvoy');

describe('Performance Tests', () => {
  let cli;

  beforeEach(() => {
    cli = new CLI();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('module loading performance', () => {
    it('should load modules within acceptable time', async () => {
      const start = performance.now();
      
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      
      const end = performance.now();
      const loadTime = end - start;
      
      // Module loading should be fast (< 100ms)
      expect(loadTime).toBeLessThan(100);
      
      // Verify modules were actually loaded
      expect(cli.modules.size).toBeGreaterThan(0);
    });

    it('should cache module instances effectively', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      cli.initializeModuleFactory();
      
      // First access - creates instance
      const start1 = performance.now();
      const instance1 = cli.getOrCreateModuleInstance('calculator');
      const time1 = performance.now() - start1;
      
      // Second access - should use cache
      const start2 = performance.now();
      const instance2 = cli.getOrCreateModuleInstance('calculator');
      const time2 = performance.now() - start2;
      
      // Cache access should be much faster
      expect(time2).toBeLessThan(time1 / 10);
      expect(instance1).toBe(instance2); // Same instance
    });

    it('should discover tools efficiently', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      cli.initializeModuleFactory();
      
      const start = performance.now();
      const tools = cli.discoverTools();
      const end = performance.now();
      
      // Tool discovery should be fast (< 50ms)
      expect(end - start).toBeLessThan(50);
      
      // Should cache the result
      const start2 = performance.now();
      const tools2 = cli.discoverTools();
      const end2 = performance.now();
      
      // Cached access should be very fast (< 1ms)
      expect(end2 - start2).toBeLessThan(1);
      expect(tools).toBe(tools2); // Same Map instance
    });
  });

  describe('command parsing performance', () => {
    it('should parse simple commands quickly', () => {
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        cli.parseArgs(['node', 'jsenvoy', 'calculator.calculator_evaluate', '--expression', '2+2']);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Average parse time should be < 0.1ms
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should parse complex commands efficiently', () => {
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        cli.parseArgs([
          'node', 'jsenvoy', 
          '--verbose', '--output', 'json', '--config', '/path/to/config',
          'file.file_writer',
          '--filePath', '/path/to/file',
          '--content', 'Some content with spaces',
          '--json', '{"key": "value", "nested": {"array": [1, 2, 3]}}'
        ]);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Complex parsing should still be fast (< 1ms)
      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('large output handling', () => {
    it('should handle large string outputs efficiently', async () => {
      // Create a large string (1MB)
      const largeString = 'x'.repeat(1024 * 1024);
      
      const start = performance.now();
      cli.formatOutput({ result: largeString });
      const end = performance.now();
      
      // Formatting should be fast even for large outputs (< 50ms)
      expect(end - start).toBeLessThan(50);
    });

    it('should handle large array outputs efficiently', async () => {
      // Create a large array (10k items)
      const largeArray = Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random()
      }));
      
      cli.options = { output: 'json' };
      
      const start = performance.now();
      cli.formatOutput({ items: largeArray });
      const end = performance.now();
      
      // JSON formatting should handle large arrays (< 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it('should format tables efficiently', () => {
      // Create table data with many rows
      const tableData = Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `Module ${i}`,
        tools: `${i} tools`,
        status: i % 2 === 0 ? 'active' : 'inactive'
      }));
      
      const start = performance.now();
      cli.formatTable(tableData);
      const end = performance.now();
      
      // Table formatting should scale well (< 50ms for 1000 rows)
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('memory usage', () => {
    it('should not leak memory when loading/unloading modules', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Load and clear modules multiple times
      for (let i = 0; i < 10; i++) {
        await cli.loadModules();
        cli.modules.clear();
        cli.tools.clear();
        cli.moduleClasses.clear();
        cli.moduleInstances.clear();
        cli.toolRegistry = null;
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be minimal (< 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });

    it('should efficiently handle repeated tool executions', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      cli.initializeModuleFactory();
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Execute a tool many times
      for (let i = 0; i < 100; i++) {
        await cli.executeTool('calculator.calculator_evaluate', {
          expression: `${i} + ${i}`
        });
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth from repeated executions should be reasonable (< 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('startup time optimization', () => {
    it('should have fast CLI startup time', async () => {
      const iterations = 5;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await execAsync(`node ${binPath} help`);
        const end = Date.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      // Average startup time should be reasonable (< 200ms)
      expect(avgTime).toBeLessThan(200);
    });

    it('should execute simple commands quickly', async () => {
      const start = Date.now();
      await execAsync(`node ${binPath} calculator.calculator_evaluate --expression "42"`);
      const end = Date.now();
      
      // Simple command execution should be fast (< 150ms)
      expect(end - start).toBeLessThan(150);
    });
  });

  describe('configuration loading performance', () => {
    it('should load configuration files quickly', async () => {
      const start = performance.now();
      await cli.loadConfiguration();
      const end = performance.now();
      
      // Config loading should be fast (< 20ms)
      expect(end - start).toBeLessThan(20);
    });

    it('should merge configurations efficiently', () => {
      const baseConfig = {
        verbose: false,
        output: 'text',
        resources: { a: 1, b: 2, c: 3 },
        modules: {
          calculator: { timeout: 1000 },
          file: { maxSize: 1024 }
        }
      };
      
      const overrides = {
        verbose: true,
        resources: { b: 20, d: 4 },
        modules: {
          calculator: { precision: 2 },
          github: { token: 'xxx' }
        }
      };
      
      const start = performance.now();
      
      // Merge many times
      for (let i = 0; i < 1000; i++) {
        const merged = cli.mergeConfigurations(baseConfig, overrides);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / 1000;
      
      // Config merging should be very fast (< 0.1ms)
      expect(avgTime).toBeLessThan(0.1);
    });
  });

  describe('autocomplete performance', () => {
    it('should provide autocomplete suggestions quickly', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      
      const completer = cli.getCompleter();
      
      // Test various autocomplete scenarios
      const testCases = [
        'calc',
        'file.',
        'calculator.calc',
        'list ',
        'help calc'
      ];
      
      for (const input of testCases) {
        const start = performance.now();
        const [completions] = await completer(input);
        const end = performance.now();
        
        // Autocomplete should be very responsive (< 10ms)
        expect(end - start).toBeLessThan(10);
        expect(completions).toBeInstanceOf(Array);
      }
    });
  });

  describe('error handling performance', () => {
    it('should generate error suggestions quickly', () => {
      const candidates = Array(100).fill(null).map((_, i) => `command${i}`);
      
      const start = performance.now();
      const suggestion = cli.findBestMatch('comand50', candidates);
      const end = performance.now();
      
      // Fuzzy matching should be fast even with many candidates (< 5ms)
      expect(end - start).toBeLessThan(5);
      expect(suggestion).toBe('command50');
    });

    it('should handle errors without performance degradation', async () => {
      const iterations = 100;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        try {
          cli.handleError(new Error(`Test error ${i}`));
        } catch (e) {
          // Expected
        }
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      // Error handling should be consistently fast (< 1ms)
      expect(avgTime).toBeLessThan(1);
    });
  });
});