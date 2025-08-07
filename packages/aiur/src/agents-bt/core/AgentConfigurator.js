/**
 * AgentConfigurator - Manages loading and validation of agent configurations
 * 
 * Handles JSON-based agent workflow definitions, providing configuration
 * loading, validation, and runtime modification capabilities.
 */

import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AgentConfigurator {
  constructor() {
    this.configCache = new Map();
    this.configWatchers = new Map();
  }
  
  /**
   * Load configuration from JSON file
   */
  async loadConfig(configPath) {
    try {
      // Resolve relative paths from the configs directory
      const resolvedPath = this.resolveConfigPath(configPath);
      
      // Check cache first
      if (this.configCache.has(resolvedPath)) {
        const cached = this.configCache.get(resolvedPath);
        // Check if file has been modified (simple timestamp check)
        const stats = await fs.stat(resolvedPath);
        if (stats.mtime <= cached.timestamp) {
          return cached.config;
        }
      }
      
      // Load and parse the configuration file
      const configContent = await fs.readFile(resolvedPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      // Validate basic structure
      this.validateBasicStructure(config);
      
      // Process includes and references
      const processedConfig = await this.processIncludes(config, resolvedPath);
      
      // Cache the config with timestamp
      this.configCache.set(resolvedPath, {
        config: processedConfig,
        timestamp: new Date(),
        path: resolvedPath
      });
      
      console.log(`AgentConfigurator: Loaded configuration from ${resolvedPath}`);
      return processedConfig;
      
    } catch (error) {
      console.error(`AgentConfigurator: Failed to load config from ${configPath}:`, error);
      throw new Error(`Configuration loading failed: ${error.message}`);
    }
  }
  
  /**
   * Resolve configuration path relative to configs directory
   */
  resolveConfigPath(configPath) {
    // If it's already absolute, use as-is
    if (configPath.startsWith('/')) {
      return configPath;
    }
    
    // If it's relative, resolve from configs directory
    const configsDir = join(__dirname, '..', 'configs');
    
    // Add .json extension if not present
    const finalPath = configPath.endsWith('.json') ? configPath : `${configPath}.json`;
    
    return resolve(configsDir, finalPath);
  }
  
  /**
   * Validate basic configuration structure
   */
  validateBasicStructure(config) {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Configuration must be an object');
    }
    
    if (!config.type) {
      throw new Error('Configuration must specify a root node type');
    }
    
    if (!config.name) {
      console.warn('Configuration should specify a name for better debugging');
    }
  }
  
  /**
   * Process includes and references in configuration
   */
  async processIncludes(config, configPath) {
    // Deep clone to avoid modifying original
    const processed = JSON.parse(JSON.stringify(config));
    
    // Process includes recursively
    await this.processIncludesRecursive(processed, configPath);
    
    return processed;
  }
  
  /**
   * Recursively process includes in configuration nodes
   */
  async processIncludesRecursive(node, basePath) {
    if (typeof node !== 'object' || node === null) {
      return;
    }
    
    // Handle include directive
    if (node.$include) {
      const includePath = this.resolveIncludePath(node.$include, basePath);
      const includedConfig = await this.loadConfig(includePath);
      
      // Merge included config into current node
      Object.assign(node, includedConfig);
      delete node.$include;
    }
    
    // Handle template references
    if (node.$template) {
      const template = await this.loadTemplate(node.$template);
      
      // Apply template with parameters
      const instantiated = this.instantiateTemplate(template, node.$params || {});
      Object.assign(node, instantiated);
      
      delete node.$template;
      delete node.$params;
    }
    
    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        await this.processIncludesRecursive(child, basePath);
      }
    }
    
    // Process other object properties
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        await this.processIncludesRecursive(value, basePath);
      }
    }
  }
  
  /**
   * Resolve include path relative to current config
   */
  resolveIncludePath(includePath, basePath) {
    if (includePath.startsWith('/')) {
      return includePath;
    }
    
    const baseDir = dirname(basePath);
    return resolve(baseDir, includePath);
  }
  
  /**
   * Load configuration template
   */
  async loadTemplate(templateName) {
    const templatesDir = join(__dirname, '..', 'templates');
    const templatePath = join(templatesDir, `${templateName}.json`);
    
    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      return JSON.parse(templateContent);
    } catch (error) {
      throw new Error(`Template '${templateName}' not found: ${error.message}`);
    }
  }
  
  /**
   * Instantiate template with parameters
   */
  instantiateTemplate(template, params) {
    // Simple template parameter substitution
    const templateStr = JSON.stringify(template);
    let instantiated = templateStr;
    
    // Replace template parameters like {{paramName}}
    for (const [paramName, paramValue] of Object.entries(params)) {
      const pattern = new RegExp(`\\{\\{${paramName}\\}\\}`, 'g');
      instantiated = instantiated.replace(pattern, JSON.stringify(paramValue));
    }
    
    try {
      return JSON.parse(instantiated);
    } catch (error) {
      throw new Error(`Template instantiation failed: ${error.message}`);
    }
  }
  
  /**
   * Save configuration to file
   */
  async saveConfig(config, configPath) {
    try {
      const resolvedPath = this.resolveConfigPath(configPath);
      
      // Ensure directory exists
      const configDir = dirname(resolvedPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // Format and save configuration
      const configStr = JSON.stringify(config, null, 2);
      await fs.writeFile(resolvedPath, configStr, 'utf-8');
      
      // Update cache
      this.configCache.set(resolvedPath, {
        config: config,
        timestamp: new Date(),
        path: resolvedPath
      });
      
      console.log(`AgentConfigurator: Saved configuration to ${resolvedPath}`);
      
    } catch (error) {
      console.error(`AgentConfigurator: Failed to save config to ${configPath}:`, error);
      throw new Error(`Configuration saving failed: ${error.message}`);
    }
  }
  
  /**
   * Get default configuration for an agent type
   */
  getDefaultConfig(agentType) {
    const defaultConfigs = {
      chat: {
        type: 'message_handler',
        name: 'ChatAgent_Default',
        routes: {
          chat_message: {
            type: 'sequence',
            children: [
              { type: 'conversation_manager', action: 'add_user_message' },
              { type: 'llm_interaction', streaming: true, tools: true },
              { type: 'response_sender' }
            ]
          },
          clear_history: {
            type: 'conversation_manager',
            action: 'clear_history'
          }
        }
      },
      
      terminal: {
        type: 'message_handler', 
        name: 'TerminalAgent_Default',
        routes: {
          session_create: {
            type: 'session_manager',
            action: 'create_session'
          },
          tool_request: {
            type: 'sequence',
            children: [
              { type: 'tool_execution' },
              { type: 'response_sender' }
            ]
          },
          tools_list: {
            type: 'tools_list'
          }
        }
      },
      
      artifact: {
        type: 'message_handler',
        name: 'ArtifactAgent_Default',
        routes: {
          get_artifacts: {
            type: 'artifact_storage',
            action: 'get_all'
          },
          clear_artifacts: {
            type: 'artifact_storage',
            action: 'clear_all'
          },
          artifact_created: {
            type: 'sequence',
            children: [
              { type: 'artifact_storage', action: 'store' },
              { type: 'artifact_sync', action: 'notify_frontend' }
            ]
          }
        }
      }
    };
    
    return defaultConfigs[agentType] || {
      type: 'sequence',
      name: `${agentType}_default`,
      children: [
        { type: 'message_handler' }
      ]
    };
  }
  
  /**
   * Watch configuration file for changes (development mode)
   */
  async watchConfig(configPath, callback) {
    const resolvedPath = this.resolveConfigPath(configPath);
    
    try {
      // Use fs.watch to monitor file changes
      const watcher = fs.watch(resolvedPath, async (eventType) => {
        if (eventType === 'change') {
          try {
            console.log(`AgentConfigurator: Configuration file changed: ${resolvedPath}`);
            
            // Reload configuration
            const newConfig = await this.loadConfig(configPath);
            
            // Notify callback
            if (callback) {
              await callback(newConfig);
            }
            
          } catch (error) {
            console.error('AgentConfigurator: Error reloading configuration:', error);
          }
        }
      });
      
      this.configWatchers.set(resolvedPath, watcher);
      console.log(`AgentConfigurator: Watching configuration file: ${resolvedPath}`);
      
    } catch (error) {
      console.error(`AgentConfigurator: Failed to watch config file ${resolvedPath}:`, error);
    }
  }
  
  /**
   * Stop watching a configuration file
   */
  stopWatching(configPath) {
    const resolvedPath = this.resolveConfigPath(configPath);
    const watcher = this.configWatchers.get(resolvedPath);
    
    if (watcher) {
      watcher.close();
      this.configWatchers.delete(resolvedPath);
      console.log(`AgentConfigurator: Stopped watching ${resolvedPath}`);
    }
  }
  
  /**
   * Clear configuration cache
   */
  clearCache() {
    this.configCache.clear();
    console.log('AgentConfigurator: Configuration cache cleared');
  }
  
  /**
   * Get cached configurations
   */
  getCacheInfo() {
    const info = [];
    for (const [path, cached] of this.configCache) {
      info.push({
        path,
        timestamp: cached.timestamp,
        configName: cached.config.name
      });
    }
    return info;
  }
  
  /**
   * Clean up watchers
   */
  destroy() {
    for (const watcher of this.configWatchers.values()) {
      watcher.close();
    }
    this.configWatchers.clear();
    this.configCache.clear();
  }
}