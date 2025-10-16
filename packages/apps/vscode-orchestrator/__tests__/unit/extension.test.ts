import { describe, test, expect, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';

describe('Extension', () => {
  let mockContext: vscode.ExtensionContext;
  let mockOutputChannel: vscode.OutputChannel;

  beforeEach(() => {
    // Create mock extension context
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: async () => {},
        keys: () => []
      },
      globalState: {
        get: () => undefined,
        update: async () => {},
        keys: () => [],
        setKeysForSync: () => {}
      },
      extensionPath: '/test/path',
      extensionUri: vscode.Uri.file('/test/path'),
      environmentVariableCollection: {} as any,
      extensionMode: 3,
      storageUri: vscode.Uri.file('/test/storage'),
      globalStorageUri: vscode.Uri.file('/test/global-storage'),
      logUri: vscode.Uri.file('/test/log'),
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/log',
      asAbsolutePath: (relativePath: string) => `/test/path/${relativePath}`,
      secrets: {} as any,
      extension: {} as any
    } as vscode.ExtensionContext;

    mockOutputChannel = vscode.window.createOutputChannel('test');
  });

  test('should import extension module', async () => {
    // This test verifies the extension module can be imported
    const extension = await import('../../src/extension');

    expect(extension).toBeDefined();
    expect(typeof extension.activate).toBe('function');
    expect(typeof extension.deactivate).toBe('function');
  });

  test('should have activate function', async () => {
    const extension = await import('../../src/extension');

    expect(extension.activate).toBeDefined();
    expect(typeof extension.activate).toBe('function');
  });

  test('should have deactivate function', async () => {
    const extension = await import('../../src/extension');

    expect(extension.deactivate).toBeDefined();
    expect(typeof extension.deactivate).toBe('function');
  });

  test('should handle activate with mock context', async () => {
    const extension = await import('../../src/extension');

    // Call activate with mock context - should not throw
    await extension.activate(mockContext);

    // Cleanup - call deactivate
    await extension.deactivate();

    // Reset subscriptions for next test
    mockContext.subscriptions = [];
  });

  test('should register command on activation', async () => {
    const extension = await import('../../src/extension');

    await extension.activate(mockContext);

    // Verify at least one subscription was added
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);

    // Cleanup
    await extension.deactivate();
  });
});
