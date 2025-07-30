/**
 * Jest Agent CLI Tests
 * Tests for the command-line interface functionality
 */

import { JestAgentCLI } from '../../src/cli/JestAgentCLI.js';
import { promises as fs } from 'fs';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('JestAgentCLI', () => {
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  let cli;
  let testDbPath;

  beforeEach(() => {
    cli = new JestAgentCLI();
  });

  afterEach(async () => {
    // Clean up test database
    await cleanupTestDb(testDbPath);
    
    // Clean up CLI instance
    if (cli && cli.jaw) {
      await cli.jaw.close();
    }
  });

  describe('Argument Parsing', () => {
    test('parseArgs with default command', () => {
      const args = [];
      const parsed = cli.parseArgs(args);
      
      expect(parsed.command).toBe('run');
      expect(parsed.pattern).toBe('');
      expect(parsed.options).toEqual({});
    });

    test('parseArgs with custom command', () => {
      const args = ['query'];
      const parsed = cli.parseArgs(args);
      
      expect(parsed.command).toBe('query');
      expect(parsed.pattern).toBe('');
      expect(parsed.options).toEqual({});
    });

    test('parseArgs with pattern', () => {
      const args = ['run', 'src/**/*.test.js'];
      const parsed = cli.parseArgs(args);
      
      expect(parsed.command).toBe('run');
      expect(parsed.pattern).toBe('src/**/*.test.js');
      expect(parsed.options).toEqual({});
    });

    test('parseArgs with options', () => {
      const args = ['run', '--output=custom.db', '--storage=sqlite'];
      const parsed = cli.parseArgs(args);
      
      expect(parsed.command).toBe('run');
      expect(parsed.pattern).toBe('');
      expect(parsed.options).toEqual({
        output: 'custom.db',
        storage: 'sqlite'
      });
    });

    test('parseArgs with boolean flags', () => {
      const args = ['query', '--failed', '--errors'];
      const parsed = cli.parseArgs(args);
      
      expect(parsed.command).toBe('query');
      expect(parsed.options).toEqual({
        failed: true,
        errors: true
      });
    });

    test('parseArgs with mixed arguments', () => {
      const args = ['run', 'test/**/*.js', '--output=results.db', '--verbose'];
      const parsed = cli.parseArgs(args);
      
      expect(parsed.command).toBe('run');
      expect(parsed.pattern).toBe('test/**/*.js');
      expect(parsed.options).toEqual({
        output: 'results.db',
        verbose: true
      });
    });
  });

  describe('CLI Instance', () => {
    test('creates CLI instance successfully', () => {
      expect(cli).toBeDefined();
      expect(typeof cli.parseArgs).toBe('function');
      expect(typeof cli.run).toBe('function');
      expect(typeof cli.showHelp).toBe('function');
    });

    test('has null jaw instance initially', () => {
      expect(cli.jaw).toBeNull();
    });
  });

  describe('Command Methods', () => {
    test('runTests method exists and is callable', async () => {
      expect(typeof cli.runTests).toBe('function');
      
      // Test that it doesn't throw
      await expect(cli.runTests('', { output: testDbPath })).resolves.not.toThrow();
    });

    test('queryTests method exists and is callable', async () => {
      expect(typeof cli.queryTests).toBe('function');
      
      // Setup first
      await cli.runTests('', { output: testDbPath });
      
      // Test that it doesn't throw
      await expect(cli.queryTests({ output: testDbPath })).resolves.not.toThrow();
    });

    test('showSummary method exists and is callable', async () => {
      expect(typeof cli.showSummary).toBe('function');
      
      // Setup first
      await cli.runTests('', { output: testDbPath });
      
      // Test that it doesn't throw
      await expect(cli.showSummary({ output: testDbPath })).resolves.not.toThrow();
    });

    test('showHistory method exists and is callable', async () => {
      expect(typeof cli.showHistory).toBe('function');
      
      // Setup first
      await cli.runTests('', { output: testDbPath });
      
      // Test that it doesn't throw
      await expect(cli.showHistory({ test: 'sample', output: testDbPath })).resolves.not.toThrow();
    });
  });

  describe('Database File Creation', () => {
    test('creates database file when running tests', async () => {
      await cli.runTests('', { output: testDbPath });
      
      // Check if file was created
      try {
        await fs.access(testDbPath);
        // File exists
        expect(true).toBe(true);
      } catch (error) {
        // File doesn't exist
        expect(false).toBe(true);
      }
    });

    test('handles custom database path', async () => {
      const customPath = './custom-cli-test.db';
      
      await cli.runTests('', { output: customPath });
      
      try {
        await fs.access(customPath);
        await fs.unlink(customPath); // Clean up
        expect(true).toBe(true);
      } catch (error) {
        expect(false).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('handles invalid database path gracefully', async () => {
      // This should throw due to invalid path
      await expect(cli.queryTests({ 
        output: '/invalid/path/test.db',
        failed: true 
      })).rejects.toThrow();
    });

    test('handles missing test name in history gracefully', async () => {
      await expect(cli.showHistory({ output: testDbPath })).resolves.not.toThrow();
    });
  });

  describe('Configuration Options', () => {
    test('respects storage type option', async () => {
      const options = { storage: 'sqlite', output: testDbPath };
      
      await expect(cli.runTests('', options)).resolves.not.toThrow();
    });

    test('handles different output formats', async () => {
      const options = { output: testDbPath };
      
      await expect(cli.runTests('', options)).resolves.not.toThrow();
    });
  });

  describe('Sequential Operations', () => {
    test('can run multiple operations in sequence', async () => {
      // Run tests
      await cli.runTests('', { output: testDbPath });
      
      // Query results
      await cli.queryTests({ failed: true, output: testDbPath });
      
      // Show summary
      await cli.showSummary({ output: testDbPath });
      
      // Show history
      await cli.showHistory({ test: 'sample', output: testDbPath });
      
      // All operations should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('Resource Management', () => {
    test('properly manages JAW instances', async () => {
      expect(cli.jaw).toBeNull();
      
      await cli.runTests('', { output: testDbPath });
      
      // JAW instance should be created and available
      expect(cli.jaw).toBeDefined();
      expect(cli.jaw).not.toBeNull();
    });
  });

  describe('Help System', () => {
    test('showHelp method exists and is callable', () => {
      expect(typeof cli.showHelp).toBe('function');
      expect(() => cli.showHelp()).not.toThrow();
    });
  });

  describe('Integration', () => {
    test('full workflow completes successfully', async () => {
      // Parse arguments
      const parsed = cli.parseArgs(['run', '--output=' + testDbPath]);
      expect(parsed.command).toBe('run');
      expect(parsed.options.output).toBe(testDbPath);
      
      // Run the command
      await expect(cli.runTests(parsed.pattern, parsed.options)).resolves.not.toThrow();
      
      // Query the results
      const queryParsed = cli.parseArgs(['query', '--failed', '--output=' + testDbPath]);
      await expect(cli.queryTests(queryParsed.options)).resolves.not.toThrow();
      
      // Show summary
      const summaryParsed = cli.parseArgs(['summary', '--output=' + testDbPath]);
      await expect(cli.showSummary(summaryParsed.options)).resolves.not.toThrow();
    });
  });
});
