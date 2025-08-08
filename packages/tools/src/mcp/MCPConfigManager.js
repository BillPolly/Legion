/**
 * MCPConfigManager - Manages MCP server configurations
 * 
 * Handles:
 * - Server configuration storage and retrieval
 * - Configuration validation and schema enforcement
 * - Environment variable substitution
 * - Configuration templates and presets
 * - Hot reloading of configuration changes
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

// Configuration schema validation
const ServerConfigSchema = z.object({
  serverId: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  
  // Installation info
  installation: z.object({
    method: z.enum(['npm', 'git-clone', 'download']),
    package: z.string().optional(),
    url: z.string().optional(),
    path: z.string().optional(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string()).default({})
  }).optional(),
  
  // Runtime configuration
  command: z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    cwd: z.string().optional(),
    env: z.record(z.string()).default({})
  }),
  
  // Server options
  autoRestart: z.boolean().default(true),
  maxRestarts: z.number().default(5),
  healthCheckInterval: z.number().default(30000),
  weight: z.number().default(1),
  
  // Resource limits
  maxMemory: z.number().optional(), // MB
  maxCpu: z.number().optional(), // %
  timeout: z.number().default(30000),
  
  // Metadata
  description: z.string().optional(),
  category: z.string().default('general'),
  tags: z.array(z.string()).default([]),
  version: z.string().optional(),
  
  // Custom configuration
  custom: z.record(z.any()).default({})
});

export class MCPConfigManager extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    
    this.resourceManager = dependencies.resourceManager;
    this.configDir = dependencies.configDir || './config/mcp-servers';
    this.templatesDir = dependencies.templatesDir || './config/mcp-templates';
    this.envSubstitution = dependencies.envSubstitution !== false;
    this.watchFiles = dependencies.watchFiles !== false;
    
    // State
    this.configs = new Map(); // serverId -> config
    self.templates = new Map(); // templateId -> template
    this.watchers = new Map(); // filePath -> watcher
    this.initialized = false;
    
    // Built-in templates
    this.builtInTemplates = new Map([
      ['filesystem', this.createFilesystemTemplate()],
      ['git', this.createGitTemplate()],
      ['web', this.createWebTemplate()],
      ['database', this.createDatabaseTemplate()]
    ]);
  }

  /**
   * Initialize the config manager
   */
  async initialize() {
    if (this.initialized) return;
    
    this.emit('info', 'Initializing MCP Config Manager');
    
    // Ensure directories exist
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.mkdir(this.templatesDir, { recursive: true });
    
    // Load configurations
    await this.loadAllConfigs();
    
    // Load templates
    await this.loadTemplates();
    
    // Set up file watching if enabled
    if (this.watchFiles) {
      await this.setupFileWatching();
    }
    
    this.initialized = true;
    
    this.emit('initialized', {
      configCount: this.configs.size,
      templateCount: this.templates.size + this.builtInTemplates.size
    });
  }

  /**
   * Load all server configurations
   */
  async loadAllConfigs() {
    try {
      const files = await fs.readdir(this.configDir);
      const configFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of configFiles) {
        await this.loadConfigFile(path.join(this.configDir, file));
      }
      
      this.emit('info', `Loaded ${this.configs.size} server configurations`);
    } catch (error) {
      this.emit('warning', `Failed to load configurations: ${error.message}`);
    }
  }

  /**
   * Load a specific configuration file
   */
  async loadConfigFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const rawConfig = JSON.parse(content);
      
      // Environment variable substitution
      const processedConfig = this.envSubstitution ? 
        this.substituteEnvVars(rawConfig) : rawConfig;
      
      // Validate configuration
      const config = ServerConfigSchema.parse(processedConfig);
      
      // Store configuration
      this.configs.set(config.serverId, config);
      
      this.emit('config-loaded', {
        serverId: config.serverId,
        filePath
      });
      
      return config;
    } catch (error) {
      this.emit('error', `Failed to load config file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save server configuration
   */
  async saveServerConfig(config) {
    // Validate configuration
    const validatedConfig = ServerConfigSchema.parse(config);
    
    const filePath = path.join(this.configDir, `${validatedConfig.serverId}.json`);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(validatedConfig, null, 2));
      
      const isNew = !this.configs.has(validatedConfig.serverId);
      this.configs.set(validatedConfig.serverId, validatedConfig);
      
      this.emit('config-saved', {
        serverId: validatedConfig.serverId,
        filePath,
        isNew
      });
      
      this.emit('config-changed', {
        serverId: validatedConfig.serverId,
        changeType: isNew ? 'server-added' : 'server-updated',
        config: validatedConfig
      });
      
      return validatedConfig;
    } catch (error) {
      this.emit('error', `Failed to save config for ${validatedConfig.serverId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete server configuration
   */
  async deleteServerConfig(serverId) {
    const config = this.configs.get(serverId);
    if (!config) {
      throw new Error(`Configuration not found: ${serverId}`);
    }
    
    const filePath = path.join(this.configDir, `${serverId}.json`);
    
    try {
      await fs.unlink(filePath);
      this.configs.delete(serverId);
      
      this.emit('config-deleted', {
        serverId,
        filePath
      });
      
      this.emit('config-changed', {
        serverId,
        changeType: 'server-removed',
        config
      });
      
    } catch (error) {
      this.emit('error', `Failed to delete config for ${serverId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get server configuration
   */
  getServerConfig(serverId) {
    return this.configs.get(serverId);
  }

  /**
   * Get all server configurations
   */
  getAllServerConfigs() {
    return Array.from(this.configs.values());
  }

  /**
   * Get configurations by category
   */
  getConfigsByCategory(category) {
    return Array.from(this.configs.values())
      .filter(config => config.category === category);
  }

  /**
   * Get enabled configurations
   */
  getEnabledConfigs() {
    return Array.from(this.configs.values())
      .filter(config => config.enabled !== false);
  }

  /**
   * Create configuration from template
   */
  async createFromTemplate(templateId, overrides = {}) {
    let template = this.templates.get(templateId) || this.builtInTemplates.get(templateId);
    
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // Deep merge template with overrides
    const config = this.deepMerge(template, overrides);
    
    // Ensure required fields
    if (!config.serverId) {
      config.serverId = this.generateServerId(templateId);
    }
    
    if (!config.name) {
      config.name = `${templateId}-server-${Date.now()}`;
    }
    
    // Save the configuration
    return this.saveServerConfig(config);
  }

  /**
   * Load configuration templates
   */
  async loadTemplates() {
    try {
      const files = await fs.readdir(this.templatesDir);
      const templateFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of templateFiles) {
        const filePath = path.join(this.templatesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const template = JSON.parse(content);
        
        const templateId = path.basename(file, '.json');
        this.templates.set(templateId, template);
        
        this.emit('template-loaded', {
          templateId,
          filePath
        });
      }
      
      this.emit('info', `Loaded ${this.templates.size} configuration templates`);
    } catch (error) {
      this.emit('warning', `Failed to load templates: ${error.message}`);
    }
  }

  /**
   * Save configuration template
   */
  async saveTemplate(templateId, template) {
    const filePath = path.join(this.templatesDir, `${templateId}.json`);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(template, null, 2));
      this.templates.set(templateId, template);
      
      this.emit('template-saved', {
        templateId,
        filePath
      });
      
      return template;
    } catch (error) {
      this.emit('error', `Failed to save template ${templateId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    const templates = new Map();
    
    // Add built-in templates
    for (const [id, template] of this.builtInTemplates) {
      templates.set(id, { ...template, builtin: true });
    }
    
    // Add custom templates
    for (const [id, template] of this.templates) {
      templates.set(id, { ...template, builtin: false });
    }
    
    return Object.fromEntries(templates);
  }

  /**
   * Substitute environment variables in configuration
   */
  substituteEnvVars(obj) {
    if (typeof obj === 'string') {
      return obj.replace(/\${([^}]+)}/g, (match, varName) => {
        return this.getEnvVar(varName) || match;
      });
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteEnvVars(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteEnvVars(value);
      }
      return result;
    }
    
    return obj;
  }

  /**
   * Get environment variable with resource manager fallback
   */
  getEnvVar(varName) {
    // Try process.env first
    if (process.env[varName]) {
      return process.env[varName];
    }
    
    // Try resource manager if available
    if (this.resourceManager) {
      return this.resourceManager.get(`env.${varName}`);
    }
    
    return undefined;
  }

  /**
   * Set up file watching for configuration changes
   */
  async setupFileWatching() {
    try {
      const fs = await import('fs');
      
      // Watch config directory
      const configWatcher = fs.watch(this.configDir, async (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          const filePath = path.join(this.configDir, filename);
          
          if (eventType === 'change') {
            try {
              await this.loadConfigFile(filePath);
              this.emit('config-file-changed', { filePath });
            } catch (error) {
              this.emit('warning', `Failed to reload config file ${filename}: ${error.message}`);
            }
          }
        }
      });
      
      this.watchers.set(this.configDir, configWatcher);
      
      // Watch templates directory
      const templatesWatcher = fs.watch(this.templatesDir, async (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          if (eventType === 'change') {
            await this.loadTemplates();
            this.emit('templates-reloaded');
          }
        }
      });
      
      this.watchers.set(this.templatesDir, templatesWatcher);
      
      this.emit('info', 'File watching enabled for configuration changes');
    } catch (error) {
      this.emit('warning', `Failed to set up file watching: ${error.message}`);
    }
  }

  /**
   * Validate server configuration
   */
  validateConfig(config) {
    try {
      return ServerConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
  }

  /**
   * Generate unique server ID
   */
  generateServerId(prefix = 'server') {
    let counter = 1;
    let serverId = `${prefix}-${counter}`;
    
    while (this.configs.has(serverId)) {
      counter++;
      serverId = `${prefix}-${counter}`;
    }
    
    return serverId;
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Create built-in templates
   */
  createFilesystemTemplate() {
    return {
      name: 'Filesystem MCP Server',
      description: 'MCP server for file system operations',
      category: 'mcp-filesystem',
      tags: ['filesystem', 'files', 'storage'],
      installation: {
        method: 'npm',
        package: '@modelcontextprotocol/server-filesystem'
      },
      command: {
        command: 'node',
        args: ['dist/index.js'],
        env: {}
      },
      autoRestart: true,
      maxRestarts: 3,
      healthCheckInterval: 30000,
      weight: 1
    };
  }

  createGitTemplate() {
    return {
      name: 'Git MCP Server',
      description: 'MCP server for Git operations',
      category: 'mcp-git',
      tags: ['git', 'vcs', 'version-control'],
      installation: {
        method: 'git-clone',
        url: 'https://github.com/modelcontextprotocol/servers.git',
        path: 'src/git'
      },
      command: {
        command: 'node',
        args: ['dist/index.js'],
        env: {}
      },
      autoRestart: true,
      maxRestarts: 3,
      healthCheckInterval: 30000,
      weight: 1
    };
  }

  createWebTemplate() {
    return {
      name: 'Web MCP Server',
      description: 'MCP server for web/HTTP operations',
      category: 'mcp-web',
      tags: ['web', 'http', 'api'],
      installation: {
        method: 'npm',
        package: '@modelcontextprotocol/server-web'
      },
      command: {
        command: 'node',
        args: ['dist/index.js'],
        env: {}
      },
      autoRestart: true,
      maxRestarts: 3,
      healthCheckInterval: 30000,
      weight: 1
    };
  }

  createDatabaseTemplate() {
    return {
      name: 'Database MCP Server',
      description: 'MCP server for database operations',
      category: 'mcp-database',
      tags: ['database', 'sql', 'data'],
      installation: {
        method: 'npm',
        package: '@modelcontextprotocol/server-database'
      },
      command: {
        command: 'node',
        args: ['dist/index.js'],
        env: {
          DB_URL: '${DATABASE_URL}'
        }
      },
      autoRestart: true,
      maxRestarts: 3,
      healthCheckInterval: 30000,
      weight: 1
    };
  }

  /**
   * Export configurations
   */
  async exportConfigs(filePath) {
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      configs: Object.fromEntries(this.configs)
    };
    
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    
    this.emit('configs-exported', {
      filePath,
      configCount: this.configs.size
    });
  }

  /**
   * Import configurations
   */
  async importConfigs(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const importData = JSON.parse(content);
    
    if (!importData.configs) {
      throw new Error('Invalid import file format');
    }
    
    let importedCount = 0;
    for (const [serverId, config] of Object.entries(importData.configs)) {
      try {
        await this.saveServerConfig(config);
        importedCount++;
      } catch (error) {
        this.emit('warning', `Failed to import config ${serverId}: ${error.message}`);
      }
    }
    
    this.emit('configs-imported', {
      filePath,
      importedCount
    });
    
    return importedCount;
  }

  /**
   * Get configuration statistics
   */
  getStatistics() {
    const categories = {};
    const statuses = { enabled: 0, disabled: 0 };
    
    for (const config of this.configs.values()) {
      // Count by category
      categories[config.category] = (categories[config.category] || 0) + 1;
      
      // Count by status
      if (config.enabled !== false) {
        statuses.enabled++;
      } else {
        statuses.disabled++;
      }
    }
    
    return {
      totalConfigs: this.configs.size,
      categories,
      statuses,
      templates: {
        builtin: this.builtInTemplates.size,
        custom: this.templates.size,
        total: this.builtInTemplates.size + this.templates.size
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Close file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    
    this.removeAllListeners();
  }
}