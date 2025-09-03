/**
 * ModulesManagementComponent - Module discovery, status, and management
 * 
 * Provides interface to:
 * - Browse all discovered modules (filesystem vs database)
 * - View module status (loaded, failed, available)
 * - Load/unload modules
 * - Inspect module details and tool counts
 */

import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class ModulesManagementComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    
    // Model
    this.model = {
      modules: [],
      discoveredModules: [],
      loadedModules: [],
      failedModules: [],
      connected: false,
      isLoading: false
    };
    
    // View elements
    this.elements = {};
    
    this.createView();
  }

  /**
   * Create the modules management interface
   */
  createView() {
    this.container.innerHTML = '';
    
    // Main container
    const mainDiv = document.createElement('div');
    mainDiv.className = 'modules-management-container';
    mainDiv.style.padding = '16px';
    mainDiv.style.height = '100%';
    mainDiv.style.overflow = 'auto';
    
    // Controls section
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'modules-controls';
    controlsDiv.style.marginBottom = '16px';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.gap = '8px';
    controlsDiv.style.alignItems = 'center';
    
    // Query modules button
    this.elements.queryModulesButton = document.createElement('button');
    this.elements.queryModulesButton.className = 'modules-query-btn';
    this.elements.queryModulesButton.textContent = '🗄️ Query Database';
    this.elements.queryModulesButton.style.padding = '8px 16px';
    this.elements.queryModulesButton.style.backgroundColor = '#3b82f6';
    this.elements.queryModulesButton.style.color = 'white';
    this.elements.queryModulesButton.style.border = 'none';
    this.elements.queryModulesButton.style.borderRadius = '6px';
    this.elements.queryModulesButton.style.cursor = 'pointer';
    this.elements.queryModulesButton.onclick = () => this.handleQueryDatabase();
    
    // Refresh registry button
    this.elements.refreshButton = document.createElement('button');
    this.elements.refreshButton.className = 'modules-refresh-btn';
    this.elements.refreshButton.textContent = '🔄 Refresh Registry';
    this.elements.refreshButton.style.padding = '8px 16px';
    this.elements.refreshButton.style.backgroundColor = '#10b981';
    this.elements.refreshButton.style.color = 'white';
    this.elements.refreshButton.style.border = 'none';
    this.elements.refreshButton.style.borderRadius = '6px';
    this.elements.refreshButton.style.cursor = 'pointer';
    this.elements.refreshButton.onclick = () => this.handleRefresh();
    
    // Status indicator
    this.elements.statusDiv = document.createElement('div');
    this.elements.statusDiv.className = 'modules-status';
    this.elements.statusDiv.style.marginLeft = 'auto';
    this.elements.statusDiv.style.fontSize = '12px';
    this.elements.statusDiv.style.color = '#6b7280';
    this.elements.statusDiv.textContent = 'Not connected';
    
    controlsDiv.appendChild(this.elements.queryModulesButton);
    controlsDiv.appendChild(this.elements.refreshButton);
    controlsDiv.appendChild(this.elements.statusDiv);
    
    // Modules list container
    this.elements.modulesList = document.createElement('div');
    this.elements.modulesList.className = 'modules-list';
    
    // Sections for different module sources
    this.createModuleSection('database', 'Modules Collection (Database)', '🗄️');
    this.createModuleSection('registry', 'Module Registry (Discovered)', '📦');
    
    // Assemble view
    mainDiv.appendChild(controlsDiv);
    mainDiv.appendChild(this.elements.modulesList);
    this.container.appendChild(mainDiv);
    
    this.renderModules();
  }

  /**
   * Create collapsible section for module category
   */
  createModuleSection(sectionId, title, icon) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = `modules-section-${sectionId}`;
    sectionContainer.style.marginBottom = '16px';
    
    const collapsible = new CollapsibleSectionComponent(sectionContainer, {
      title: title,
      icon: icon,
      defaultExpanded: sectionId === 'loaded'
    });
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `modules-${sectionId}-content`;
    
    collapsible.setContent(contentDiv);
    this.elements.modulesList.appendChild(sectionContainer);
    
    // Store reference to content div
    this.elements[`${sectionId}Content`] = contentDiv;
  }

  /**
   * Render modules in their respective sections
   */
  renderModules() {
    console.log('Rendering modules:', this.model.modules.length);
    
    // Clear all sections first
    if (this.elements.databaseContent) {
      this.elements.databaseContent.innerHTML = '';
    }
    if (this.elements.registryContent) {
      this.elements.registryContent.innerHTML = '';
    }
    
    if (this.model.modules.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.color = '#9ca3af';
      emptyDiv.style.fontStyle = 'italic';
      emptyDiv.style.padding = '8px';
      emptyDiv.textContent = 'No modules found';
      
      if (this.elements.registryContent) {
        this.elements.registryContent.appendChild(emptyDiv);
      }
      return;
    }
    
    // Show all modules in registry section
    this.model.modules.forEach(module => {
      console.log('Creating module element for:', module.name);
      const moduleDiv = this.createModuleElement(module);
      
      if (this.elements.registryContent) {
        this.elements.registryContent.appendChild(moduleDiv);
      }
    });
    
    console.log('Modules rendered in registry section');
  }

  /**
   * Create element for single module
   */
  createModuleElement(module) {
    const moduleDiv = document.createElement('div');
    moduleDiv.className = 'module-item';
    moduleDiv.style.margin = '8px 0';
    moduleDiv.style.padding = '12px';
    moduleDiv.style.border = '1px solid #e5e7eb';
    moduleDiv.style.borderRadius = '6px';
    moduleDiv.style.backgroundColor = 'white';
    
    // Module header
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '8px';
    
    const nameSpan = document.createElement('span');
    nameSpan.style.fontWeight = 'bold';
    nameSpan.style.fontSize = '14px';
    nameSpan.textContent = module.name;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '4px';
    
    // Action buttons based on status
    if (module.status === 'loaded') {
      const unloadBtn = this.createActionButton('🔄 Unload', '#ef4444', () => 
        this.handleModuleAction('unload', module.name)
      );
      actionsDiv.appendChild(unloadBtn);
    } else if (module.status === 'available') {
      const loadBtn = this.createActionButton('📥 Load', '#10b981', () => 
        this.handleModuleAction('load', module.name)
      );
      actionsDiv.appendChild(loadBtn);
    } else if (module.status === 'failed') {
      const retryBtn = this.createActionButton('🔄 Retry', '#f59e0b', () => 
        this.handleModuleAction('retry', module.name)
      );
      actionsDiv.appendChild(retryBtn);
    }
    
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(actionsDiv);
    
    // Module details
    const detailsDiv = document.createElement('div');
    detailsDiv.style.fontSize = '12px';
    detailsDiv.style.color = '#6b7280';
    
    const details = [
      `📝 ${module.description || 'No description'}`,
      `🔧 ${module.toolCount || 0} tools`,
      `📍 ${module.path || 'Unknown path'}`
    ];
    
    if (module.version) {
      details.unshift(`v${module.version}`);
    }
    
    if (module.error) {
      details.push(`❌ ${module.error}`);
    }
    
    detailsDiv.innerHTML = details.join('<br>');
    
    moduleDiv.appendChild(headerDiv);
    moduleDiv.appendChild(detailsDiv);
    
    return moduleDiv;
  }

  /**
   * Create action button
   */
  createActionButton(text, color, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.padding = '4px 8px';
    button.style.fontSize = '11px';
    button.style.backgroundColor = color;
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.onclick = onClick;
    return button;
  }

  /**
   * Handle refresh action
   */
  handleRefresh() {
    this.model.isLoading = true;
    this.updateLoadingState();
    
    if (this.options.onRefresh) {
      this.options.onRefresh();
    }
  }

  /**
   * Handle query database action
   */
  handleQueryDatabase() {
    console.log('Querying modules collection in database...');
    
    if (this.options.onDatabaseQuery) {
      this.options.onDatabaseQuery('modules', 'find', { query: {} });
    }
  }

  /**
   * Handle module action
   */
  handleModuleAction(action, moduleName) {
    if (this.options.onModuleAction) {
      this.options.onModuleAction(action, moduleName);
    }
  }

  /**
   * Update loading state
   */
  updateLoadingState() {
    this.elements.refreshButton.disabled = this.model.isLoading;
    this.elements.refreshButton.textContent = this.model.isLoading ? '⏳ Loading...' : '🔄 Refresh Discovery';
  }

  /**
   * Update modules data
   */
  updateModules(modules) {
    this.model.modules = modules || [];
    this.model.isLoading = false;
    this.updateLoadingState();
    this.renderModules();
  }

  /**
   * Set connection status
   */
  setConnected(connected) {
    this.model.connected = connected;
    this.elements.statusDiv.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
    this.elements.refreshButton.disabled = !connected;
  }

  /**
   * Get component state for debugging
   */
  getState() {
    return {
      moduleCount: this.model.modules.length,
      connected: this.model.connected,
      isLoading: this.model.isLoading,
      activeSubTab: this.model.activeSubTab
    };
  }
}