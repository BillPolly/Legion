/**
 * ProjectContextService - Ported from Gemini CLI environmentContext.ts
 * Provides project structure and context awareness for the agent
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Service for building project context (ported from Gemini CLI)
 */
export class ProjectContextService {
  constructor(resourceManager, toolsModule) {
    this.resourceManager = resourceManager;
    this.toolsModule = toolsModule;
    
    // Enhanced context tracking (ported from Gemini CLI patterns)
    this.recentFiles = new Map(); // file path -> { accessed: timestamp, modified: timestamp, operations: [] }
    this.projectMetadata = new Map(); // cache for project analysis
    this.fileChangeDetection = new Map(); // file path -> last known mtime
  }

  /**
   * Get directory context string (ported from getDirectoryContextString)
   * @param {string} workingDir - Working directory
   * @returns {Promise<string>} Directory context
   */
  async getDirectoryContext(workingDir = process.cwd()) {
    try {
      const folderStructure = await this.getFolderStructure(workingDir);
      
      return `\n# Current Working Directory
Working directory: ${workingDir}

## Project Structure:
${folderStructure}`;
    } catch (error) {
      return `\n# Current Working Directory
Working directory: ${workingDir}
(Unable to read directory structure: ${error.message})`;
    }
  }

  /**
   * Get environment context (ported from getEnvironmentContext)
   * @returns {string} Environment context
   */
  getEnvironmentContext() {
    const today = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric',
    });
    
    const platform = process.platform;
    const nodeVersion = process.version;
    
    return `\n# Environment Context
Date: ${today}
Platform: ${platform}
Node.js: ${nodeVersion}`;
  }

  /**
   * Check if directory is a git repository (ported from Gemini CLI)
   * @param {string} dir - Directory to check
   * @returns {Promise<boolean>} Whether it's a git repo
   */
  async isGitRepository(dir = process.cwd()) {
    try {
      const gitDir = path.join(dir, '.git');
      const stats = await fs.stat(gitDir);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get git context if available (ported from Gemini CLI)
   * @param {string} dir - Directory to check
   * @returns {Promise<string>} Git context
   */
  async getGitContext(dir = process.cwd()) {
    const isGit = await this.isGitRepository(dir);
    
    if (isGit) {
      return `\n# Git Repository
- The current working directory is managed by git
- Use shell_command for git operations like 'git status', 'git diff', 'git log'
- When committing, always review changes and propose commit messages`;
    }
    
    return '';
  }

  /**
   * Detect project type and build system (ported concept from Gemini CLI)
   * @param {string} dir - Directory to analyze
   * @returns {Promise<string>} Project type context
   */
  async getProjectTypeContext(dir = process.cwd()) {
    try {
      const files = await fs.readdir(dir);
      const context = [];
      
      if (files.includes('package.json')) {
        try {
          const packageContent = await fs.readFile(path.join(dir, 'package.json'), 'utf-8');
          const packageData = JSON.parse(packageContent);
          context.push(`- Node.js project: ${packageData.name || 'unknown'}`);
          if (packageData.scripts) {
            const scripts = Object.keys(packageData.scripts);
            context.push(`- Available npm scripts: ${scripts.join(', ')}`);
          }
        } catch (error) {
          context.push('- Node.js project detected');
        }
      }
      
      if (files.includes('Cargo.toml')) {
        context.push('- Rust project detected');
      }
      
      if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
        context.push('- Python project detected');
      }
      
      if (files.includes('pom.xml') || files.includes('build.gradle')) {
        context.push('- Java project detected');
      }
      
      if (context.length > 0) {
        return `\n# Project Type\n${context.join('\n')}`;
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Get folder structure (simplified version of Gemini CLI's getFolderStructure)
   * @param {string} dir - Directory to analyze
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Promise<string>} Folder structure
   */
  async getFolderStructure(dir, maxDepth = 2) {
    try {
      const structure = await this._buildStructure(dir, 0, maxDepth);
      return structure;
    } catch (error) {
      return `Unable to read directory structure: ${error.message}`;
    }
  }

  /**
   * Recursively build directory structure
   * @param {string} currentPath - Current path
   * @param {number} depth - Current depth
   * @param {number} maxDepth - Maximum depth
   * @returns {Promise<string>} Structure string
   */
  async _buildStructure(currentPath, depth, maxDepth) {
    if (depth > maxDepth) return '';
    
    try {
      const items = await fs.readdir(currentPath, { withFileTypes: true });
      const indent = '  '.repeat(depth);
      const results = [];
      
      // Sort: directories first, then files
      const sorted = items.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });
      
      for (const item of sorted.slice(0, 20)) { // Limit to first 20 items
        if (item.name.startsWith('.')) continue; // Skip hidden files
        
        const itemPath = path.join(currentPath, item.name);
        const relativePath = path.relative(process.cwd(), itemPath);
        
        if (item.isDirectory()) {
          results.push(`${indent}📁 ${item.name}/`);
          if (depth < maxDepth) {
            const subStructure = await this._buildStructure(itemPath, depth + 1, maxDepth);
            if (subStructure) results.push(subStructure);
          }
        } else {
          results.push(`${indent}📄 ${item.name}`);
        }
      }
      
      return results.join('\n');
    } catch (error) {
      return `${' '.repeat(depth * 2)}❌ Cannot access directory`;
    }
  }

  /**
   * Track file access (ported from Gemini CLI file tracking)
   * @param {string} filePath - File that was accessed
   * @param {string} operation - Operation performed (read, write, edit, etc.)
   */
  trackFileAccess(filePath, operation) {
    try {
      const now = Date.now();
      const existing = this.recentFiles.get(filePath) || {
        accessed: now,
        modified: now,
        operations: []
      };
      
      existing.accessed = now;
      if (operation === 'write' || operation === 'edit') {
        existing.modified = now;
      }
      existing.operations.push({ operation, timestamp: now });
      
      // Keep only recent operations (last 10)
      if (existing.operations.length > 10) {
        existing.operations = existing.operations.slice(-10);
      }
      
      this.recentFiles.set(filePath, existing);
    } catch (error) {
      console.warn('File tracking failed:', error.message);
    }
  }

  /**
   * Get recent files context (ported from Gemini CLI)
   * @returns {string} Recent files context
   */
  getRecentFilesContext() {
    if (this.recentFiles.size === 0) {
      return '';
    }

    const recentEntries = Array.from(this.recentFiles.entries())
      .sort(([,a], [,b]) => b.accessed - a.accessed)
      .slice(0, 10); // Last 10 accessed files

    let context = '\\n# Recently Accessed Files\\n';
    for (const [filePath, info] of recentEntries) {
      const relativeFilePath = path.relative(process.cwd(), filePath);
      const lastOp = info.operations[info.operations.length - 1];
      const timeAgo = this._timeAgo(lastOp.timestamp);
      
      context += `- ${relativeFilePath} (${lastOp.operation} ${timeAgo})\\n`;
    }
    
    return context;
  }

  /**
   * Detect file changes since last check (ported from Gemini CLI change detection)
   * @param {string} workingDir - Directory to check
   * @returns {Promise<string>} File changes context
   */
  async detectFileChanges(workingDir = process.cwd()) {
    try {
      const changes = [];
      const currentFiles = await this._getAllProjectFiles(workingDir);
      
      for (const filePath of currentFiles) {
        try {
          const stats = await fs.stat(filePath);
          const currentMtime = stats.mtimeMs;
          const lastKnownMtime = this.fileChangeDetection.get(filePath);
          
          if (lastKnownMtime === undefined) {
            // New file discovered
            this.fileChangeDetection.set(filePath, currentMtime);
          } else if (currentMtime > lastKnownMtime) {
            // File was modified
            const relativePath = path.relative(workingDir, filePath);
            changes.push(`${relativePath} (modified)`);
            this.fileChangeDetection.set(filePath, currentMtime);
          }
        } catch (error) {
          // File might have been deleted
          if (this.fileChangeDetection.has(filePath)) {
            const relativePath = path.relative(workingDir, filePath);
            changes.push(`${relativePath} (deleted)`);
            this.fileChangeDetection.delete(filePath);
          }
        }
      }
      
      if (changes.length > 0) {
        return `\\n# Recent File Changes\\n${changes.map(c => `- ${c}`).join('\\n')}`;
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Get all project files (helper for change detection)
   * @param {string} dir - Directory to scan
   * @returns {Promise<Array>} All file paths
   */
  async _getAllProjectFiles(dir) {
    const files = [];
    
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        
        const itemPath = path.join(dir, item.name);
        
        if (item.isFile()) {
          files.push(itemPath);
        } else if (item.isDirectory()) {
          const subFiles = await this._getAllProjectFiles(itemPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return files;
  }

  /**
   * Format time ago string
   * @param {number} timestamp - Timestamp
   * @returns {string} Time ago string
   */
  _timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  /**
   * Build complete project context with file tracking (enhanced from Gemini CLI)
   * @param {string} workingDir - Working directory
   * @returns {Promise<string>} Complete context with file tracking
   */
  async buildCompleteContext(workingDir = process.cwd()) {
    const contexts = await Promise.all([
      this.getDirectoryContext(workingDir),
      this.getEnvironmentContext(),
      this.getGitContext(workingDir),
      this.getProjectTypeContext(workingDir),
      this.detectFileChanges(workingDir)
    ]);
    
    // Add recent files context
    const recentFilesContext = this.getRecentFilesContext();
    if (recentFilesContext) {
      contexts.push(recentFilesContext);
    }
    
    return contexts.filter(context => context.trim().length > 0).join('\\n');
  }
}

export default ProjectContextService;