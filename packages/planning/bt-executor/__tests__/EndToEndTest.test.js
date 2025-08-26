/**
 * End-to-end test: Generate plan with LLM, validate it, and execute it successfully
 */

import { Planner } from '@legion/planner';
import { LLMClient } from '@legion/llm';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { BTValidator } from '@legion/bt-validator';
import toolRegistry from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';

// Load environment variables from monorepo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: rootPath });

describe('End-to-End Hello World Test', () => {
  let testDir;
  let originalDir;

  beforeAll(async () => {
    originalDir = process.cwd();
    
    // Ensure modules are loaded
    try {
      // Load file tools
      const FileModule = (await import('@legion/tools-collection/src/file/index.js')).default;
      await FileModule.create();
      
      // Load node runner tools  
      const NodeRunnerModule = (await import('@legion/node-runner')).default;
      const nodeModule = new NodeRunnerModule();
      await nodeModule.initialize();
      
      console.log('✅ Modules loaded successfully');
    } catch (error) {
      console.error('❌ Error loading modules:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'e2e-output', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    console.log(`📁 Test directory: ${testDir}`);
  });

  afterEach(async () => {
    // Clean up
    process.chdir(originalDir);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('should generate, validate and execute hello world plan end-to-end', async () => {
    console.log('\n🚀 Starting End-to-End Test\n');
    
    // Step 1: Initialize LLM
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found');
    }

    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });

    // Step 2: Define tools for LLM (matching what registry would provide)
    console.log('📋 Step 2: Setting up tools...');
    
    const tools = [
      {
        name: 'file_writer',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path where file should be written' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filePath', 'content']
        }
      },
      {
        name: 'run_node',
        description: 'Execute JavaScript file using Node.js',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: { type: 'string', description: 'Project directory path' },
            command: { type: 'string', description: 'Command to execute' }
          },
          required: ['projectPath', 'command']
        }
      }
    ];
    
    console.log(`✅ Tools defined: ${tools.map(t => t.name).join(', ')}`);

    // Step 3: Generate plan with LLM
    console.log('\n🧠 Step 3: Generating plan with LLM...');
    const planner = new Planner({
      llmClient: llmClient,
      tools: tools
    });

    const goal = "please write a simple hello world program in javascript";
    console.log(`Goal: "${goal}"`);
    
    const planResult = await planner.makePlan(goal, tools, {
      maxAttempts: 1,
      saveDebugFiles: true
    });
    
    expect(planResult.success).toBe(true);
    const plan = planResult.data.plan;
    
    console.log('✅ Plan generated successfully');
    console.log('Plan structure:', JSON.stringify(plan, null, 2));
    
    // DEBUG: Check the actual structure the executor will see
    console.log('\n🔍 DEBUG: Checking plan structure for executor...');
    plan.children.forEach((child, i) => {
      console.log(`Child ${i}:`, {
        id: child.id,
        tool: child.tool,
        toolId: child.toolId,
        config: child.config
      });
    });

    // Step 4: Validate plan
    console.log('\n✅ Step 4: Validating plan...');
    const validator = new BTValidator({
      strictMode: true,
      validateTools: true,
      applyDefaults: true
    });

    const validation = await validator.validate(plan, tools);
    
    if (!validation.valid) {
      console.error('❌ Validation failed:');
      validation.errors.forEach(err => {
        console.error(`  - ${err.type}: ${err.message}`);
      });
    }
    
    expect(validation.valid).toBe(true);
    console.log('✅ Plan validation passed');

    // Step 5: Execute plan
    console.log('\n⚡ Step 5: Executing plan...');
    console.log('Current working directory:', process.cwd());
    
    // Create mock executable tools
    const executableTools = new Map();
    
    executableTools.set('file_writer', {
      name: 'file_writer',
      async execute(inputs) {
        const { filePath, content } = inputs;
        await fs.writeFile(filePath, content, 'utf-8');
        const stats = await fs.stat(filePath);
        return {
          success: true,
          data: {
            filepath: path.resolve(filePath),
            bytesWritten: stats.size,
            created: true
          }
        };
      }
    });

    executableTools.set('run_node', {
      name: 'run_node',
      async execute(inputs) {
        const { projectPath, command } = inputs;
        const { spawn } = await import('child_process');
        
        return new Promise((resolve) => {
          const [cmd, ...args] = command.split(' ');
          const child = spawn(cmd, args, { 
            cwd: projectPath, 
            stdio: ['pipe', 'pipe', 'pipe'] 
          });
          
          let stdout = '';
          let stderr = '';
          
          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          child.on('close', (code) => {
            resolve({
              success: code === 0,
              data: {
                exitCode: code,
                stdout: stdout.trim(),
                stderr: stderr.trim()
              }
            });
          });
        });
      }
    });
    
    // Create mock registry
    const mockRegistry = {
      getTool: (name) => executableTools.get(name),
      getToolById: (id) => executableTools.get(id)
    };
    
    const executor = new DebugBehaviorTreeExecutor(mockRegistry);
    
    // Initialize tree
    await executor.initializeTree(plan);
    
    // DEBUG: Check what the tree looks like after initialization
    console.log('\n🔍 DEBUG: Tree after initialization...');
    console.log('Root node config:', executor.rootNode?.config);
    if (executor.rootNode?.children) {
      executor.rootNode.children.forEach((child, i) => {
        console.log(`Child ${i} config:`, {
          type: child.config?.type,
          id: child.config?.id,
          tool: child.config?.tool,
          tool_id: child.config?.tool_id,
          toolId: child.config?.toolId,
          inputs: child.config?.inputs
        });
      });
    }
    
    // Set to run mode for full execution
    executor.executionMode = 'run';
    
    // Execute
    const executionResult = await executor.execute();
    
    console.log('\n📊 Execution Results:');
    console.log('Success:', executionResult.success);
    console.log('Message:', executionResult.message);
    
    if (executionResult.error) {
      console.error('Error:', executionResult.error);
    }
    
    if (executionResult.artifacts) {
      console.log('Artifacts:', executionResult.artifacts);
    }
    
    if (executor.executionContext?.artifacts) {
      console.log('Context artifacts:', executor.executionContext.artifacts);
    }

    // Step 6: Verify results
    console.log('\n🔍 Step 6: Verifying results...');
    
    // Check if execution was successful
    expect(executionResult.success).toBe(true);
    
    // List files in directory
    const files = await fs.readdir(testDir);
    console.log('Files created:', files);
    
    // Verify hello.js was created
    const helloFile = path.join(testDir, 'hello.js');
    const fileExists = await fs.access(helloFile).then(() => true).catch(() => false);
    
    if (fileExists) {
      const content = await fs.readFile(helloFile, 'utf-8');
      console.log('✅ hello.js created with content:', JSON.stringify(content));
      
      expect(content).toContain('console.log');
      expect(content.toLowerCase()).toContain('hello');
    } else {
      console.error('❌ hello.js file not found');
      
      // List all files for debugging
      try {
        const allFiles = await fs.readdir('.', { recursive: true });
        console.log('All files in current directory:', allFiles);
      } catch (e) {
        console.log('Could not list files:', e.message);
      }
    }
    
    expect(fileExists).toBe(true);
    
    console.log('\n🎉 End-to-End Test Completed Successfully!');
    console.log('✅ Plan generated by LLM');
    console.log('✅ Plan validated');
    console.log('✅ Plan executed');
    console.log('✅ File created');
    console.log('✅ Content verified');

  }, 180000); // 3 minute timeout
});