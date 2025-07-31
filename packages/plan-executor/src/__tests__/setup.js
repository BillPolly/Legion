/**
 * Jest setup for ES modules
 */

// Create mock function factory
function createMockFn() {
  const mockFn = (...args) => {
    mockFn.mock.calls.push(args);
    
    // Use mockImplementation if available
    if (mockFn._mockImplementation) {
      return mockFn._mockImplementation(...args);
    }
    
    if (mockFn._mockResolvedValue !== undefined) {
      return Promise.resolve(mockFn._mockResolvedValue);
    }
    if (mockFn._mockRejectedValue !== undefined) {
      return Promise.reject(mockFn._mockRejectedValue);
    }
    return mockFn._mockReturnValue;
  };
  
  mockFn.mock = {
    calls: [],
    results: []
  };
  
  mockFn._mockReturnValue = undefined;
  mockFn._mockResolvedValue = undefined;
  mockFn._mockRejectedValue = undefined;
  
  mockFn.mockResolvedValue = (value) => {
    mockFn._mockResolvedValue = value;
    return mockFn;
  };
  
  mockFn.mockRejectedValue = (value) => {
    mockFn._mockRejectedValue = value;
    return mockFn;
  };
  
  mockFn.mockReturnValue = (value) => {
    mockFn._mockReturnValue = value;
    return mockFn;
  };
  
  mockFn.mockImplementation = (fn) => {
    mockFn._mockImplementation = fn;
    return mockFn;
  };
  
  return mockFn;
}

// Set global jest object
global.jest = {
  fn: createMockFn
};

// Test cleanup - remove any artifacts created during tests
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testArtifactDirs = ['dbs', 'tmp', 'test-output'];
const projectRoot = path.resolve(__dirname, '../../');

afterAll(async () => {
  // Clean up test artifacts in parallel
  const cleanupPromises = testArtifactDirs.map(async (dir) => {
    const dirPath = path.join(projectRoot, dir);
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors - directory might not exist
    }
  });
  
  await Promise.all(cleanupPromises);
});