/**
 * Comprehensive test suite for CommandExecutorModule
 * Tests command execution tool with 100% coverage including security features
 */

import CommandExecutorModule from '../CommandExecutorModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('CommandExecutorModule', () => {
  let resourceManager;
  let commandExecutorModule;
  let testDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    commandExecutorModule = await CommandExecutorModule.create(resourceManager);
    
    // Create test directory for file operations
    testDir = join(process.cwd(), 'src', 'command-executor', '__tests__', 'tmp');
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Module Creation and Initialization', () => {
    test('should create module with correct metadata', () => {
      expect(commandExecutorModule.name).toBe('command-executor');
      expect(commandExecutorModule.description).toContain('Command execution');
      expect(commandExecutorModule.version).toBe('1.0.0');
    });

    test('should have ResourceManager injected', () => {
      expect(commandExecutorModule.resourceManager).toBe(resourceManager);
    });

    test('should register command executor tool during initialization', () => {
      const tool = commandExecutorModule.getTool('command_executor');
      expect(tool).toBeDefined();
    });

    test('should have proper module structure', () => {
      expect(typeof commandExecutorModule.initialize).toBe('function');
      expect(typeof commandExecutorModule.getTool).toBe('function');
      expect(typeof commandExecutorModule.getTools).toBe('function');
    });

    test('should create module via static create method', async () => {
      const module = await CommandExecutorModule.create(resourceManager);
      expect(module).toBeInstanceOf(CommandExecutorModule);
      expect(module.resourceManager).toBe(resourceManager);
    });
  });

  describe('Command Executor Tool', () => {
    let tool;

    beforeEach(() => {
      tool = commandExecutorModule.getTool('command_executor');
    });

    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('command_executor');
      expect(tool.description).toContain('Execute a bash command');
    });

    test('should have getMetadata method', () => {
      expect(typeof tool.getMetadata).toBe('function');
      const metadata = tool.getMetadata();
      expect(metadata.name).toBe('command_executor');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
    });

    test('should have validate method', () => {
      expect(typeof tool.validate).toBe('function');
      const validation = tool.validate({ command: 'echo test' });
      expect(validation.valid).toBe(true);
    });

    // Basic Command Execution Tests
    test('should execute simple echo command successfully', async () => {
      const result = await tool.execute({ command: 'echo "Hello World"' });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.trim()).toBe('Hello World');
      expect(result.data.command).toBe('echo "Hello World"');
      expect(result.data.exitCode).toBe(0);
      expect(result.data.stderr).toBe('');
    });

    test('should execute pwd command successfully', async () => {
      const result = await tool.execute({ command: 'pwd' });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('/');
      expect(result.data.exitCode).toBe(0);
    });

    test('should execute ls command successfully', async () => {
      const result = await tool.execute({ command: 'ls -la' });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBeTruthy();
      expect(result.data.exitCode).toBe(0);
    });

    test('should handle commands with pipes', async () => {
      const result = await tool.execute({ command: 'echo "test line" | wc -l' });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.trim()).toBe('1');
      expect(result.data.exitCode).toBe(0);
    });

    test('should handle commands with variables', async () => {
      const result = await tool.execute({ command: 'TEST_VAR="hello"; echo $TEST_VAR' });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.trim()).toBe('hello');
      expect(result.data.exitCode).toBe(0);
    });

    // File Operations Tests
    test('should create and read files', async () => {
      const testFile = join(testDir, 'test.txt');
      const testContent = 'This is a test file';
      
      // Create file
      const createResult = await tool.execute({ 
        command: `echo "${testContent}" > "${testFile}"` 
      });
      expect(createResult.success).toBe(true);
      
      // Read file
      const readResult = await tool.execute({ 
        command: `cat "${testFile}"` 
      });
      expect(readResult.success).toBe(true);
      expect(readResult.data.stdout.trim()).toBe(testContent);
      
      // Cleanup
      await tool.execute({ command: `rm "${testFile}"` });
    });

    test('should handle file operations with spaces in paths', async () => {
      const testFile = join(testDir, 'test file.txt');
      const testContent = 'File with spaces';
      
      // Create file with spaces in name
      const createResult = await tool.execute({ 
        command: `echo "${testContent}" > "${testFile}"` 
      });
      expect(createResult.success).toBe(true);
      
      // Read file with spaces in name
      const readResult = await tool.execute({ 
        command: `cat "${testFile}"` 
      });
      expect(readResult.success).toBe(true);
      expect(readResult.data.stdout.trim()).toBe(testContent);
      
      // Cleanup
      await tool.execute({ command: `rm "${testFile}"` });
    });

    // Error Handling Tests
    test('should handle non-existent commands', async () => {
      const result = await tool.execute({ command: 'nonexistentcommand12345' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('exit_code');
      expect(result.data.exitCode).toBeGreaterThan(0);
      expect(result.error).toBeTruthy();
    });

    test('should handle commands with non-zero exit codes', async () => {
      const result = await tool.execute({ command: 'ls /nonexistent/directory' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('exit_code');
      expect(result.data.exitCode).toBeGreaterThan(0);
      expect(result.data.stderr).toBeTruthy();
    });

    test('should handle commands that write to stderr but succeed', async () => {
      const result = await tool.execute({ command: 'echo "error message" >&2; echo "success"' });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.trim()).toBe('success');
      expect(result.data.stderr.trim()).toBe('error message');
      expect(result.data.exitCode).toBe(0);
    });

    test('should handle missing command parameter', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle null command parameter', async () => {
      const result = await tool.execute({ command: null });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle empty command parameter', async () => {
      const result = await tool.execute({ command: '' });
      
      expect(result.success).toBe(true); // Empty command succeeds in bash
      expect(result.data.stdout).toBe('');
    });

    // Timeout Tests
    test('should handle timeout for long-running commands', async () => {
      const result = await tool.execute({ 
        command: 'sleep 2', 
        timeout: 1000 
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('timeout');
      expect(result.error).toBeTruthy();
    }, 10000);

    test('should complete fast commands within timeout', async () => {
      const result = await tool.execute({ 
        command: 'echo "fast"', 
        timeout: 5000 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.trim()).toBe('fast');
    });

    // Security Tests - Dangerous Command Detection
    test('should block rm -rf / command', async () => {
      const result = await tool.execute({ command: 'rm -rf /' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('dangerous_command');
      expect(result.error).toContain('safety');
    });

    test('should block rm -rf / with extra spaces', async () => {
      const result = await tool.execute({ command: 'rm -rf  /  ' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('dangerous_command');
    });

    test('should block disk wiping commands', async () => {
      const result = await tool.execute({ command: 'dd if=/dev/zero of=/dev/sda' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('dangerous_command');
    });

    test('should block fork bomb commands', async () => {
      const result = await tool.execute({ command: ':(){ :|:& };:' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('dangerous_command');
    });

    test('should block filesystem formatting commands', async () => {
      const result = await tool.execute({ command: 'mkfs.ext4 /dev/sda1' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('dangerous_command');
    });

    test('should allow safe rm commands', async () => {
      // Create a test file first
      const testFile = join(testDir, 'safe_to_delete.txt');
      await tool.execute({ command: `touch "${testFile}"` });
      
      const result = await tool.execute({ command: `rm "${testFile}"` });
      
      expect(result.success).toBe(true);
      expect(result.data.exitCode).toBe(0);
    });

    test('should allow safe ls commands in root', async () => {
      const result = await tool.execute({ command: 'ls /' });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBeTruthy();
    });

    // Performance and Stress Tests
    test('should handle large output', async () => {
      const result = await tool.execute({ 
        command: 'seq 1 1000 | head -50' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.split('\n').length).toBeGreaterThan(40);
    });

    test('should handle multiple commands with &&', async () => {
      const result = await tool.execute({ 
        command: 'echo "first" && echo "second" && echo "third"' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('first');
      expect(result.data.stdout).toContain('second');
      expect(result.data.stdout).toContain('third');
    });

    test('should handle command substitution', async () => {
      const result = await tool.execute({ 
        command: 'echo "Current date: $(date +%Y)"' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Current date:');
      expect(result.data.stdout).toMatch(/\d{4}/); // Should contain a year
    });

    // Complex Command Tests
    test('should handle grep with pipes', async () => {
      const result = await tool.execute({ 
        command: 'echo -e "apple\\nbanana\\ncherry" | grep "a"' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('apple');
      expect(result.data.stdout).toContain('banana');
      expect(result.data.stdout).not.toContain('cherry');
    });

    test('should handle awk processing', async () => {
      const result = await tool.execute({ 
        command: 'echo -e "1 apple 5\\n2 banana 3\\n4 cherry 1" | awk \'{print $2 ":" $3}\'' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('apple:5');
      expect(result.data.stdout).toContain('banana:3');  
      expect(result.data.stdout).toContain('cherry:1');
    });

    test('should handle sort operations', async () => {
      const result = await tool.execute({ 
        command: 'echo -e "3\\n1\\n4\\n2" | sort -n' 
      });
      
      expect(result.success).toBe(true);
      const lines = result.data.stdout.trim().split('\n');
      expect(lines).toEqual(['1', '2', '3', '4']);
    });
  });

  describe('Integration Tests', () => {
    test('should execute multiple commands in sequence', async () => {
      const tool = commandExecutorModule.getTool('command_executor');
      
      const commands = [
        'echo "test1"',
        'echo "test2"', 
        'echo "test3"'
      ];
      
      const results = await Promise.all(
        commands.map(cmd => tool.execute({ command: cmd }))
      );
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.stdout.trim()).toBe(`test${index + 1}`);
      });
    });

    test('should handle concurrent command execution', async () => {
      const tool = commandExecutorModule.getTool('command_executor');
      
      const commands = Array.from({ length: 5 }, (_, i) => 
        tool.execute({ command: `echo "concurrent${i}"` })
      );
      
      const results = await Promise.all(commands);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.stdout.trim()).toBe(`concurrent${index}`);
      });
    });

    test('should maintain command isolation', async () => {
      const tool = commandExecutorModule.getTool('command_executor');
      
      // Set a variable in one command
      const result1 = await tool.execute({ command: 'TEST_VAR="hello"' });
      expect(result1.success).toBe(true);
      
      // Try to access it in another command (should fail since they're isolated)
      const result2 = await tool.execute({ command: 'echo $TEST_VAR' });
      expect(result2.success).toBe(true);
      expect(result2.data.stdout.trim()).toBe(''); // Variable not preserved
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let tool;

    beforeEach(() => {
      tool = commandExecutorModule.getTool('command_executor');
    });

    test('should handle malformed commands gracefully', async () => {
      const result = await tool.execute({ command: 'echo "unclosed quote' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBeTruthy();
    });

    test('should handle binary output commands', async () => {
      // Create a small binary file and try to cat it
      const testFile = join(testDir, 'binary.bin');
      await tool.execute({ command: `echo -e "\\x00\\x01\\x02\\x03" > "${testFile}"` });
      
      const result = await tool.execute({ command: `cat "${testFile}"` });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBeTruthy();
      
      // Cleanup
      await tool.execute({ command: `rm "${testFile}"` });
    });

    test('should handle permission denied errors', async () => {
      // Try to write to a protected location (this might succeed in some environments)
      const result = await tool.execute({ command: 'echo "test" > /root/test.txt' });
      
      // Either succeeds or fails with permission error - both are valid
      if (!result.success) {
        expect(result.data.errorType).toBe('exit_code');
        expect(result.data.stderr).toBeTruthy();
      }
    });

    test('should handle very long command lines', async () => {
      const longString = 'a'.repeat(1000);
      const result = await tool.execute({ command: `echo "${longString}"` });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.trim()).toBe(longString);
    });

    test('should handle special characters in commands', async () => {
      const specialChars = 'hello@#$%world';
      const result = await tool.execute({ 
        command: `echo "${specialChars}"` 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.stdout.trim()).toBe(specialChars);
    });

    test('should maintain consistent error response format', async () => {
      const errorCommands = [
        'nonexistentcommand',
        'ls /nonexistent',
        ''
      ];

      for (const cmd of errorCommands) {
        try {
          const result = await tool.execute({ command: cmd });
          if (!result.success) {
            expect(result.data).toHaveProperty('command');
            expect(result.data).toHaveProperty('errorType');
            expect(result).toHaveProperty('success', false);
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(typeof error.message).toBe('string');
        }
      }
    });
  });

  describe('Performance Tests', () => {
    let tool;

    beforeEach(() => {
      tool = commandExecutorModule.getTool('command_executor');
    });

    test('should complete simple commands quickly', async () => {
      const start = Date.now();
      const result = await tool.execute({ command: 'echo "speed test"' });
      const duration = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle rapid sequential commands', async () => {
      const commands = Array.from({ length: 10 }, (_, i) => 
        `echo "rapid${i}"`
      );
      
      const start = Date.now();
      const results = [];
      
      for (const cmd of commands) {
        const result = await tool.execute({ command: cmd });
        results.push(result);
      }
      
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(10);
      results.forEach(result => expect(result.success).toBe(true));
      expect(duration).toBeLessThan(5000); // Should complete all in under 5 seconds
    });

    test('should respect timeout settings consistently', async () => {
      const shortTimeout = 500;
      const start = Date.now();
      
      const result = await tool.execute({ 
        command: 'sleep 2', 
        timeout: shortTimeout 
      });
      
      const duration = Date.now() - start;
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('timeout');
      expect(duration).toBeLessThan(shortTimeout + 200); // Allow small buffer
    }, 10000);
  });
});