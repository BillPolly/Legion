/**
 * Test for CLI module loading and automatic tool refresh
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock the ToolManager
const mockToolManager = {
  refresh: jest.fn().mockResolvedValue(new Map()),
  getTools: jest.fn().mockReturnValue(new Map()),
  isToolsReady: jest.fn().mockReturnValue(true),
  getTool: jest.fn(),
  getToolNames: jest.fn().mockReturnValue([]),
};

// Mock the ResponseFormatter
const mockResponseFormatter = {
  format: jest.fn().mockReturnValue('Formatted response'),
};

// Mock interface that simulates successful module_load
const mockInterface = {
  executeTool: jest.fn(),
};

describe('CLI Module Loading and Tool Refresh', () => {
  let CliTerminalV2;
  let cliTerminal;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Import the CLI terminal class
    const module = await import('../../src/client/cli-terminal-v2/components/CliTerminalV2.js');
    CliTerminalV2 = module.CliTerminalV2;

    // Create a minimal DOM environment for the CLI
    global.document = {
      createElement: jest.fn(() => ({
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        style: {},
      })),
      getElementById: jest.fn(() => ({
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        style: {},
        scrollTop: 0,
        scrollHeight: 100,
      })),
    };

    // Create CLI terminal instance
    cliTerminal = new CliTerminalV2();
    cliTerminal.toolManager = mockToolManager;
    cliTerminal.responseFormatter = mockResponseFormatter;
    cliTerminal.interface = mockInterface;
    
    // Mock the addOutput method to avoid DOM manipulation
    cliTerminal.addOutput = jest.fn();
    cliTerminal.addFormattedOutput = jest.fn();
  });

  test('successful module_load triggers tool refresh', async () => {
    // Setup: Mock successful module_load response
    const successfulLoadResult = {
      success: true,
      module: 'calculator',
      message: 'Module loaded successfully'
    };

    mockInterface.executeTool.mockResolvedValue(successfulLoadResult);

    // Execute: Run module_load command
    const result = await cliTerminal.executeTool('module_load', { module: 'calculator' });

    // Verify: Check that the result is correct
    expect(result).toEqual(successfulLoadResult);

    // Verify: Check that refreshTools was called
    expect(mockToolManager.refresh).toHaveBeenCalledTimes(1);

    // Verify: Check that success message was displayed
    expect(cliTerminal.addOutput).toHaveBeenCalledWith(
      '✓ Tools refreshed after module loading',
      'info'
    );

    console.log('✓ Successful module_load triggers tool refresh');
  });

  test('failed module_load does not trigger tool refresh', async () => {
    // Setup: Mock failed module_load response
    const failedLoadResult = {
      success: false,
      error: 'Module not found',
      module: 'nonexistent'
    };

    mockInterface.executeTool.mockResolvedValue(failedLoadResult);

    // Execute: Run module_load command
    const result = await cliTerminal.executeTool('module_load', { module: 'nonexistent' });

    // Verify: Check that the result is correct
    expect(result).toEqual(failedLoadResult);

    // Verify: Check that refreshTools was NOT called
    expect(mockToolManager.refresh).not.toHaveBeenCalled();

    console.log('✓ Failed module_load does not trigger tool refresh');
  });

  test('module_load with error property does not trigger tool refresh', async () => {
    // Setup: Mock module_load response with error
    const errorLoadResult = {
      module: 'calculator',
      error: 'Permission denied'
    };

    mockInterface.executeTool.mockResolvedValue(errorLoadResult);

    // Execute: Run module_load command
    const result = await cliTerminal.executeTool('module_load', { module: 'calculator' });

    // Verify: Check that the result is correct
    expect(result).toEqual(errorLoadResult);

    // Verify: Check that refreshTools was NOT called
    expect(mockToolManager.refresh).not.toHaveBeenCalled();

    console.log('✓ module_load with error does not trigger tool refresh');
  });

  test('non-module_load commands do not trigger tool refresh', async () => {
    // Setup: Mock successful response for different tool
    const calculatorResult = {
      result: 4,
      expression: '2+2'
    };

    mockInterface.executeTool.mockResolvedValue(calculatorResult);

    // Execute: Run calculator_evaluate command
    const result = await cliTerminal.executeTool('calculator_evaluate', { expression: '2+2' });

    // Verify: Check that the result is correct
    expect(result).toEqual(calculatorResult);

    // Verify: Check that refreshTools was NOT called
    expect(mockToolManager.refresh).not.toHaveBeenCalled();

    console.log('✓ Non-module_load commands do not trigger tool refresh');
  });

  test('tool refresh failure is handled gracefully', async () => {
    // Setup: Mock successful module_load but failed refresh
    const successfulLoadResult = {
      success: true,
      module: 'calculator',
      message: 'Module loaded successfully'
    };

    mockInterface.executeTool.mockResolvedValue(successfulLoadResult);
    mockToolManager.refresh.mockRejectedValue(new Error('Refresh failed'));

    // Execute: Run module_load command
    const result = await cliTerminal.executeTool('module_load', { module: 'calculator' });

    // Verify: Check that the result is still returned despite refresh failure
    expect(result).toEqual(successfulLoadResult);

    // Verify: Check that refreshTools was called
    expect(mockToolManager.refresh).toHaveBeenCalledTimes(1);

    // Verify: Check that warning message was displayed
    expect(cliTerminal.addOutput).toHaveBeenCalledWith(
      '⚠ Warning: Failed to refresh tools list',
      'error'
    );

    console.log('✓ Tool refresh failure is handled gracefully');
  });

  test('response content extraction works correctly', async () => {
    // Setup: Mock response wrapped in content array (typical MCP format)
    const wrappedResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            module: 'calculator',
            message: 'Module loaded successfully'
          })
        }
      ]
    };

    mockInterface.executeTool.mockResolvedValue(wrappedResponse);

    // Execute: Run module_load command
    const result = await cliTerminal.executeTool('module_load', { module: 'calculator' });

    // Verify: Check that the content was properly extracted
    expect(result.success).toBe(true);
    expect(result.module).toBe('calculator');

    // Verify: Check that refreshTools was called
    expect(mockToolManager.refresh).toHaveBeenCalledTimes(1);

    console.log('✓ Response content extraction works correctly');
  });
});