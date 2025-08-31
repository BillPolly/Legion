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
      title: 'Tools Found',
      expandedTools: new Set() // Track expanded tools
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
    
    // Create a vertical list of clickable tools instead of a grid
    this.model.tools.forEach((tool, index) => {
      const isExpanded = this.model.expandedTools.has(index);
      const toolName = typeof tool === 'string' ? tool : tool.name;
      
      const toolItem = document.createElement('div');
      toolItem.className = 'tool-item-expandable';
      toolItem.style.marginBottom = '8px';
      toolItem.style.border = '1px solid #e0e0e0';
      toolItem.style.borderRadius = '6px';
      toolItem.style.overflow = 'hidden';
      
      // Create clickable header
      const toolHeader = document.createElement('div');
      toolHeader.className = 'tool-header clickable';
      toolHeader.style.cursor = 'pointer';
      toolHeader.style.padding = '8px 12px';
      toolHeader.style.backgroundColor = '#f8f9fa';
      toolHeader.style.borderBottom = isExpanded ? '1px solid #e0e0e0' : 'none';
      toolHeader.style.display = 'flex';
      toolHeader.style.alignItems = 'center';
      toolHeader.style.gap = '8px';
      toolHeader.style.transition = 'background-color 0.2s';
      toolHeader.dataset.toolIndex = index;
      
      // Expand icon
      const expandIcon = document.createElement('span');
      expandIcon.className = 'tool-expand-icon';
      expandIcon.textContent = isExpanded ? '▼' : '▶️';
      expandIcon.style.fontSize = '12px';
      expandIcon.style.width = '16px';
      expandIcon.style.textAlign = 'center';
      toolHeader.appendChild(expandIcon);
      
      // Tool name
      const toolNameSpan = document.createElement('strong');
      toolNameSpan.textContent = toolName;
      toolNameSpan.style.flex = '1';
      toolHeader.appendChild(toolNameSpan);
      
      // Confidence if available
      if (this.options.showConfidence && tool.confidence !== undefined) {
        const confidenceSpan = document.createElement('span');
        confidenceSpan.className = 'tool-confidence';
        confidenceSpan.textContent = `${(tool.confidence * 100).toFixed(1)}%`;
        confidenceSpan.style.fontSize = '0.9em';
        confidenceSpan.style.color = '#666';
        toolHeader.appendChild(confidenceSpan);
      }
      
      toolItem.appendChild(toolHeader);
      
      // Create expandable metadata section
      if (isExpanded) {
        const metadataSection = document.createElement('div');
        metadataSection.className = 'tool-metadata-section';
        metadataSection.style.padding = '15px';
        metadataSection.style.backgroundColor = '#fafafa';
        metadataSection.style.borderTop = '1px solid #e0e0e0';
        
        if (tool.metadata) {
          const metadataTitle = document.createElement('h6');
          metadataTitle.textContent = 'Tool Metadata:';
          metadataTitle.style.margin = '0 0 10px 0';
          metadataTitle.style.color = '#333';
          metadataTitle.style.fontSize = '14px';
          metadataTitle.style.fontWeight = 'bold';
          metadataSection.appendChild(metadataTitle);
          
          // Description
          if (tool.metadata.description) {
            const descField = this.createMetadataField('Description', tool.metadata.description);
            metadataSection.appendChild(descField);
          }
          
          // Category
          if (tool.metadata.category) {
            const categoryField = this.createMetadataField('Category', tool.metadata.category);
            metadataSection.appendChild(categoryField);
          }
          
          // Version
          if (tool.metadata.version) {
            const versionField = this.createMetadataField('Version', tool.metadata.version);
            metadataSection.appendChild(versionField);
          }
          
          // Author
          if (tool.metadata.author) {
            const authorField = this.createMetadataField('Author', tool.metadata.author);
            metadataSection.appendChild(authorField);
          }
          
          // Input Schema
          if (tool.metadata.inputSchema && Object.keys(tool.metadata.inputSchema).length > 0) {
            const inputSchemaField = this.createMetadataField('Input Schema', null, true);
            const schemaJson = document.createElement('pre');
            schemaJson.className = 'schema-json';
            schemaJson.textContent = JSON.stringify(tool.metadata.inputSchema, null, 2);
            schemaJson.style.background = '#f8f8f8';
            schemaJson.style.border = '1px solid #ddd';
            schemaJson.style.borderRadius = '3px';
            schemaJson.style.padding = '8px';
            schemaJson.style.fontFamily = "'Monaco', 'Menlo', 'Ubuntu Mono', monospace";
            schemaJson.style.fontSize = '11px';
            schemaJson.style.maxHeight = '200px';
            schemaJson.style.overflowY = 'auto';
            schemaJson.style.margin = '5px 0 0 0';
            inputSchemaField.appendChild(schemaJson);
            metadataSection.appendChild(inputSchemaField);
          }
          
          // Output Schema
          if (tool.metadata.outputSchema && Object.keys(tool.metadata.outputSchema).length > 0) {
            const outputSchemaField = this.createMetadataField('Output Schema', null, true);
            const schemaJson = document.createElement('pre');
            schemaJson.className = 'schema-json';
            schemaJson.textContent = JSON.stringify(tool.metadata.outputSchema, null, 2);
            schemaJson.style.background = '#f8f8f8';
            schemaJson.style.border = '1px solid #ddd';
            schemaJson.style.borderRadius = '3px';
            schemaJson.style.padding = '8px';
            schemaJson.style.fontFamily = "'Monaco', 'Menlo', 'Ubuntu Mono', monospace";
            schemaJson.style.fontSize = '11px';
            schemaJson.style.maxHeight = '200px';
            schemaJson.style.overflowY = 'auto';
            schemaJson.style.margin = '5px 0 0 0';
            outputSchemaField.appendChild(schemaJson);
            metadataSection.appendChild(outputSchemaField);
          }
        } else {
          // No metadata available
          const noMetadata = document.createElement('div');
          noMetadata.className = 'no-metadata';
          noMetadata.textContent = 'No metadata available for this tool';
          noMetadata.style.padding = '10px';
          noMetadata.style.color = '#999';
          noMetadata.style.fontStyle = 'italic';
          noMetadata.style.textAlign = 'center';
          noMetadata.style.background = '#f9f9f9';
          noMetadata.style.borderRadius = '4px';
          metadataSection.appendChild(noMetadata);
        }
        
        toolItem.appendChild(metadataSection);
      }
      
      toolsContent.appendChild(toolItem);
    });
    
    // Add click event listeners
    toolsContent.addEventListener('click', (e) => {
      const toolHeader = e.target.closest('.tool-header.clickable');
      if (toolHeader) {
        const index = parseInt(toolHeader.dataset.toolIndex);
        if (this.model.expandedTools.has(index)) {
          this.model.expandedTools.delete(index);
        } else {
          this.model.expandedTools.add(index);
        }
        this.render();
      }
    });
    
    return toolsContent;
  }
  
  createMetadataField(label, value, isSchema = false) {
    const field = document.createElement('div');
    field.className = 'metadata-field';
    field.style.background = 'white';
    field.style.padding = '10px';
    field.style.borderRadius = '4px';
    field.style.border = '1px solid #e5e5e5';
    field.style.marginBottom = '10px';
    
    const labelElem = document.createElement('strong');
    labelElem.textContent = label + ':';
    labelElem.style.display = 'block';
    labelElem.style.marginBottom = '5px';
    labelElem.style.color = '#555';
    labelElem.style.fontSize = '12px';
    labelElem.style.textTransform = 'uppercase';
    field.appendChild(labelElem);
    
    if (value && !isSchema) {
      const valueElem = document.createElement('div');
      valueElem.textContent = value;
      valueElem.style.color = '#333';
      field.appendChild(valueElem);
    }
    
    return field;
  }
}