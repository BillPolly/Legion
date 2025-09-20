/**
 * PromptRegistry - Utility for managing and loading prompt template files
 * 
 * Provides a simple interface for loading markdown prompt templates from
 * the filesystem and caching them for reuse.
 */

import fs from 'fs/promises';
import path from 'path';

export class PromptRegistry {
  constructor(templateDir = './prompts') {
    this.templateDir = templateDir;
    this.cache = new Map();
  }

  /**
   * Load a prompt template from file
   * @param {string} templateName - Name of the template file (with or without .md extension)
   * @returns {Promise<string>} The loaded template content
   */
  async load(templateName) {
    // Normalize template name (add .md if not present)
    const fileName = templateName.endsWith('.md') ? templateName : `${templateName}.md`;
    
    // Check cache first
    if (this.cache.has(fileName)) {
      return this.cache.get(fileName);
    }

    // Load from filesystem
    const filePath = path.join(this.templateDir, fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Cache for future use
      this.cache.set(fileName, content);
      
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Prompt template not found: ${fileName} (looked in ${filePath})`);
      }
      throw new Error(`Failed to load prompt template: ${error.message}`);
    }
  }

  /**
   * Load a prompt template synchronously (for initialization)
   * @param {string} templateName - Name of the template file
   * @returns {string} The loaded template content
   */
  loadSync(templateName) {
    const fsSync = require('fs');
    
    // Normalize template name
    const fileName = templateName.endsWith('.md') ? templateName : `${templateName}.md`;
    
    // Check cache first
    if (this.cache.has(fileName)) {
      return this.cache.get(fileName);
    }

    // Load from filesystem
    const filePath = path.join(this.templateDir, fileName);
    
    try {
      const content = fsSync.readFileSync(filePath, 'utf-8');
      
      // Cache for future use
      this.cache.set(fileName, content);
      
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Prompt template not found: ${fileName} (looked in ${filePath})`);
      }
      throw new Error(`Failed to load prompt template: ${error.message}`);
    }
  }

  /**
   * List all available prompt templates
   * @returns {Promise<string[]>} Array of template names
   */
  async list() {
    try {
      const files = await fs.readdir(this.templateDir);
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', ''));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to list prompt templates: ${error.message}`);
    }
  }

  /**
   * Check if a template exists
   * @param {string} templateName - Name of the template
   * @returns {Promise<boolean>} True if template exists
   */
  async exists(templateName) {
    const fileName = templateName.endsWith('.md') ? templateName : `${templateName}.md`;
    const filePath = path.join(this.templateDir, fileName);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear the template cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get the template directory
   */
  getTemplateDir() {
    return this.templateDir;
  }

  /**
   * Set a new template directory
   */
  setTemplateDir(dir) {
    this.templateDir = dir;
    this.clearCache(); // Clear cache when directory changes
  }
}