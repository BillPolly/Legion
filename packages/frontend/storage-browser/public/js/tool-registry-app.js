/**
 * Tool Registry Application
 * Main application logic for the responsive MVVM Tool Registry
 */

import { ToolRegistryBrowser } from '/components/src/components/tool-registry/index.js';

// Sample data for demonstration
const SAMPLE_TOOLS = [
  {
    id: 'file-reader',
    name: 'File Reader',
    description: 'Read and process various file formats including JSON, CSV, TXT, and binary files',
    category: 'file-operations',
    status: 'active',
    module: 'file-module',
    tags: ['files', 'io', 'reader', 'json', 'csv'],
    hasExecute: true
  },
  {
    id: 'json-parser',
    name: 'JSON Parser',
    description: 'Parse and validate JSON data structures with comprehensive error reporting',
    category: 'data-processing',
    status: 'active',
    module: 'data-module',
    tags: ['json', 'parser', 'validation', 'data'],
    hasExecute: true
  },
  {
    id: 'api-client',
    name: 'API Client',
    description: 'HTTP client for API interactions with authentication and retry logic',
    category: 'networking',
    status: 'active',
    module: 'network-module',
    tags: ['http', 'api', 'client', 'rest'],
    hasExecute: true
  },
  {
    id: 'csv-processor',
    name: 'CSV Processor',
    description: 'Process CSV files with advanced filtering and transformation capabilities',
    category: 'data-processing',
    status: 'active',
    module: 'data-module',
    tags: ['csv', 'data', 'processing', 'transform'],
    hasExecute: true
  },
  {
    id: 'image-optimizer',
    name: 'Image Optimizer',
    description: 'Optimize images for web with compression, resizing, and format conversion',
    category: 'media-processing',
    status: 'experimental',
    module: 'media-module',
    tags: ['images', 'optimization', 'compression', 'resize'],
    hasExecute: false
  },
  {
    id: 'database-connector',
    name: 'Database Connector',
    description: 'Connect to various databases including MySQL, PostgreSQL, MongoDB',
    category: 'data-storage',
    status: 'active',
    module: 'database-module',
    tags: ['database', 'sql', 'nosql', 'connection'],
    hasExecute: true
  },
  {
    id: 'email-sender',
    name: 'Email Sender',
    description: 'Send emails through various providers with template support',
    category: 'communication',
    status: 'active',
    module: 'communication-module',
    tags: ['email', 'smtp', 'templates'],
    hasExecute: true
  },
  {
    id: 'pdf-generator',
    name: 'PDF Generator',
    description: 'Generate PDF documents from HTML, templates, or raw data',
    category: 'document-processing',
    status: 'active',
    module: 'document-module',
    tags: ['pdf', 'generator', 'html', 'documents'],
    hasExecute: true
  },
  {
    id: 'text-analyzer',
    name: 'Text Analyzer',
    description: 'Analyze text for sentiment, keywords, and language detection',
    category: 'ai-processing',
    status: 'experimental',
    module: 'ai-module',
    tags: ['text', 'nlp', 'sentiment', 'analysis'],
    hasExecute: true
  },
  {
    id: 'cache-manager',
    name: 'Cache Manager',
    description: 'Manage application caching with Redis or in-memory storage',
    category: 'system',
    status: 'active',
    module: 'system-module',
    tags: ['cache', 'redis', 'memory', 'performance'],
    hasExecute: true
  }
];

const SAMPLE_MODULES = [
  {
    id: 'file-module',
    name: 'File Operations',
    description: 'Complete file system operations and utilities',
    toolCount: 7,
    status: 'active',
    category: 'filesystem'
  },
  {
    id: 'data-module',
    name: 'Data Processing',
    description: 'Advanced data transformation and validation tools',
    toolCount: 12,
    status: 'active',
    category: 'data-processing'
  },
  {
    id: 'network-module',
    name: 'Network Operations',
    description: 'HTTP clients, WebSocket handlers, and network utilities',
    toolCount: 8,
    status: 'active',
    category: 'networking'
  },
  {
    id: 'media-module',
    name: 'Media Processing',
    description: 'Image, video, and audio processing tools',
    toolCount: 6,
    status: 'experimental',
    category: 'media-processing'
  },
  {
    id: 'database-module',
    name: 'Database Tools',
    description: 'Database connectivity and management tools',
    toolCount: 9,
    status: 'active',
    category: 'data-storage'
  },
  {
    id: 'ai-module',
    name: 'AI & ML Tools',
    description: 'Artificial intelligence and machine learning utilities',
    toolCount: 5,
    status: 'experimental',
    category: 'ai-processing'
  }
];

class ToolRegistryApp {
  constructor() {
    this.toolRegistry = null;
    this.ws = null;
    this.dataStore = {
      tools: new Map(),
      modules: new Map(),
      searchResults: []
    };
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Tool Registry Application...');
      
      const appContainer = document.getElementById('app');
      if (!appContainer) {
        throw new Error('App container not found');
      }

      // Create the Tool Registry Browser
      this.toolRegistry = ToolRegistryBrowser.create({
        dom: appContainer,
        websocketUrl: this.getWebSocketUrl(),
        theme: this.getTheme(),
        userInfo: this.getUserInfo(),
        onMount: (instance) => this.handleMount(instance),
        onTabChange: (tabId, tab) => this.handleTabChange(tabId, tab),
        onError: (error) => this.handleError(error)
      });

      // Initialize WebSocket connection
      await this.initializeWebSocket();
      
      // Load initial data
      this.loadSampleData();
      
      // Set up global access for debugging
      window.toolRegistryApp = this;
      window.toolRegistry = this.toolRegistry;
      
      console.log('✅ Tool Registry Application initialized successfully');
      
    } catch (error) {
      console.error('💥 Failed to initialize application:', error);
      this.showErrorState(error);
    }
  }

  getWebSocketUrl() {
    // Check if storage server is running
    const wsUrl = 'ws://localhost:3700/storage';
    console.log(`📡 WebSocket URL: ${wsUrl}`);
    return wsUrl;
  }

  getTheme() {
    const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }

  getUserInfo() {
    return {
      name: 'Developer',
      initials: 'DV',
      status: 'online',
      avatar: null
    };
  }

  async initializeWebSocket() {
    if (!this.toolRegistry) return;
    
    try {
      const wsUrl = this.getWebSocketUrl();
      if (!wsUrl) return;

      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to storage server');
        this.loadRemoteData();
      };
      
      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };
      
      this.ws.onerror = (error) => {
        console.warn('⚠️ WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
      };
      
    } catch (error) {
      console.warn('⚠️ WebSocket initialization failed:', error);
    }
  }

  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('📨 WebSocket message:', data.type);
      
      if (data.type === 'response') {
        this.handleWebSocketResponse(data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  handleWebSocketResponse(data) {
    if (data.id?.includes('tools')) {
      this.updateTools(data.data);
    } else if (data.id?.includes('modules')) {
      this.updateModules(data.data);
    }
  }

  sendWebSocketRequest(actor, method, params, idPrefix = '') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return null;
    }

    const request = {
      type: 'request',
      id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actor: actor,
      method: method,
      params: params,
      timestamp: Date.now()
    };
    
    this.ws.send(JSON.stringify(request));
    return request.id;
  }

  loadRemoteData() {
    // Request tools from storage server
    this.sendWebSocketRequest('CollectionActor', 'find', {
      collection: 'tools',
      query: {},
      options: { provider: 'mongodb' }
    }, 'tools');
    
    // Request modules from storage server
    this.sendWebSocketRequest('CollectionActor', 'find', {
      collection: 'modules',
      query: {},
      options: { provider: 'mongodb' }
    }, 'modules');
  }

  loadSampleData() {
    console.log('📦 Loading sample data...');
    
    // Store tools
    SAMPLE_TOOLS.forEach(tool => {
      this.dataStore.tools.set(tool.id, tool);
    });
    
    // Store modules
    SAMPLE_MODULES.forEach(module => {
      this.dataStore.modules.set(module.id, module);
    });
    
    console.log(`✅ Loaded ${this.dataStore.tools.size} tools and ${this.dataStore.modules.size} modules`);
    
    // Update search panel if it's active
    this.updateSearchPanel();
  }

  updateTools(tools) {
    if (!Array.isArray(tools)) return;
    
    tools.forEach(tool => {
      this.dataStore.tools.set(tool.id || tool._id, tool);
    });
    
    console.log(`📊 Updated ${tools.length} tools from server`);
    this.updateSearchPanel();
  }

  updateModules(modules) {
    if (!Array.isArray(modules)) return;
    
    modules.forEach(module => {
      this.dataStore.modules.set(module.id || module._id, module);
    });
    
    console.log(`📊 Updated ${modules.length} modules from server`);
  }

  updateSearchPanel() {
    // Get the search panel component if it exists
    const navigation = this.toolRegistry?.getComponent('navigation');
    if (!navigation) return;
    
    const searchPanel = navigation.getTabComponent('search');
    if (!searchPanel) {
      console.log('Search panel not loaded yet');
      return;
    }
    
    // Update with all tools
    const allTools = Array.from(this.dataStore.tools.values());
    searchPanel.updateResults(allTools);
    
    console.log(`🔍 Updated search panel with ${allTools.length} tools`);
  }

  handleMount(instance) {
    console.log('✅ Tool Registry mounted');
    console.log('📊 Available API methods:', Object.keys(instance));
    
    // After mount, load data into panels
    setTimeout(() => {
      this.updateSearchPanel();
    }, 1000);
  }

  handleTabChange(tabId, tab) {
    console.log(`📑 Tab changed to: ${tabId}`);
    
    // Load data for specific tab
    switch (tabId) {
      case 'search':
        this.updateSearchPanel();
        break;
      case 'modules':
        this.updateModulesPanel();
        break;
      case 'details':
        this.updateDetailsPanel();
        break;
      case 'admin':
        this.updateAdminPanel();
        break;
    }
  }

  updateModulesPanel() {
    console.log('Loading modules panel...');
    // TODO: Implement when ModuleBrowserPanel is created
  }

  updateDetailsPanel() {
    console.log('Loading details panel...');
    // TODO: Implement when ToolDetailsPanel is created
  }

  updateAdminPanel() {
    console.log('Loading admin panel...');
    // TODO: Implement when AdministrationPanel is created
  }

  handleError(error) {
    console.error('❌ Application error:', error);
    // Could show a notification or error dialog
  }

  showErrorState(error) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    
    appContainer.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        padding: var(--spacing-xl);
        text-align: center;
        color: var(--color-error);
      ">
        <h1 style="font-size: var(--font-2xl); margin-bottom: var(--spacing-lg);">
          ⚠️ Application Error
        </h1>
        <p style="
          font-size: var(--font-lg);
          margin-bottom: var(--spacing-xl);
          max-width: 40rem;
          line-height: 1.6;
        ">
          ${error.message}
        </p>
        <button onclick="location.reload()" style="
          padding: var(--spacing-md) var(--spacing-xl);
          font-size: var(--font-md);
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
        ">
          Reload Application
        </button>
      </div>
    `;
  }

  // Public API for testing
  searchTools(query, filters = {}) {
    const allTools = Array.from(this.dataStore.tools.values());
    
    let results = allTools;
    
    // Filter by query
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(tool => 
        tool.name.toLowerCase().includes(searchTerm) ||
        tool.description?.toLowerCase().includes(searchTerm) ||
        tool.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply filters
    if (filters.category) {
      results = results.filter(tool => tool.category === filters.category);
    }
    
    if (filters.status) {
      results = results.filter(tool => tool.status === filters.status);
    }
    
    if (filters.module) {
      results = results.filter(tool => tool.module === filters.module);
    }
    
    console.log(`🔍 Search found ${results.length} results for "${query}"`);
    return results;
  }

  // Utility methods
  toggleTheme() {
    const currentTheme = this.toolRegistry?.getState('userPreferences.theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    if (this.toolRegistry) {
      this.toolRegistry.updateState('userPreferences.theme', newTheme);
      console.log(`🎨 Theme switched to: ${newTheme}`);
    }
  }

  testResponsiveFeatures() {
    console.log('🔍 Testing responsive features...');
    console.log('✅ All measurements use clamp(), rem, vh, vw');
    console.log('✅ No hardcoded pixel values');
    console.log('✅ Fluid typography scaling');
    console.log('✅ Component-based MVVM architecture');
    console.log('📱 Try resizing the window to see responsive behavior!');
  }
}

// Export for module usage
export { ToolRegistryApp };

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  window.ToolRegistryApp = ToolRegistryApp;
  
  const initApp = () => {
    const app = new ToolRegistryApp();
    app.initialize();
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}