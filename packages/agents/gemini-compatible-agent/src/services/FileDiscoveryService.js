/**
 * FileDiscoveryService - Ported from Gemini CLI fileDiscoveryService.ts
 * Provides intelligent file finding with gitignore and geminiignore support
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Service for intelligent file discovery (ported from Gemini CLI)
 */
export class FileDiscoveryService {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.gitignorePatterns = [];
    this.geminiignorePatterns = [];
    this.isGitRepo = false;
    
    // Add default gitignore patterns
    this._addDefaultGitIgnorePatterns();
    
    // Initialize ignore patterns
    this._loadIgnorePatterns();
  }

  /**
   * Add default gitignore patterns that should always be ignored
   * @private
   */
  _addDefaultGitIgnorePatterns() {
    const defaultPatterns = [
      'node_modules',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '*.tmp',
      '*.temp'
    ];
    
    for (const pattern of defaultPatterns) {
      // Convert gitignore patterns to regex
      let regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      
      // Handle directory patterns
      if (pattern.endsWith('/')) {
        regexPattern = regexPattern + '.*';
      } else if (!pattern.includes('.')) {
        // If no extension, match both files and directories
        regexPattern = `(^|/)${regexPattern}(/.*)?$`;
      } else {
        regexPattern = `(^|/)${regexPattern}$`;
      }
      
      this.gitignorePatterns.push(new RegExp(regexPattern));
    }
  }

  /**
   * Load gitignore and geminiignore patterns (ported from Gemini CLI)
   * @private
   */
  async _loadIgnorePatterns() {
    try {
      // Check if it's a git repository
      const gitDir = path.join(this.projectRoot, '.git');
      this.isGitRepo = await fs.access(gitDir).then(() => true).catch(() => false);
      
      if (this.isGitRepo) {
        await this._loadGitignore();
      }
      
      await this._loadGeminiignore();
    } catch (error) {
      console.warn('Failed to load ignore patterns:', error.message);
    }
  }

  /**
   * Load .gitignore patterns (ported from Gemini CLI)
   * @private
   */
  async _loadGitignore() {
    try {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      
      this.gitignorePatterns = content
        .split('\\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(pattern => this._convertToRegex(pattern));
    } catch (error) {
      // .gitignore not found or unreadable - use defaults
      this.gitignorePatterns = [
        /node_modules/,
        /\\.git/,
        /dist/,
        /build/,
        /coverage/
      ];
    }
  }

  /**
   * Load .geminiignore patterns (ported from Gemini CLI)
   * @private
   */
  async _loadGeminiignore() {
    try {
      const geminiignorePath = path.join(this.projectRoot, '.geminiignore');
      const content = await fs.readFile(geminiignorePath, 'utf-8');
      
      this.geminiignorePatterns = content
        .split('\\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(pattern => this._convertToRegex(pattern));
    } catch (error) {
      // .geminiignore not found - use defaults
      this.geminiignorePatterns = [
        /\\.log$/,
        /\\.tmp$/,
        /\\.cache/
      ];
    }
  }

  /**
   * Convert gitignore pattern to regex (simplified from Gemini CLI)
   * @param {string} pattern - Gitignore pattern
   * @returns {RegExp} Regex pattern
   * @private
   */
  _convertToRegex(pattern) {
    // Simple conversion - real implementation would be more sophisticated
    let regexPattern = pattern
      .replace(/\\./g, '\\\\.')
      .replace(/\\*/g, '.*')
      .replace(/\\?/g, '.');
    
    if (pattern.endsWith('/')) {
      regexPattern += '.*';
    }
    
    return new RegExp(regexPattern, 'i');
  }

  /**
   * Check if file should be ignored by git patterns (ported from Gemini CLI)
   * @param {string} filePath - File path to check
   * @returns {boolean} Whether file should be ignored
   */
  shouldGitIgnoreFile(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    
    return this.gitignorePatterns.some(pattern => 
      pattern.test(relativePath) || pattern.test(path.basename(filePath))
    );
  }

  /**
   * Check if file should be ignored by Gemini patterns (ported from Gemini CLI)
   * @param {string} filePath - File path to check
   * @returns {boolean} Whether file should be ignored
   */
  shouldGeminiIgnoreFile(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    
    return this.geminiignorePatterns.some(pattern =>
      pattern.test(relativePath) || pattern.test(path.basename(filePath))
    );
  }

  /**
   * Filter files based on ignore rules (ported from Gemini CLI)
   * @param {Array} filePaths - Files to filter
   * @param {Object} options - Filter options
   * @returns {Array} Filtered file paths
   */
  filterFiles(filePaths, options = { respectGitIgnore: true, respectGeminiIgnore: true }) {
    return filePaths.filter(filePath => {
      if (options.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        return false;
      }
      
      if (options.respectGeminiIgnore && this.shouldGeminiIgnoreFile(filePath)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Discover relevant files in project (ported from Gemini CLI)
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Discovered files
   */
  async discoverProjectFiles(options = {}) {
    try {
      const {
        respectGitIgnore = true,
        respectGeminiIgnore = true,
        fileExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs'],
        maxDepth = 5
      } = options;
      
      const allFiles = await this._scanDirectory(this.projectRoot, 0, maxDepth);
      
      // Filter by extensions
      const relevantFiles = allFiles.filter(filePath => {
        const ext = path.extname(filePath);
        return fileExtensions.includes(ext) || fileExtensions.includes('*');
      });
      
      // Apply ignore filters
      const filteredFiles = this.filterFiles(relevantFiles, {
        respectGitIgnore,
        respectGeminiIgnore
      });
      
      return filteredFiles.sort();
    } catch (error) {
      throw new Error(`File discovery failed: ${error.message}`);
    }
  }

  /**
   * Recursively scan directory (ported concept from Gemini CLI)
   * @param {string} dirPath - Directory to scan
   * @param {number} depth - Current depth
   * @param {number} maxDepth - Maximum depth
   * @returns {Promise<Array>} Found files
   * @private
   */
  async _scanDirectory(dirPath, depth, maxDepth) {
    if (depth > maxDepth) {
      return [];
    }

    const files = [];
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isFile()) {
          files.push(itemPath);
        } else if (item.isDirectory() && !item.name.startsWith('.')) {
          const subFiles = await this._scanDirectory(itemPath, depth + 1, maxDepth);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return files;
  }

  /**
   * Get discovery statistics
   * @returns {Object} Discovery stats
   */
  getDiscoveryStats() {
    return {
      projectRoot: this.projectRoot,
      isGitRepo: this.isGitRepo,
      gitignorePatterns: this.gitignorePatterns.length,
      geminiignorePatterns: this.geminiignorePatterns.length
    };
  }
}

export default FileDiscoveryService;