/**
 * Direct Shell Command Tool Test
 * Tests the actual shell_command tool directly to verify it works
 * NO ConversationManager - just test the tool itself
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';

describe('Shell Command Tool Direct Test', () => {
  let toolsModule;
  let shellCommandTool;

  beforeAll(async () => {
    // Get real ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    
    // Create real GeminiToolsModule
    toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Get the actual shell_command tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    shellCommandTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'shell_command' || tool.toolName === 'shell_command')
    );
    
    if (!shellCommandTool) {
      throw new Error('shell_command tool not found in GeminiToolsModule');
    }
    
    shellCommandTool = shellCommandTool[1]; // Get the tool object
    console.log('✅ Found shell_command tool:', shellCommandTool.name || shellCommandTool.toolName);
  });

  it('should execute ls command and return proper result structure', async () => {
    const args = { command: 'ls -la' };
    
    console.log('🔧 Testing shell_command tool directly');
    console.log('📋 Args:', args);
    
    // Execute tool directly
    const result = await shellCommandTool.execute(args);
    
    console.log('📊 Tool result:', result);
    
    // Verify result structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    
    if (result.success) {
      expect(result.data).toHaveProperty('stdout');
      expect(result.data).toHaveProperty('stderr');
      expect(result.data).toHaveProperty('exit_code');
      expect(result.data).toHaveProperty('command');
      
      // Verify actual command output
      expect(result.data.stdout).toContain('total');
      expect(result.data.stdout).toContain('drwx');
      expect(result.data.exit_code).toBe(0);
      expect(result.data.command).toBe('ls -la');
      
      console.log('✅ Command executed successfully');
      console.log('📄 stdout length:', result.data.stdout.length);
      console.log('🚪 exit_code:', result.data.exit_code);
      console.log('📝 First line of output:', result.data.stdout.split('\n')[0]);
      
    } else {
      console.log('❌ Command failed:', result.error);
      throw new Error(`Shell command failed: ${result.error}`);
    }
  }, 15000);

  it('should handle command that fails', async () => {
    const args = { command: 'nonexistentcommand123' };
    
    console.log('🔧 Testing failed command');
    
    const result = await shellCommandTool.execute(args);
    
    console.log('📊 Failed command result:', result);
    
    // Tool execution succeeds, but command fails (exit_code != 0)
    expect(result).toHaveProperty('success', true);
    expect(result.data.exit_code).not.toBe(0); // Command should fail
    expect(result.data.stderr).toContain('command not found');
    
    console.log('✅ Error handling works correctly');
  }, 15000);

  it('should handle echo command to verify output capture', async () => {
    const testMessage = 'Hello from shell command test';
    const args = { command: `echo "${testMessage}"` };
    
    console.log('🔧 Testing echo command for output verification');
    
    const result = await shellCommandTool.execute(args);
    
    console.log('📊 Echo result:', result);
    
    if (result.success) {
      expect(result.data.stdout).toContain(testMessage);
      expect(result.data.exit_code).toBe(0);
      
      console.log('✅ Echo command output captured correctly');
      console.log('📝 Echo output:', result.data.stdout.trim());
    } else {
      throw new Error(`Echo command failed: ${result.error}`);
    }
  }, 15000);
});