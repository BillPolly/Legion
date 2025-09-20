/**
 * PromptRegistry - Utility for loading and managing prompt templates
 */

import fs from 'fs/promises';
import path from 'path';
import TemplatedPrompt from './TemplatedPrompt.js';

export default class PromptRegistry {
  constructor() {
    this.prompts = new Map();
    this.directories = [];
  }

  /**
   * Add a directory to search for prompt files
   */
  addDirectory(dir) {
    if (!dir || typeof dir !== 'string') {
      throw new Error('Directory must be a non-empty string');
    }
    this.directories.push(dir);
  }

  /**
   * Load all prompts from registered directories
   */
  async loadPrompts(options = {}) {
    const fileExtensions = options.extensions || ['.md', '.txt', '.prompt'];
    const loadedFiles = [];
    
    for (const dir of this.directories) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const ext = path.extname(file);
          if (fileExtensions.includes(ext)) {
            const filePath = path.join(dir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const name = path.basename(file, ext);
            
            // Create TemplatedPrompt instance
            const prompt = new TemplatedPrompt(content, {
              name,
              ...options.defaultOptions
            });
            
            this.prompts.set(name, prompt);
            loadedFiles.push({ name, path: filePath });
          }
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Directory doesn't exist, skip it
          continue;
        }
        throw error;
      }
    }
    
    return loadedFiles;
  }

  /**
   * Register a prompt directly
   */
  register(name, template, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Name must be a non-empty string');
    }
    
    const prompt = template instanceof TemplatedPrompt 
      ? template 
      : new TemplatedPrompt(template, { name, ...options });
      
    this.prompts.set(name, prompt);
    return prompt;
  }

  /**
   * Get a prompt by name
   */
  get(name) {
    return this.prompts.get(name);
  }

  /**
   * Check if a prompt exists
   */
  has(name) {
    return this.prompts.has(name);
  }

  /**
   * Remove a prompt
   */
  remove(name) {
    return this.prompts.delete(name);
  }

  /**
   * Clear all prompts
   */
  clear() {
    this.prompts.clear();
    this.directories = [];
  }

  /**
   * Get all prompt names
   */
  getNames() {
    return Array.from(this.prompts.keys());
  }

  /**
   * Get all prompts
   */
  getAll() {
    return Array.from(this.prompts.values());
  }

  /**
   * Load a single prompt file
   */
  async loadFile(filePath, options = {}) {
    const content = await fs.readFile(filePath, 'utf-8');
    const name = options.name || path.basename(filePath, path.extname(filePath));
    
    const prompt = new TemplatedPrompt(content, {
      name,
      ...options
    });
    
    this.prompts.set(name, prompt);
    return prompt;
  }

  /**
   * Create a prompt and optionally save to file
   */
  async create(name, template, options = {}) {
    const prompt = this.register(name, template, options);
    
    if (options.saveToFile && this.directories.length > 0) {
      const dir = options.directory || this.directories[0];
      const ext = options.extension || '.md';
      const filePath = path.join(dir, `${name}${ext}`);
      
      await fs.writeFile(filePath, template, 'utf-8');
      return { prompt, filePath };
    }
    
    return { prompt };
  }

  /**
   * Clone the registry
   */
  clone() {
    const newRegistry = new PromptRegistry();
    newRegistry.directories = [...this.directories];
    
    for (const [name, prompt] of this.prompts) {
      newRegistry.prompts.set(name, prompt.clone());
    }
    
    return newRegistry;
  }

  /**
   * Export all prompts to a directory
   */
  async exportToDirectory(dir, options = {}) {
    const ext = options.extension || '.md';
    const exported = [];
    
    await fs.mkdir(dir, { recursive: true });
    
    for (const [name, prompt] of this.prompts) {
      const filePath = path.join(dir, `${name}${ext}`);
      await fs.writeFile(filePath, prompt.template, 'utf-8');
      exported.push({ name, path: filePath });
    }
    
    return exported;
  }
}