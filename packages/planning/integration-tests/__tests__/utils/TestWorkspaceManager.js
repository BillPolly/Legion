/**
 * TestWorkspaceManager - Manages isolated test environments for integration tests
 * Provides workspace creation, cleanup, and path management
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

export class TestWorkspaceManager {
  constructor(basePath = '/tmp/legion-integration-tests') {
    this.basePath = basePath;
    this.workspaces = new Map(); // trackId -> workspace path
  }

  /**
   * Create a new isolated workspace for a test
   * @param {string} testName - Name of the test (for debugging)
   * @returns {Promise<string>} Path to the created workspace
   */
  async createWorkspace(testName = 'test') {
    const trackId = randomUUID();
    const timestamp = Date.now();
    const sanitizedName = testName.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    const workspacePath = join(this.basePath, `${sanitizedName}-${timestamp}-${trackId.slice(0, 8)}`);
    
    try {
      await fs.mkdir(workspacePath, { recursive: true });
      this.workspaces.set(trackId, workspacePath);
      
      // Create basic structure
      await fs.mkdir(join(workspacePath, 'src'), { recursive: true });
      await fs.mkdir(join(workspacePath, 'test'), { recursive: true });
      await fs.mkdir(join(workspacePath, 'output'), { recursive: true });
      
      console.log(`📁 Created test workspace: ${workspacePath}`);
      return { workspacePath, trackId };
    } catch (error) {
      console.error(`❌ Failed to create workspace: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the path to a workspace by track ID
   * @param {string} trackId - Workspace track ID
   * @returns {string} Workspace path
   */
  getWorkspacePath(trackId) {
    const path = this.workspaces.get(trackId);
    if (!path) {
      throw new Error(`Workspace not found for trackId: ${trackId}`);
    }
    return path;
  }

  /**
   * Write a file to a workspace
   * @param {string} trackId - Workspace track ID
   * @param {string} filePath - Relative file path within workspace
   * @param {string} content - File content
   */
  async writeFile(trackId, filePath, content) {
    const workspacePath = this.getWorkspacePath(trackId);
    const fullPath = join(workspacePath, filePath);
    
    // Ensure directory exists
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    
    global.trackFileCreation && global.trackFileCreation();
    return fullPath;
  }

  /**
   * Read a file from a workspace
   * @param {string} trackId - Workspace track ID  
   * @param {string} filePath - Relative file path within workspace
   * @returns {Promise<string>} File content
   */
  async readFile(trackId, filePath) {
    const workspacePath = this.getWorkspacePath(trackId);
    const fullPath = join(workspacePath, filePath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Check if a file exists in a workspace
   * @param {string} trackId - Workspace track ID
   * @param {string} filePath - Relative file path within workspace
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(trackId, filePath) {
    const workspacePath = this.getWorkspacePath(trackId);
    const fullPath = join(workspacePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in a workspace directory
   * @param {string} trackId - Workspace track ID
   * @param {string} dirPath - Relative directory path (default: root)
   * @returns {Promise<string[]>} Array of file names
   */
  async listFiles(trackId, dirPath = '') {
    const workspacePath = this.getWorkspacePath(trackId);
    const fullPath = join(workspacePath, dirPath);
    try {
      return await fs.readdir(fullPath);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get workspace statistics for validation
   * @param {string} trackId - Workspace track ID
   * @returns {Promise<Object>} Workspace stats
   */
  async getWorkspaceStats(trackId) {
    const workspacePath = this.getWorkspacePath(trackId);
    
    const stats = {
      path: workspacePath,
      files: [],
      directories: [],
      totalSize: 0
    };

    const scanDirectory = async (dirPath, relativePath = '') => {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const relativeEntryPath = join(relativePath, entry);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          stats.directories.push(relativeEntryPath);
          await scanDirectory(fullPath, relativeEntryPath);
        } else {
          stats.files.push(relativeEntryPath);
          stats.totalSize += stat.size;
        }
      }
    };

    try {
      await scanDirectory(workspacePath);
    } catch (error) {
      console.warn(`Warning: Could not scan workspace ${workspacePath}: ${error.message}`);
    }

    return stats;
  }

  /**
   * Clean up a specific workspace
   * @param {string} trackId - Workspace track ID
   */
  async cleanupWorkspace(trackId) {
    const workspacePath = this.workspaces.get(trackId);
    if (!workspacePath) {
      return; // Already cleaned up or never created
    }

    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
      this.workspaces.delete(trackId);
      console.log(`🗑️  Cleaned up workspace: ${workspacePath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup workspace ${workspacePath}: ${error.message}`);
    }
  }

  /**
   * Clean up all workspaces managed by this instance
   */
  async cleanupAll() {
    const cleanupPromises = Array.from(this.workspaces.keys()).map(
      trackId => this.cleanupWorkspace(trackId)
    );
    await Promise.allSettled(cleanupPromises);
    console.log(`🧹 Cleaned up ${cleanupPromises.length} workspaces`);
  }

  /**
   * Create a test file with common patterns for validation
   * @param {string} trackId - Workspace track ID
   * @param {string} type - File type ('js', 'json', 'md', etc.)
   * @param {string} name - File name (without extension)
   * @returns {Promise<string>} Full file path
   */
  async createTestFile(trackId, type, name) {
    const templates = {
      js: `// ${name}.js - Generated by Legion integration test
export function ${name}() {
  console.log('Hello from ${name}');
  return '${name} executed successfully';
}

export default ${name};
`,
      json: JSON.stringify({
        name: name,
        version: '1.0.0',
        description: `Generated by Legion integration test`,
        main: 'index.js',
        scripts: {
          start: 'node index.js',
          test: 'jest'
        },
        generatedAt: new Date().toISOString()
      }, null, 2),
      md: `# ${name}

Generated by Legion integration test at ${new Date().toISOString()}.

## Purpose

This file was created to validate the planning → BT execution pipeline.

## Contents

- Demonstrates successful file creation
- Validates workspace management
- Tests integration workflow
`,
      txt: `${name} - Generated by Legion integration test
Created at: ${new Date().toISOString()}
Purpose: Validate planning to execution pipeline
Status: Generated successfully
`
    };

    const content = templates[type] || templates.txt;
    const fileName = `${name}.${type}`;
    
    return await this.writeFile(trackId, fileName, content);
  }
}