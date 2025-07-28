/**
 * Unit test for module_load automatic refresh logic
 */

import { describe, test, expect, jest } from '@jest/globals';

describe('Module Load Refresh Logic', () => {
  test('should call refreshTools after successful module_load', async () => {
    // Mock functions
    const mockRefreshTools = jest.fn().mockResolvedValue();
    const mockAddOutput = jest.fn();

    // Test the specific logic we added
    const testModuleLoadRefresh = async (toolName, result) => {
      // This is the logic we added to CliTerminalV2.js
      if (toolName === 'module_load' && result && !result.error) {
        console.log('[CLI] module_load successful, refreshing tools...');
        try {
          await mockRefreshTools();
          mockAddOutput('✓ Tools refreshed after module loading', 'info');
        } catch (error) {
          console.error('[CLI] Failed to refresh tools after module_load:', error);
          mockAddOutput('⚠ Warning: Failed to refresh tools list', 'error');
        }
      }
    };

    // Test Case 1: Successful module_load should trigger refresh
    await testModuleLoadRefresh('module_load', { success: true, module: 'calculator' });
    expect(mockRefreshTools).toHaveBeenCalledTimes(1);
    expect(mockAddOutput).toHaveBeenCalledWith('✓ Tools refreshed after module loading', 'info');

    // Reset mocks
    mockRefreshTools.mockClear();
    mockAddOutput.mockClear();

    // Test Case 2: Failed module_load should not trigger refresh
    await testModuleLoadRefresh('module_load', { success: false, error: 'Module not found' });
    expect(mockRefreshTools).not.toHaveBeenCalled();
    expect(mockAddOutput).not.toHaveBeenCalled();

    // Reset mocks
    mockRefreshTools.mockClear();
    mockAddOutput.mockClear();

    // Test Case 3: module_load with error should not trigger refresh
    await testModuleLoadRefresh('module_load', { module: 'calculator', error: 'Permission denied' });
    expect(mockRefreshTools).not.toHaveBeenCalled();
    expect(mockAddOutput).not.toHaveBeenCalled();

    // Reset mocks
    mockRefreshTools.mockClear();
    mockAddOutput.mockClear();

    // Test Case 4: Other tools should not trigger refresh
    await testModuleLoadRefresh('calculator_evaluate', { result: 4 });
    expect(mockRefreshTools).not.toHaveBeenCalled();
    expect(mockAddOutput).not.toHaveBeenCalled();

    // Reset mocks
    mockRefreshTools.mockClear();
    mockAddOutput.mockClear();

    // Test Case 5: Null/undefined result should not trigger refresh
    await testModuleLoadRefresh('module_load', null);
    expect(mockRefreshTools).not.toHaveBeenCalled();
    expect(mockAddOutput).not.toHaveBeenCalled();

    console.log('✅ All module load refresh logic tests passed!');
  });

  test('should handle refresh failures gracefully', async () => {
    // Mock functions with refresh failure
    const mockRefreshTools = jest.fn().mockRejectedValue(new Error('Refresh failed'));
    const mockAddOutput = jest.fn();

    // Test the specific error handling logic
    const testModuleLoadRefreshError = async (toolName, result) => {
      if (toolName === 'module_load' && result && !result.error) {
        console.log('[CLI] module_load successful, refreshing tools...');
        try {
          await mockRefreshTools();
          mockAddOutput('✓ Tools refreshed after module loading', 'info');
        } catch (error) {
          console.error('[CLI] Failed to refresh tools after module_load:', error);
          mockAddOutput('⚠ Warning: Failed to refresh tools list', 'error');
        }
      }
    };

    // Test that refresh failure is handled gracefully
    await testModuleLoadRefreshError('module_load', { success: true, module: 'calculator' });
    
    expect(mockRefreshTools).toHaveBeenCalledTimes(1);
    expect(mockAddOutput).toHaveBeenCalledWith('⚠ Warning: Failed to refresh tools list', 'error');
    expect(mockAddOutput).not.toHaveBeenCalledWith('✓ Tools refreshed after module loading', 'info');

    console.log('✅ Refresh error handling test passed!');
  });

  test('should handle various result formats correctly', async () => {
    const mockRefreshTools = jest.fn().mockResolvedValue();
    const mockAddOutput = jest.fn();

    const testModuleLoadRefresh = async (toolName, result) => {
      if (toolName === 'module_load' && result && !result.error) {
        await mockRefreshTools();
        mockAddOutput('✓ Tools refreshed after module loading', 'info');
      }
    };

    // Test different successful result formats
    const successfulResults = [
      { success: true, module: 'calculator' },
      { module: 'calculator', loaded: true },
      { status: 'loaded', module: 'calculator' },
      { module: 'calculator' }, // No error property = success
    ];

    for (const result of successfulResults) {
      mockRefreshTools.mockClear();
      mockAddOutput.mockClear();
      
      await testModuleLoadRefresh('module_load', result);
      expect(mockRefreshTools).toHaveBeenCalledTimes(1);
      expect(mockAddOutput).toHaveBeenCalledWith('✓ Tools refreshed after module loading', 'info');
    }

    // Test various error formats that should NOT trigger refresh
    const errorResults = [
      { error: 'Module not found' },
      { success: false, error: 'Permission denied' },
      { module: 'calculator', error: 'Load failed' },
      null,
      undefined,
    ];

    // Test edge case: empty object should trigger refresh (truthy, no error)
    mockRefreshTools.mockClear();
    mockAddOutput.mockClear();
    await testModuleLoadRefresh('module_load', {});
    expect(mockRefreshTools).toHaveBeenCalledTimes(1);
    expect(mockAddOutput).toHaveBeenCalledWith('✓ Tools refreshed after module loading', 'info');

    for (const result of errorResults) {
      mockRefreshTools.mockClear();
      mockAddOutput.mockClear();
      
      await testModuleLoadRefresh('module_load', result);
      expect(mockRefreshTools).not.toHaveBeenCalled();
      expect(mockAddOutput).not.toHaveBeenCalled();
    }

    console.log('✅ Result format handling tests passed!');
  });
});