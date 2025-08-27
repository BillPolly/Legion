/**
 * FileWriter - Utility for writing files with tracking
 * 
 * Provides centralized file writing functionality with automatic
 * tracking of generated files and test files.
 */

import path from 'path';

class FileWriter {
  constructor(codeAgent) {
    this.codeAgent = codeAgent;
    this.fileOps = codeAgent.fileOps;
    this.workingDirectory = codeAgent.config.workingDirectory;
  }

  /**
   * Write a test file and track it
   * @param {string} filename - Relative path of test file
   * @param {string} content - File content
   * @private
   */
  async writeTestFile(filename, content) {
    const filePath = await this.writeFile(filename, content);
    this.codeAgent.testFiles.add(filePath);
    return filePath;
  }

  /**
   * Write a file and track it as generated
   * @param {string} filename - Relative path of file
   * @param {string|Buffer} content - File content
   * @private
   */
  async writeFile(filename, content) {
    const filePath = path.join(this.workingDirectory, filename);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await this.fileOps.createDirectory(dir);
    
    // Write file - handle both string and Buffer content
    if (Buffer.isBuffer(content)) {
      // For binary content, use fs directly
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, content);
    } else {
      await this.fileOps.writeFile(filePath, content);
    }
    
    // Track generated file
    this.codeAgent.generatedFiles.add(filePath);
    
    this.codeAgent.emit('file-created', {
      filename,
      filePath,
      size: Buffer.isBuffer(content) ? content.length : content.length
    });
    return filePath;
  }

  /**
   * Check if a file exists
   * @param {string} filename - Relative path of file
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filename) {
    const filePath = path.join(this.workingDirectory, filename);
    return this.fileOps.fileExists(filePath);
  }

  /**
   * Read a file
   * @param {string} filename - Relative path of file
   * @returns {Promise<string>} File content
   */
  async readFile(filename) {
    const filePath = path.join(this.workingDirectory, filename);
    return this.fileOps.readFile(filePath);
  }
}

export { FileWriter };