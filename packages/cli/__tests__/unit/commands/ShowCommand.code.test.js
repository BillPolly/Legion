/**
 * Unit test for ShowCommand JavaScript file:// URL handling
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ShowCommand } from '../../../src/commands/ShowCommand.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ShowCommand JavaScript file:// URL handling', () => {
  let showCommand;
  let resourceManager;
  let displayEngine;
  let testCodePath;
  let testJavaScript;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Create test JavaScript code (reused across tests)
    testJavaScript = `/**
 * Sample JavaScript function
 */
function greet(name) {
  const message = 'Hello, ' + name + '!';
  return message;
}

// Export the function
export { greet };

// Call it
const result = greet('World');
console.log(result);
`;

    testCodePath = path.join(__dirname, '../../tmp/test-code-unit.js');

    // Create a mock display engine that mimics DisplayEngine.renderBrowser()
    displayEngine = {
      render: async (handle, options) => {
        // Extract Handle data - mimics real DisplayEngine.renderBrowser()
        let assetData;
        if (typeof handle.getData === 'function') {
          try {
            // getData() returns string directly for CodeHandle
            assetData = await handle.getData();
          } catch (error) {
            console.error('Error calling getData():', error);
            assetData = handle.codeData?.data || handle.data;
          }
        } else {
          assetData = handle.codeData?.data || handle.data;
        }

        return {
          success: true,
          format: 'browser',
          rendered: 'browser',
          handle: handle,
          assetData: assetData,
          title: options.title || handle.codeData?.title || handle.title || 'Handle',
          assetType: handle.resourceType || handle.type || 'unknown'
        };
      }
    };

    showCommand = new ShowCommand(displayEngine, resourceManager);
  });

  beforeEach(async () => {
    // Recreate test code before each test
    await fs.mkdir(path.dirname(testCodePath), { recursive: true });
    await fs.writeFile(testCodePath, testJavaScript, 'utf-8');
  });

  afterAll(async () => {
    // Clean up test code
    try {
      await fs.unlink(testCodePath);
    } catch (e) {
      // Ignore
    }
  });

  test('should read JavaScript file and create CodeHandle', async () => {
    const result = await showCommand.execute([`file://${testCodePath}`]);

    expect(result.success).toBe(true);
    expect(result.rendered).toBe('browser');
    expect(result.assetData).toBeDefined();

    // assetData IS the code string directly (not an object)
    const codeData = result.assetData;
    expect(typeof codeData).toBe('string');
    expect(codeData).toContain('function greet');
    expect(codeData).toContain('Hello, ');
    expect(codeData).toContain('export { greet }');
  });

  test('should detect JavaScript language from extension', async () => {
    const result = await showCommand.execute([`file://${testCodePath}`]);

    expect(result.success).toBe(true);
    expect(result.handle.resourceType).toBe('code');
    expect(result.handle.codeData.language).toBe('javascript');
  });

  test('should handle different JavaScript extensions', async () => {
    const extensions = ['.mjs', '.cjs', '.jsx'];

    for (const ext of extensions) {
      const testPath = testCodePath.replace('.js', ext);
      await fs.copyFile(testCodePath, testPath);

      const result = await showCommand.execute([`file://${testPath}`]);

      expect(result.success).toBe(true);
      expect(result.handle.resourceType).toBe('code');
      expect(result.handle.codeData.language).toBe('javascript');
      expect(result.assetType).toBe('code');

      await fs.unlink(testPath);
    }
  });

  test('should handle TypeScript files', async () => {
    const tsCode = `interface User {
  name: string;
  age: number;
}

function createUser(name: string, age: number): User {
  return { name, age };
}

const user = createUser('Alice', 30);
console.log(user);
`;

    const tsPath = testCodePath.replace('.js', '.ts');
    await fs.writeFile(tsPath, tsCode, 'utf-8');

    const result = await showCommand.execute([`file://${tsPath}`]);

    expect(result.success).toBe(true);
    expect(result.handle.resourceType).toBe('code');
    expect(result.handle.codeData.language).toBe('typescript');
    expect(result.assetData).toContain('interface User');

    await fs.unlink(tsPath);
  });

  test('should use filename as title when not provided', async () => {
    const result = await showCommand.execute([`file://${testCodePath}`]);

    expect(result.title).toBe('test-code-unit.js');
  });

  test('should use custom title when provided', async () => {
    const result = await showCommand.execute([
      `file://${testCodePath}`,
      '--title',
      'My JavaScript Module'
    ]);

    expect(result.title).toBe('My JavaScript Module');
  });

  test('should handle non-existent files gracefully', async () => {
    await expect(
      showCommand.execute(['file:///non/existent/file.js'])
    ).rejects.toThrow();
  });

  test('should count line numbers correctly', async () => {
    const result = await showCommand.execute([`file://${testCodePath}`]);

    expect(result.handle.codeData.lineCount).toBe(testJavaScript.split('\n').length);
  });

  test('should handle Python files', async () => {
    const pythonCode = `def greet(name):
    """Greet a person by name"""
    message = f"Hello, {name}!"
    return message

if __name__ == "__main__":
    result = greet("World")
    print(result)
`;

    const pyPath = testCodePath.replace('.js', '.py');
    await fs.writeFile(pyPath, pythonCode, 'utf-8');

    const result = await showCommand.execute([`file://${pyPath}`]);

    expect(result.success).toBe(true);
    expect(result.handle.resourceType).toBe('code');
    expect(result.handle.codeData.language).toBe('python');
    expect(result.assetData).toContain('def greet');

    await fs.unlink(pyPath);
  });
});
