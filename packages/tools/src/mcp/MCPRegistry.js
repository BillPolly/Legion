/**
 * MCPRegistry - Central registry for available MCP servers
 * 
 * Manages the catalog of available MCP servers from various sources:
 * - NPM registry (packages with 'mcp-server' keyword)
 * - GitHub repositories (modelcontextprotocol organization and others)
 * - Manual entries (custom servers)
 * 
 * Provides discovery, search, and metadata for MCP server installation.
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class MCPRegistry extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    this.resourceManager = dependencies.resourceManager;
    this.httpClient = dependencies.httpClient;
    this.registryFile = dependencies.registryFile || './config/mcp-registry.json';
    this.cacheTimeout = dependencies.cacheTimeout || 24 * 60 * 60 * 1000; // 24 hours
    
    this.registry = {
      servers: new Map(),
      lastUpdated: null,
      sources: {
        npm: true,
        github: true,
        manual: true
      }
    };
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    this.emit('info', 'Initializing MCP Registry');
    
    // Load cached registry if available
    await this.loadCachedRegistry();
    
    // Update if cache is stale or empty
    if (!this.registry.lastUpdated || 
        Date.now() - this.registry.lastUpdated > this.cacheTimeout ||
        this.registry.servers.size === 0) {
      await this.updateRegistry();
    }
    
    this.emit('info', `MCP Registry initialized with ${this.registry.servers.size} servers`);
  }

  /**
   * Update registry from all sources
   */
  async updateRegistry() {
    this.emit('info', 'Updating MCP Registry from remote sources');
    
    const updatePromises = [];
    
    if (this.registry.sources.npm) {
      updatePromises.push(this.updateFromNPM());
    }
    
    if (this.registry.sources.github) {
      updatePromises.push(this.updateFromGitHub());
    }
    
    if (this.registry.sources.manual) {
      updatePromises.push(this.updateFromManual());
    }
    
    await Promise.allSettled(updatePromises);
    
    this.registry.lastUpdated = Date.now();
    await this.saveCachedRegistry();
    
    this.emit('registry-updated', {
      serverCount: this.registry.servers.size,
      timestamp: this.registry.lastUpdated
    });
  }

  /**
   * Update from NPM registry
   */
  async updateFromNPM() {
    try {
      this.emit('info', 'Searching NPM registry for MCP servers');
      
      // Search NPM for packages with 'mcp-server' keyword
      const npmSearchUrl = 'https://registry.npmjs.org/-/v1/search';
      const searchParams = new URLSearchParams({
        text: 'keywords:mcp-server',
        size: 100,
        quality: 0.65,
        popularity: 0.25,
        maintenance: 0.1
      });
      
      const response = await fetch(`${npmSearchUrl}?${searchParams}`);
      if (!response.ok) {
        throw new Error(`NPM search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      for (const pkg of data.objects) {
        const server = this.parseNPMPackage(pkg.package);
        if (server) {
          this.registry.servers.set(server.id, server);
          this.emit('server-discovered', server);
        }
      }
      
      this.emit('info', `Discovered ${data.objects.length} MCP servers from NPM`);
    } catch (error) {
      this.emit('error', `Failed to update from NPM: ${error.message}`);
    }
  }

  /**
   * Update from GitHub repositories
   */
  async updateFromGitHub() {
    try {
      this.emit('info', 'Searching GitHub for MCP servers');
      
      // Known MCP server repositories
      const knownRepos = [
        'modelcontextprotocol/servers',
        'modelcontextprotocol/create-server',
        // Add more as they become available
      ];
      
      for (const repo of knownRepos) {
        await this.processGitHubRepo(repo);
      }
      
      // Search GitHub for additional MCP servers
      await this.searchGitHubRepositories();
      
    } catch (error) {
      this.emit('error', `Failed to update from GitHub: ${error.message}`);
    }
  }

  /**
   * Process a specific GitHub repository for MCP servers
   */
  async processGitHubRepo(repoPath) {
    try {
      const apiUrl = `https://api.github.com/repos/${repoPath}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`GitHub API failed: ${response.statusText}`);
      }
      
      const repoData = await response.json();
      
      // Check if this is a monorepo with multiple servers
      if (repoPath === 'modelcontextprotocol/servers') {
        await this.processMonorepoServers(repoPath, repoData);
      } else {
        // Single server repository
        const server = this.parseGitHubRepo(repoData);
        if (server) {
          this.registry.servers.set(server.id, server);
          this.emit('server-discovered', server);
        }
      }
    } catch (error) {
      this.emit('error', `Failed to process GitHub repo ${repoPath}: ${error.message}`);
    }
  }

  /**
   * Process monorepo with multiple MCP servers
   */
  async processMonorepoServers(repoPath, repoData) {
    try {
      // Get directory listing for known server paths
      const contentsUrl = `https://api.github.com/repos/${repoPath}/contents/src`;
      const response = await fetch(contentsUrl);
      
      if (!response.ok) {
        this.emit('warning', `Could not list contents of ${repoPath}/src`);
        return;
      }
      
      const contents = await response.json();
      
      // Each directory in /src is potentially a server
      for (const item of contents) {
        if (item.type === 'dir') {
          const server = {
            id: `github-${repoPath.replace('/', '-')}-${item.name}`,
            name: `${item.name}-mcp-server`,
            description: `${item.name} MCP server from ${repoPath}`,
            source: 'github',
            repository: repoPath,
            path: `src/${item.name}`,
            category: this.inferCategoryFromName(item.name),
            tags: this.inferTagsFromName(item.name),
            installation: {
              method: 'git-clone',
              url: repoData.clone_url,
              path: `src/${item.name}`,
              build: true // Assume needs npm install
            },
            metadata: {
              author: repoData.owner.login,
              stars: repoData.stargazers_count,
              language: repoData.language || 'JavaScript',
              lastUpdated: new Date(repoData.updated_at).toISOString()
            }
          };
          
          this.registry.servers.set(server.id, server);
          this.emit('server-discovered', server);
        }
      }
    } catch (error) {
      this.emit('error', `Failed to process monorepo ${repoPath}: ${error.message}`);
    }
  }

  /**
   * Search GitHub for MCP server repositories
   */
  async searchGitHubRepositories() {
    try {
      const searchQuery = 'mcp-server OR "model context protocol" language:JavaScript';
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&per_page=50`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`GitHub search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      for (const repo of data.items) {
        // Skip repos we already processed
        if (repo.full_name === 'modelcontextprotocol/servers') continue;
        
        const server = this.parseGitHubRepo(repo);
        if (server && !this.registry.servers.has(server.id)) {
          this.registry.servers.set(server.id, server);
          this.emit('server-discovered', server);
        }
      }
      
      this.emit('info', `Searched GitHub, found ${data.items.length} potential MCP repositories`);
    } catch (error) {
      this.emit('error', `Failed to search GitHub: ${error.message}`);
    }
  }

  /**
   * Update from manual entries
   */
  async updateFromManual() {
    try {
      // Load manual server definitions
      const manualServers = await this.loadManualServers();
      
      for (const server of manualServers) {
        server.source = 'manual';
        this.registry.servers.set(server.id, server);
        this.emit('server-discovered', server);
      }
      
      this.emit('info', `Loaded ${manualServers.length} manual MCP server entries`);
    } catch (error) {
      this.emit('error', `Failed to load manual entries: ${error.message}`);
    }
  }

  /**
   * Parse NPM package into server definition
   */
  parseNPMPackage(pkg) {
    if (!pkg.keywords || !pkg.keywords.includes('mcp-server')) {
      return null;
    }
    
    return {
      id: `npm-${pkg.name.replace(/[@\/]/g, '-')}`,
      name: pkg.name,
      description: pkg.description || 'MCP Server from NPM',
      source: 'npm',
      package: pkg.name,
      version: pkg.version,
      category: this.inferCategoryFromDescription(pkg.description),
      tags: this.inferTagsFromKeywords(pkg.keywords),
      installation: {
        method: 'npm',
        package: pkg.name,
        version: pkg.version
      },
      metadata: {
        author: pkg.author?.name || pkg.publisher?.username,
        downloads: pkg.popularity,
        license: pkg.license,
        lastUpdated: pkg.date
      }
    };
  }

  /**
   * Parse GitHub repository into server definition
   */
  parseGitHubRepo(repo) {
    // Filter out non-MCP repositories
    const mcpKeywords = ['mcp-server', 'model-context-protocol', 'mcp'];
    const description = (repo.description || '').toLowerCase();
    const name = repo.name.toLowerCase();
    
    const isMCPRepo = mcpKeywords.some(keyword => 
      description.includes(keyword) || name.includes(keyword)
    ) || (repo.topics && repo.topics.some(topic => mcpKeywords.includes(topic)));
    
    if (!isMCPRepo) {
      return null;
    }
    
    return {
      id: `github-${repo.full_name.replace('/', '-')}`,
      name: repo.name,
      description: repo.description || 'MCP Server from GitHub',
      source: 'github',
      repository: repo.full_name,
      category: this.inferCategoryFromDescription(repo.description),
      tags: this.inferTagsFromTopics(repo.topics),
      installation: {
        method: 'git-clone',
        url: repo.clone_url,
        build: true
      },
      metadata: {
        author: repo.owner.login,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        lastUpdated: repo.updated_at
      }
    };
  }

  /**
   * Infer category from server name/description
   */
  inferCategoryFromName(name) {
    const categoryMap = {
      'filesystem': ['fs', 'file', 'directory'],
      'git': ['git', 'vcs', 'version'],
      'database': ['db', 'sql', 'mongo', 'postgres'],
      'web': ['http', 'api', 'web', 'fetch'],
      'system': ['system', 'os', 'process'],
      'ai': ['ai', 'llm', 'openai', 'anthropic'],
      'development': ['dev', 'build', 'test', 'lint']
    };
    
    const nameLower = name.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => nameLower.includes(keyword))) {
        return `mcp-${category}`;
      }
    }
    
    return 'mcp-general';
  }

  /**
   * Infer category from description
   */
  inferCategoryFromDescription(description) {
    if (!description) return 'mcp-general';
    
    const descLower = description.toLowerCase();
    const categoryMap = {
      'filesystem': ['file', 'directory', 'storage', 'disk'],
      'git': ['git', 'repository', 'version control', 'commit'],
      'database': ['database', 'sql', 'query', 'data'],
      'web': ['http', 'api', 'web', 'request', 'fetch'],
      'system': ['system', 'process', 'command', 'shell'],
      'ai': ['ai', 'llm', 'openai', 'language model'],
      'development': ['development', 'build', 'test', 'code']
    };
    
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => descLower.includes(keyword))) {
        return `mcp-${category}`;
      }
    }
    
    return 'mcp-general';
  }

  /**
   * Infer tags from keywords/topics
   */
  inferTagsFromKeywords(keywords) {
    if (!Array.isArray(keywords)) return [];
    return keywords.filter(k => k !== 'mcp-server').map(k => k.toLowerCase());
  }

  /**
   * Infer tags from GitHub topics
   */
  inferTagsFromTopics(topics) {
    if (!Array.isArray(topics)) return [];
    return topics.filter(t => t !== 'mcp-server').map(t => t.toLowerCase());
  }

  /**
   * Infer tags from name
   */
  inferTagsFromName(name) {
    const nameParts = name.toLowerCase().split(/[-_]/);
    return nameParts.filter(part => part.length > 2);
  }

  /**
   * Load manual server definitions
   */
  async loadManualServers() {
    try {
      const manualFile = './config/mcp-manual-servers.json';
      const content = await fs.readFile(manualFile, 'utf-8');
      const data = JSON.parse(content);
      return data.servers || [];
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  /**
   * Load cached registry
   */
  async loadCachedRegistry() {
    try {
      const content = await fs.readFile(this.registryFile, 'utf-8');
      const data = JSON.parse(content);
      
      this.registry.lastUpdated = data.lastUpdated;
      this.registry.servers = new Map(data.servers || []);
      
      this.emit('info', `Loaded cached registry with ${this.registry.servers.size} servers`);
    } catch (error) {
      this.emit('info', 'No cached registry found, will create new one');
    }
  }

  /**
   * Save cached registry
   */
  async saveCachedRegistry() {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.registryFile), { recursive: true });
      
      const data = {
        lastUpdated: this.registry.lastUpdated,
        servers: Array.from(this.registry.servers.entries())
      };
      
      await fs.writeFile(this.registryFile, JSON.stringify(data, null, 2));
      this.emit('info', `Cached registry saved to ${this.registryFile}`);
    } catch (error) {
      this.emit('error', `Failed to save registry cache: ${error.message}`);
    }
  }

  /**
   * Search servers by query
   */
  searchServers(query, options = {}) {
    const {
      category = null,
      source = null,
      limit = 50,
      sortBy = 'relevance'
    } = options;
    
    const queryLower = query.toLowerCase();
    const results = [];
    
    for (const server of this.registry.servers.values()) {
      // Filter by category
      if (category && server.category !== category) continue;
      
      // Filter by source
      if (source && server.source !== source) continue;
      
      // Calculate relevance score
      let score = 0;
      
      // Name match (highest weight)
      if (server.name.toLowerCase().includes(queryLower)) {
        score += 10;
      }
      
      // Description match
      if (server.description.toLowerCase().includes(queryLower)) {
        score += 5;
      }
      
      // Tags match
      const tagMatches = server.tags.filter(tag => 
        tag.includes(queryLower) || queryLower.includes(tag)
      );
      score += tagMatches.length * 3;
      
      // Category match
      if (server.category.includes(queryLower)) {
        score += 2;
      }
      
      if (score > 0) {
        results.push({ ...server, relevanceScore: score });
      }
    }
    
    // Sort results
    if (sortBy === 'relevance') {
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else if (sortBy === 'popularity') {
      results.sort((a, b) => (b.metadata.stars || 0) - (a.metadata.stars || 0));
    } else if (sortBy === 'updated') {
      results.sort((a, b) => new Date(b.metadata.lastUpdated) - new Date(a.metadata.lastUpdated));
    }
    
    return results.slice(0, limit);
  }

  /**
   * Get server by ID
   */
  getServer(id) {
    return this.registry.servers.get(id);
  }

  /**
   * Get all servers
   */
  getAllServers() {
    return Array.from(this.registry.servers.values());
  }

  /**
   * Get servers by category
   */
  getServersByCategory(category) {
    return Array.from(this.registry.servers.values())
      .filter(server => server.category === category);
  }

  /**
   * Get available categories
   */
  getCategories() {
    const categories = new Set();
    for (const server of this.registry.servers.values()) {
      categories.add(server.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const stats = {
      totalServers: this.registry.servers.size,
      lastUpdated: this.registry.lastUpdated,
      sources: {},
      categories: {},
      languages: {}
    };
    
    for (const server of this.registry.servers.values()) {
      // Count by source
      stats.sources[server.source] = (stats.sources[server.source] || 0) + 1;
      
      // Count by category
      stats.categories[server.category] = (stats.categories[server.category] || 0) + 1;
      
      // Count by language
      const lang = server.metadata?.language || 'Unknown';
      stats.languages[lang] = (stats.languages[lang] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Force update registry
   */
  async forceUpdate() {
    this.registry.lastUpdated = null;
    await this.updateRegistry();
  }
}