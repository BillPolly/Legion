/**
 * MemoryDiscoveryService - Ported from Gemini CLI memoryDiscovery.ts
 * Automatically discovers and loads GEMINI.md files for project context
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Service for discovering and loading GEMINI.md memory files (ported from Gemini CLI)
 */
export class MemoryDiscoveryService {
  constructor(resourceManager, fileDiscoveryService) {
    this.resourceManager = resourceManager;
    this.fileDiscoveryService = fileDiscoveryService;
    this.geminiDir = '.gemini';
    this.memoryFilenames = ['GEMINI.md', 'README.md', 'CONTEXT.md'];
    this.discoveredMemoryFiles = new Map();
    this.projectMemoryCache = new Map();
  }

  /**
   * Discover all GEMINI.md files in project hierarchy (ported from Gemini CLI)
   * @param {string} workingDir - Current working directory
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Discovered memory file paths
   */
  async discoverMemoryFiles(workingDir = process.cwd(), options = {}) {
    const {
      respectGitIgnore = true,
      respectGeminiIgnore = true,
      maxDepth = 10
    } = options;

    const discoveredPaths = [];

    try {
      // 1. Global memory file (ported from Gemini CLI)
      const globalPaths = await this._findGlobalMemoryFiles();
      discoveredPaths.push(...globalPaths);

      // 2. Project root memory files (ported from Gemini CLI)
      const projectRoot = await this._findProjectRoot(workingDir);
      if (projectRoot) {
        const projectPaths = await this._findProjectMemoryFiles(projectRoot);
        discoveredPaths.push(...projectPaths);
      }

      // 3. Workspace memory files (ported from Gemini CLI)
      const workspacePaths = await this._findWorkspaceMemoryFiles(workingDir, maxDepth);
      discoveredPaths.push(...workspacePaths);

      // Remove duplicates and filter
      const uniquePaths = Array.from(new Set(discoveredPaths));
      
      if (this.fileDiscoveryService) {
        return this.fileDiscoveryService.filterFiles(uniquePaths, {
          respectGitIgnore,
          respectGeminiIgnore
        });
      }

      return uniquePaths;
    } catch (error) {
      throw new Error(`Memory discovery failed: ${error.message}`);
    }
  }

  /**
   * Load and process discovered memory files (ported from Gemini CLI)
   * @param {Array} memoryFilePaths - Paths to memory files
   * @returns {Promise<string>} Combined memory content
   */
  async loadMemoryContent(memoryFilePaths) {
    const memoryContents = [];

    for (const filePath of memoryFilePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const processedContent = this._processMemoryContent(content, filePath);
        
        memoryContents.push({
          source: filePath,
          content: processedContent
        });

        this.discoveredMemoryFiles.set(filePath, {
          path: filePath,
          lastModified: (await fs.stat(filePath)).mtime,
          size: content.length
        });

      } catch (error) {
        console.warn(`Failed to load memory file ${filePath}:`, error.message);
      }
    }

    // Combine all memory content (ported pattern from Gemini CLI)
    return this._combineMemoryContent(memoryContents);
  }

  /**
   * Find global memory files (ported from Gemini CLI)
   * @returns {Promise<Array>} Global memory file paths
   * @private
   */
  async _findGlobalMemoryFiles() {
    const globalPaths = [];
    const homeDir = os.homedir();
    
    for (const filename of this.memoryFilenames) {
      const globalPath = path.join(homeDir, this.geminiDir, filename);
      try {
        await fs.access(globalPath);
        globalPaths.push(globalPath);
      } catch (error) {
        // File doesn't exist, continue
      }
    }
    
    return globalPaths;
  }

  /**
   * Find project root by looking for .git directory (ported from Gemini CLI)
   * @param {string} startDir - Starting directory
   * @returns {Promise<string|null>} Project root path
   * @private
   */
  async _findProjectRoot(startDir) {
    let currentDir = path.resolve(startDir);
    
    while (true) {
      const gitPath = path.join(currentDir, '.git');
      try {
        const stats = await fs.stat(gitPath);
        if (stats.isDirectory()) {
          return currentDir;
        }
      } catch (error) {
        // No .git directory, continue up
      }
      
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        return null; // Reached root without finding .git
      }
      currentDir = parentDir;
    }
  }

  /**
   * Find memory files in project root (ported from Gemini CLI)
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Array>} Project memory file paths
   * @private
   */
  async _findProjectMemoryFiles(projectRoot) {
    const projectPaths = [];
    
    for (const filename of this.memoryFilenames) {
      const projectMemoryPath = path.join(projectRoot, filename);
      try {
        await fs.access(projectMemoryPath);
        projectPaths.push(projectMemoryPath);
      } catch (error) {
        // File doesn't exist, continue
      }
    }
    
    return projectPaths;
  }

  /**
   * Find memory files in workspace tree (ported from Gemini CLI)
   * @param {string} workingDir - Working directory
   * @param {number} maxDepth - Maximum search depth
   * @returns {Promise<Array>} Workspace memory file paths
   * @private
   */
  async _findWorkspaceMemoryFiles(workingDir, maxDepth) {
    const workspacePaths = [];
    
    await this._scanForMemoryFiles(workingDir, 0, maxDepth, workspacePaths);
    
    return workspacePaths;
  }

  /**
   * Recursively scan for memory files (ported concept from Gemini CLI)
   * @param {string} dirPath - Directory to scan
   * @param {number} depth - Current depth
   * @param {number} maxDepth - Maximum depth
   * @param {Array} foundPaths - Array to collect found paths
   * @private
   */
  async _scanForMemoryFiles(dirPath, depth, maxDepth, foundPaths) {
    if (depth > maxDepth) {
      return;
    }

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isFile() && this.memoryFilenames.includes(item.name)) {
          foundPaths.push(itemPath);
        } else if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          await this._scanForMemoryFiles(itemPath, depth + 1, maxDepth, foundPaths);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Process memory file content (ported concept from Gemini CLI)
   * @param {string} content - Raw file content
   * @param {string} filePath - File path for context
   * @returns {string} Processed content
   * @private
   */
  _processMemoryContent(content, filePath) {
    // Add source annotation (ported pattern)
    const relativePath = path.relative(process.cwd(), filePath);
    const sourceHeader = `<!-- Source: ${relativePath} -->\\n`;
    
    // Process imports and references (simplified from Gemini CLI)
    let processedContent = content;
    
    // Handle @import directives (simplified)
    processedContent = processedContent.replace(
      /@import\\s+"([^"]+)"/g,
      (match, importPath) => {
        return `<!-- Import: ${importPath} -->`;
      }
    );
    
    return sourceHeader + processedContent;
  }

  /**
   * Combine memory content from multiple sources (ported from Gemini CLI)
   * @param {Array} memoryContents - Array of memory content objects
   * @returns {string} Combined memory content
   * @private
   */
  _combineMemoryContent(memoryContents) {
    if (memoryContents.length === 0) {
      return '';
    }

    let combined = '# Project Memory Context\\n\\n';
    
    for (const { source, content } of memoryContents) {
      const relativePath = path.relative(process.cwd(), source);
      combined += `## From: ${relativePath}\\n\\n${content}\\n\\n`;
    }
    
    return combined;
  }

  /**
   * Get memory discovery statistics
   * @returns {Object} Discovery statistics
   */
  getMemoryStats() {
    return {
      discoveredFiles: this.discoveredMemoryFiles.size,
      memoryFilenames: this.memoryFilenames,
      projectCacheSize: this.projectMemoryCache.size,
      lastDiscovery: this.lastDiscoveryTime || null
    };
  }

  /**
   * Clear memory cache (for testing)
   */
  clearMemoryCache() {
    this.discoveredMemoryFiles.clear();
    this.projectMemoryCache.clear();
  }

  /**
   * Get discovered memory files info
   * @returns {Array} Memory file information
   */
  getDiscoveredMemoryFiles() {
    return Array.from(this.discoveredMemoryFiles.values());
  }
}

export default MemoryDiscoveryService;