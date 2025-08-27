/**
 * End-to-end test: Load pre-written behavior tree and execute it successfully
 * NO LLM PLANNING - just execution of static BT files
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('BT Executor End-to-End Execution Tests', () => {
  let testDir;
  let originalDir;

  beforeAll(() => {
    originalDir = process.cwd();
  });

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'e2e-output', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    console.log(`📁 Test directory: ${testDir}`);
  });

  afterEach(async () => {
    process.chdir(originalDir);
  });

  test('should execute pre-written simple file write behavior tree', async () => {
    console.log('\n🚀 Starting BT Execution Test (No LLM Planning)');
    
    // Load pre-written behavior tree
    const btPath = path.join(__dirname, '../test-plans/simple-file-write-bt.json');
    const btContent = await fs.readFile(btPath, 'utf-8');
    const behaviorTree = JSON.parse(btContent);
    
    console.log('✅ Loaded behavior tree:', behaviorTree.id);
    
    // Setup mock tools
    const mockToolRegistry = {
      getToolById: async (id) => {
        if (id === 'file_write') {
          return {
            name: 'file_write',
            execute: async (params) => {
              const { filepath, content } = params;
              const fullPath = path.resolve(filepath);
              await fs.writeFile(fullPath, content);
              
              return {
                success: true,
                data: {
                  filepath: fullPath,
                  content: content,
                  bytesWritten: content.length,
                  created: new Date().toISOString()
                }
              };
            }
          };
        }
        return null;
      }
    };
    
    // Create executor and run
    const executor = new DebugBehaviorTreeExecutor(mockToolRegistry);
    
    await executor.initializeTree(behaviorTree);
    executor.setMode('run');
    
    const result = await executor.runToCompletion();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify file was created
    const outputPath = path.join(testDir, 'test-output.txt');
    const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    const fileContent = await fs.readFile(outputPath, 'utf-8');
    expect(fileContent).toContain('This is a test file created by BT executor');
    
    // Check that artifacts were stored
    const state = executor.getExecutionState();
    expect(state.context.artifacts.file_result).toBeDefined();
    expect(state.context.artifacts.file_result.success).toBe(true);
    
    console.log('✅ BT Execution completed successfully');
  }, 10000); // 10 second timeout - no LLM calls needed
});