/**
 * AdministrationPanel Component - MVVM Implementation
 * System administration, configuration, and monitoring interface
 * Following the design document specification with complete MVVM separation
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

class AdministrationPanelModel {
  constructor(options = {}) {
    this.state = {
      activeSection: 'system', // system, users, logs, modules, performance
      systemSettings: {
        connectionUrl: 'ws://localhost:8090',
        maxConnections: 100,
        timeout: 30000,
        retryAttempts: 3,
        enableLogging: true,
        logLevel: 'info'
      },
      userManagement: {
        currentUser: 'admin',
        users: [
          { id: 1, name: 'Administrator', role: 'admin', status: 'active', lastLogin: '2 minutes ago' },
          { id: 2, name: 'Developer', role: 'developer', status: 'active', lastLogin: '1 hour ago' },
          { id: 3, name: 'Viewer', role: 'viewer', status: 'inactive', lastLogin: '2 days ago' }
        ],
        permissions: {
          admin: ['read', 'write', 'execute', 'manage'],
          developer: ['read', 'write', 'execute'],
          viewer: ['read']
        }
      },
      systemLogs: {
        logs: [
          { id: 1, timestamp: '2025-01-14T18:01:45.000Z', level: 'info', category: 'system', message: 'Tool registry initialized successfully' },
          { id: 2, timestamp: '2025-01-14T18:01:44.000Z', level: 'info', category: 'connection', message: 'WebSocket connection established' },
          { id: 3, timestamp: '2025-01-14T18:01:43.000Z', level: 'warn', category: 'semantic', message: 'Semantic search not available - Qdrant connection failed' },
          { id: 4, timestamp: '2025-01-14T18:01:42.000Z', level: 'info', category: 'embedding', message: 'Local embedding service ready (384d vectors)' },
          { id: 5, timestamp: '2025-01-14T18:01:41.000Z', level: 'info', category: 'system', message: 'All services initialized successfully' }
        ],
        filters: {
          level: 'all',
          category: 'all',
          search: ''
        }
      },
      moduleManagement: {
        modules: [
          { name: 'FileModule', status: 'active', version: '1.0.0', tools: 5, config: { maxFileSize: '10MB', allowedTypes: ['txt', 'json', 'csv'] } },
          { name: 'CalculatorModule', status: 'active', version: '1.2.1', tools: 8, config: { precision: 10, maxExpression: 1000 } },
          { name: 'TextModule', status: 'active', version: '2.0.0', tools: 12, config: { maxLength: 50000, enableRegex: true } },
          { name: 'WebModule', status: 'inactive', version: '0.9.5', tools: 6, config: { timeout: 30000, maxRequests: 100 } },
          { name: 'DataModule', status: 'error', version: '1.1.0', tools: 4, config: { maxRows: 10000, enableCache: false } }
        ]
      },
      performanceMetrics: {
        system: {
          cpuUsage: 45.2,
          memoryUsage: 67.8,
          diskUsage: 23.4,
          networkLatency: 12.5
        },
        application: {
          activeConnections: 3,
          totalRequests: 156,
          avgResponseTime: 245,
          errorRate: 0.8
        },
        tools: {
          totalExecutions: 1247,
          successRate: 98.5,
          avgExecutionTime: 1240,
          mostUsedTool: 'file-manager'
        }
      }
    };
  }
  
  updateState(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
  
  getState(path = '') {
    if (!path) return this.state;
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }
  
  updateSystemSetting(key, value) {
    this.state.systemSettings[key] = value;
  }
  
  addUser(user) {
    const newId = Math.max(...this.state.userManagement.users.map(u => u.id)) + 1;
    this.state.userManagement.users.push({ ...user, id: newId });
  }
  
  updateUser(userId, updates) {
    const userIndex = this.state.userManagement.users.findIndex(u => u.id === userId);
    if (userIndex >= 0) {
      this.state.userManagement.users[userIndex] = { ...this.state.userManagement.users[userIndex], ...updates };
    }
  }
  
  filterLogs() {
    const filters = this.state.systemLogs.filters;
    let filtered = [...this.state.systemLogs.logs];
    
    if (filters.level !== 'all') {
      filtered = filtered.filter(log => log.level === filters.level);
    }
    
    if (filters.category !== 'all') {
      filtered = filtered.filter(log => log.category === filters.category);
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        log.category.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }
  
  updateModuleStatus(moduleName, status) {
    const moduleIndex = this.state.moduleManagement.modules.findIndex(m => m.name === moduleName);
    if (moduleIndex >= 0) {
      this.state.moduleManagement.modules[moduleIndex].status = status;
    }
  }
}

class AdministrationPanelView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
  }
  
  generateCSS() {
    return `
      .administration-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--surface-primary);
        overflow: hidden;
      }
      
      .admin-header {
        flex-shrink: 0;
        padding: clamp(1rem, 3vw, 2rem);
        border-bottom: 1px solid var(--border-subtle);
        background: var(--surface-secondary);
      }
      
      .admin-title {
        font-size: clamp(1.5rem, 4vw, 2.5rem);
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 clamp(0.5rem, 1vw, 0.75rem) 0;
        display: flex;
        align-items: center;
        gap: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .admin-subtitle {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.5;
      }
      
      .admin-content {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }
      
      .admin-sidebar {
        flex-shrink: 0;
        width: clamp(12rem, 25vw, 18rem);
        background: var(--surface-tertiary);
        border-right: 1px solid var(--border-subtle);
        overflow-y: auto;
      }
      
      .admin-nav {
        padding: clamp(1rem, 2vw, 1.5rem);
      }
      
      .admin-nav-item {
        display: block;
        width: 100%;
        padding: clamp(0.75rem, 1.5vw, 1rem);
        margin-bottom: clamp(0.25rem, 0.5vw, 0.5rem);
        background: none;
        border: none;
        border-radius: var(--radius-md);
        text-align: left;
        color: var(--text-secondary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      
      .admin-nav-item:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
        transform: translateX(0.25rem);
      }
      
      .admin-nav-item.active {
        background: var(--color-primary);
        color: white;
        font-weight: 600;
      }
      
      .admin-nav-item.active:hover {
        background: var(--color-primary-hover);
        transform: translateX(0.25rem);
      }
      
      .admin-main {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }
      
      .admin-section {
        padding: clamp(1.5rem, 3vw, 2rem);
        height: 100%;
        box-sizing: border-box;
      }
      
      .section-title {
        font-size: clamp(1.25rem, 3vw, 1.75rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 clamp(1rem, 2vw, 1.5rem) 0;
        display: flex;
        align-items: center;
        gap: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .section-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(clamp(18rem, 30vw, 25rem), 1fr));
        gap: clamp(1rem, 2vw, 1.5rem);
        margin-bottom: clamp(2rem, 4vw, 3rem);
      }
      
      .admin-card {
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: clamp(1rem, 2vw, 1.5rem);
        box-shadow: var(--shadow-sm);
        transition: all 0.2s ease;
      }
      
      .admin-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      
      .card-title {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 clamp(0.75rem, 1.5vw, 1rem) 0;
        display: flex;
        align-items: center;
        gap: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .card-content {
        color: var(--text-secondary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        line-height: 1.5;
      }
      
      .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: clamp(0.75rem, 1.5vw, 1rem) 0;
        border-bottom: 1px solid var(--border-subtle);
      }
      
      .setting-item:last-child {
        border-bottom: none;
      }
      
      .setting-label {
        font-weight: 500;
        color: var(--text-primary);
        font-size: clamp(0.875rem, 2vw, 1rem);
      }
      
      .setting-description {
        color: var(--text-tertiary);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        margin-top: clamp(0.125rem, 0.25vw, 0.25rem);
      }
      
      .setting-control {
        flex-shrink: 0;
        margin-left: clamp(1rem, 2vw, 1.5rem);
      }
      
      .setting-input {
        padding: clamp(0.375rem, 1vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--surface-primary);
        color: var(--text-primary);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        min-width: clamp(6rem, 15vw, 10rem);
      }
      
      .setting-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 0.1875rem rgba(59, 130, 246, 0.15);
      }
      
      .setting-toggle {
        position: relative;
        width: clamp(2.5rem, 5vw, 3rem);
        height: clamp(1.25rem, 2.5vw, 1.5rem);
        background: var(--color-secondary);
        border-radius: clamp(0.625rem, 1.25vw, 0.75rem);
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .setting-toggle.active {
        background: var(--color-success);
      }
      
      .setting-toggle::after {
        content: '';
        position: absolute;
        top: clamp(0.125rem, 0.25vw, 0.1875rem);
        left: clamp(0.125rem, 0.25vw, 0.1875rem);
        width: clamp(1rem, 2vw, 1.125rem);
        height: clamp(1rem, 2vw, 1.125rem);
        background: white;
        border-radius: 50%;
        transition: transform 0.2s ease;
      }
      
      .setting-toggle.active::after {
        transform: translateX(clamp(1.25rem, 2.5vw, 1.5rem));
      }
      
      .users-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: clamp(1rem, 2vw, 1.5rem);
        background: var(--surface-primary);
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      
      .users-table th,
      .users-table td {
        padding: clamp(0.75rem, 1.5vw, 1rem);
        text-align: left;
        border-bottom: 1px solid var(--border-subtle);
      }
      
      .users-table th {
        background: var(--surface-tertiary);
        font-weight: 600;
        color: var(--text-primary);
        font-size: clamp(0.875rem, 2vw, 1rem);
      }
      
      .users-table td {
        font-size: clamp(0.875rem, 2vw, 1rem);
        color: var(--text-secondary);
      }
      
      .user-status {
        padding: clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem);
        border-radius: var(--radius-sm);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        font-weight: 500;
        text-transform: capitalize;
      }
      
      .user-status.active {
        background: rgba(16, 185, 129, 0.1);
        color: var(--color-success);
      }
      
      .user-status.inactive {
        background: rgba(107, 114, 128, 0.1);
        color: var(--text-tertiary);
      }
      
      .user-role {
        font-weight: 500;
        text-transform: capitalize;
      }
      
      .logs-controls {
        display: flex;
        gap: clamp(1rem, 2vw, 1.5rem);
        margin-bottom: clamp(1rem, 2vw, 1.5rem);
        flex-wrap: wrap;
      }
      
      .logs-filter {
        display: flex;
        align-items: center;
        gap: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .logs-filter label {
        font-size: clamp(0.875rem, 2vw, 1rem);
        font-weight: 500;
        color: var(--text-primary);
      }
      
      .logs-filter select,
      .logs-filter input {
        padding: clamp(0.375rem, 1vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--surface-secondary);
        color: var(--text-primary);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
      }
      
      .logs-container {
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        max-height: clamp(20rem, 40vh, 30rem);
        overflow-y: auto;
      }
      
      .log-entry {
        padding: clamp(0.75rem, 1.5vw, 1rem);
        border-bottom: 1px solid var(--border-subtle);
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        line-height: 1.4;
      }
      
      .log-entry:last-child {
        border-bottom: none;
      }
      
      .log-timestamp {
        color: var(--text-tertiary);
      }
      
      .log-level {
        padding: clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem);
        border-radius: var(--radius-sm);
        font-size: clamp(0.625rem, 1.25vw, 0.75rem);
        font-weight: 500;
        text-transform: uppercase;
        margin: 0 clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .log-level.info {
        background: rgba(59, 130, 246, 0.1);
        color: var(--color-primary);
      }
      
      .log-level.warn {
        background: rgba(245, 158, 11, 0.1);
        color: var(--color-warning);
      }
      
      .log-level.error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--color-error);
      }
      
      .log-category {
        background: var(--surface-tertiary);
        padding: clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem);
        border-radius: var(--radius-sm);
        font-size: clamp(0.625rem, 1.25vw, 0.75rem);
        color: var(--text-secondary);
        margin-right: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .log-message {
        color: var(--text-primary);
      }
      
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(clamp(12rem, 20vw, 16rem), 1fr));
        gap: clamp(1rem, 2vw, 1.5rem);
        margin-bottom: clamp(2rem, 4vw, 3rem);
      }
      
      .metric-card {
        background: linear-gradient(135deg, var(--surface-secondary), var(--surface-primary));
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: clamp(1rem, 2vw, 1.5rem);
        text-align: center;
        box-shadow: var(--shadow-sm);
        transition: all 0.2s ease;
      }
      
      .metric-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      
      .metric-value {
        font-size: clamp(1.5rem, 4vw, 2.5rem);
        font-weight: 700;
        color: var(--color-primary);
        margin-bottom: clamp(0.25rem, 0.5vw, 0.5rem);
      }
      
      .metric-label {
        font-size: clamp(0.875rem, 2vw, 1rem);
        color: var(--text-secondary);
        font-weight: 500;
      }
      
      .metric-unit {
        font-size: clamp(1rem, 2vw, 1.25rem);
        color: var(--text-tertiary);
        margin-left: clamp(0.25rem, 0.5vw, 0.5rem);
      }
      
      .modules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(clamp(15rem, 25vw, 20rem), 1fr));
        gap: clamp(1rem, 2vw, 1.5rem);
      }
      
      .module-card {
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: clamp(1rem, 2vw, 1.5rem);
        transition: all 0.2s ease;
      }
      
      .module-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      
      .module-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: clamp(0.75rem, 1.5vw, 1rem);
      }
      
      .module-name {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
      
      .module-status {
        padding: clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem);
        border-radius: var(--radius-sm);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        font-weight: 500;
        text-transform: capitalize;
      }
      
      .module-status.active {
        background: rgba(16, 185, 129, 0.1);
        color: var(--color-success);
      }
      
      .module-status.inactive {
        background: rgba(107, 114, 128, 0.1);
        color: var(--text-tertiary);
      }
      
      .module-status.error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--color-error);
      }
      
      .module-info {
        color: var(--text-secondary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        line-height: 1.4;
      }
      
      .module-version {
        font-weight: 500;
        color: var(--text-primary);
      }
      
      .module-actions {
        margin-top: clamp(1rem, 2vw, 1.5rem);
        display: flex;
        gap: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .module-btn {
        padding: clamp(0.375rem, 1vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--surface-primary);
        color: var(--text-primary);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .module-btn:hover {
        background: var(--surface-hover);
        border-color: var(--border-medium);
      }
      
      .module-btn.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }
      
      .module-btn.primary:hover {
        background: var(--color-primary-hover);
      }
      
      .module-btn.danger {
        background: var(--color-error);
        color: white;
        border-color: var(--color-error);
      }
      
      .module-btn.danger:hover {
        background: #dc2626;
      }
    `;
  }
  
  injectCSS() {
    if (this.cssInjected) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'administration-panel-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
  }
  
  render(modelData) {
    this.injectCSS();
    
    this.container.innerHTML = '';
    this.container.className = 'administration-panel';
    
    // Header
    const header = this.createHeader();
    this.container.appendChild(header);
    
    // Content
    const content = this.createContent(modelData);
    this.container.appendChild(content);
    
    return this.container;
  }
  
  createHeader() {
    const header = document.createElement('div');
    header.className = 'admin-header';
    
    const title = document.createElement('h1');
    title.className = 'admin-title';
    title.innerHTML = '⚙️ System Administration';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'admin-subtitle';
    subtitle.textContent = 'Manage system settings, users, modules, and monitor performance metrics.';
    
    header.appendChild(title);
    header.appendChild(subtitle);
    
    return header;
  }
  
  createContent(modelData) {
    const content = document.createElement('div');
    content.className = 'admin-content';
    
    // Sidebar
    const sidebar = this.createSidebar(modelData);
    content.appendChild(sidebar);
    
    // Main
    const main = this.createMain(modelData);
    content.appendChild(main);
    
    return content;
  }
  
  createSidebar(modelData) {
    const sidebar = document.createElement('div');
    sidebar.className = 'admin-sidebar';
    
    const nav = document.createElement('nav');
    nav.className = 'admin-nav';
    
    const sections = [
      { id: 'system', label: '🔧 System Settings', icon: '🔧' },
      { id: 'users', label: '👥 User Management', icon: '👥' },
      { id: 'logs', label: '📋 System Logs', icon: '📋' },
      { id: 'modules', label: '📦 Module Management', icon: '📦' },
      { id: 'performance', label: '📊 Performance Metrics', icon: '📊' }
    ];
    
    sections.forEach(section => {
      const navItem = document.createElement('button');
      navItem.className = `admin-nav-item${modelData.activeSection === section.id ? ' active' : ''}`;
      navItem.textContent = section.label;
      navItem.dataset.section = section.id;
      nav.appendChild(navItem);
    });
    
    sidebar.appendChild(nav);
    return sidebar;
  }
  
  createMain(modelData) {
    const main = document.createElement('div');
    main.className = 'admin-main';
    
    const section = document.createElement('div');
    section.className = 'admin-section';
    
    switch (modelData.activeSection) {
      case 'system':
        section.appendChild(this.createSystemSection(modelData));
        break;
      case 'users':
        section.appendChild(this.createUsersSection(modelData));
        break;
      case 'logs':
        section.appendChild(this.createLogsSection(modelData));
        break;
      case 'modules':
        section.appendChild(this.createModulesSection(modelData));
        break;
      case 'performance':
        section.appendChild(this.createPerformanceSection(modelData));
        break;
    }
    
    main.appendChild(section);
    return main;
  }
  
  createSystemSection(modelData) {
    const container = document.createElement('div');
    
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.innerHTML = '🔧 System Settings';
    
    const grid = document.createElement('div');
    grid.className = 'section-grid';
    
    // Connection Settings Card
    const connectionCard = document.createElement('div');
    connectionCard.className = 'admin-card';
    
    const connectionTitle = document.createElement('h3');
    connectionTitle.className = 'card-title';
    connectionTitle.innerHTML = '🌐 Connection Settings';
    
    const connectionContent = document.createElement('div');
    connectionContent.className = 'card-content';
    
    const connectionSettings = [
      { key: 'connectionUrl', label: 'WebSocket URL', description: 'Connection endpoint for the application', type: 'text' },
      { key: 'maxConnections', label: 'Max Connections', description: 'Maximum concurrent connections allowed', type: 'number' },
      { key: 'timeout', label: 'Timeout (ms)', description: 'Connection timeout in milliseconds', type: 'number' },
      { key: 'retryAttempts', label: 'Retry Attempts', description: 'Number of reconnection attempts', type: 'number' }
    ];
    
    connectionSettings.forEach(setting => {
      const settingItem = document.createElement('div');
      settingItem.className = 'setting-item';
      
      const settingInfo = document.createElement('div');
      const settingLabel = document.createElement('div');
      settingLabel.className = 'setting-label';
      settingLabel.textContent = setting.label;
      const settingDesc = document.createElement('div');
      settingDesc.className = 'setting-description';
      settingDesc.textContent = setting.description;
      settingInfo.appendChild(settingLabel);
      settingInfo.appendChild(settingDesc);
      
      const settingControl = document.createElement('div');
      settingControl.className = 'setting-control';
      const input = document.createElement('input');
      input.className = 'setting-input';
      input.type = setting.type;
      input.value = modelData.systemSettings[setting.key];
      input.dataset.setting = setting.key;
      settingControl.appendChild(input);
      
      settingItem.appendChild(settingInfo);
      settingItem.appendChild(settingControl);
      connectionContent.appendChild(settingItem);
    });
    
    connectionCard.appendChild(connectionTitle);
    connectionCard.appendChild(connectionContent);
    
    // Logging Settings Card
    const loggingCard = document.createElement('div');
    loggingCard.className = 'admin-card';
    
    const loggingTitle = document.createElement('h3');
    loggingTitle.className = 'card-title';
    loggingTitle.innerHTML = '📝 Logging Settings';
    
    const loggingContent = document.createElement('div');
    loggingContent.className = 'card-content';
    
    const loggingToggle = document.createElement('div');
    loggingToggle.className = 'setting-item';
    
    const toggleInfo = document.createElement('div');
    const toggleLabel = document.createElement('div');
    toggleLabel.className = 'setting-label';
    toggleLabel.textContent = 'Enable Logging';
    const toggleDesc = document.createElement('div');
    toggleDesc.className = 'setting-description';
    toggleDesc.textContent = 'Enable or disable system logging';
    toggleInfo.appendChild(toggleLabel);
    toggleInfo.appendChild(toggleDesc);
    
    const toggleControl = document.createElement('div');
    toggleControl.className = 'setting-control';
    const toggle = document.createElement('div');
    toggle.className = `setting-toggle${modelData.systemSettings.enableLogging ? ' active' : ''}`;
    toggle.dataset.setting = 'enableLogging';
    toggleControl.appendChild(toggle);
    
    loggingToggle.appendChild(toggleInfo);
    loggingToggle.appendChild(toggleControl);
    loggingContent.appendChild(loggingToggle);
    
    const logLevelItem = document.createElement('div');
    logLevelItem.className = 'setting-item';
    
    const logLevelInfo = document.createElement('div');
    const logLevelLabel = document.createElement('div');
    logLevelLabel.className = 'setting-label';
    logLevelLabel.textContent = 'Log Level';
    const logLevelDesc = document.createElement('div');
    logLevelDesc.className = 'setting-description';
    logLevelDesc.textContent = 'Minimum log level to record';
    logLevelInfo.appendChild(logLevelLabel);
    logLevelInfo.appendChild(logLevelDesc);
    
    const logLevelControl = document.createElement('div');
    logLevelControl.className = 'setting-control';
    const logLevelSelect = document.createElement('select');
    logLevelSelect.className = 'setting-input';
    logLevelSelect.innerHTML = `
      <option value="debug">Debug</option>
      <option value="info">Info</option>
      <option value="warn">Warning</option>
      <option value="error">Error</option>
    `;
    logLevelSelect.value = modelData.systemSettings.logLevel;
    logLevelSelect.dataset.setting = 'logLevel';
    logLevelControl.appendChild(logLevelSelect);
    
    logLevelItem.appendChild(logLevelInfo);
    logLevelItem.appendChild(logLevelControl);
    loggingContent.appendChild(logLevelItem);
    
    loggingCard.appendChild(loggingTitle);
    loggingCard.appendChild(loggingContent);
    
    grid.appendChild(connectionCard);
    grid.appendChild(loggingCard);
    
    container.appendChild(title);
    container.appendChild(grid);
    
    return container;
  }
  
  createUsersSection(modelData) {
    const container = document.createElement('div');
    
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.innerHTML = '👥 User Management';
    
    const table = document.createElement('table');
    table.className = 'users-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Name</th>
        <th>Role</th>
        <th>Status</th>
        <th>Last Login</th>
        <th>Actions</th>
      </tr>
    `;
    
    const tbody = document.createElement('tbody');
    modelData.userManagement.users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${user.name}</strong></td>
        <td><span class="user-role">${user.role}</span></td>
        <td><span class="user-status ${user.status}">${user.status}</span></td>
        <td>${user.lastLogin}</td>
        <td>
          <button class="module-btn" data-action="edit" data-user-id="${user.id}">Edit</button>
          <button class="module-btn danger" data-action="delete" data-user-id="${user.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    table.appendChild(thead);
    table.appendChild(tbody);
    
    container.appendChild(title);
    container.appendChild(table);
    
    return container;
  }
  
  createLogsSection(modelData) {
    const container = document.createElement('div');
    
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.innerHTML = '📋 System Logs';
    
    const controls = document.createElement('div');
    controls.className = 'logs-controls';
    
    // Level filter
    const levelFilter = document.createElement('div');
    levelFilter.className = 'logs-filter';
    const levelLabel = document.createElement('label');
    levelLabel.textContent = 'Level:';
    const levelSelect = document.createElement('select');
    levelSelect.innerHTML = `
      <option value="all">All Levels</option>
      <option value="info">Info</option>
      <option value="warn">Warning</option>
      <option value="error">Error</option>
    `;
    levelSelect.value = modelData.systemLogs.filters.level;
    levelSelect.dataset.filter = 'level';
    levelFilter.appendChild(levelLabel);
    levelFilter.appendChild(levelSelect);
    
    // Category filter
    const categoryFilter = document.createElement('div');
    categoryFilter.className = 'logs-filter';
    const categoryLabel = document.createElement('label');
    categoryLabel.textContent = 'Category:';
    const categorySelect = document.createElement('select');
    categorySelect.innerHTML = `
      <option value="all">All Categories</option>
      <option value="system">System</option>
      <option value="connection">Connection</option>
      <option value="semantic">Semantic</option>
      <option value="embedding">Embedding</option>
    `;
    categorySelect.value = modelData.systemLogs.filters.category;
    categorySelect.dataset.filter = 'category';
    categoryFilter.appendChild(categoryLabel);
    categoryFilter.appendChild(categorySelect);
    
    // Search filter
    const searchFilter = document.createElement('div');
    searchFilter.className = 'logs-filter';
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Search:';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search logs...';
    searchInput.value = modelData.systemLogs.filters.search;
    searchInput.dataset.filter = 'search';
    searchFilter.appendChild(searchLabel);
    searchFilter.appendChild(searchInput);
    
    controls.appendChild(levelFilter);
    controls.appendChild(categoryFilter);
    controls.appendChild(searchFilter);
    
    // Logs container
    const logsContainer = document.createElement('div');
    logsContainer.className = 'logs-container';
    
    const filteredLogs = this.getFilteredLogs(modelData);
    filteredLogs.forEach(log => {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      logEntry.innerHTML = `
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level ${log.level}">${log.level}</span>
        <span class="log-category">${log.category}</span>
        <span class="log-message">${log.message}</span>
      `;
      
      logsContainer.appendChild(logEntry);
    });
    
    container.appendChild(title);
    container.appendChild(controls);
    container.appendChild(logsContainer);
    
    return container;
  }
  
  createModulesSection(modelData) {
    const container = document.createElement('div');
    
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.innerHTML = '📦 Module Management';
    
    const modulesGrid = document.createElement('div');
    modulesGrid.className = 'modules-grid';
    
    modelData.moduleManagement.modules.forEach(module => {
      const moduleCard = document.createElement('div');
      moduleCard.className = 'module-card';
      
      const moduleHeader = document.createElement('div');
      moduleHeader.className = 'module-header';
      
      const moduleName = document.createElement('h3');
      moduleName.className = 'module-name';
      moduleName.textContent = module.name;
      
      const moduleStatus = document.createElement('span');
      moduleStatus.className = `module-status ${module.status}`;
      moduleStatus.textContent = module.status;
      
      moduleHeader.appendChild(moduleName);
      moduleHeader.appendChild(moduleStatus);
      
      const moduleInfo = document.createElement('div');
      moduleInfo.className = 'module-info';
      moduleInfo.innerHTML = `
        <div>Version: <span class="module-version">${module.version}</span></div>
        <div>Tools: <strong>${module.tools}</strong></div>
        <div>Configuration: ${Object.keys(module.config).length} settings</div>
      `;
      
      const moduleActions = document.createElement('div');
      moduleActions.className = 'module-actions';
      
      const configButton = document.createElement('button');
      configButton.className = 'module-btn';
      configButton.textContent = 'Configure';
      configButton.dataset.action = 'configure';
      configButton.dataset.module = module.name;
      
      const statusButton = document.createElement('button');
      statusButton.className = `module-btn ${module.status === 'active' ? 'danger' : 'primary'}`;
      statusButton.textContent = module.status === 'active' ? 'Disable' : 'Enable';
      statusButton.dataset.action = 'toggle';
      statusButton.dataset.module = module.name;
      
      moduleActions.appendChild(configButton);
      moduleActions.appendChild(statusButton);
      
      moduleCard.appendChild(moduleHeader);
      moduleCard.appendChild(moduleInfo);
      moduleCard.appendChild(moduleActions);
      
      modulesGrid.appendChild(moduleCard);
    });
    
    container.appendChild(title);
    container.appendChild(modulesGrid);
    
    return container;
  }
  
  createPerformanceSection(modelData) {
    const container = document.createElement('div');
    
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.innerHTML = '📊 Performance Metrics';
    
    // System Metrics
    const systemTitle = document.createElement('h3');
    systemTitle.className = 'section-title';
    systemTitle.innerHTML = '🖥️ System Resources';
    
    const systemGrid = document.createElement('div');
    systemGrid.className = 'metrics-grid';
    
    const systemMetrics = [
      { label: 'CPU Usage', value: modelData.performanceMetrics.system.cpuUsage, unit: '%' },
      { label: 'Memory Usage', value: modelData.performanceMetrics.system.memoryUsage, unit: '%' },
      { label: 'Disk Usage', value: modelData.performanceMetrics.system.diskUsage, unit: '%' },
      { label: 'Network Latency', value: modelData.performanceMetrics.system.networkLatency, unit: 'ms' }
    ];
    
    systemMetrics.forEach(metric => {
      const metricCard = document.createElement('div');
      metricCard.className = 'metric-card';
      
      const metricValue = document.createElement('div');
      metricValue.className = 'metric-value';
      metricValue.innerHTML = `${metric.value}<span class="metric-unit">${metric.unit}</span>`;
      
      const metricLabel = document.createElement('div');
      metricLabel.className = 'metric-label';
      metricLabel.textContent = metric.label;
      
      metricCard.appendChild(metricValue);
      metricCard.appendChild(metricLabel);
      systemGrid.appendChild(metricCard);
    });
    
    // Application Metrics
    const appTitle = document.createElement('h3');
    appTitle.className = 'section-title';
    appTitle.innerHTML = '🚀 Application Performance';
    
    const appGrid = document.createElement('div');
    appGrid.className = 'metrics-grid';
    
    const appMetrics = [
      { label: 'Active Connections', value: modelData.performanceMetrics.application.activeConnections, unit: '' },
      { label: 'Total Requests', value: modelData.performanceMetrics.application.totalRequests, unit: '' },
      { label: 'Avg Response Time', value: modelData.performanceMetrics.application.avgResponseTime, unit: 'ms' },
      { label: 'Error Rate', value: modelData.performanceMetrics.application.errorRate, unit: '%' }
    ];
    
    appMetrics.forEach(metric => {
      const metricCard = document.createElement('div');
      metricCard.className = 'metric-card';
      
      const metricValue = document.createElement('div');
      metricValue.className = 'metric-value';
      metricValue.innerHTML = `${metric.value}<span class="metric-unit">${metric.unit}</span>`;
      
      const metricLabel = document.createElement('div');
      metricLabel.className = 'metric-label';
      metricLabel.textContent = metric.label;
      
      metricCard.appendChild(metricValue);
      metricCard.appendChild(metricLabel);
      appGrid.appendChild(metricCard);
    });
    
    container.appendChild(title);
    container.appendChild(systemTitle);
    container.appendChild(systemGrid);
    container.appendChild(appTitle);
    container.appendChild(appGrid);
    
    return container;
  }
  
  getFilteredLogs(modelData) {
    const filters = modelData.systemLogs.filters;
    let filtered = [...modelData.systemLogs.logs];
    
    if (filters.level !== 'all') {
      filtered = filtered.filter(log => log.level === filters.level);
    }
    
    if (filters.category !== 'all') {
      filtered = filtered.filter(log => log.category === filters.category);
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        log.category.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered.reverse(); // Show newest first
  }
}

class AdministrationPanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.eventListeners = [];
  }
  
  initialize() {
    this.render();
    this.setupEventListeners();
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this.createPublicAPI());
    }
    
    return this.createPublicAPI();
  }
  
  render() {
    this.view.render(this.model.getState());
  }
  
  setupEventListeners() {
    // Section navigation
    const handleSectionClick = (event) => {
      if (event.target.classList.contains('admin-nav-item')) {
        const section = event.target.dataset.section;
        this.model.updateState('activeSection', section);
        this.render();
      }
    };
    
    // System settings changes
    const handleSettingChange = (event) => {
      if (event.target.dataset.setting) {
        const setting = event.target.dataset.setting;
        let value = event.target.value;
        
        // Convert numeric values
        if (event.target.type === 'number') {
          value = parseInt(value) || 0;
        }
        
        this.model.updateSystemSetting(setting, value);
        console.log(`System setting updated: ${setting} = ${value}`);
      }
    };
    
    // Toggle switches
    const handleToggleClick = (event) => {
      if (event.target.classList.contains('setting-toggle')) {
        const setting = event.target.dataset.setting;
        const currentValue = this.model.getState(`systemSettings.${setting}`);
        this.model.updateSystemSetting(setting, !currentValue);
        this.render();
        console.log(`Toggle updated: ${setting} = ${!currentValue}`);
      }
    };
    
    // Log filters
    const handleLogFilterChange = (event) => {
      if (event.target.dataset.filter) {
        const filter = event.target.dataset.filter;
        const value = event.target.value;
        this.model.updateState(`systemLogs.filters.${filter}`, value);
        this.render();
      }
    };
    
    // Module actions
    const handleModuleAction = (event) => {
      if (event.target.dataset.action && event.target.dataset.module) {
        const action = event.target.dataset.action;
        const moduleName = event.target.dataset.module;
        
        switch (action) {
          case 'configure':
            console.log(`Configure module: ${moduleName}`);
            // Will implement module configuration in Phase 6
            break;
          case 'toggle':
            const currentModule = this.model.getState('moduleManagement.modules')
              .find(m => m.name === moduleName);
            const newStatus = currentModule.status === 'active' ? 'inactive' : 'active';
            this.model.updateModuleStatus(moduleName, newStatus);
            this.render();
            console.log(`Module ${moduleName} status changed to: ${newStatus}`);
            break;
        }
      }
    };
    
    // User management actions
    const handleUserAction = (event) => {
      if (event.target.dataset.action && event.target.dataset.userId) {
        const action = event.target.dataset.action;
        const userId = parseInt(event.target.dataset.userId);
        
        switch (action) {
          case 'edit':
            console.log(`Edit user: ${userId}`);
            // Will implement user editing in Phase 6
            break;
          case 'delete':
            console.log(`Delete user: ${userId}`);
            // Will implement user deletion in Phase 6
            break;
        }
      }
    };
    
    // Add event listeners
    this.view.container.addEventListener('click', (event) => {
      handleSectionClick(event);
      handleToggleClick(event);
      handleModuleAction(event);
      handleUserAction(event);
    });
    
    this.view.container.addEventListener('change', (event) => {
      handleSettingChange(event);
      handleLogFilterChange(event);
    });
    
    this.view.container.addEventListener('input', (event) => {
      handleLogFilterChange(event);
    });
    
    this.eventListeners.push(() => {
      this.view.container.removeEventListener('click', handleSectionClick);
      this.view.container.removeEventListener('click', handleToggleClick);
      this.view.container.removeEventListener('click', handleModuleAction);
      this.view.container.removeEventListener('click', handleUserAction);
      this.view.container.removeEventListener('change', handleSettingChange);
      this.view.container.removeEventListener('change', handleLogFilterChange);
      this.view.container.removeEventListener('input', handleLogFilterChange);
    });
  }
  
  createPublicAPI() {
    return {
      switchSection: (section) => {
        this.model.updateState('activeSection', section);
        this.render();
      },
      getActiveSection: () => this.model.getState('activeSection'),
      updateSystemSetting: (key, value) => {
        this.model.updateSystemSetting(key, value);
        this.render();
      },
      getSystemSettings: () => this.model.getState('systemSettings'),
      getUsers: () => this.model.getState('userManagement.users'),
      getModules: () => this.model.getState('moduleManagement.modules'),
      getPerformanceMetrics: () => this.model.getState('performanceMetrics'),
      destroy: () => this.destroy()
    };
  }
  
  destroy() {
    this.eventListeners.forEach(cleanup => cleanup());
    this.view.container.innerHTML = '';
    
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
  }
}

export const AdministrationPanel = {
  create(umbilical) {
    // 1. Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element');
      requirements.add('onMount', 'function', 'Mount callback (optional)', false);
      requirements.add('onDestroy', 'function', 'Destroy callback (optional)', false);
      requirements.add('onSettingChange', 'function', 'Setting change callback (optional)', false);
      requirements.add('onUserAction', 'function', 'User action callback (optional)', false);
      requirements.add('onModuleAction', 'function', 'Module action callback (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE
      });
    }
    
    // 3. Instance Creation Mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'AdministrationPanel');
    
    const model = new AdministrationPanelModel(umbilical);
    const view = new AdministrationPanelView(umbilical.dom);
    const viewModel = new AdministrationPanelViewModel(model, view, umbilical);
    
    return viewModel.initialize();
  }
};