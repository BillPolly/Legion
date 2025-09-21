/**
 * EnhancedPromptRegistry - Advanced prompt template management with namespaces
 * 
 * Features:
 * - Namespace support (e.g., 'coding/requirements/analyze')
 * - Markdown frontmatter metadata extraction
 * - Directory bulk loading
 * - Template caching with TTL
 * - Schema validation integration
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export class EnhancedPromptRegistry {
  constructor(templateDir = './prompts', options = {}) {
    this.templateDir = templateDir;
    this.cache = new Map();
    this.metadata = new Map();
    
    // Configuration options
    this.options = {
      cacheTTL: options.cacheTTL || null, // null = infinite cache
      autoReload: options.autoReload || false, // watch for file changes
      validateSchemas: options.validateSchemas || false,
      ...options
    };
    
    // Statistics tracking
    this.stats = {
      hits: 0,
      misses: 0,
      loads: 0,
      errors: 0
    };
  }

  /**
   * Load a prompt template with namespace support
   * @param {string} templatePath - Namespaced path (e.g., 'coding/requirements/analyze')
   * @returns {Promise<Object>} Object with content and metadata
   */
  async load(templatePath) {
    // Normalize path and add .md extension if needed
    const normalizedPath = this._normalizePath(templatePath);
    
    // Check cache first
    const cached = this._getCached(normalizedPath);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    
    this.stats.misses++;
    
    // Load from filesystem
    const filePath = path.join(this.templateDir, normalizedPath);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsed = this._parseMarkdown(fileContent);
      
      // Cache the result
      this._setCached(normalizedPath, parsed);
      this.stats.loads++;
      
      return parsed;
    } catch (error) {
      this.stats.errors++;
      if (error.code === 'ENOENT') {
        // Try alternative paths (e.g., index.md in directory)
        const alternative = await this._tryAlternativePaths(templatePath);
        if (alternative) {
          return alternative;
        }
        throw new Error(`Prompt template not found: ${templatePath} (looked in ${filePath})`);
      }
      throw new Error(`Failed to load prompt template: ${error.message}`);
    }
  }

  /**
   * Load all templates from a directory
   * @param {string} dirPath - Directory path relative to templateDir
   * @returns {Promise<Map>} Map of template names to content/metadata
   */
  async loadDirectory(dirPath) {
    const fullPath = path.join(this.templateDir, dirPath);
    const templates = new Map();
    
    try {
      const files = await this._scanDirectory(fullPath);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const relativePath = path.relative(this.templateDir, file);
          const templateName = this._pathToNamespace(relativePath);
          const content = await this.load(templateName);
          templates.set(templateName, content);
        }
      }
      
      return templates;
    } catch (error) {
      throw new Error(`Failed to load directory: ${error.message}`);
    }
  }

  /**
   * Get metadata for a template without loading content
   * @param {string} templatePath - Namespaced path
   * @returns {Promise<Object>} Template metadata
   */
  async getMetadata(templatePath) {
    const template = await this.load(templatePath);
    return template.metadata;
  }

  /**
   * List all available templates
   * @returns {Promise<Array>} Array of template paths
   */
  async list() {
    const templates = [];
    const files = await this._scanDirectory(this.templateDir);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const relativePath = path.relative(this.templateDir, file);
        templates.push(this._pathToNamespace(relativePath));
      }
    }
    
    return templates;
  }

  /**
   * Search templates by metadata
   * @param {Object} query - Query object for metadata search
   * @returns {Promise<Array>} Matching template paths
   */
  async search(query) {
    const allTemplates = await this.list();
    const matches = [];
    
    for (const templatePath of allTemplates) {
      const metadata = await this.getMetadata(templatePath);
      
      if (this._matchesQuery(metadata, query)) {
        matches.push(templatePath);
      }
    }
    
    return matches;
  }

  /**
   * Clear cache (optionally for specific template)
   * @param {string} templatePath - Optional specific template to clear
   */
  clearCache(templatePath = null) {
    if (templatePath) {
      const normalizedPath = this._normalizePath(templatePath);
      this.cache.delete(normalizedPath);
      this.metadata.delete(normalizedPath);
    } else {
      this.cache.clear();
      this.metadata.clear();
    }
  }

  /**
   * Get registry statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const cacheSize = this.cache.size;
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;
    
    return {
      ...this.stats,
      cacheSize,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  // Private helper methods

  /**
   * Normalize template path
   * @private
   */
  _normalizePath(templatePath) {
    // Remove leading/trailing slashes
    let normalized = templatePath.trim().replace(/^\/+|\/+$/g, '');
    
    // Convert namespace separator (dots) to path separator BEFORE adding extension
    normalized = normalized.replace(/\./g, '/');
    
    // Add .md extension if not present
    if (!normalized.endsWith('.md')) {
      normalized += '.md';
    }
    
    return normalized;
  }

  /**
   * Convert file path to namespace format
   * @private
   */
  _pathToNamespace(filePath) {
    return filePath
      .replace(/\.md$/, '')
      .replace(/\\/g, '/') // Windows path support
      .replace(/\//g, '/'); // Keep forward slashes for namespaces
  }

  /**
   * Parse markdown with frontmatter
   * @private
   */
  _parseMarkdown(fileContent) {
    const { content, data } = matter(fileContent);
    
    return {
      content: content.trim(),
      metadata: {
        ...data,
        // Add computed metadata
        hasVariables: this._detectVariables(content),
        lineCount: content.split('\n').length,
        wordCount: content.split(/\s+/).length
      }
    };
  }

  /**
   * Detect template variables in content
   * @private
   */
  _detectVariables(content) {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      if (!variables.includes(match[1].trim())) {
        variables.push(match[1].trim());
      }
    }
    
    return variables;
  }

  /**
   * Get cached template
   * @private
   */
  _getCached(normalizedPath) {
    if (!this.cache.has(normalizedPath)) {
      return null;
    }
    
    const cached = this.cache.get(normalizedPath);
    
    // Check TTL if configured
    if (this.options.cacheTTL) {
      const age = Date.now() - cached.timestamp;
      if (age > this.options.cacheTTL) {
        this.cache.delete(normalizedPath);
        return null;
      }
    }
    
    return cached.data;
  }

  /**
   * Set cached template
   * @private
   */
  _setCached(normalizedPath, data) {
    this.cache.set(normalizedPath, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Recursively scan directory for .md files
   * @private
   */
  async _scanDirectory(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this._scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or not readable
      console.warn(`Could not scan directory: ${dir}`);
    }
    
    return files;
  }

  /**
   * Try alternative paths for template
   * @private
   */
  async _tryAlternativePaths(templatePath) {
    const alternatives = [
      `${templatePath}/index.md`,
      `${templatePath}/main.md`,
      `${templatePath}/default.md`
    ];
    
    for (const alt of alternatives) {
      try {
        return await this.load(alt);
      } catch (error) {
        // Continue to next alternative
      }
    }
    
    return null;
  }

  /**
   * Check if metadata matches query
   * @private
   */
  _matchesQuery(metadata, query) {
    for (const [key, value] of Object.entries(query)) {
      if (key === 'tags') {
        // Special handling for tags
        if (!metadata.tags || !Array.isArray(metadata.tags)) {
          return false;
        }
        const queryTags = Array.isArray(value) ? value : [value];
        if (!queryTags.every(tag => metadata.tags.includes(tag))) {
          return false;
        }
      } else {
        // Simple equality check for other fields
        if (metadata[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Create a template with variables filled in
   * @param {string} templatePath - Template path
   * @param {Object} variables - Variables to substitute
   * @returns {Promise<string>} Filled template
   */
  async fill(templatePath, variables = {}) {
    const template = await this.load(templatePath);
    let content = template.content;
    
    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      content = content.replace(pattern, value);
    }
    
    return content;
  }

  /**
   * Validate template has required variables
   * @param {string} templatePath - Template path
   * @param {Array} requiredVars - Required variable names
   * @returns {Promise<boolean>} True if valid
   */
  async validate(templatePath, requiredVars = []) {
    const template = await this.load(templatePath);
    const hasVars = template.metadata.hasVariables || [];
    
    return requiredVars.every(v => hasVars.includes(v));
  }
}

// Export singleton instance for convenience
export const promptRegistry = new EnhancedPromptRegistry();