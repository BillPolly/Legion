/**
 * Integration tests with real FileModule using new inputs/outputs system
 */

import { PlanExecutor } from '../../src/core/PlanExecutor.js';
import { ResourceManager } from '@legion/tool-system';
import { FileModule } from '../../../../general-tools/src/file/FileModule.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('FileModule Integration with New Input/Output System', () => {
  let executor;
  let resourceManager;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await global.createTempDir('file-integration-');
    
    // Set up real ResourceManager and PlanExecutor
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    executor = await PlanExecutor.create(resourceManager);
    
    // Load real FileModule
    await executor.moduleLoader.loadModuleByName('file', FileModule);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should execute new format plan with FileModule', async () => {
    const plan = {
      id: 'file-integration-test',
      name: 'File Integration Test',
      status: 'validated',
      steps: [
        {
          id: 'create-structure',
          name: 'Create Directory Structure',
          actions: [
            {
              id: 'create-root',
              type: 'directory_create',
              inputs: {
                dirpath: path.join(tempDir, 'test-project'),
                operation: 'create'
              },
              outputs: {
                dirpath: 'projectRoot',
                created: 'rootCreated'
              }
            },
            {
              id: 'create-src',
              type: 'directory_create',
              inputs: {
                dirpath: '@projectRoot/src',
                operation: 'create'
              },
              outputs: {
                dirpath: 'srcDir', 
                created: 'srcCreated'
              }
            }
          ]
        },
        {
          id: 'create-files',
          name: 'Create Project Files',
          dependencies: ['create-structure'],
          actions: [
            {
              id: 'create-package',
              type: 'file_write',
              inputs: {
                filepath: '@projectRoot/package.json',
                content: {
                  name: 'integration-test-project',
                  version: '1.0.0',
                  main: 'src/index.js'
                }
              },
              outputs: {
                filepath: 'packagePath',
                bytesWritten: 'packageSize',
                created: 'packageCreated'
              }
            },
            {
              id: 'create-main',
              type: 'file_write',
              inputs: {
                filepath: '@srcDir/index.js',
                content: 'console.log("Hello from integration test!");'
              },
              outputs: {
                filepath: 'mainPath',
                bytesWritten: 'mainSize', 
                created: 'mainCreated'
              }
            }
          ]
        }
      ]
    };

    const result = await executor.executePlan(plan);

    // Verify plan execution succeeded
    expect(result.success).toBe(true);
    expect(result.completedSteps).toEqual(['create-structure', 'create-files']);
    expect(result.failedSteps).toHaveLength(0);

    // Verify actual files were created
    const projectRoot = path.join(tempDir, 'test-project');
    const srcDir = path.join(projectRoot, 'src');
    const packagePath = path.join(projectRoot, 'package.json');
    const mainPath = path.join(srcDir, 'index.js');

    expect(await fs.access(projectRoot).then(() => true, () => false)).toBe(true);
    expect(await fs.access(srcDir).then(() => true, () => false)).toBe(true);
    expect(await fs.access(packagePath).then(() => true, () => false)).toBe(true);
    expect(await fs.access(mainPath).then(() => true, () => false)).toBe(true);

    // Verify file contents
    const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    expect(packageContent.name).toBe('integration-test-project');
    expect(packageContent.version).toBe('1.0.0');

    const mainContent = await fs.readFile(mainPath, 'utf8');
    expect(mainContent).toBe('console.log("Hello from integration test!");');
  });

  test('should handle variable chaining between multiple actions', async () => {
    const plan = {
      id: 'variable-chaining-test',
      name: 'Variable Chaining Test', 
      status: 'validated',
      steps: [
        {
          id: 'setup-chain',
          name: 'Variable Chain Test',
          actions: [
            {
              id: 'create-base',
              type: 'directory_create',
              inputs: {
                dirpath: path.join(tempDir, 'chain-test'),
                operation: 'create'
              },
              outputs: {
                dirpath: 'baseDir'
              }
            },
            {
              id: 'create-config',
              type: 'file_write',
              inputs: {
                filepath: '@baseDir/config.json',
                content: { name: 'test-config', version: '1.0' }
              },
              outputs: {
                filepath: 'configPath'
              }
            },
            {
              id: 'read-config',
              type: 'file_read',
              inputs: {
                filepath: '@configPath'
              },
              outputs: {
                content: 'configContent',
                filepath: 'readPath'
              }
            }
          ]
        }
      ]
    };

    const result = await executor.executePlan(plan);

    expect(result.success).toBe(true);
    expect(result.completedSteps).toEqual(['setup-chain']);

    // Verify the chained operations worked
    const expectedConfigPath = path.join(tempDir, 'chain-test', 'config.json');
    expect(await fs.access(expectedConfigPath).then(() => true, () => false)).toBe(true);

    const actualContent = await fs.readFile(expectedConfigPath, 'utf8');
    const parsedContent = JSON.parse(actualContent);
    expect(parsedContent.name).toBe('test-config');
  });

  test('should handle file operation errors gracefully', async () => {
    const plan = {
      id: 'error-handling-test',
      name: 'Error Handling Test',
      status: 'validated',
      steps: [
        {
          id: 'error-test',
          name: 'Error Test Step',
          actions: [
            {
              id: 'invalid-read',
              type: 'file_read',
              inputs: {
                filepath: '/nonexistent/path/file.txt'
              },
              outputs: {
                content: 'fileContent'
              }
            }
          ]
        }
      ]
    };

    const result = await executor.executePlan(plan);

    expect(result.success).toBe(false);
    expect(result.failedSteps).toContain('error-test');
    expect(result.completedSteps).toHaveLength(0);
  });

  test('should work with legacy parameters format', async () => {
    const legacyPlan = {
      id: 'legacy-file-test',
      name: 'Legacy File Test',
      status: 'validated',
      steps: [
        {
          id: 'legacy-operations',
          name: 'Legacy Operations',
          actions: [
            {
              id: 'legacy-dir',
              type: 'directory_create',
              parameters: {
                dirpath: path.join(tempDir, 'legacy-dir'),
                operation: 'create'
              }
            },
            {
              id: 'legacy-file',
              type: 'file_write',
              parameters: {
                filepath: path.join(tempDir, 'legacy-dir', 'legacy.txt'),
                content: 'Legacy content'
              }
            }
          ]
        }
      ]
    };

    const result = await executor.executePlan(legacyPlan);

    expect(result.success).toBe(true);
    expect(result.completedSteps).toEqual(['legacy-operations']);

    // Verify legacy operations worked
    const legacyFile = path.join(tempDir, 'legacy-dir', 'legacy.txt');
    expect(await fs.access(legacyFile).then(() => true, () => false)).toBe(true);
    
    const content = await fs.readFile(legacyFile, 'utf8');
    expect(content).toBe('Legacy content');
  });

  test('should emit proper events during execution', async () => {
    const events = [];
    
    executor.on('plan:start', (e) => events.push({ type: 'plan:start', planId: e.planId }));
    executor.on('step:start', (e) => events.push({ type: 'step:start', stepId: e.stepId }));
    executor.on('action:start', (e) => events.push({ type: 'action:start', actionId: e.actionId }));
    executor.on('action:complete', (e) => events.push({ type: 'action:complete', actionId: e.actionId }));
    executor.on('step:complete', (e) => events.push({ type: 'step:complete', stepId: e.stepId }));
    executor.on('plan:complete', (e) => events.push({ type: 'plan:complete', success: e.success }));

    const plan = {
      id: 'event-test',
      name: 'Event Test',
      status: 'validated',
      steps: [
        {
          id: 'simple-step',
          name: 'Simple Step',
          actions: [
            {
              id: 'simple-action',
              type: 'file_write',
              inputs: {
                filepath: path.join(tempDir, 'event-test.txt'),
                content: 'Event test content'
              },
              outputs: {}
            }
          ]
        }
      ]
    };

    await executor.executePlan(plan);

    // Verify event sequence
    expect(events.map(e => e.type)).toEqual([
      'plan:start',
      'step:start', 
      'action:start',
      'action:complete',
      'step:complete',
      'plan:complete'
    ]);

    expect(events.find(e => e.type === 'plan:start')?.planId).toBe('event-test');
    expect(events.find(e => e.type === 'step:start')?.stepId).toBe('simple-step');
    expect(events.find(e => e.type === 'action:start')?.actionId).toBe('simple-action');
    expect(events.find(e => e.type === 'plan:complete')?.success).toBe(true);
  });
});