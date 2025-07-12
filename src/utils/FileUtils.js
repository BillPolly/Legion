/**
 * FileUtils - File operation utilities
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class FileUtils {
  /**
   * Check if file exists
   * @param {string} filePath - File path to check
   * @returns {boolean} True if exists
   */
  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read JSON file
   * @param {string} filePath - File path
   * @returns {object} Parsed JSON
   */
  async readJson(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write JSON file
   * @param {string} filePath - File path
   * @param {object} data - Data to write
   * @param {number} indent - JSON indent
   */
  async writeJson(filePath, data, indent = 2) {
    const content = JSON.stringify(data, null, indent);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Find config file in directory hierarchy
   * @param {string} filename - Config filename
   * @param {string} startPath - Starting directory
   * @returns {string|null} Path to config file or null
   */
  async findConfigUp(filename, startPath = process.cwd()) {
    let currentPath = startPath;
    
    while (currentPath !== path.dirname(currentPath)) {
      const configPath = path.join(currentPath, filename);
      if (await this.exists(configPath)) {
        return configPath;
      }
      currentPath = path.dirname(currentPath);
    }
    
    return null;
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   */
  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get home directory
   * @returns {string} Home directory path
   */
  getHomeDir() {
    return os.homedir();
  }

  /**
   * Resolve path with home directory expansion
   * @param {string} inputPath - Path to resolve
   * @returns {string} Resolved path
   */
  resolvePath(inputPath) {
    if (inputPath.startsWith('~')) {
      return path.join(this.getHomeDir(), inputPath.slice(1));
    }
    return path.resolve(inputPath);
  }

  /**
   * Get relative path from base
   * @param {string} from - Base path
   * @param {string} to - Target path
   * @returns {string} Relative path
   */
  getRelativePath(from, to) {
    return path.relative(from, to);
  }

  /**
   * Check if path is absolute
   * @param {string} inputPath - Path to check
   * @returns {boolean} True if absolute
   */
  isAbsolute(inputPath) {
    return path.isAbsolute(inputPath);
  }

  /**
   * Join paths
   * @param {...string} paths - Paths to join
   * @returns {string} Joined path
   */
  join(...paths) {
    return path.join(...paths);
  }

  /**
   * Get directory name
   * @param {string} filePath - File path
   * @returns {string} Directory name
   */
  dirname(filePath) {
    return path.dirname(filePath);
  }

  /**
   * Get base name
   * @param {string} filePath - File path
   * @param {string} ext - Extension to remove
   * @returns {string} Base name
   */
  basename(filePath, ext) {
    return path.basename(filePath, ext);
  }

  /**
   * Get extension
   * @param {string} filePath - File path
   * @returns {string} Extension
   */
  extname(filePath) {
    return path.extname(filePath);
  }

  /**
   * List files in directory
   * @param {string} dirPath - Directory path
   * @param {object} options - Options
   * @returns {string[]} File names
   */
  async listFiles(dirPath, options = {}) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      let files = entries
        .filter(entry => options.includeDirectories || entry.isFile())
        .map(entry => entry.name);
      
      if (options.extension) {
        files = files.filter(name => name.endsWith(options.extension));
      }
      
      return files;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

export default FileUtils;