/**
 * MCPPackageManager - High-level manager for MCP server packages
 * 
 * Coordinates discovery, installation, and management of MCP servers.
 * Provides a unified interface for:
 * - Searching available servers
 * - Installing/uninstalling servers
 * - Managing server lifecycle
 * - Recommendations and suggestions
 */

import { EventEmitter } from 'events';
import { MCPRegistry } from './MCPRegistry.js';
import { MCPInstaller } from './MCPInstaller.js';

export class MCPPackageManager extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    this.resourceManager = dependencies.resourceManager;
    
    // Initialize components
    this.registry = new MCPRegistry({
      resourceManager: this.resourceManager,
      ...dependencies.registry
    });
    
    this.installer = new MCPInstaller({
      resourceManager: this.resourceManager,
      ...dependencies.installer
    });
    
    // Configuration
    this.autoUpdate = dependencies.autoUpdate !== false;
    this.autoInstall = dependencies.autoInstall || false;
    this.updateInterval = dependencies.updateInterval || 24 * 60 * 60 * 1000; // 24 hours
    
    // State
    this.initialized = false;
    this.updateTimer = null;
    
    // Forward events from components
    this.setupEventForwarding();
  }

  /**
   * Initialize the package manager
   */
  async initialize() {
    if (this.initialized) return;
    
    this.emit('info', 'Initializing MCP Package Manager');
    
    // Initialize components
    await this.registry.initialize();
    await this.installer.initialize();
    
    // Set up periodic updates if enabled
    if (this.autoUpdate) {
      this.setupPeriodicUpdates();
    }
    
    this.initialized = true;
    this.emit('initialized');
    
    const stats = this.registry.getStatistics();
    this.emit('info', `MCP Package Manager ready with ${stats.totalServers} available servers`);
  }

  /**
   * Search for MCP servers
   */
  async searchServers(query, options = {}) {
    await this.ensureInitialized();
    
    const results = this.registry.searchServers(query, options);
    
    // Enrich results with installation status
    const enrichedResults = await Promise.all(
      results.map(async (server) => {
        const isInstalled = await this.installer.isInstalled(server);
        let installedInfo = null;
        
        if (isInstalled) {
          try {
            installedInfo = await this.installer.getInstalledInfo(server);
          } catch (error) {
            // Ignore errors getting install info
          }
        }
        
        return {
          ...server,
          installed: isInstalled,
          installedInfo
        };
      })
    );
    
    this.emit('search-completed', {
      query,
      resultCount: enrichedResults.length,
      installedCount: enrichedResults.filter(r => r.installed).length
    });
    
    return enrichedResults;
  }

  /**
   * Get server by ID with installation status
   */
  async getServer(serverId) {
    await this.ensureInitialized();
    
    const server = this.registry.getServer(serverId);
    if (!server) return null;
    
    const isInstalled = await this.installer.isInstalled(server);
    let installedInfo = null;
    
    if (isInstalled) {
      try {
        installedInfo = await this.installer.getInstalledInfo(server);
      } catch (error) {
        // Ignore errors
      }
    }
    
    return {
      ...server,
      installed: isInstalled,
      installedInfo
    };
  }

  /**
   * Install server by ID
   */
  async installServer(serverId, options = {}) {
    await this.ensureInitialized();
    
    const server = this.registry.getServer(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found in registry`);
    }
    
    this.emit('install-request', { serverId, server });
    
    try {
      const result = await this.installer.installServer(server, options);
      
      this.emit('server-installed', {
        serverId,
        server,
        result
      });
      
      return result;
    } catch (error) {
      this.emit('install-error', {
        serverId,
        server,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Uninstall server by ID
   */
  async uninstallServer(serverId) {
    await this.ensureInitialized();
    
    try {
      const result = await this.installer.uninstallServer(serverId);
      
      this.emit('server-uninstalled', { serverId, result });
      
      return result;
    } catch (error) {
      this.emit('uninstall-error', {
        serverId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update server to latest version
   */
  async updateServer(serverId, options = {}) {
    await this.ensureInitialized();
    
    const server = this.registry.getServer(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found in registry`);
    }
    
    this.emit('update-request', { serverId, server });
    
    try {
      const result = await this.installer.updateServer(serverId, options);
      
      this.emit('server-updated', {
        serverId,
        server,
        result
      });
      
      return result;
    } catch (error) {
      this.emit('update-error', {
        serverId,
        server,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List all installed servers
   */
  async listInstalledServers() {
    await this.ensureInitialized();
    
    const installed = await this.installer.listInstalled();
    
    // Enrich with registry information
    const enriched = installed.map(installInfo => {
      const registryInfo = this.registry.getServer(installInfo.serverId);
      return {
        ...installInfo,
        registryInfo,
        hasUpdate: this.checkForUpdates(installInfo, registryInfo)
      };
    });
    
    return enriched;
  }

  /**
   * Get recommendations for a task description
   */
  async getRecommendations(taskDescription, options = {}) {
    await this.ensureInitialized();
    
    const {
      maxRecommendations = 5,
      includeInstalled = true,
      preferPopular = true
    } = options;
    
    // Search for relevant servers
    const searchResults = this.registry.searchServers(taskDescription, {
      limit: maxRecommendations * 2 // Get more to filter
    });
    
    // Enrich with installation status
    const enrichedResults = await Promise.all(
      searchResults.map(async (server) => {
        const isInstalled = await this.installer.isInstalled(server);
        return { ...server, installed: isInstalled };
      })
    );
    
    // Filter and rank recommendations
    let recommendations = enrichedResults;
    
    if (!includeInstalled) {
      recommendations = recommendations.filter(r => !r.installed);
    }
    
    if (preferPopular) {
      recommendations.sort((a, b) => {
        // Combine relevance score with popularity metrics
        const aPopularity = (a.metadata?.stars || 0) + (a.metadata?.downloads || 0);
        const bPopularity = (b.metadata?.stars || 0) + (b.metadata?.downloads || 0);
        
        const aScore = a.relevanceScore * 0.7 + (aPopularity / 1000) * 0.3;
        const bScore = b.relevanceScore * 0.7 + (bPopularity / 1000) * 0.3;
        
        return bScore - aScore;
      });
    }
    
    const finalRecommendations = recommendations.slice(0, maxRecommendations);
    
    this.emit('recommendations-generated', {
      taskDescription,
      recommendationCount: finalRecommendations.length,
      installedCount: finalRecommendations.filter(r => r.installed).length
    });
    
    return finalRecommendations;
  }

  /**
   * Auto-install recommended servers for a task
   */
  async autoInstallForTask(taskDescription, options = {}) {
    if (!this.autoInstall) {
      throw new Error('Auto-install is disabled');
    }
    
    const {
      maxInstalls = 3,
      skipExisting = true
    } = options;
    
    const recommendations = await this.getRecommendations(taskDescription, {
      includeInstalled: !skipExisting,
      maxRecommendations: maxInstalls
    });
    
    const toInstall = recommendations.filter(r => !r.installed).slice(0, maxInstalls);
    
    this.emit('auto-install-start', {
      taskDescription,
      serverCount: toInstall.length,
      servers: toInstall.map(s => s.id)
    });
    
    const results = [];
    for (const server of toInstall) {
      try {
        const result = await this.installServer(server.id);
        results.push({ serverId: server.id, success: true, result });
      } catch (error) {
        results.push({ serverId: server.id, success: false, error: error.message });
      }
    }
    
    this.emit('auto-install-complete', {
      taskDescription,
      results,
      successCount: results.filter(r => r.success).length
    });
    
    return results;
  }

  /**
   * Get popular servers by category
   */
  async getPopularServers(category = null, limit = 10) {
    await this.ensureInitialized();
    
    let servers = this.registry.getAllServers();
    
    if (category) {
      servers = servers.filter(s => s.category === category);
    }
    
    // Sort by popularity metrics
    servers.sort((a, b) => {
      const aScore = (a.metadata?.stars || 0) + (a.metadata?.downloads || 0) * 0.1;
      const bScore = (b.metadata?.stars || 0) + (b.metadata?.downloads || 0) * 0.1;
      return bScore - aScore;
    });
    
    const popular = servers.slice(0, limit);
    
    // Enrich with installation status
    return Promise.all(popular.map(async (server) => {
      const isInstalled = await this.installer.isInstalled(server);
      return { ...server, installed: isInstalled };
    }));
  }

  /**
   * Get categories with server counts
   */
  async getCategoriesWithCounts() {
    await this.ensureInitialized();
    
    const categories = this.registry.getCategories();
    const categoryCounts = {};
    
    for (const category of categories) {
      const servers = this.registry.getServersByCategory(category);
      const installedCount = await Promise.all(
        servers.map(server => this.installer.isInstalled(server))
      ).then(results => results.filter(Boolean).length);
      
      categoryCounts[category] = {
        total: servers.length,
        installed: installedCount
      };
    }
    
    return categoryCounts;
  }

  /**
   * Update registry from remote sources
   */
  async updateRegistry() {
    await this.ensureInitialized();
    await this.registry.updateRegistry();
  }

  /**
   * Check for updates to installed servers
   */
  async checkForUpdates() {
    await this.ensureInitialized();
    
    const installed = await this.installer.listInstalled();
    const updates = [];
    
    for (const installInfo of installed) {
      const registryInfo = this.registry.getServer(installInfo.serverId);
      if (registryInfo && this.checkForUpdates(installInfo, registryInfo)) {
        updates.push({
          serverId: installInfo.serverId,
          currentVersion: installInfo.packageInfo?.version,
          availableVersion: registryInfo.version,
          server: registryInfo
        });
      }
    }
    
    this.emit('updates-available', { updateCount: updates.length, updates });
    
    return updates;
  }

  /**
   * Install popular servers for common tasks
   */
  async installEssentials() {
    await this.ensureInitialized();
    
    // Define essential servers for common tasks
    const essentialCategories = [
      'mcp-filesystem',
      'mcp-git',
      'mcp-web'
    ];
    
    const essentials = [];
    for (const category of essentialCategories) {
      const popular = await this.getPopularServers(category, 1);
      if (popular.length > 0 && !popular[0].installed) {
        essentials.push(popular[0]);
      }
    }
    
    this.emit('installing-essentials', {
      serverCount: essentials.length,
      servers: essentials.map(s => s.id)
    });
    
    const results = [];
    for (const server of essentials) {
      try {
        const result = await this.installServer(server.id);
        results.push({ serverId: server.id, success: true, result });
      } catch (error) {
        results.push({ serverId: server.id, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get package manager statistics
   */
  async getStatistics() {
    await this.ensureInitialized();
    
    const registryStats = this.registry.getStatistics();
    const installedServers = await this.installer.listInstalled();
    const ongoingInstalls = this.installer.getOngoingInstallations();
    
    return {
      registry: registryStats,
      installed: {
        total: installedServers.length,
        byCategory: this.groupByCategory(installedServers),
        bySource: this.groupBySource(installedServers)
      },
      installation: {
        ongoing: ongoingInstalls.length,
        operations: ongoingInstalls
      }
    };
  }

  /**
   * Set up event forwarding from components
   */
  setupEventForwarding() {
    // Forward registry events
    this.registry.on('server-discovered', (server) => {
      this.emit('server-discovered', server);
    });
    
    this.registry.on('registry-updated', (info) => {
      this.emit('registry-updated', info);
    });
    
    // Forward installer events
    this.installer.on('install-started', (info) => {
      this.emit('install-started', info);
    });
    
    this.installer.on('install-completed', (info) => {
      this.emit('install-completed', info);
    });
    
    this.installer.on('install-failed', (info) => {
      this.emit('install-failed', info);
    });
  }

  /**
   * Set up periodic registry updates
   */
  setupPeriodicUpdates() {
    this.updateTimer = setInterval(async () => {
      try {
        await this.updateRegistry();
      } catch (error) {
        this.emit('error', `Periodic update failed: ${error.message}`);
      }
    }, this.updateInterval);
  }

  /**
   * Check if an installed server has updates available
   */
  checkForUpdates(installInfo, registryInfo) {
    if (!registryInfo) return false;
    
    // Simple version comparison - could be improved with semver
    const currentVersion = installInfo.packageInfo?.version || '0.0.0';
    const availableVersion = registryInfo.version || 'latest';
    
    return currentVersion !== availableVersion && availableVersion !== 'latest';
  }

  /**
   * Group servers by category
   */
  groupByCategory(servers) {
    const groups = {};
    for (const server of servers) {
      const category = server.serverDefinition?.category || 'unknown';
      groups[category] = (groups[category] || 0) + 1;
    }
    return groups;
  }

  /**
   * Group servers by source
   */
  groupBySource(servers) {
    const groups = {};
    for (const server of servers) {
      const source = server.serverDefinition?.source || 'unknown';
      groups[source] = (groups[source] || 0) + 1;
    }
    return groups;
  }

  /**
   * Ensure package manager is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Shutdown the package manager
   */
  async shutdown() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    this.emit('shutdown');
  }
}