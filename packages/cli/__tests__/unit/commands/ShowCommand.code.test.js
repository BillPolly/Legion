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
        let title = options.title || 'Handle';

        if (typeof handle.getData === 'function') {
          try {
            // getData() returns data object for TextFileHandle
            assetData = await handle.getData();
          } catch (error) {
            console.error('Error calling getData():', error);
            assetData = handle.data;
          }
        } else {
          assetData = handle.data;
        }

        // Get title from metadata if not provided in options
        if (!options.title && typeof handle.getMetadata === 'function') {
          try {
            const metadata = await handle.getMetadata();
            title = metadata.title || 'Handle';
          } catch (error) {
            console.error('Error getting metadata:', error);
          }
        }

        return {
          success: true,
          format: 'browser',
          rendered: 'browser',
          handle: handle,
          assetData: assetData,
          title: title,
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

    // assetData is now an object with {content, language, filePath, lineCount, viewerType}
    expect(typeof result.assetData).toBe('object');
    expect(result.assetData.content).toContain('function greet');
    expect(result.assetData.content).toContain('Hello, ');
    expect(result.assetData.content).toContain('export { greet }');
  });

  test('should detect JavaScript language from extension', async () => {
    const result = await showCommand.execute([`file://${testCodePath}`]);

    expect(result.success).toBe(true);
    expect(result.handle.resourceType).toBe('code');

    // Get language via async method
    const language = await result.handle.getLanguage();
    expect(language).toBe('javascript');
  });

  test('should handle different JavaScript extensions', async () => {
    const extensions = ['.mjs', '.cjs', '.jsx'];

    for (const ext of extensions) {
      const testPath = testCodePath.replace('.js', ext);
      await fs.copyFile(testCodePath, testPath);

      const result = await showCommand.execute([`file://${testPath}`]);

      expect(result.success).toBe(true);
      expect(result.handle.resourceType).toBe('code');

      // Get language via async method
      const language = await result.handle.getLanguage();
      expect(language).toBe('javascript');
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

    // Get language via async method
    const language = await result.handle.getLanguage();
    expect(language).toBe('typescript');
    expect(result.assetData.content).toContain('interface User');

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

    // Get metadata via async method
    const metadata = await result.handle.getMetadata();
    expect(metadata.lineCount).toBe(testJavaScript.split('\n').length);
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

    // Get language via async method
    const language = await result.handle.getLanguage();
    expect(language).toBe('python');
    expect(result.assetData.content).toContain('def greet');

    await fs.unlink(pyPath);
  });
});
