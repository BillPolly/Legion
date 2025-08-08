import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { ToolRegistry } from '@legion/tools';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('BehaviorTreeExecutor Integration Tests', () => {
  let executor;
  let toolRegistry;
  let testDir;

  beforeAll(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'test-output-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Initialize real ToolRegistry with Legion tools
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    
    executor = new BehaviorTreeExecutor(toolRegistry);
    
    console.log('Integration test setup complete');
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  beforeEach(async () => {
    // Change to test directory for each test
    process.chdir(testDir);
  });

  describe('File Operations Integration', () => {
    test('should execute file creation behavior tree', async () => {
      const treeConfig = {
        type: 'sequence',
        id: 'file-operations-test',
        children: [
          {
            type: 'action',
            id: 'create-dir',
            tool: 'directory_create',
            params: { dirpath: 'test-project' }
          },
          {
            type: 'action',
            id: 'change-dir',
            tool: 'directory_change',
            params: { dirpath: 'test-project' }
          },
          {
            type: 'action',
            id: 'write-file',
            tool: 'file_write',
            params: {
              filepath: 'hello.js',
              content: 'console.log("Hello from BT!");'
            }
          },
          {
            type: 'action',
            id: 'read-file',
            tool: 'file_read',
            params: { filepath: 'hello.js' }
          }
        ]
      };

      const result = await executor.executeTree(treeConfig, {
        workspaceDir: testDir
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.nodeResults).toBeDefined();
      
      // Verify files were actually created
      const projectPath = path.join(testDir, 'test-project');
      const filePath = path.join(projectPath, 'hello.js');
      
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe('console.log("Hello from BT!");');
    });

    test('should handle nested directory creation', async () => {
      const treeConfig = {
        type: 'sequence',
        id: 'nested-dirs-test',
        children: [
          {
            type: 'action',
            id: 'create-src',
            tool: 'directory_create',
            params: { dirpath: 'nested-test/src' }
          },
          {
            type: 'action',
            id: 'create-test',
            tool: 'directory_create',
            params: { dirpath: 'nested-test/test' }
          },
          {
            type: 'action',
            id: 'write-index',
            tool: 'file_write',
            params: {
              filepath: 'nested-test/src/index.js',
              content: 'module.exports = { message: "BT Integration Test" };'
            }
          },
          {
            type: 'action',
            id: 'write-test',
            tool: 'file_write',
            params: {
              filepath: 'nested-test/test/index.test.js',
              content: 'const app = require("../src/index"); console.log(app.message);'
            }
          }
        ]
      };

      const result = await executor.executeTree(treeConfig, {
        workspaceDir: testDir
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      
      // Verify directory structure
      const srcPath = path.join(testDir, 'nested-test/src');
      const testPath = path.join(testDir, 'nested-test/test');
      
      const srcExists = await fs.access(srcPath).then(() => true).catch(() => false);
      const testExists = await fs.access(testPath).then(() => true).catch(() => false);
      
      expect(srcExists).toBe(true);
      expect(testExists).toBe(true);
    });
  });

  describe('Retry Logic Integration', () => {
    test('should retry failed operations', async () => {
      // This test simulates a scenario where directory creation might fail initially
      // but succeed on retry (though with our current tools this is hard to simulate)
      const treeConfig = {
        type: 'retry',
        id: 'retry-test',
        maxAttempts: 3,
        child: {
          type: 'sequence',
          id: 'retry-sequence',
          children: [
            {
              type: 'action',
              id: 'create-temp-dir',
              tool: 'directory_create',
              params: { dirpath: 'retry-test-dir' }
            },
            {
              type: 'action',
              id: 'write-file',
              tool: 'file_write',
              params: {
                filepath: 'retry-test-dir/retry.txt',
                content: 'This file was created with retry logic'
              }
            }
          ]
        }
      };

      const result = await executor.executeTree(treeConfig, {
        workspaceDir: testDir
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      
      // Verify file was created
      const filePath = path.join(testDir, 'retry-test-dir/retry.txt');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('Complex Project Structure', () => {
    test('should create a complete Node.js project structure', async () => {
      const treeConfig = {
        type: 'sequence',
        id: 'nodejs-project',
        children: [
          {
            type: 'action',
            id: 'create-root-dir',
            tool: 'directory_create',
            params: { dirpath: 'my-node-app' }
          },
          {
            type: 'action',
            id: 'change-to-root',
            tool: 'directory_change',
            params: { dirpath: 'my-node-app' }
          },
          {
            type: 'parallel',
            id: 'create-structure',
            children: [
              {
                type: 'action',
                id: 'create-src-dir',
                tool: 'directory_create',
                params: { dirpath: 'src' }
              },
              {
                type: 'action',
                id: 'create-test-dir',
                tool: 'directory_create',
                params: { dirpath: 'test' }
              }
            ]
          },
          {
            type: 'action',
            id: 'write-package-json',
            tool: 'file_write',
            params: {
              filepath: 'package.json',
              content: JSON.stringify({
                name: 'my-node-app',
                version: '1.0.0',
                description: 'Generated by BehaviorTreeExecutor',
                main: 'src/index.js',
                scripts: {
                  test: 'jest',
                  start: 'node src/index.js'
                }
              }, null, 2)
            }
          },
          {
            type: 'action',
            id: 'write-main-file',
            tool: 'file_write',
            params: {
              filepath: 'src/index.js',
              content: `const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from BehaviorTree-generated app!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

module.exports = app;`
            }
          },
          {
            type: 'action',
            id: 'write-test-file',
            tool: 'file_write',
            params: {
              filepath: 'test/app.test.js',
              content: `const app = require('../src/index');

describe('App', () => {
  test('should export express app', () => {
    expect(app).toBeDefined();
  });
});`
            }
          },
          {
            type: 'action',
            id: 'write-gitignore',
            tool: 'file_write',
            params: {
              filepath: '.gitignore',
              content: `node_modules/
.env
*.log
coverage/
.DS_Store`
            }
          }
        ]
      };

      const result = await executor.executeTree(treeConfig, {
        workspaceDir: testDir
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      
      // Verify complete project structure
      const projectPath = path.join(testDir, 'my-node-app');
      
      const expectedFiles = [
        'package.json',
        'src/index.js',
        'test/app.test.js',
        '.gitignore'
      ];
      
      const expectedDirs = ['src', 'test'];
      
      // Check files
      for (const file of expectedFiles) {
        const filePath = path.join(projectPath, file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
      
      // Check directories
      for (const dir of expectedDirs) {
        const dirPath = path.join(projectPath, dir);
        const stat = await fs.stat(dirPath);
        expect(stat.isDirectory()).toBe(true);
      }
      
      // Validate package.json content
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      expect(packageJson.name).toBe('my-node-app');
      expect(packageJson.main).toBe('src/index.js');
    });
  });

  describe('Event Emission Integration', () => {
    test('should emit all expected events during execution', async () => {
      const events = [];
      
      executor.on('tree:start', (data) => events.push({ type: 'tree:start', data }));
      executor.on('tree:complete', (data) => events.push({ type: 'tree:complete', data }));
      executor.on('node:start', (data) => events.push({ type: 'node:start', data }));
      executor.on('node:complete', (data) => events.push({ type: 'node:complete', data }));
      executor.on('action:execute', (data) => events.push({ type: 'action:execute', data }));
      executor.on('action:result', (data) => events.push({ type: 'action:result', data }));
      
      const treeConfig = {
        type: 'sequence',
        id: 'event-test',
        children: [
          {
            type: 'action',
            id: 'create-event-dir',
            tool: 'directory_create',
            params: { dirpath: 'event-test' }
          },
          {
            type: 'action',
            id: 'write-event-file',
            tool: 'file_write',
            params: {
              filepath: 'event-test/events.txt',
              content: 'Event testing file'
            }
          }
        ]
      };

      const result = await executor.executeTree(treeConfig, {
        workspaceDir: testDir
      });

      expect(result.success).toBe(true);
      
      // Verify expected events were emitted
      const eventTypes = events.map(e => e.type);
      
      expect(eventTypes).toContain('tree:start');
      expect(eventTypes).toContain('tree:complete');
      expect(eventTypes.filter(t => t === 'node:start').length).toBeGreaterThan(0);
      expect(eventTypes.filter(t => t === 'node:complete').length).toBeGreaterThan(0);
      expect(eventTypes.filter(t => t === 'action:execute').length).toBe(2);
      expect(eventTypes.filter(t => t === 'action:result').length).toBe(2);
      
      // Clean up event listeners
      executor.removeAllListeners();
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle tool execution errors gracefully', async () => {
      const treeConfig = {
        type: 'sequence',
        id: 'error-handling-test',
        children: [
          {
            type: 'action',
            id: 'valid-operation',
            tool: 'directory_create',
            params: { dirpath: 'error-test' }
          },
          {
            type: 'action',
            id: 'invalid-operation',
            tool: 'file_read',
            params: { filepath: 'non-existent-file.txt' } // This should fail
          }
        ]
      };

      const result = await executor.executeTree(treeConfig, {
        workspaceDir: testDir
      });

      // The sequence should fail when the second action fails
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILURE');
      
      // But the first directory should still have been created
      const dirPath = path.join(testDir, 'error-test');
      const dirExists = await fs.access(dirPath).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    test('should handle invalid tool names', async () => {
      const treeConfig = {
        type: 'action',
        id: 'invalid-tool-test',
        tool: 'non_existent_tool',
        params: { someParam: 'value' }
      };

      await expect(executor.executeTree(treeConfig, {
        workspaceDir: testDir
      })).rejects.toThrow();
    });
  });

  describe('Performance Integration', () => {
    test('should handle large behavior trees efficiently', async () => {
      const startTime = Date.now();
      
      // Create a tree with many file operations
      const actions = [];
      for (let i = 0; i < 20; i++) {
        actions.push({
          type: 'action',
          id: `write-file-${i}`,
          tool: 'file_write',
          params: {
            filepath: `performance-test/file-${i}.txt`,
            content: `This is file number ${i}`
          }
        });
      }
      
      const treeConfig = {
        type: 'sequence',
        id: 'performance-test',
        children: [
          {
            type: 'action',
            id: 'create-perf-dir',
            tool: 'directory_create',
            params: { dirpath: 'performance-test' }
          },
          ...actions
        ]
      };

      const result = await executor.executeTree(treeConfig, {
        workspaceDir: testDir
      });

      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify all files were created
      for (let i = 0; i < 20; i++) {
        const filePath = path.join(testDir, `performance-test/file-${i}.txt`);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });
});