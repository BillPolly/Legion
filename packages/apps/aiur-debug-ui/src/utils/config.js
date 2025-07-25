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
    autoStart: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
    timeout: 30000,
    sessionTimeout: 3600000,
    maxSessions: 100,
    maxConnections: 1000,
    heartbeatInterval: 30000,
    customTools: [],
    logging: {
      enableFile: true,
      directory: './logs',
      retentionDays: 7
    }
  },
  ui: {
    theme: 'dark',
    autoConnect: true
  },
  logging: {
    level: 'info',
    console: true,
    file: null,
    requests: true
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
  
  // Debug UI server settings
  if (process.env.DEBUG_UI_PORT) {
    config.server.port = parseInt(process.env.DEBUG_UI_PORT, 10);
  }
  if (process.env.DEBUG_UI_HOST) {
    config.server.host = process.env.DEBUG_UI_HOST;
  }
  
  // MCP server settings
  if (process.env.MCP_SERVER_URL) {
    config.mcp.defaultUrl = process.env.MCP_SERVER_URL;
  }
  if (process.env.MCP_AUTO_START !== undefined) {
    config.mcp.autoStart = process.env.MCP_AUTO_START === 'true';
  }
  if (process.env.AIUR_SERVER_PORT) {
    // Update MCP URL if Aiur server port is specified
    const host = config.mcp.defaultUrl.includes('localhost') ? 'localhost' : '0.0.0.0';
    config.mcp.defaultUrl = `ws://${host}:${process.env.AIUR_SERVER_PORT}/ws`;
  }
  if (process.env.AIUR_SERVER_HOST) {
    // Update MCP URL if Aiur server host is specified
    const port = config.mcp.defaultUrl.match(/:(\d+)/)?.[1] || '8080';
    config.mcp.defaultUrl = `ws://${process.env.AIUR_SERVER_HOST}:${port}/ws`;
  }
  if (process.env.AIUR_SESSION_TIMEOUT) {
    config.mcp.sessionTimeout = parseInt(process.env.AIUR_SESSION_TIMEOUT, 10);
  }
  if (process.env.MCP_RECONNECT_INTERVAL) {
    config.mcp.reconnectInterval = parseInt(process.env.MCP_RECONNECT_INTERVAL, 10);
  }
  if (process.env.MCP_MAX_RECONNECT_ATTEMPTS) {
    config.mcp.maxReconnectAttempts = parseInt(process.env.MCP_MAX_RECONNECT_ATTEMPTS, 10);
  }
  
  // UI settings
  if (process.env.UI_THEME) {
    config.ui.theme = process.env.UI_THEME;
  }
  if (process.env.UI_AUTO_CONNECT !== undefined) {
    config.ui.autoConnect = process.env.UI_AUTO_CONNECT === 'true';
  }
  
  // Logging settings
  if (process.env.LOG_LEVEL) {
    config.logging.level = process.env.LOG_LEVEL;
  }
  if (process.env.LOG_FILE) {
    config.logging.file = process.env.LOG_FILE;
  }
  if (process.env.LOG_REQUESTS !== undefined) {
    config.logging.requests = process.env.LOG_REQUESTS === 'true';
  }
  if (process.env.AIUR_LOG_DIRECTORY) {
    config.mcp.logging.directory = process.env.AIUR_LOG_DIRECTORY;
  }
  if (process.env.AIUR_LOG_RETENTION_DAYS) {
    config.mcp.logging.retentionDays = parseInt(process.env.AIUR_LOG_RETENTION_DAYS, 10);
  }
  
  // CORS settings
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
  
  // Validate debug UI server port
  const port = getConfigValue(config, 'server.port');
  if (port !== undefined && (port <= 0 || port > 65535)) {
    errors.push('Invalid debug UI server port');
  }
  
  // Validate MCP WebSocket URL
  const mcpUrl = getConfigValue(config, 'mcp.defaultUrl');
  if (mcpUrl && !mcpUrl.startsWith('ws://') && !mcpUrl.startsWith('wss://')) {
    errors.push('MCP server URL must start with ws:// or wss://');
  }
  
  // Check for port conflicts
  if (mcpUrl && port) {
    const mcpPortMatch = mcpUrl.match(/:(\d+)/);
    const mcpPort = mcpPortMatch ? parseInt(mcpPortMatch[1]) : 8080;
    if (mcpPort === port) {
      errors.push('MCP server port and debug UI port cannot be the same');
    }
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
  
  // Validate session timeout
  const sessionTimeout = getConfigValue(config, 'mcp.sessionTimeout');
  if (sessionTimeout !== undefined && sessionTimeout < 1000) {
    errors.push('Session timeout must be at least 1000ms');
  }
  
  // Validate max sessions
  const maxSessions = getConfigValue(config, 'mcp.maxSessions');
  if (maxSessions !== undefined && maxSessions < 1) {
    errors.push('Max sessions must be at least 1');
  }
  
  // Validate max connections
  const maxConnections = getConfigValue(config, 'mcp.maxConnections');
  if (maxConnections !== undefined && maxConnections < 1) {
    errors.push('Max connections must be at least 1');
  }
  
  // Validate heartbeat interval
  const heartbeatInterval = getConfigValue(config, 'mcp.heartbeatInterval');
  if (heartbeatInterval !== undefined && heartbeatInterval < 1000) {
    errors.push('Heartbeat interval must be at least 1000ms');
  }
  
  // Validate log retention days
  const retentionDays = getConfigValue(config, 'mcp.logging.retentionDays');
  if (retentionDays !== undefined && retentionDays < 1) {
    errors.push('Log retention days must be at least 1');
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