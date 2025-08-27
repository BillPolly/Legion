/**
 * Test setup for Claude Tools package
 * Sets up test environment and utilities
 */

import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test directory paths
export const TEST_TEMP_DIR = path.join(__dirname, 'temp');
export const TEST_FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * Setup test environment before all tests
 */
export async function setupTestEnvironment() {
  // Initialize ResourceManager singleton
  const resourceManager = await ResourceManager.getInstance();

  // Create test directories
  await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
  await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true });

  // Clean temp directory before tests (not after)
  await cleanTempDirectory();
}

/**
 * Clean temporary test directory
 */
export async function cleanTempDirectory() {
  try {
    const files = await fs.readdir(TEST_TEMP_DIR);
    for (const file of files) {
      const filePath = path.join(TEST_TEMP_DIR, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    // Directory might not exist yet
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Create a test file with content
 */
export async function createTestFile(filename, content) {
  const filePath = path.join(TEST_TEMP_DIR, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

/**
 * Create a test directory structure
 */
export async function createTestDirectory(dirname, structure = {}) {
  const dirPath = path.join(TEST_TEMP_DIR, dirname);
  await fs.mkdir(dirPath, { recursive: true });
  
  for (const [name, content] of Object.entries(structure)) {
    const itemPath = path.join(dirPath, name);
    if (typeof content === 'string') {
      await fs.writeFile(itemPath, content, 'utf8');
    } else if (typeof content === 'object') {
      await fs.mkdir(itemPath, { recursive: true });
      await createTestDirectory(path.join(dirname, name), content);
    }
  }
  
  return dirPath;
}

/**
 * Read a test file
 */
export async function readTestFile(filename) {
  const filePath = path.join(TEST_TEMP_DIR, filename);
  return await fs.readFile(filePath, 'utf8');
}

/**
 * Check if a test file exists
 */
export async function testFileExists(filename) {
  const filePath = path.join(TEST_TEMP_DIR, filename);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a test Jupyter notebook
 */
export async function createTestNotebook(filename, cells = []) {
  const notebook = {
    cells: cells.length > 0 ? cells : [
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: ['print("Hello, World!")']
      },
      {
        cell_type: 'markdown',
        metadata: {},
        source: ['# Test Notebook']
      }
    ],
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3'
      },
      language_info: {
        name: 'python',
        version: '3.9.0'
      }
    },
    nbformat: 4,
    nbformat_minor: 4
  };
  
  const filePath = path.join(TEST_TEMP_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(notebook, null, 2), 'utf8');
  return filePath;
}

// Global test setup
beforeAll(async () => {
  await setupTestEnvironment();
});

// Clean before each test (not after, so we can inspect results)
beforeEach(async () => {
  await cleanTempDirectory();
});