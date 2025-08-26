/**
 * ToolsListComponent - MVVM Component for displaying found tools in a nice format
 * One tool per line with confidence scores, collapsible with column layout
 */

import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class ToolsListComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showConfidence: options.showConfidence !== false,
      collapsible: options.collapsible !== false,
      defaultExpanded: options.defaultExpanded !== false,
      columns: options.columns || 3,
      ...options
    };
    
    // Model
    this.model = {
      tools: [],
      title: 'Tools Found'
    };
    
    // View elements
    this.elements = {};
    
    this.render();
  }
  
  setTools(tools, title = 'Tools Found') {
    // Ensure tools is always an array
    if (!tools || !Array.isArray(tools)) {
      console.warn('ToolsListComponent: tools must be an array, received:', typeof tools, tools);
      this.model.tools = [];
    } else {
      this.model.tools = tools;
    }
    this.model.title = title;
    this.render();
  }
  
  clear() {
    this.model.tools = [];
    this.render();
  }
  
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    if (this.model.tools.length === 0) {
      return;
    }
    
    if (this.options.collapsible) {
      // Create collapsible container
      const collapsibleContainer = document.createElement('div');
      const collapsible = new CollapsibleSectionComponent(collapsibleContainer, {
        title: this.model.title,
        icon: '🔧',
        defaultExpanded: this.options.defaultExpanded
      });
      
      // Create tools content
      const toolsContent = this.createToolsContent();
      collapsible.setContent(toolsContent);
      
      this.container.appendChild(collapsibleContainer);
      this.elements.container = collapsibleContainer;
    } else {
      // Create non-collapsible container
      const toolsFoundDiv = document.createElement('div');
      toolsFoundDiv.className = 'tools-found-summary';
      
      // Title
      const toolsTitle = document.createElement('h5');
      toolsTitle.textContent = `🔧 ${this.model.title}:`;
      toolsFoundDiv.appendChild(toolsTitle);
      
      // Add tools content
      const toolsContent = this.createToolsContent();
      toolsFoundDiv.appendChild(toolsContent);
      
      this.container.appendChild(toolsFoundDiv);
      this.elements.container = toolsFoundDiv;
    }
  }
  
  createToolsContent() {
    const toolsContent = document.createElement('div');
    toolsContent.className = 'tools-content';
    
    // Create column-based layout
    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'tools-grid';
    toolsGrid.style.display = 'grid';
    toolsGrid.style.gridTemplateColumns = `repeat(${this.options.columns}, 1fr)`;
    toolsGrid.style.gap = '8px';
    toolsGrid.style.marginTop = '8px';
    
    this.model.tools.forEach(tool => {
      const toolItem = document.createElement('div');
      toolItem.className = 'tool-item-grid';
      toolItem.style.padding = '4px 8px';
      toolItem.style.backgroundColor = '#f5f5f5';
      toolItem.style.borderRadius = '4px';
      toolItem.style.fontSize = '0.9em';
      
      if (this.options.showConfidence && tool.confidence !== undefined) {
        const toolName = document.createElement('strong');
        toolName.textContent = tool.name;
        toolName.style.display = 'block';
        
        const confidence = document.createElement('span');
        confidence.className = 'confidence';
        confidence.textContent = `${(tool.confidence * 100).toFixed(1)}%`;
        confidence.style.fontSize = '0.8em';
        confidence.style.color = '#666';
        
        toolItem.appendChild(toolName);
        toolItem.appendChild(confidence);
      } else {
        const toolName = document.createElement('strong');
        toolName.textContent = typeof tool === 'string' ? tool : tool.name;
        toolItem.appendChild(toolName);
      }
      
      toolsGrid.appendChild(toolItem);
    });
    
    toolsContent.appendChild(toolsGrid);
    return toolsContent;
  }
}