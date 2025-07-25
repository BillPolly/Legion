/**
 * Configuration management for the debug UI
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Default configuration
const defaultConfig = {
  server: {
    port: 3001,
    host: 'localhost'
  },
  mcp: {
    defaultUrl: 'ws://localhost:8080/ws',
    reconnectInterval: 1000,
    maxReconnectAttempts: 5
  },
  ui: {
    theme: 'dark',
    autoConnect: true
  },
  logging: {
    level: 'info',
    console: true,
    file: null
  },
  cors: {
    enabled: false,
    origin: '*'
  }
};

/**
 * Load configuration from environment and optional config file
 * @param {string} [configPath] - Optional path to config file
 * @returns {Object} Merged configuration object
 */
export function loadConfig(configPath) {
  let config = JSON.parse(JSON.stringify(defaultConfig)); // Deep clone
  
  // Determine config file path
  const configFile = configPath || process.env.CONFIG_FILE || join(process.cwd(), 'config.json');
  
  // Load config file if it exists
  if (existsSync(configFile)) {
    try {
      const fileConfig = JSON.parse(readFileSync(configFile, 'utf8'));
      config = deepMerge(config, fileConfig);
    } catch (error) {
      console.error(`Failed to load config file: ${error.message}`);
    }
  }
  
  // Override with environment variables
  if (process.env.DEBUG_UI_PORT) {
    config.server.port = parseInt(process.env.DEBUG_UI_PORT, 10);
  }
  if (process.env.DEBUG_UI_HOST) {
    config.server.host = process.env.DEBUG_UI_HOST;
  }
  if (process.env.MCP_SERVER_URL) {
    config.mcp.defaultUrl = process.env.MCP_SERVER_URL;
  }
  if (process.env.UI_THEME) {
    config.ui.theme = process.env.UI_THEME;
  }
  if (process.env.LOG_LEVEL) {
    config.logging.level = process.env.LOG_LEVEL;
  }
  if (process.env.LOG_FILE) {
    config.logging.file = process.env.LOG_FILE;
  }
  if (process.env.CORS_ENABLED) {
    config.cors.enabled = process.env.CORS_ENABLED === 'true';
  }
  if (process.env.CORS_ORIGIN) {
    config.cors.origin = process.env.CORS_ORIGIN;
  }
  
  return config;
}

/**
 * Get a configuration value by dot-notation path
 * @param {Object} config - Configuration object
 * @param {string} path - Dot-notation path (e.g., 'server.port')
 * @param {*} [defaultValue] - Default value if path not found
 * @returns {*} Configuration value
 */
export function getConfigValue(config, path, defaultValue) {
  if (!config) return defaultValue;
  
  const parts = path.split('.');
  let value = config;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return defaultValue;
    }
  }
  
  return value;
}

/**
 * Validate configuration and return array of errors
 * @param {Object} config - Configuration to validate
 * @returns {string[]} Array of validation errors (empty if valid)
 */
export function validateConfig(config) {
  const errors = [];
  
  // Validate port
  const port = getConfigValue(config, 'server.port');
  if (port !== undefined && (port <= 0 || port > 65535)) {
    errors.push('Invalid server port');
  }
  
  // Validate WebSocket URL
  const mcpUrl = getConfigValue(config, 'mcp.defaultUrl');
  if (mcpUrl && !mcpUrl.startsWith('ws://') && !mcpUrl.startsWith('wss://')) {
    errors.push('MCP server URL must start with ws:// or wss://');
  }
  
  // Validate reconnect interval
  const reconnectInterval = getConfigValue(config, 'mcp.reconnectInterval');
  if (reconnectInterval !== undefined && reconnectInterval < 100) {
    errors.push('Reconnect interval must be at least 100ms');
  }
  
  // Validate max reconnect attempts
  const maxReconnectAttempts = getConfigValue(config, 'mcp.maxReconnectAttempts');
  if (maxReconnectAttempts !== undefined && maxReconnectAttempts < 0) {
    errors.push('Max reconnect attempts must be non-negative');
  }
  
  return errors;
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!result[key]) result[key] = {};
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}