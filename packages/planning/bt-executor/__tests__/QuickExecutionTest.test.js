/**
 * Quick test to verify the executor fix works
 */

import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';
import path from 'path';

describe('Quick Execution Test', () => {
  test('should execute plan with fixed toolId lookup', async () => {
    // Create test directory
    const testDir = path.join(process.cwd(), '__tests__', 'quick-test', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    // Simple plan (matching what LLM generates)
    const plan = {
      "type": "sequence",
      "id": "root",
      "description": "Create and run Hello World program",
      "children": [
        {
          "type": "action",
          "id": "write-hello-world",
          "tool": "file_writer",
          "description": "Create hello world JavaScript file",
          "inputs": {
            "filePath": "hello.js",
            "content": "console.log('Hello World!');"
          },
          "outputs": {
            "filepath": "js_file_path"
          }
        },
        {
          "type": "action", 
          "id": "execute-hello-world",
          "tool": "run_node",
          "description": "Execute the hello world script",
          "inputs": {
            "projectPath": ".",
            "command": "node hello.js"
          }
        }
      ]
    };

    // Mock executable tools
    const executableTools = new Map();
    
    executableTools.set('file_writer', {
      name: 'file_writer',
      async execute(inputs) {
        console.log('[TOOL] file_writer called with:', inputs);
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
        console.log('[TOOL] run_node called with:', inputs);
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
            console.log('[TOOL] run_node completed with code:', code, 'stdout:', stdout);
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
    
    // Mock registry
    const mockRegistry = {
      getTool: (name) => executableTools.get(name),
      getToolById: (id) => executableTools.get(id)
    };
    
    console.log('\n🔧 Testing fixed executor...');
    console.log('Current dir:', process.cwd());
    
    const executor = new DebugBehaviorTreeExecutor(mockRegistry);
    
    // Initialize tree
    await executor.initializeTree(plan);
    
    // Set to run mode for full execution
    executor.executionMode = 'run';
    
    // Execute
    const result = await executor.execute();
    
    console.log('\n📊 Execution Result:');
    console.log('Success:', result.success);
    console.log('Message:', result.message);
    console.log('Artifacts:', executor.executionContext.artifacts);
    
    // Check if file was created
    const files = await fs.readdir('.');
    console.log('Files created:', files);
    
    const helloExists = files.includes('hello.js');
    if (helloExists) {
      const content = await fs.readFile('hello.js', 'utf-8');
      console.log('✅ hello.js created with content:', content);
    } else {
      console.log('❌ hello.js not found');
    }
    
    expect(result.success).toBe(true);
    expect(helloExists).toBe(true);

    // Clean up
    process.chdir(path.join(process.cwd(), '../../../'));
    await fs.rm(testDir, { recursive: true, force: true });

    console.log('\n🎉 Test completed successfully!');
  }, 30000);
});