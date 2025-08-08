#!/usr/bin/env node

/**
 * MCP CLI - Command Line Interface for managing MCP servers in Legion
 * 
 * Provides commands for:
 * - Discovering and installing MCP servers
 * - Managing server lifecycle (start/stop/restart)
 * - Viewing server status and logs
 * - Searching available tools
 * - Configuration management
 */

import { program } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Import Legion MCP components
import { MCPPackageManager } from '../mcp/MCPPackageManager.js';
import { MCPServerManager } from '../mcp/MCPServerManager.js';
import { MCPRegistry } from '../mcp/MCPRegistry.js';
import { MCPHealthChecker } from '../mcp/MCPHealthChecker.js';
import { ResourceManager } from '@legion/module-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

class MCPCLIManager {
  constructor() {
    this.configPath = this.findConfigPath();
    this.config = this.loadConfig();
    this.resourceManager = null;
    this.packageManager = null;
    this.serverManager = null;
    this.registry = null;
    this.healthChecker = null;
  }

  async initialize() {
    console.log(chalk.blue('🚀 Initializing MCP CLI...'));
    
    // Initialize ResourceManager
    this.resourceManager = new ResourceManager();
    await this.resourceManager.initialize();

    // Initialize MCP components
    this.registry = new MCPRegistry({ resourceManager: this.resourceManager });
    await this.registry.initialize();

    this.packageManager = new MCPPackageManager({ 
      resourceManager: this.resourceManager,
      registry: this.registry 
    });
    await this.packageManager.initialize();

    this.serverManager = new MCPServerManager({ 
      resourceManager: this.resourceManager,
      config: this.config 
    });
    await this.serverManager.initialize();

    this.healthChecker = new MCPHealthChecker({ 
      serverManager: this.serverManager 
    });
    await this.healthChecker.initialize();

    console.log(chalk.green('✅ MCP CLI initialized successfully'));
  }

  findConfigPath() {
    const possiblePaths = [
      join(process.cwd(), 'mcp-config.json'),
      join(process.cwd(), '.mcp', 'config.json'),
      join(process.env.HOME || process.env.USERPROFILE || '', '.legion', 'mcp-config.json'),
      join(__dirname, '..', 'config', 'mcp-config.json')
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    // Return default location if none found
    return join(process.cwd(), 'mcp-config.json');
  }

  loadConfig() {
    if (!existsSync(this.configPath)) {
      console.log(chalk.yellow(`⚠️ Config file not found at ${this.configPath}`));
      console.log(chalk.blue('Creating default configuration...'));
      
      const defaultConfig = {
        mcpServers: {},
        discovery: {
          sources: [
            { type: 'npm', searchTerms: ['mcp-server', '@modelcontextprotocol'], enabled: true },
            { type: 'github', searchTerms: ['mcp-server', 'model-context-protocol'], enabled: true }
          ],
          updateInterval: 86400000,
          cacheTimeout: 3600000
        },
        integration: {
          enabled: true,
          toolPrefix: 'mcp',
          semanticSearch: { enabled: true, searchWeight: 0.8, autoSuggest: true },
          observability: { enabled: true, logLevel: 'info', traceExecution: true }
        }
      };

      writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }

    try {
      return JSON.parse(readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load config: ${error.message}`));
      process.exit(1);
    }
  }

  saveConfig() {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log(chalk.green(`✅ Configuration saved to ${this.configPath}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to save config: ${error.message}`));
    }
  }

  // Discovery Commands
  async discoverServers(options = {}) {
    console.log(chalk.blue('🔍 Discovering available MCP servers...'));
    
    try {
      await this.registry.updateFromAllSources();
      const servers = await this.registry.searchServers('', { 
        limit: options.limit || 50,
        includeInstalled: options.includeInstalled !== false
      });

      this.displayServerList(servers, 'Available MCP Servers');
      return servers;
    } catch (error) {
      console.error(chalk.red(`❌ Discovery failed: ${error.message}`));
      return [];
    }
  }

  async searchServers(query, options = {}) {
    console.log(chalk.blue(`🔍 Searching for: "${query}"...`));
    
    try {
      const servers = await this.registry.searchServers(query, {
        limit: options.limit || 20,
        categories: options.categories,
        includeInstalled: options.includeInstalled !== false
      });

      this.displayServerList(servers, `Search Results for "${query}"`);
      return servers;
    } catch (error) {
      console.error(chalk.red(`❌ Search failed: ${error.message}`));
      return [];
    }
  }

  // Installation Commands
  async installServer(serverId, options = {}) {
    console.log(chalk.blue(`📦 Installing MCP server: ${serverId}...`));
    
    try {
      const result = await this.packageManager.installServer(serverId, {
        force: options.force,
        skipDeps: options.skipDeps,
        method: options.method // npm or git
      });

      if (result.success) {
        console.log(chalk.green(`✅ Successfully installed ${serverId}`));
        
        // Add to configuration if requested
        if (options.addToConfig) {
          await this.addServerToConfig(serverId, result.serverDef, options);
        }
        
        return result;
      } else {
        console.error(chalk.red(`❌ Installation failed: ${result.error}`));
        return result;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Installation failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async uninstallServer(serverId, options = {}) {
    console.log(chalk.blue(`🗑️ Uninstalling MCP server: ${serverId}...`));
    
    try {
      // Stop server if running
      if (this.serverManager.isServerRunning(serverId)) {
        await this.serverManager.stopServer(serverId);
      }

      // Remove from package manager
      const result = await this.packageManager.uninstallServer(serverId);
      
      if (result.success) {
        console.log(chalk.green(`✅ Successfully uninstalled ${serverId}`));
        
        // Remove from config if requested
        if (options.removeFromConfig && this.config.mcpServers[serverId]) {
          delete this.config.mcpServers[serverId];
          this.saveConfig();
        }
        
        return result;
      } else {
        console.error(chalk.red(`❌ Uninstallation failed: ${result.error}`));
        return result;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Uninstallation failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  // Server Management Commands
  async listServers(options = {}) {
    console.log(chalk.blue('📋 Listing MCP servers...'));
    
    const configuredServers = Object.keys(this.config.mcpServers || {});
    const runningServers = this.serverManager.getRunningServers();
    const serverStatus = await this.serverManager.getAllServerStatus();

    console.log(chalk.cyan('\n📊 Server Status Overview:'));
    console.log(`Total Configured: ${configuredServers.length}`);
    console.log(`Currently Running: ${runningServers.length}`);

    if (configuredServers.length === 0) {
      console.log(chalk.yellow('\n⚠️ No servers configured. Use "mcp install" to add some!'));
      return;
    }

    console.log(chalk.cyan('\n📋 Configured Servers:'));
    
    const table = [];
    for (const serverId of configuredServers) {
      const config = this.config.mcpServers[serverId];
      const status = serverStatus.find(s => s.serverId === serverId);
      
      table.push({
        ID: serverId,
        Name: config.name,
        Status: this.formatStatus(status?.status || 'stopped'),
        Category: config.category || 'general',
        'Auto Start': config.autoStart ? '✅' : '❌',
        Enabled: config.enabled ? '✅' : '❌'
      });
    }

    console.table(table);
  }

  async startServer(serverId, options = {}) {
    console.log(chalk.blue(`🚀 Starting MCP server: ${serverId}...`));
    
    try {
      const result = await this.serverManager.startServer(serverId, {
        timeout: options.timeout,
        env: options.env
      });

      if (result.success) {
        console.log(chalk.green(`✅ Server ${serverId} started successfully`));
        console.log(`PID: ${result.process.pid}`);
        console.log(`Tools available: ${result.toolCount || 0}`);
      } else {
        console.error(chalk.red(`❌ Failed to start ${serverId}: ${result.error}`));
      }

      return result;
    } catch (error) {
      console.error(chalk.red(`❌ Start failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async stopServer(serverId, options = {}) {
    console.log(chalk.blue(`⏹️ Stopping MCP server: ${serverId}...`));
    
    try {
      const result = await this.serverManager.stopServer(serverId, {
        force: options.force,
        timeout: options.timeout
      });

      if (result.success) {
        console.log(chalk.green(`✅ Server ${serverId} stopped successfully`));
      } else {
        console.error(chalk.red(`❌ Failed to stop ${serverId}: ${result.error}`));
      }

      return result;
    } catch (error) {
      console.error(chalk.red(`❌ Stop failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async restartServer(serverId, options = {}) {
    console.log(chalk.blue(`🔄 Restarting MCP server: ${serverId}...`));
    
    try {
      await this.stopServer(serverId, options);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.startServer(serverId, options);
    } catch (error) {
      console.error(chalk.red(`❌ Restart failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  // Health and Monitoring Commands
  async healthCheck(serverId = null, options = {}) {
    if (serverId) {
      console.log(chalk.blue(`🏥 Health check for server: ${serverId}...`));
      
      try {
        const health = await this.healthChecker.checkServerHealth(serverId);
        this.displayHealthInfo(serverId, health);
        return health;
      } catch (error) {
        console.error(chalk.red(`❌ Health check failed: ${error.message}`));
        return null;
      }
    } else {
      console.log(chalk.blue('🏥 Running health checks for all servers...'));
      
      try {
        const results = await this.healthChecker.performHealthChecks();
        console.log(chalk.cyan('\n📊 Health Check Summary:'));
        
        for (const [serverId, health] of Object.entries(results)) {
          this.displayHealthInfo(serverId, health);
        }
        
        return results;
      } catch (error) {
        console.error(chalk.red(`❌ Health checks failed: ${error.message}`));
        return {};
      }
    }
  }

  async viewLogs(serverId, options = {}) {
    console.log(chalk.blue(`📜 Viewing logs for server: ${serverId}...`));
    
    try {
      const logs = await this.serverManager.getServerLogs(serverId, {
        lines: options.lines || 50,
        follow: options.follow
      });

      if (logs.length === 0) {
        console.log(chalk.yellow('No logs available'));
        return;
      }

      logs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const level = this.formatLogLevel(log.level);
        console.log(`${chalk.gray(timestamp)} ${level} ${log.message}`);
      });

      return logs;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to get logs: ${error.message}`));
      return [];
    }
  }

  // Tool Commands
  async listTools(serverId = null, options = {}) {
    if (serverId) {
      console.log(chalk.blue(`🔧 Listing tools for server: ${serverId}...`));
      
      try {
        const tools = await this.serverManager.getServerTools(serverId);
        this.displayToolList(tools, `Tools from ${serverId}`);
        return tools;
      } catch (error) {
        console.error(chalk.red(`❌ Failed to get tools: ${error.message}`));
        return [];
      }
    } else {
      console.log(chalk.blue('🔧 Listing all available MCP tools...'));
      
      try {
        const allTools = await this.serverManager.getAllAvailableTools();
        this.displayToolList(allTools, 'All Available MCP Tools');
        return allTools;
      } catch (error) {
        console.error(chalk.red(`❌ Failed to get tools: ${error.message}`));
        return [];
      }
    }
  }

  async searchTools(query, options = {}) {
    console.log(chalk.blue(`🔍 Searching tools for: "${query}"...`));
    
    try {
      const tools = await this.serverManager.searchTools(query, {
        limit: options.limit || 20,
        categories: options.categories
      });

      this.displayToolList(tools, `Tool Search Results for "${query}"`);
      return tools;
    } catch (error) {
      console.error(chalk.red(`❌ Tool search failed: ${error.message}`));
      return [];
    }
  }

  // Configuration Commands
  async showConfig(section = null) {
    console.log(chalk.blue(`⚙️ Configuration from: ${this.configPath}`));
    
    if (section) {
      if (this.config[section]) {
        console.log(chalk.cyan(`\n[${section}]:`));
        console.log(JSON.stringify(this.config[section], null, 2));
      } else {
        console.error(chalk.red(`❌ Section "${section}" not found`));
      }
    } else {
      console.log(chalk.cyan('\nFull Configuration:'));
      console.log(JSON.stringify(this.config, null, 2));
    }
  }

  async editConfig(key, value) {
    console.log(chalk.blue(`⚙️ Setting ${key} = ${value}...`));
    
    try {
      // Simple key.subkey.value parsing
      const keys = key.split('.');
      let target = this.config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) target[keys[i]] = {};
        target = target[keys[i]];
      }
      
      // Try to parse value as JSON, fallback to string
      try {
        target[keys[keys.length - 1]] = JSON.parse(value);
      } catch {
        target[keys[keys.length - 1]] = value;
      }
      
      this.saveConfig();
      console.log(chalk.green('✅ Configuration updated'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to update config: ${error.message}`));
    }
  }

  // Helper Methods
  async addServerToConfig(serverId, serverDef, options = {}) {
    const config = {
      name: serverDef.name,
      description: serverDef.description,
      command: serverDef.installInfo?.command || 'npx',
      args: serverDef.installInfo?.args || [serverDef.packageName || serverId],
      category: serverDef.category || 'general',
      tags: serverDef.tags || [],
      enabled: true,
      autoStart: options.autoStart || false
    };

    if (serverDef.env) config.env = serverDef.env;
    if (options.cwd) config.cwd = options.cwd;

    this.config.mcpServers[serverId] = config;
    this.saveConfig();
    
    console.log(chalk.green(`✅ Added ${serverId} to configuration`));
  }

  displayServerList(servers, title) {
    console.log(chalk.cyan(`\n${title}:`));
    
    if (servers.length === 0) {
      console.log(chalk.yellow('No servers found'));
      return;
    }

    const table = servers.map(server => ({
      ID: server.id,
      Name: server.name,
      Category: server.category || 'general',
      'Tool Count': server.toolCount || 0,
      Status: server.installed ? '✅ Installed' : '📦 Available',
      Description: (server.description || '').substring(0, 50) + '...'
    }));

    console.table(table);
  }

  displayToolList(tools, title) {
    console.log(chalk.cyan(`\n${title}:`));
    
    if (tools.length === 0) {
      console.log(chalk.yellow('No tools found'));
      return;
    }

    const table = tools.map(tool => ({
      Name: tool.name,
      Server: tool.serverId || 'Unknown',
      Category: tool.category || 'general',
      Description: (tool.description || '').substring(0, 60) + '...'
    }));

    console.table(table);
  }

  displayHealthInfo(serverId, health) {
    const status = health.healthy ? 
      chalk.green('✅ Healthy') : 
      chalk.red('❌ Unhealthy');
    
    console.log(`\n${chalk.bold(serverId)}: ${status}`);
    console.log(`  Status: ${health.status}`);
    console.log(`  Uptime: ${Math.floor(health.uptime / 1000)}s`);
    console.log(`  Last Check: ${new Date(health.lastCheck).toLocaleString()}`);
    
    if (health.errors?.length > 0) {
      console.log(`  Errors: ${health.errors.length}`);
      health.errors.slice(0, 3).forEach(error => {
        console.log(`    - ${error.message}`);
      });
    }
  }

  formatStatus(status) {
    switch (status) {
      case 'running': return chalk.green('🟢 Running');
      case 'stopped': return chalk.gray('⭕ Stopped');
      case 'error': return chalk.red('🔴 Error');
      case 'starting': return chalk.yellow('🟡 Starting');
      case 'stopping': return chalk.yellow('🟡 Stopping');
      default: return chalk.gray('❓ Unknown');
    }
  }

  formatLogLevel(level) {
    switch (level.toLowerCase()) {
      case 'error': return chalk.red('ERROR');
      case 'warn': return chalk.yellow('WARN');
      case 'info': return chalk.blue('INFO');
      case 'debug': return chalk.gray('DEBUG');
      default: return level;
    }
  }
}

// Initialize CLI manager
const cliManager = new MCPCLIManager();

// Define CLI commands
program
  .name('mcp')
  .description('Legion MCP Server Management CLI')
  .version('1.0.0')
  .hook('preAction', async () => {
    await cliManager.initialize();
  });

// Discovery commands
program
  .command('discover')
  .description('Discover available MCP servers')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .option('--no-installed', 'Exclude already installed servers')
  .action(async (options) => {
    await cliManager.discoverServers(options);
  });

program
  .command('search <query>')
  .description('Search for MCP servers')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .option('-c, --categories <categories>', 'Filter by categories (comma-separated)')
  .option('--no-installed', 'Exclude already installed servers')
  .action(async (query, options) => {
    if (options.categories) {
      options.categories = options.categories.split(',');
    }
    await cliManager.searchServers(query, options);
  });

// Installation commands
program
  .command('install <server-id>')
  .description('Install an MCP server')
  .option('-f, --force', 'Force reinstall if already installed')
  .option('--skip-deps', 'Skip dependency installation')
  .option('-m, --method <method>', 'Installation method (npm|git)', 'npm')
  .option('--add-config', 'Add to configuration after installation')
  .option('--auto-start', 'Enable auto-start after installation')
  .option('--cwd <directory>', 'Working directory for the server')
  .action(async (serverId, options) => {
    await cliManager.installServer(serverId, options);
  });

program
  .command('uninstall <server-id>')
  .description('Uninstall an MCP server')
  .option('--remove-config', 'Remove from configuration')
  .action(async (serverId, options) => {
    await cliManager.uninstallServer(serverId, options);
  });

// Server management commands
program
  .command('list')
  .alias('ls')
  .description('List configured MCP servers')
  .action(async (options) => {
    await cliManager.listServers(options);
  });

program
  .command('start [server-id]')
  .description('Start MCP server(s)')
  .option('-t, --timeout <ms>', 'Startup timeout', '30000')
  .option('-e, --env <vars>', 'Environment variables (JSON)')
  .action(async (serverId, options) => {
    if (options.env) {
      try {
        options.env = JSON.parse(options.env);
      } catch (error) {
        console.error(chalk.red('❌ Invalid JSON in --env option'));
        return;
      }
    }
    
    if (serverId) {
      await cliManager.startServer(serverId, options);
    } else {
      // Start all auto-start servers
      const serverIds = Object.keys(cliManager.config.mcpServers || {})
        .filter(id => cliManager.config.mcpServers[id].autoStart);
      
      for (const id of serverIds) {
        await cliManager.startServer(id, options);
      }
    }
  });

program
  .command('stop [server-id]')
  .description('Stop MCP server(s)')
  .option('-f, --force', 'Force stop (kill process)')
  .option('-t, --timeout <ms>', 'Stop timeout', '10000')
  .action(async (serverId, options) => {
    if (serverId) {
      await cliManager.stopServer(serverId, options);
    } else {
      // Stop all running servers
      const runningServers = cliManager.serverManager.getRunningServers();
      
      for (const id of runningServers) {
        await cliManager.stopServer(id, options);
      }
    }
  });

program
  .command('restart [server-id]')
  .description('Restart MCP server(s)')
  .option('-f, --force', 'Force stop before restart')
  .option('-t, --timeout <ms>', 'Operation timeout', '30000')
  .action(async (serverId, options) => {
    if (serverId) {
      await cliManager.restartServer(serverId, options);
    } else {
      // Restart all running servers
      const runningServers = cliManager.serverManager.getRunningServers();
      
      for (const id of runningServers) {
        await cliManager.restartServer(id, options);
      }
    }
  });

// Health and monitoring commands  
program
  .command('health [server-id]')
  .description('Check health of MCP server(s)')
  .action(async (serverId) => {
    await cliManager.healthCheck(serverId);
  });

program
  .command('logs <server-id>')
  .description('View server logs')
  .option('-n, --lines <number>', 'Number of log lines', '50')
  .option('-f, --follow', 'Follow log output')
  .action(async (serverId, options) => {
    options.lines = parseInt(options.lines);
    await cliManager.viewLogs(serverId, options);
  });

// Tool commands
program
  .command('tools [server-id]')
  .description('List available tools')
  .action(async (serverId) => {
    await cliManager.listTools(serverId);
  });

program
  .command('search-tools <query>')
  .description('Search available tools')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .option('-c, --categories <categories>', 'Filter by categories (comma-separated)')
  .action(async (query, options) => {
    if (options.categories) {
      options.categories = options.categories.split(',');
    }
    await cliManager.searchTools(query, options);
  });

// Configuration commands
program
  .command('config [section]')
  .description('Show configuration')
  .action(async (section) => {
    await cliManager.showConfig(section);
  });

program
  .command('set <key> <value>')
  .description('Set configuration value')
  .action(async (key, value) => {
    await cliManager.editConfig(key, value);
  });

// Parse command line arguments
program.parse();