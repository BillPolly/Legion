/**
 * Foundation tests to validate test infrastructure
 */

import { ResourceManager } from '@legion/resource-manager';
import { 
  createTestFile, 
  readTestFile, 
  testFileExists,
  TEST_TEMP_DIR 
} from '../setup.js';
import {
  createTestResourceManager,
  validateToolResult
} from '../utils/TestUtils.js';

describe('Foundation Test Infrastructure', () => {
  describe('ResourceManager Integration', () => {
    test('should access ResourceManager singleton', () => {
      const resourceManager = ResourceManager.getInstance();
      expect(resourceManager).toBeDefined();
    });

    test('should configure ResourceManager for tests', () => {
      const resourceManager = createTestResourceManager({
        TEST_KEY: 'test_value'
      });
      
      expect(resourceManager.get('TEST_KEY')).toBe('test_value');
      expect(resourceManager.get('BASE_PATH')).toBeDefined();
    });
  });

  describe('Test Utilities', () => {
    test('should create test files', async () => {
      const filePath = await createTestFile('test.txt', 'Hello World');
      expect(filePath).toContain(TEST_TEMP_DIR);
      
      const exists = await testFileExists('test.txt');
      expect(exists).toBe(true);
      
      const content = await readTestFile('test.txt');
      expect(content).toBe('Hello World');
    });

    test('should validate tool result structure', () => {
      const successResult = {
        success: true,
        data: { test: 'data' }
      };
      
      const failureResult = {
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error'
        }
      };
      
      validateToolResult(successResult);
      validateToolResult(failureResult);
    });
  });

  describe('Package Structure', () => {
    test('should have correct directory structure', async () => {
      const fs = await import('fs');
      const path = await import('path');
      
      const packageRoot = path.resolve(process.cwd());
      
      // Check directories exist
      expect(fs.existsSync(path.join(packageRoot, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(packageRoot, 'docs'))).toBe(true);
      expect(fs.existsSync(path.join(packageRoot, '__tests__'))).toBe(true);
      
      // Check module directories
      expect(fs.existsSync(path.join(packageRoot, 'src/file-operations'))).toBe(true);
      expect(fs.existsSync(path.join(packageRoot, 'src/search-navigation'))).toBe(true);
      expect(fs.existsSync(path.join(packageRoot, 'src/task-management'))).toBe(true);
      expect(fs.existsSync(path.join(packageRoot, 'src/system-operations'))).toBe(true);
      expect(fs.existsSync(path.join(packageRoot, 'src/web-tools'))).toBe(true);
    });
  });
});