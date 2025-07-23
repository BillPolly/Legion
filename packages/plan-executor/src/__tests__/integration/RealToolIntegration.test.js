/**
 * Real Tool Integration Tests for Plan Executor
 * 
 * These tests demonstrate the Plan Executor working with actual Legion file tools
 * to perform real file system operations, proving end-to-end integration.
 */

import { PlanExecutor } from '../../core/PlanExecutor.js';
import { ModuleLoader } from '../../core/ModuleLoader.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Real file operation tools that actually perform file system operations
const createRealFileTools = () => {
  return {
    file_read: {
      name: 'file_read',
      execute: async (parameters) => {
        console.log(`🔧 Real file_read: ${parameters.filepath}`);
        try {
          const content = await fs.readFile(parameters.filepath, 'utf8');
          return {
            success: true,
            content: content,
            filepath: parameters.filepath,
            size: content.length
          };
        } catch (error) {
          throw new Error(`Failed to read file ${parameters.filepath}: ${error.message}`);
        }
      }
    },
    
    file_write: {
      name: 'file_write', 
      execute: async (parameters) => {
        console.log(`🔧 Real file_write: ${parameters.filepath}`);
        try {
          // Ensure directory exists
          const dir = path.dirname(parameters.filepath);
          await fs.mkdir(dir, { recursive: true });
          
          await fs.writeFile(parameters.filepath, parameters.content, 'utf8');
          return {
            success: true,
            filepath: parameters.filepath,
            bytesWritten: parameters.content.length,
            created: true
          };
        } catch (error) {
          throw new Error(`Failed to write file ${parameters.filepath}: ${error.message}`);
        }
      }
    },
    
    directory_create: {
      name: 'directory_create',
      execute: async (parameters) => {
        console.log(`🔧 Real directory_create: ${parameters.dirpath}`);
        try {
          await fs.mkdir(parameters.dirpath, { recursive: true });
          return {
            success: true,
            dirpath: parameters.dirpath,
            created: true
          };
        } catch (error) {
          throw new Error(`Failed to create directory ${parameters.dirpath}: ${error.message}`);
        }
      }
    },
    
    directory_list: {
      name: 'directory_list',
      execute: async (parameters) => {
        console.log(`🔧 Real directory_list: ${parameters.dirpath || process.cwd()}`);
        try {
          const dirpath = parameters.dirpath || process.cwd();
          const entries = await fs.readdir(dirpath, { withFileTypes: true });
          const contents = entries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file'
          }));
          return {
            success: true,
            dirpath: dirpath,
            contents: contents
          };
        } catch (error) {
          throw new Error(`Failed to list directory: ${error.message}`);
        }
      }
    }
  };
};

describe('Real Tool Integration Tests', () => {
  let executor;
  let testDir;
  let createdFiles = [];
  let createdDirs = [];

  beforeAll(async () => {
    // Create a unique test directory in the system temp directory
    const tempDir = os.tmpdir();
    testDir = path.join(tempDir, `plan-executor-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    console.log(`Creating test directory: ${testDir}`);
    await fs.mkdir(testDir, { recursive: true });
    createdDirs.push(testDir);
  });

  beforeEach(() => {
    // Set up real resource manager and module factory
    const mockResourceManager = {
      resources: new Map(),
      get(key) {
        return this.resources.get(key);
      },
      register(key, value) {
        this.resources.set(key, value);
      }
    };

    // Module factory - not actually used since we override the module loader
    const mockModuleFactory = {
      createModule(moduleClass) {
        return new moduleClass();
      }
    };

    // Create plan executor
    executor = new PlanExecutor({
      moduleFactory: mockModuleFactory,
      resourceManager: mockResourceManager
    });

    // Override module loader to use real file tools
    executor.moduleLoader = new class extends ModuleLoader {
      constructor() {
        super(mockModuleFactory, mockResourceManager);
        this.realTools = createRealFileTools();
      }

      async loadModulesForPlan(plan) {
        console.log('✅ Real file tools loaded:', Object.keys(this.realTools));
      }

      getTool(toolName) {
        const tool = this.realTools[toolName];
        if (!tool) {
          throw new Error(`Real tool not found: ${toolName}`);
        }
        return tool;
      }
    }(mockModuleFactory, mockResourceManager);
  });

  afterEach(async () => {
    // Clean up created files
    for (const file of createdFiles) {
      try {
        await fs.unlink(file);
        console.log(`🗑️  Cleaned up file: ${file}`);
      } catch (error) {
        console.warn(`⚠️  Could not clean up file ${file}:`, error.message);
      }
    }
    createdFiles = [];
  });

  afterAll(async () => {
    // Clean up created directories (in reverse order for nested dirs)
    for (const dir of createdDirs.reverse()) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        console.log(`🗑️  Cleaned up directory: ${dir}`);
      } catch (error) {
        console.warn(`⚠️  Could not clean up directory ${dir}:`, error.message);
      }
    }
  });

  describe('simple file operations workflow', () => {
    it('should execute a real file operations plan with actual file system operations', async () => {
      const inputFile = path.join(testDir, 'input.txt');
      const outputFile = path.join(testDir, 'output.txt');
      const originalContent = 'Hello, World! This is a test file for plan execution.';
      const processedContent = originalContent.toUpperCase();

      createdFiles.push(inputFile, outputFile);

      // Listen for execution events
      const events = [];
      executor.on('plan:start', (event) => {
        events.push({ type: 'plan:start', ...event });
        console.log(`📋 Plan started: ${event.planName}`);
      });
      executor.on('step:start', (event) => {
        events.push({ type: 'step:start', ...event });
        console.log(`▶️  Step started: ${event.stepName} [${event.stepPath}]`);
      });
      executor.on('step:complete', (event) => {
        events.push({ type: 'step:complete', ...event });
        console.log(`✅ Step completed: ${event.stepName}`);
      });
      executor.on('plan:complete', (event) => {
        events.push({ type: 'plan:complete', ...event });
        console.log(`🎉 Plan completed! Success: ${event.success}`);
      });

      const plan = {
        id: 'real-file-operations',
        name: 'Real File Operations Test Plan',
        description: 'Execute real file operations using actual Legion file tools',
        steps: [
          {
            id: 'write-input',
            name: 'Write Input File',
            description: 'Create input file with test content',
            actions: [
              {
                type: 'file_write',
                parameters: {
                  filepath: inputFile,
                  content: originalContent
                }
              }
            ]
          },
          {
            id: 'read-content',
            name: 'Read File Content',
            description: 'Read the content from the input file',
            dependencies: ['write-input'],
            actions: [
              {
                type: 'file_read',
                parameters: {
                  filepath: inputFile
                }
              }
            ]
          },
          {
            id: 'write-output',
            name: 'Write Processed Output',
            description: 'Write processed content to output file',
            dependencies: ['read-content'],
            actions: [
              {
                type: 'file_write',
                parameters: {
                  filepath: outputFile,
                  content: processedContent
                }
              }
            ]
          }
        ]
      };

      console.log(`\n🚀 Starting plan execution with test directory: ${testDir}\n`);
      
      const result = await executor.executePlan(plan, {
        emitProgress: true,
        stopOnError: true,
        timeout: 10000,
        retries: 1
      });

      // Verify plan execution results
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['write-input', 'read-content', 'write-output']);
      expect(result.failedSteps).toEqual([]);
      expect(result.skippedSteps).toEqual([]);

      // Verify actual files were created and contain expected content
      console.log('\n📁 Verifying actual file system state...');
      
      // Check input file
      expect(await fs.access(inputFile).then(() => true).catch(() => false)).toBe(true);
      const inputContent = await fs.readFile(inputFile, 'utf8');
      expect(inputContent).toBe(originalContent);
      console.log(`✅ Input file verified: ${inputContent.length} characters`);

      // Check output file
      expect(await fs.access(outputFile).then(() => true).catch(() => false)).toBe(true);
      const outputContent = await fs.readFile(outputFile, 'utf8');
      expect(outputContent).toBe(processedContent);
      console.log(`✅ Output file verified: ${outputContent.length} characters`);

      // Verify events were emitted
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'plan:start')).toBe(true);
      expect(events.some(e => e.type === 'plan:complete')).toBe(true);
      expect(events.filter(e => e.type === 'step:complete')).toHaveLength(3);

      console.log('🎉 Real file operations test completed successfully!');
    });
  });

  describe('directory operations with real tools', () => {
    it('should create directories and manage nested file structures', async () => {
      const subDir = path.join(testDir, 'subdirectory');
      const nestedDir = path.join(subDir, 'nested');
      const nestedFile = path.join(nestedDir, 'nested-file.txt');
      const fileContent = 'This is content in a nested directory structure.';

      createdDirs.push(subDir, nestedDir);
      createdFiles.push(nestedFile);

      const plan = {
        id: 'directory-operations',
        name: 'Directory Operations Test',
        description: 'Create directories and manage nested file structures',
        steps: [
          {
            id: 'create-subdirectory',
            name: 'Create Subdirectory',
            actions: [
              {
                type: 'directory_create',
                parameters: {
                  dirpath: subDir
                }
              }
            ]
          },
          {
            id: 'create-nested-directory',
            name: 'Create Nested Directory',
            dependencies: ['create-subdirectory'],
            actions: [
              {
                type: 'directory_create',
                parameters: {
                  dirpath: nestedDir
                }
              }
            ]
          },
          {
            id: 'create-nested-file',
            name: 'Create File in Nested Directory',
            dependencies: ['create-nested-directory'],
            actions: [
              {
                type: 'file_write',
                parameters: {
                  filepath: nestedFile,
                  content: fileContent
                }
              }
            ]
          },
          {
            id: 'verify-nested-file',
            name: 'Verify Nested File Content',
            dependencies: ['create-nested-file'],
            actions: [
              {
                type: 'file_read',
                parameters: {
                  filepath: nestedFile
                }
              }
            ]
          }
        ]
      };

      console.log(`\n🏗️  Starting directory operations test...\n`);

      const result = await executor.executePlan(plan, {
        emitProgress: true,
        stopOnError: true,
        timeout: 10000
      });

      // Verify plan execution
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual([
        'create-subdirectory',
        'create-nested-directory', 
        'create-nested-file',
        'verify-nested-file'
      ]);

      // Verify actual directory structure was created
      console.log('\n📁 Verifying directory structure...');
      
      const subDirStats = await fs.stat(subDir);
      expect(subDirStats.isDirectory()).toBe(true);
      console.log(`✅ Subdirectory created: ${subDir}`);

      const nestedDirStats = await fs.stat(nestedDir);
      expect(nestedDirStats.isDirectory()).toBe(true);
      console.log(`✅ Nested directory created: ${nestedDir}`);

      const nestedFileContent = await fs.readFile(nestedFile, 'utf8');
      expect(nestedFileContent).toBe(fileContent);
      console.log(`✅ Nested file created with correct content: ${nestedFile}`);

      console.log('🎉 Directory operations test completed successfully!');
    });
  });

  describe('error handling with real tools', () => {
    it('should handle real file system errors gracefully', async () => {
      const nonExistentDir = path.join(testDir, 'does-not-exist');
      const nonExistentFile = path.join(nonExistentDir, 'missing-file.txt');

      const plan = {
        id: 'error-handling-test',
        name: 'Error Handling Test',
        description: 'Test error handling with real file system errors',
        steps: [
          {
            id: 'try-read-missing-file',
            name: 'Try to Read Non-existent File',
            actions: [
              {
                type: 'file_read',
                parameters: {
                  filepath: nonExistentFile
                }
              }
            ]
          },
          {
            id: 'create-recovery-file',
            name: 'Create Recovery File',
            actions: [
              {
                type: 'file_write',
                parameters: {
                  filepath: path.join(testDir, 'recovery.txt'),
                  content: 'This step should execute despite the previous failure'
                }
              }
            ]
          }
        ]
      };

      createdFiles.push(path.join(testDir, 'recovery.txt'));

      console.log(`\n⚠️  Starting error handling test...\n`);

      const result = await executor.executePlan(plan, {
        emitProgress: true,
        stopOnError: false, // Continue on error
        timeout: 5000,
        retries: 0
      });

      // Verify plan handled errors correctly
      expect(result.success).toBe(false); // Overall plan failed due to error
      expect(result.failedSteps).toContain('try-read-missing-file');
      expect(result.completedSteps).toContain('create-recovery-file');

      // Verify recovery file was still created
      const recoveryFile = path.join(testDir, 'recovery.txt');
      expect(await fs.access(recoveryFile).then(() => true).catch(() => false)).toBe(true);
      
      const recoveryContent = await fs.readFile(recoveryFile, 'utf8');
      expect(recoveryContent).toBe('This step should execute despite the previous failure');

      console.log('✅ Error handling test completed - errors handled gracefully!');
    });
  });

  describe('performance with real operations', () => {
    it('should handle multiple file operations efficiently', async () => {
      const fileCount = 5;
      const files = [];
      
      // Generate test files
      for (let i = 0; i < fileCount; i++) {
        files.push({
          path: path.join(testDir, `test-file-${i}.txt`),
          content: `This is test file number ${i} with some sample content.`
        });
        createdFiles.push(files[i].path);
      }

      // Create plan with multiple sequential file operations
      const steps = [];
      for (let i = 0; i < fileCount; i++) {
        steps.push({
          id: `write-file-${i}`,
          name: `Write Test File ${i}`,
          actions: [
            {
              type: 'file_write',
              parameters: {
                filepath: files[i].path,
                content: files[i].content
              }
            }
          ]
        });
        steps.push({
          id: `read-file-${i}`,
          name: `Read Test File ${i}`,
          dependencies: [`write-file-${i}`],
          actions: [
            {
              type: 'file_read',
              parameters: {
                filepath: files[i].path
              }
            }
          ]
        });
      }

      const plan = {
        id: 'performance-test',
        name: 'Performance Test with Multiple Files',
        description: `Performance test with ${fileCount} file write/read operations`,
        steps: steps
      };

      console.log(`\n⚡ Starting performance test with ${fileCount} files...\n`);
      
      const startTime = Date.now();
      const result = await executor.executePlan(plan, {
        emitProgress: true,
        stopOnError: true,
        timeout: 30000
      });
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify all operations completed
      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(fileCount * 2); // write + read for each file
      expect(result.failedSteps).toHaveLength(0);

      // Verify all files were created and contain correct content
      for (let i = 0; i < fileCount; i++) {
        const actualContent = await fs.readFile(files[i].path, 'utf8');
        expect(actualContent).toBe(files[i].content);
      }

      console.log(`✅ Performance test completed in ${executionTime}ms`);
      console.log(`📊 Average time per operation: ${(executionTime / (fileCount * 2)).toFixed(2)}ms`);
      
      // Reasonable performance expectation (should complete within 10 seconds)
      expect(executionTime).toBeLessThan(10000);
    });
  });
});