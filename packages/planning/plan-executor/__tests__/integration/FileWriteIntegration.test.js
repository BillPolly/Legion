/**
 * Integration test for plan execution with real file writing using Legion file module
 */

import { PlanExecutor } from '../../src/core/PlanExecutor.js';
import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import FileModule from '../../../general-tools/src/file/FileModule.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('File Write Integration with Real Tools', () => {
  let executor;
  let resourceManager;
  let moduleLoader;
  let tempDir;

  beforeEach(async () => {
    // Create a temporary directory for test files in __tests__/tmp
    const testTmpDir = path.join(__dirname, '..', 'tmp');
    await fs.mkdir(testTmpDir, { recursive: true });
    tempDir = await fs.mkdtemp(path.join(testTmpDir, 'plan-executor-test-'));
    
    // Create real ResourceManager and ModuleLoader
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load the actual FileModule from Legion
    await moduleLoader.loadModuleByName('file', FileModule);
    
    // Create executor with the real module loader
    executor = new PlanExecutor({ moduleLoader });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should execute a plan that writes a file using real file_operations tool', async () => {
    // Verify the file_operations tool is available
    const toolNames = moduleLoader.getToolNames();
    expect(toolNames).toContain('file_operations');
    
    const fileOpsTool = moduleLoader.getTool('file_operations');
    expect(fileOpsTool).toBeTruthy();
    expect(fileOpsTool.name).toBe('file_operations');
    
    // Create a plan that uses the real file_operations tool
    const plan = {
      id: 'file-write-test',
      name: 'File Write Test Plan',
      status: 'validated',
      workspaceDir: tempDir,
      steps: [
        {
          id: 'create-file',
          name: 'Create Test File',
          actions: [
            {
              type: 'file_operations',  // Using the real tool name
              parameters: {
                filepath: '$workspaceDir/test-output.txt',  // file_operations uses 'filepath' not 'path'
                content: 'Hello from plan executor test!\nThis file was created by an automated test using REAL Legion tools.',
                encoding: 'utf8'
              }
            }
          ]
        }
      ]
    };

    // Execute the plan with the real tools
    const result = await executor.executePlan(plan, { 
      workspaceDir: tempDir,
      emitProgress: true 
    });

    // Verify execution was successful
    expect(result.success).toBe(true);
    expect(result.completedSteps).toEqual(['create-file']);
    expect(result.failedSteps).toEqual([]);
    expect(result.statistics.totalSteps).toBe(1);

    // Verify the file was actually created
    const expectedFilePath = path.join(tempDir, 'test-output.txt');
    const fileExists = await fs.access(expectedFilePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Verify file contents
    const fileContents = await fs.readFile(expectedFilePath, 'utf8');
    expect(fileContents).toBe('Hello from plan executor test!\nThis file was created by an automated test using REAL Legion tools.');
  });

  test('should handle workspace directory from execution options with real tools', async () => {
    // Create another temp directory in __tests__/tmp
    const testTmpDir = path.join(__dirname, '..', 'tmp');
    const customWorkspace = await fs.mkdtemp(path.join(testTmpDir, 'custom-workspace-'));
    
    const plan = {
      id: 'workspace-override-test',
      name: 'Workspace Override Test',
      status: 'validated',
      // No workspaceDir in plan - will use execution options
      steps: [
        {
          id: 'create-file-custom',
          name: 'Create File in Custom Workspace',
          actions: [
            {
              type: 'file_operations',  // Real tool
              parameters: {
                filepath: '$workspaceDir/custom-output.txt',  // file_operations parameter name
                content: 'This file is in the custom workspace'
              }
            }
          ]
        }
      ]
    };

    // Execute with custom workspace directory
    const result = await executor.executePlan(plan, {
      workspaceDir: customWorkspace
    });

    expect(result.success).toBe(true);
    
    // Verify file was created in custom workspace
    const filePath = path.join(customWorkspace, 'custom-output.txt');
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Clean up
    await fs.rm(customWorkspace, { recursive: true, force: true });
  });

  test('should create directory and list contents using real tools', async () => {
    // Let's use multiple real tools - directory_create and directory_list
    const plan = {
      id: 'multi-tool-test',
      name: 'Multiple Real Tools Test',
      status: 'validated',
      workspaceDir: tempDir,
      steps: [
        {
          id: 'create-dir',
          name: 'Create Output Directory',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                dirpath: '$workspaceDir/output',
                operation: 'create'  // directory_create operation
              }
            }
          ]
        },
        {
          id: 'write-file',
          name: 'Write File to Directory',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                filepath: '$workspaceDir/output/data.txt',
                content: 'This is test data in the output directory'
              }
            }
          ]
        },
        {
          id: 'list-dir',
          name: 'List Directory Contents',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                dirpath: '$workspaceDir/output',
                operation: 'list'  // directory_list operation
              }
            }
          ]
        }
      ]
    };

    const result = await executor.executePlan(plan);
    expect(result.success).toBe(true);
    expect(result.completedSteps).toEqual(['create-dir', 'write-file', 'list-dir']);

    // Verify directory was created and file exists
    const outputDir = path.join(tempDir, 'output');
    const outputFile = path.join(outputDir, 'data.txt');
    
    const dirExists = await fs.access(outputDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);
    
    const fileExists = await fs.access(outputFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    // The PlanExecutor doesn't expose step results in the current implementation
    // Just verify the plan executed successfully which means all steps worked
  });
});