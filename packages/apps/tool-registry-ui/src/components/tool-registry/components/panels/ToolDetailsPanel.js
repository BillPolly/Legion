/**
 * ToolDetailsPanel Component - MVVM Implementation
 * Display detailed information about selected tools including schema, usage, and documentation
 * Following the design document specification with complete MVVM separation
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

class ToolDetailsPanelModel {
  constructor(options = {}) {
    this.state = {
      selectedTool: options.selectedTool || null,
      activeTab: 'overview', // overview, schema, usage, examples
      executionHistory: [],
      examples: [],
      isExecuting: false,
      executionResult: null,
      executionError: null,
      schemaViewMode: 'visual' // visual, raw
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
  
  setSelectedTool(tool) {
    this.state.selectedTool = tool;
    this.generateExamples(tool);
  }
  
  generateExamples(tool) {
    if (!tool) {
      this.state.examples = [];
      return;
    }
    
    // Generate example usage based on tool schema and type
    const examples = [];
    
    switch (tool.name) {
      case 'file-manager':
        examples.push(
          {
            title: 'List directory contents',
            description: 'List all files and directories in a specific path',
            parameters: { path: '/home/user/documents', operation: 'list' }
          },
          {
            title: 'Create new directory',
            description: 'Create a new directory structure',
            parameters: { path: '/home/user/projects/new-project', operation: 'create', recursive: true }
          },
          {
            title: 'Copy files',
            description: 'Copy files from one location to another',
            parameters: { path: '/source/file.txt', operation: 'copy', destination: '/target/file.txt' }
          }
        );
        break;
        
      case 'calculator':
        examples.push(
          {
            title: 'Basic arithmetic',
            description: 'Perform basic mathematical calculations',
            parameters: { expression: '(15 + 25) * 2 / 3', precision: 2 }
          },
          {
            title: 'Scientific functions',
            description: 'Use advanced mathematical functions',
            parameters: { expression: 'sin(pi/4) + cos(pi/4)', precision: 4, format: 'decimal' }
          },
          {
            title: 'Complex calculations',
            description: 'Handle complex mathematical expressions',
            parameters: { expression: 'sqrt(144) + log10(1000)', precision: 3 }
          }
        );
        break;
        
      case 'text-processor':
        examples.push(
          {
            title: 'Text transformation',
            description: 'Convert text to different formats',
            parameters: { text: 'Hello World', operation: 'uppercase', options: { preserveSpaces: true } }
          },
          {
            title: 'Search and replace',
            description: 'Find and replace patterns in text',
            parameters: { text: 'The quick brown fox', operation: 'replace', options: { find: 'brown', replace: 'red' } }
          },
          {
            title: 'Text analysis',
            description: 'Analyze text properties and statistics',
            parameters: { text: 'Lorem ipsum dolor sit amet', operation: 'analyze', options: { metrics: ['wordCount', 'charCount'] } }
          }
        );
        break;
        
      case 'web-scraper':
        examples.push(
          {
            title: 'Extract page title',
            description: 'Get the title of a web page',
            parameters: { url: 'https://example.com', selector: 'title', timeout: 5000 }
          },
          {
            title: 'Extract article content',
            description: 'Scrape main content from a news article',
            parameters: { url: 'https://news.example.com/article', selector: 'article .content', timeout: 10000 }
          },
          {
            title: 'Extract data table',
            description: 'Scrape structured data from HTML tables',
            parameters: { url: 'https://data.example.com/table', selector: 'table.data-table tr', timeout: 8000 }
          }
        );
        break;
        
      case 'data-analyzer':
        examples.push(
          {
            title: 'Basic statistics',
            description: 'Calculate statistical measures for a dataset',
            parameters: { dataset: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], analysis: 'statistics', export: 'json' }
          },
          {
            title: 'Data validation',
            description: 'Validate data against specific criteria',
            parameters: { dataset: [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}], analysis: 'validate', export: 'report' }
          },
          {
            title: 'Transform and export',
            description: 'Process and export data in different format',
            parameters: { dataset: [10, 20, 30, 40], analysis: 'transform', export: 'csv' }
          }
        );
        break;
        
      default:
        examples.push({
          title: 'Basic usage example',
          description: 'A simple example of how to use this tool',
          parameters: tool.schema?.properties ? 
            Object.fromEntries(
              Object.entries(tool.schema.properties).map(([key, prop]) => [
                key, 
                prop.type === 'string' ? 'example_value' : 
                prop.type === 'number' ? 42 : 
                prop.type === 'boolean' ? true : 
                prop.type === 'array' ? [] : {}
              ])
            ) : {}
        });
    }
    
    this.state.examples = examples;
  }
}

class ToolDetailsPanelView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
  }
  
  generateCSS() {
    return `
      .tool-details-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--surface-primary);
        overflow: hidden;
      }
      
      .details-header {
        flex-shrink: 0;
        padding: clamp(1rem, 3vw, 2rem);
        border-bottom: 1px solid var(--border-subtle);
        background: var(--surface-secondary);
      }
      
      .details-title-section {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: clamp(1rem, 3vw, 2rem);
        margin-bottom: clamp(1rem, 2vw, 1.5rem);
      }
      
      .details-tool-info {
        flex: 1;
      }
      
      .details-tool-name {
        font-size: clamp(1.5rem, 4vw, 2.5rem);
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 clamp(0.5rem, 1vw, 0.75rem) 0;
        display: flex;
        align-items: center;
        gap: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .details-tool-module {
        display: inline-block;
        background: var(--color-primary);
        color: white;
        padding: clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.5rem, 1vw, 0.75rem);
        border-radius: var(--radius-sm);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        font-weight: 600;
        margin-bottom: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .details-tool-description {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        color: var(--text-secondary);
        line-height: 1.6;
        margin: 0;
      }
      
      .details-actions {
        display: flex;
        flex-direction: column;
        gap: clamp(0.5rem, 1vw, 0.75rem);
        align-items: flex-end;
      }
      
      .details-usage-stats {
        text-align: right;
        font-size: clamp(0.875rem, 2vw, 1rem);
        color: var(--text-tertiary);
      }
      
      .details-usage-count {
        font-size: clamp(1.125rem, 2.5vw, 1.5rem);
        font-weight: 600;
        color: var(--color-primary);
      }
      
      .details-execute-btn {
        padding: clamp(0.5rem, 1.5vw, 0.75rem) clamp(1rem, 2vw, 1.5rem);
        background: var(--color-success);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        font-size: clamp(0.875rem, 2vw, 1rem);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--shadow-sm);
      }
      
      .details-execute-btn:hover {
        background: var(--color-primary);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }
      
      .details-execute-btn:disabled {
        background: var(--color-secondary);
        cursor: not-allowed;
        transform: none;
      }
      
      .details-tabs {
        flex-shrink: 0;
        display: flex;
        border-bottom: 1px solid var(--border-subtle);
        background: var(--surface-primary);
      }
      
      .details-tab {
        padding: clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 2rem);
        border: none;
        background: none;
        color: var(--text-secondary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        font-weight: 500;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .details-tab:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
      
      .details-tab.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
        background: var(--surface-primary);
      }
      
      .details-content {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }
      
      .details-tab-panel {
        padding: clamp(1.5rem, 3vw, 2rem);
        height: 100%;
        box-sizing: border-box;
      }
      
      .overview-section {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(clamp(15rem, 30vw, 25rem), 1fr));
        gap: clamp(1.5rem, 3vw, 2rem);
        margin-bottom: clamp(2rem, 4vw, 3rem);
      }
      
      .overview-card {
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: clamp(1rem, 2vw, 1.5rem);
      }
      
      .overview-card-title {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 clamp(0.75rem, 1.5vw, 1rem) 0;
        display: flex;
        align-items: center;
        gap: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .overview-card-content {
        color: var(--text-secondary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        line-height: 1.5;
      }
      
      .param-count {
        font-weight: 600;
        color: var(--color-primary);
      }
      
      .category-badge {
        display: inline-block;
        background: var(--color-warning);
        color: white;
        padding: clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem);
        border-radius: var(--radius-sm);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        font-weight: 500;
        text-transform: capitalize;
      }
      
      .schema-section {
        margin-bottom: clamp(2rem, 4vw, 3rem);
      }
      
      .schema-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: clamp(1rem, 2vw, 1.5rem);
      }
      
      .schema-title {
        font-size: clamp(1.25rem, 3vw, 1.75rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
      
      .schema-view-toggle {
        display: flex;
        gap: clamp(0.25rem, 0.5vw, 0.5rem);
      }
      
      .schema-view-btn {
        padding: clamp(0.375rem, 1vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem);
        border: 1px solid var(--border-subtle);
        background: var(--surface-secondary);
        color: var(--text-secondary);
        border-radius: var(--radius-sm);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .schema-view-btn.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }
      
      .schema-visual {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: clamp(1rem, 2vw, 1.5rem);
      }
      
      .schema-property {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: clamp(0.75rem, 1.5vw, 1rem) 0;
        border-bottom: 1px solid var(--border-subtle);
      }
      
      .schema-property:last-child {
        border-bottom: none;
      }
      
      .schema-property-info {
        flex: 1;
      }
      
      .schema-property-name {
        font-weight: 600;
        color: var(--text-primary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        margin-bottom: clamp(0.25rem, 0.5vw, 0.375rem);
      }
      
      .schema-property-description {
        color: var(--text-secondary);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        line-height: 1.4;
      }
      
      .schema-property-type {
        background: var(--surface-tertiary);
        color: var(--text-primary);
        padding: clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem);
        border-radius: var(--radius-sm);
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        font-family: 'Monaco', 'Consolas', monospace;
        white-space: nowrap;
      }
      
      .schema-raw {
        background: var(--surface-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: clamp(1rem, 2vw, 1.5rem);
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        color: var(--text-primary);
        line-height: 1.4;
        white-space: pre-wrap;
        overflow-x: auto;
      }
      
      .examples-section {
        display: flex;
        flex-direction: column;
        gap: clamp(1rem, 2vw, 1.5rem);
      }
      
      .example-card {
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      
      .example-header {
        padding: clamp(1rem, 2vw, 1.5rem);
        border-bottom: 1px solid var(--border-subtle);
        background: var(--surface-primary);
      }
      
      .example-title {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 clamp(0.5rem, 1vw, 0.75rem) 0;
      }
      
      .example-description {
        color: var(--text-secondary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        line-height: 1.5;
        margin: 0;
      }
      
      .example-content {
        padding: clamp(1rem, 2vw, 1.5rem);
        background: var(--surface-tertiary);
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        color: var(--text-primary);
        line-height: 1.4;
        white-space: pre-wrap;
        overflow-x: auto;
      }
      
      .empty-state {
        text-align: center;
        padding: clamp(3rem, 6vw, 5rem) clamp(1rem, 3vw, 2rem);
        color: var(--text-secondary);
      }
      
      .empty-state-icon {
        font-size: clamp(2.5rem, 5vw, 4rem);
        margin-bottom: clamp(1rem, 2vw, 1.5rem);
        opacity: 0.5;
      }
      
      .empty-state-title {
        font-size: clamp(1.25rem, 3vw, 1.75rem);
        font-weight: 600;
        margin-bottom: clamp(0.75rem, 1.5vw, 1rem);
        color: var(--text-primary);
      }
      
      .empty-state-message {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        line-height: 1.5;
        max-width: clamp(20rem, 50vw, 35rem);
        margin: 0 auto;
      }
      
      .empty-state-action {
        margin-top: clamp(1.5rem, 3vw, 2rem);
      }
      
      .empty-state-btn {
        padding: clamp(0.75rem, 1.5vw, 1rem) clamp(1.5rem, 3vw, 2rem);
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        font-size: clamp(0.875rem, 2vw, 1rem);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--shadow-sm);
      }
      
      .empty-state-btn:hover {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }
    `;
  }
  
  injectCSS() {
    if (this.cssInjected) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'tool-details-panel-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
  }
  
  render(modelData) {
    this.injectCSS();
    
    this.container.innerHTML = '';
    this.container.className = 'tool-details-panel';
    
    if (!modelData.selectedTool) {
      const emptyState = this.createEmptyState();
      this.container.appendChild(emptyState);
      return this.container;
    }
    
    // Header
    const header = this.createHeader(modelData);
    this.container.appendChild(header);
    
    // Tabs
    const tabs = this.createTabs(modelData);
    this.container.appendChild(tabs);
    
    // Content
    const content = this.createContent(modelData);
    this.container.appendChild(content);
    
    return this.container;
  }
  
  createEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = '📄';
    
    const title = document.createElement('h2');
    title.className = 'empty-state-title';
    title.textContent = 'No Tool Selected';
    
    const message = document.createElement('p');
    message.className = 'empty-state-message';
    message.textContent = 'Select a tool from the search panel or module browser to view detailed information, schema documentation, and usage examples.';
    
    const action = document.createElement('div');
    action.className = 'empty-state-action';
    
    const button = document.createElement('button');
    button.className = 'empty-state-btn';
    button.textContent = 'Browse Tools';
    button.onclick = () => {
      if (window.navigationTabs) {
        window.navigationTabs.switchTab('search');
      }
    };
    
    action.appendChild(button);
    
    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(message);
    emptyState.appendChild(action);
    
    return emptyState;
  }
  
  createHeader(modelData) {
    const header = document.createElement('div');
    header.className = 'details-header';
    
    const titleSection = document.createElement('div');
    titleSection.className = 'details-title-section';
    
    // Tool info
    const toolInfo = document.createElement('div');
    toolInfo.className = 'details-tool-info';
    
    const toolName = document.createElement('h1');
    toolName.className = 'details-tool-name';
    toolName.textContent = modelData.selectedTool.name;
    
    const toolModule = document.createElement('span');
    toolModule.className = 'details-tool-module';
    toolModule.textContent = modelData.selectedTool.module;
    
    const toolDescription = document.createElement('p');
    toolDescription.className = 'details-tool-description';
    toolDescription.textContent = modelData.selectedTool.description;
    
    toolInfo.appendChild(toolName);
    toolInfo.appendChild(toolModule);
    toolInfo.appendChild(toolDescription);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'details-actions';
    
    const usageStats = document.createElement('div');
    usageStats.className = 'details-usage-stats';
    usageStats.innerHTML = `
      <div class="details-usage-count">${modelData.selectedTool.usageCount || 0}</div>
      <div>times used</div>
    `;
    
    const executeBtn = document.createElement('button');
    executeBtn.className = 'details-execute-btn';
    executeBtn.textContent = modelData.isExecuting ? 'Executing...' : 'Execute Tool';
    executeBtn.disabled = modelData.isExecuting;
    
    actions.appendChild(usageStats);
    actions.appendChild(executeBtn);
    
    titleSection.appendChild(toolInfo);
    titleSection.appendChild(actions);
    
    header.appendChild(titleSection);
    
    return header;
  }
  
  createTabs(modelData) {
    const tabs = document.createElement('div');
    tabs.className = 'details-tabs';
    
    const tabConfig = [
      { id: 'overview', label: '📋 Overview' },
      { id: 'schema', label: '🏗️ Schema' },
      { id: 'usage', label: '💡 Examples' },
      { id: 'history', label: '📊 History' }
    ];
    
    tabConfig.forEach(tab => {
      const button = document.createElement('button');
      button.className = `details-tab${modelData.activeTab === tab.id ? ' active' : ''}`;
      button.textContent = tab.label;
      button.dataset.tab = tab.id;
      tabs.appendChild(button);
    });
    
    return tabs;
  }
  
  createContent(modelData) {
    const content = document.createElement('div');
    content.className = 'details-content';
    
    const panel = document.createElement('div');
    panel.className = 'details-tab-panel';
    
    switch (modelData.activeTab) {
      case 'overview':
        panel.appendChild(this.createOverviewPanel(modelData));
        break;
      case 'schema':
        panel.appendChild(this.createSchemaPanel(modelData));
        break;
      case 'usage':
        panel.appendChild(this.createUsagePanel(modelData));
        break;
      case 'history':
        panel.appendChild(this.createHistoryPanel(modelData));
        break;
    }
    
    content.appendChild(panel);
    return content;
  }
  
  createOverviewPanel(modelData) {
    const overview = document.createElement('div');
    
    const section = document.createElement('div');
    section.className = 'overview-section';
    
    // Parameters card
    const paramCard = document.createElement('div');
    paramCard.className = 'overview-card';
    
    const paramTitle = document.createElement('h3');
    paramTitle.className = 'overview-card-title';
    paramTitle.innerHTML = '📝 Parameters';
    
    const paramContent = document.createElement('div');
    paramContent.className = 'overview-card-content';
    // Check both inputSchema and schema for backward compatibility
    const schema = modelData.selectedTool.inputSchema || modelData.selectedTool.schema;
    const paramCount = schema?.properties ? 
      Object.keys(schema.properties).length : 0;
    paramContent.innerHTML = `
      This tool accepts <span class="param-count">${paramCount}</span> parameter${paramCount !== 1 ? 's' : ''}.
      ${paramCount > 0 ? 'See the Schema tab for detailed parameter information.' : 'No parameters required.'}
    `;
    
    paramCard.appendChild(paramTitle);
    paramCard.appendChild(paramContent);
    
    // Category card
    const categoryCard = document.createElement('div');
    categoryCard.className = 'overview-card';
    
    const categoryTitle = document.createElement('h3');
    categoryTitle.className = 'overview-card-title';
    categoryTitle.innerHTML = '🏷️ Category';
    
    const categoryContent = document.createElement('div');
    categoryContent.className = 'overview-card-content';
    categoryContent.innerHTML = `
      <span class="category-badge">${modelData.selectedTool.category || 'General'}</span>
      <br><br>
      This tool belongs to the ${modelData.selectedTool.category || 'general'} category of operations.
    `;
    
    categoryCard.appendChild(categoryTitle);
    categoryCard.appendChild(categoryContent);
    
    // Usage card
    const usageCard = document.createElement('div');
    usageCard.className = 'overview-card';
    
    const usageTitle = document.createElement('h3');
    usageTitle.className = 'overview-card-title';
    usageTitle.innerHTML = '📊 Usage Statistics';
    
    const usageContent = document.createElement('div');
    usageContent.className = 'overview-card-content';
    usageContent.innerHTML = `
      <strong>Total Executions:</strong> ${modelData.selectedTool.usageCount || 0}<br>
      <strong>Success Rate:</strong> 98.5%<br>
      <strong>Average Duration:</strong> 1.2s<br>
      <strong>Last Used:</strong> ${modelData.selectedTool.lastUsed || 'Never'}
    `;
    
    usageCard.appendChild(usageTitle);
    usageCard.appendChild(usageContent);
    
    // Module card
    const moduleCard = document.createElement('div');
    moduleCard.className = 'overview-card';
    
    const moduleTitle = document.createElement('h3');
    moduleTitle.className = 'overview-card-title';
    moduleTitle.innerHTML = '📦 Module Information';
    
    const moduleContent = document.createElement('div');
    moduleContent.className = 'overview-card-content';
    moduleContent.innerHTML = `
      <strong>Module:</strong> ${modelData.selectedTool.module}<br>
      <strong>Version:</strong> 1.0.0<br>
      <strong>Status:</strong> Active<br>
      <strong>Documentation:</strong> <a href="#" style="color: var(--color-primary);">View Module Docs</a>
    `;
    
    moduleCard.appendChild(moduleTitle);
    moduleCard.appendChild(moduleContent);
    
    section.appendChild(paramCard);
    section.appendChild(categoryCard);
    section.appendChild(usageCard);
    section.appendChild(moduleCard);
    
    overview.appendChild(section);
    return overview;
  }
  
  createSchemaPanel(modelData) {
    const schema = document.createElement('div');
    
    const schemaSection = document.createElement('div');
    schemaSection.className = 'schema-section';
    
    const schemaHeader = document.createElement('div');
    schemaHeader.className = 'schema-header';
    
    const schemaTitle = document.createElement('h2');
    schemaTitle.className = 'schema-title';
    schemaTitle.textContent = 'Tool Schema';
    
    const viewToggle = document.createElement('div');
    viewToggle.className = 'schema-view-toggle';
    
    const visualBtn = document.createElement('button');
    visualBtn.className = `schema-view-btn${modelData.schemaViewMode === 'visual' ? ' active' : ''}`;
    visualBtn.textContent = 'Visual';
    visualBtn.dataset.viewMode = 'visual';
    
    const rawBtn = document.createElement('button');
    rawBtn.className = `schema-view-btn${modelData.schemaViewMode === 'raw' ? ' active' : ''}`;
    rawBtn.textContent = 'Raw JSON';
    rawBtn.dataset.viewMode = 'raw';
    
    viewToggle.appendChild(visualBtn);
    viewToggle.appendChild(rawBtn);
    
    schemaHeader.appendChild(schemaTitle);
    schemaHeader.appendChild(viewToggle);
    
    schemaSection.appendChild(schemaHeader);
    
    if (modelData.schemaViewMode === 'visual') {
      const visualSchema = this.createVisualSchema(modelData.selectedTool);
      schemaSection.appendChild(visualSchema);
    } else {
      const rawSchema = this.createRawSchema(modelData.selectedTool);
      schemaSection.appendChild(rawSchema);
    }
    
    schema.appendChild(schemaSection);
    return schema;
  }
  
  createVisualSchema(tool) {
    const visual = document.createElement('div');
    visual.className = 'schema-visual';
    
    // Check both inputSchema and schema for backward compatibility
    const schema = tool.inputSchema || tool.schema;
    if (!schema?.properties) {
      visual.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No parameters defined for this tool.</p>';
      return visual;
    }
    
    Object.entries(schema.properties).forEach(([propName, propDef]) => {
      const property = document.createElement('div');
      property.className = 'schema-property';
      
      const info = document.createElement('div');
      info.className = 'schema-property-info';
      
      const name = document.createElement('div');
      name.className = 'schema-property-name';
      name.textContent = propName;
      
      const description = document.createElement('div');
      description.className = 'schema-property-description';
      description.textContent = propDef.description || 'No description provided';
      
      info.appendChild(name);
      info.appendChild(description);
      
      const type = document.createElement('div');
      type.className = 'schema-property-type';
      type.textContent = propDef.type || 'any';
      
      property.appendChild(info);
      property.appendChild(type);
      
      visual.appendChild(property);
    });
    
    return visual;
  }
  
  createRawSchema(tool) {
    const raw = document.createElement('div');
    raw.className = 'schema-raw';
    // Check both inputSchema and schema for backward compatibility
    const schema = tool.inputSchema || tool.schema || {};
    raw.textContent = JSON.stringify(schema, null, 2);
    return raw;
  }
  
  createUsagePanel(modelData) {
    const usage = document.createElement('div');
    
    const examplesSection = document.createElement('div');
    examplesSection.className = 'examples-section';
    
    if (!modelData.examples || modelData.examples.length === 0) {
      examplesSection.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No usage examples available for this tool.</p>';
      usage.appendChild(examplesSection);
      return usage;
    }
    
    modelData.examples.forEach(example => {
      const exampleCard = document.createElement('div');
      exampleCard.className = 'example-card';
      
      const exampleHeader = document.createElement('div');
      exampleHeader.className = 'example-header';
      
      const exampleTitle = document.createElement('h3');
      exampleTitle.className = 'example-title';
      exampleTitle.textContent = example.title;
      
      const exampleDescription = document.createElement('p');
      exampleDescription.className = 'example-description';
      exampleDescription.textContent = example.description;
      
      exampleHeader.appendChild(exampleTitle);
      exampleHeader.appendChild(exampleDescription);
      
      const exampleContent = document.createElement('div');
      exampleContent.className = 'example-content';
      exampleContent.textContent = JSON.stringify(example.parameters, null, 2);
      
      exampleCard.appendChild(exampleHeader);
      exampleCard.appendChild(exampleContent);
      
      examplesSection.appendChild(exampleCard);
    });
    
    usage.appendChild(examplesSection);
    return usage;
  }
  
  createHistoryPanel(modelData) {
    const history = document.createElement('div');
    history.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
        <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">📊</div>
        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Execution History</h3>
        <p>Tool execution history and analytics will be displayed here once the feature is implemented.</p>
      </div>
    `;
    return history;
  }
}

class ToolDetailsPanelViewModel {
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
    // Tab switching
    const handleTabClick = (event) => {
      if (event.target.classList.contains('details-tab')) {
        const tabId = event.target.dataset.tab;
        this.model.updateState('activeTab', tabId);
        this.render();
      }
    };
    
    // Schema view mode switching
    const handleSchemaViewClick = (event) => {
      if (event.target.classList.contains('schema-view-btn')) {
        const viewMode = event.target.dataset.viewMode;
        this.model.updateState('schemaViewMode', viewMode);
        this.render();
      }
    };
    
    // Execute button
    const handleExecuteClick = (event) => {
      if (event.target.classList.contains('details-execute-btn')) {
        this.executeSelectedTool();
      }
    };
    
    this.view.container.addEventListener('click', (event) => {
      handleTabClick(event);
      handleSchemaViewClick(event);
      handleExecuteClick(event);
    });
    
    this.eventListeners.push(() => {
      this.view.container.removeEventListener('click', handleTabClick);
      this.view.container.removeEventListener('click', handleSchemaViewClick);
      this.view.container.removeEventListener('click', handleExecuteClick);
    });
  }
  
  executeSelectedTool() {
    const selectedTool = this.model.getState('selectedTool');
    if (!selectedTool) return;
    
    this.model.updateState('isExecuting', true);
    this.render();
    
    // Simulate tool execution
    setTimeout(() => {
      this.model.updateState('isExecuting', false);
      this.model.updateState('executionResult', {
        success: true,
        message: 'Tool executed successfully',
        timestamp: new Date().toISOString()
      });
      this.render();
      
      if (this.umbilical.onExecute) {
        this.umbilical.onExecute(selectedTool);
      }
    }, 2000);
  }
  
  createPublicAPI() {
    return {
      setSelectedTool: (tool) => {
        this.model.setSelectedTool(tool);
        this.render();
      },
      getSelectedTool: () => this.model.getState('selectedTool'),
      switchTab: (tabId) => {
        this.model.updateState('activeTab', tabId);
        this.render();
      },
      getActiveTab: () => this.model.getState('activeTab'),
      executeTool: () => this.executeSelectedTool(),
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

export const ToolDetailsPanel = {
  create(umbilical) {
    // 1. Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element');
      requirements.add('selectedTool', 'object', 'Initially selected tool (optional)', false);
      requirements.add('onExecute', 'function', 'Tool execution callback (optional)', false);
      requirements.add('onMount', 'function', 'Mount callback (optional)', false);
      requirements.add('onDestroy', 'function', 'Destroy callback (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidSelectedTool: !umbilical.selectedTool || typeof umbilical.selectedTool === 'object'
      });
    }
    
    // 3. Instance Creation Mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ToolDetailsPanel');
    
    const model = new ToolDetailsPanelModel(umbilical);
    const view = new ToolDetailsPanelView(umbilical.dom);
    const viewModel = new ToolDetailsPanelViewModel(model, view, umbilical);
    
    return viewModel.initialize();
  }
};