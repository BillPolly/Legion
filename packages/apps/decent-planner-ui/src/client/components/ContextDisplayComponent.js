/**
 * ContextDisplayComponent - Real-time context variable display
 * 
 * Shows the current state of the tool agent's execution context:
 * - Variable names, types, and values
 * - Operation history with tool execution trace
 * - Statistics and metadata
 * 
 * Updates in real-time as the agent executes tools and stores results.
 */

export class ContextDisplayComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      contextState: null,
      artifacts: {},
      operationHistory: [],
      statistics: {
        variableCount: 0,
        operationCount: 0,
        lastUpdated: null
      }
    };
    
    // View elements
    this.elements = {};
    
    this.createView();
  }

  /**
   * Create the context display view
   */
  createView() {
    this.container.innerHTML = '';
    
    // Main container
    const mainDiv = document.createElement('div');
    mainDiv.className = 'context-display-container';
    
    // Header with statistics
    const headerDiv = document.createElement('div');
    headerDiv.className = 'context-header';
    
    const titleH3 = document.createElement('h3');
    titleH3.textContent = '📝 Context Variables';
    titleH3.style.margin = '0 0 8px 0';
    titleH3.style.fontSize = '16px';
    
    this.elements.statsDiv = document.createElement('div');
    this.elements.statsDiv.className = 'context-stats';
    this.elements.statsDiv.style.fontSize = '12px';
    this.elements.statsDiv.style.color = '#666';
    this.elements.statsDiv.textContent = '0 variables, 0 operations';
    
    headerDiv.appendChild(titleH3);
    headerDiv.appendChild(this.elements.statsDiv);
    
    // Variables section
    const variablesSection = document.createElement('div');
    variablesSection.className = 'context-variables-section';
    
    const variablesTitle = document.createElement('h4');
    variablesTitle.textContent = '🗃️ Stored Variables';
    variablesTitle.style.margin = '16px 0 8px 0';
    variablesTitle.style.fontSize = '14px';
    
    this.elements.variablesList = document.createElement('div');
    this.elements.variablesList.className = 'context-variables-list';
    this.elements.variablesList.style.fontFamily = 'monospace';
    this.elements.variablesList.style.fontSize = '12px';
    this.elements.variablesList.style.maxHeight = '200px';
    this.elements.variablesList.style.overflowY = 'auto';
    this.elements.variablesList.style.border = '1px solid #eee';
    this.elements.variablesList.style.borderRadius = '4px';
    this.elements.variablesList.style.padding = '8px';
    this.elements.variablesList.style.backgroundColor = '#f9f9f9';
    
    variablesSection.appendChild(variablesTitle);
    variablesSection.appendChild(this.elements.variablesList);
    
    // Operations section
    const operationsSection = document.createElement('div');
    operationsSection.className = 'context-operations-section';
    
    const operationsTitle = document.createElement('h4');
    operationsTitle.textContent = '⚙️ Operation History';
    operationsTitle.style.margin = '16px 0 8px 0';
    operationsTitle.style.fontSize = '14px';
    
    this.elements.operationsList = document.createElement('div');
    this.elements.operationsList.className = 'context-operations-list';
    this.elements.operationsList.style.fontFamily = 'monospace';
    this.elements.operationsList.style.fontSize = '11px';
    this.elements.operationsList.style.maxHeight = '150px';
    this.elements.operationsList.style.overflowY = 'auto';
    this.elements.operationsList.style.border = '1px solid #eee';
    this.elements.operationsList.style.borderRadius = '4px';
    this.elements.operationsList.style.padding = '8px';
    this.elements.operationsList.style.backgroundColor = '#f9f9f9';
    
    operationsSection.appendChild(operationsTitle);
    operationsSection.appendChild(this.elements.operationsList);
    
    // Clear context button
    this.elements.clearButton = document.createElement('button');
    this.elements.clearButton.className = 'context-clear-button';
    this.elements.clearButton.textContent = '🗑️ Clear Context';
    this.elements.clearButton.style.marginTop = '16px';
    this.elements.clearButton.style.padding = '8px 16px';
    this.elements.clearButton.style.backgroundColor = '#ff6b6b';
    this.elements.clearButton.style.color = 'white';
    this.elements.clearButton.style.border = 'none';
    this.elements.clearButton.style.borderRadius = '4px';
    this.elements.clearButton.style.cursor = 'pointer';
    this.elements.clearButton.onclick = () => this.handleClearContext();
    
    // Assemble view
    mainDiv.appendChild(headerDiv);
    mainDiv.appendChild(variablesSection);
    mainDiv.appendChild(operationsSection);
    mainDiv.appendChild(this.elements.clearButton);
    
    this.container.appendChild(mainDiv);
    
    // Render initial state
    this.renderVariables();
    this.renderOperations();
    this.updateStats();
  }

  /**
   * Update context state from agent
   */
  updateContext(contextState) {
    this.model.contextState = contextState;
    this.model.artifacts = contextState.artifacts || {};
    this.model.operationHistory = contextState.operationHistory || [];
    this.model.statistics.lastUpdated = new Date().toISOString();
    
    this.renderVariables();
    this.renderOperations();
    this.updateStats();
  }

  /**
   * Add new operation to history
   */
  addOperation(operation) {
    this.model.operationHistory.push(operation);
    this.renderOperations();
    this.updateStats();
  }

  /**
   * Update variable in context
   */
  updateVariable(name, value) {
    this.model.artifacts[name] = value;
    this.renderVariables();
    this.updateStats();
  }

  /**
   * Render context variables
   */
  renderVariables() {
    this.elements.variablesList.innerHTML = '';
    
    const artifacts = this.model.artifacts;
    const keys = Object.keys(artifacts);
    
    if (keys.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.color = '#999';
      emptyDiv.style.fontStyle = 'italic';
      emptyDiv.textContent = 'No variables stored yet';
      this.elements.variablesList.appendChild(emptyDiv);
      return;
    }
    
    keys.forEach(key => {
      const value = artifacts[key];
      const variableDiv = document.createElement('div');
      variableDiv.className = 'context-variable';
      variableDiv.style.marginBottom = '8px';
      variableDiv.style.padding = '6px';
      variableDiv.style.backgroundColor = 'white';
      variableDiv.style.border = '1px solid #ddd';
      variableDiv.style.borderRadius = '3px';
      
      // Variable name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'variable-name';
      nameSpan.style.fontWeight = 'bold';
      nameSpan.style.color = '#2563eb';
      nameSpan.textContent = key;
      
      // Variable type
      const typeSpan = document.createElement('span');
      typeSpan.className = 'variable-type';
      typeSpan.style.color = '#7c3aed';
      typeSpan.style.fontSize = '10px';
      typeSpan.style.marginLeft = '8px';
      typeSpan.textContent = `(${this.getVariableType(value)})`;
      
      // Variable value preview
      const valueDiv = document.createElement('div');
      valueDiv.className = 'variable-value';
      valueDiv.style.marginTop = '4px';
      valueDiv.style.color = '#374151';
      valueDiv.style.fontSize = '11px';
      valueDiv.style.wordBreak = 'break-all';
      
      const preview = this.getVariablePreview(value);
      valueDiv.textContent = preview;
      
      // Click to expand for objects
      if (typeof value === 'object' && value !== null) {
        variableDiv.style.cursor = 'pointer';
        variableDiv.onclick = () => this.toggleVariableExpansion(key, variableDiv);
        
        const expandIcon = document.createElement('span');
        expandIcon.style.float = 'right';
        expandIcon.style.fontSize = '10px';
        expandIcon.textContent = '▶️';
        nameSpan.appendChild(expandIcon);
      }
      
      variableDiv.appendChild(nameSpan);
      variableDiv.appendChild(typeSpan);
      variableDiv.appendChild(valueDiv);
      
      this.elements.variablesList.appendChild(variableDiv);
    });
  }

  /**
   * Render operation history
   */
  renderOperations() {
    this.elements.operationsList.innerHTML = '';
    
    const operations = this.model.operationHistory;
    
    if (operations.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.color = '#999';
      emptyDiv.style.fontStyle = 'italic';
      emptyDiv.textContent = 'No operations executed yet';
      this.elements.operationsList.appendChild(emptyDiv);
      return;
    }
    
    operations.slice(-10).forEach((operation, index) => {
      const opDiv = document.createElement('div');
      opDiv.className = 'context-operation';
      opDiv.style.marginBottom = '8px';
      opDiv.style.padding = '6px';
      opDiv.style.backgroundColor = operation.success ? '#f0f9ff' : '#fef2f2';
      opDiv.style.border = `1px solid ${operation.success ? '#bfdbfe' : '#fecaca'}`;
      opDiv.style.borderRadius = '3px';
      
      // Operation header
      const headerDiv = document.createElement('div');
      headerDiv.style.fontWeight = 'bold';
      headerDiv.style.color = operation.success ? '#1d4ed8' : '#dc2626';
      
      const timestamp = new Date(operation.timestamp).toLocaleTimeString();
      headerDiv.textContent = `${operations.length - 10 + index + 1}. ${operation.tool} (${timestamp})`;
      
      // Success/failure indicator
      const statusSpan = document.createElement('span');
      statusSpan.style.float = 'right';
      statusSpan.textContent = operation.success ? '✅' : '❌';
      headerDiv.appendChild(statusSpan);
      
      // Operation details
      const detailsDiv = document.createElement('div');
      detailsDiv.style.marginTop = '4px';
      detailsDiv.style.fontSize = '10px';
      detailsDiv.style.color = '#6b7280';
      
      const inputsStr = JSON.stringify(operation.inputs || {});
      const truncatedInputs = inputsStr.length > 60 ? inputsStr.substring(0, 57) + '...' : inputsStr;
      
      let detailsText = `📥 ${truncatedInputs}`;
      if (operation.outputVariable) {
        detailsText += `\n💾 → ${operation.outputVariable}`;
      }
      if (operation.error) {
        detailsText += `\n❌ ${operation.error}`;
      }
      
      detailsDiv.style.whiteSpace = 'pre-line';
      detailsDiv.textContent = detailsText;
      
      opDiv.appendChild(headerDiv);
      opDiv.appendChild(detailsDiv);
      
      this.elements.operationsList.appendChild(opDiv);
    });
    
    // Auto-scroll to bottom
    this.elements.operationsList.scrollTop = this.elements.operationsList.scrollHeight;
  }

  /**
   * Update statistics display
   */
  updateStats() {
    const varCount = Object.keys(this.model.artifacts).length;
    const opCount = this.model.operationHistory.length;
    const lastUpdated = this.model.statistics.lastUpdated;
    
    this.model.statistics.variableCount = varCount;
    this.model.statistics.operationCount = opCount;
    
    let statsText = `${varCount} variables, ${opCount} operations`;
    if (lastUpdated) {
      const time = new Date(lastUpdated).toLocaleTimeString();
      statsText += ` (updated ${time})`;
    }
    
    this.elements.statsDiv.textContent = statsText;
  }

  /**
   * Update artifacts display
   */
  updateArtifacts() {
    this.renderVariables();
  }

  /**
   * Get variable type for display
   */
  getVariableType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    if (type === 'object') {
      return Array.isArray(value) ? `array[${value.length}]` : 'object';
    }
    return type;
  }

  /**
   * Get variable value preview
   */
  getVariablePreview(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    switch (type) {
      case 'string':
        return value.length > 80 ? `"${value.substring(0, 77)}..."` : `"${value}"`;
      case 'number':
      case 'boolean':
        return String(value);
      case 'object':
        if (Array.isArray(value)) {
          return value.length < 3 ? JSON.stringify(value) : `[${value.length} items]`;
        } else {
          try {
            const jsonStr = JSON.stringify(value);
            return jsonStr.length < 100 ? jsonStr : `{${Object.keys(value).length} keys}`;
          } catch (error) {
            return `{${Object.keys(value).length} keys}`;
          }
        }
      default:
        return `${type}`;
    }
  }

  /**
   * Toggle variable expansion for detailed view
   */
  toggleVariableExpansion(variableName, variableDiv) {
    const value = this.model.artifacts[variableName];
    const isExpanded = variableDiv.dataset.expanded === 'true';
    
    if (isExpanded) {
      // Collapse - show preview
      this.renderSingleVariable(variableName, value, variableDiv, false);
      variableDiv.dataset.expanded = 'false';
    } else {
      // Expand - show full value
      this.renderSingleVariable(variableName, value, variableDiv, true);
      variableDiv.dataset.expanded = 'true';
    }
  }

  /**
   * Render a single variable (for expansion/collapse)
   */
  renderSingleVariable(name, value, container, expanded) {
    container.innerHTML = '';
    
    // Variable name and type
    const nameSpan = document.createElement('span');
    nameSpan.className = 'variable-name';
    nameSpan.style.fontWeight = 'bold';
    nameSpan.style.color = '#2563eb';
    nameSpan.textContent = name;
    
    const typeSpan = document.createElement('span');
    typeSpan.className = 'variable-type';
    typeSpan.style.color = '#7c3aed';
    typeSpan.style.fontSize = '10px';
    typeSpan.style.marginLeft = '8px';
    typeSpan.textContent = `(${this.getVariableType(value)})`;
    
    // Expand icon for objects
    if (typeof value === 'object' && value !== null) {
      const expandIcon = document.createElement('span');
      expandIcon.style.float = 'right';
      expandIcon.style.fontSize = '10px';
      expandIcon.textContent = expanded ? '▼' : '▶️';
      nameSpan.appendChild(expandIcon);
    }
    
    container.appendChild(nameSpan);
    container.appendChild(typeSpan);
    
    // Variable value
    const valueDiv = document.createElement('div');
    valueDiv.className = 'variable-value';
    valueDiv.style.marginTop = '4px';
    valueDiv.style.color = '#374151';
    valueDiv.style.fontSize = '11px';
    valueDiv.style.wordBreak = 'break-all';
    
    if (expanded && typeof value === 'object' && value !== null) {
      // Show full JSON
      const preElement = document.createElement('pre');
      preElement.style.margin = '0';
      preElement.style.fontSize = '10px';
      preElement.style.backgroundColor = 'white';
      preElement.style.padding = '4px';
      preElement.style.border = '1px solid #ddd';
      preElement.style.borderRadius = '2px';
      preElement.style.maxHeight = '100px';
      preElement.style.overflow = 'auto';
      
      try {
        preElement.textContent = JSON.stringify(value, null, 2);
      } catch (error) {
        preElement.textContent = `[Circular object: ${Object.keys(value).join(', ')}]`;
      }
      
      valueDiv.appendChild(preElement);
    } else {
      // Show preview
      valueDiv.textContent = this.getVariablePreview(value);
    }
    
    container.appendChild(valueDiv);
  }

  /**
   * Handle clear context button click
   */
  handleClearContext() {
    if (confirm('Clear all context variables and operation history?')) {
      // Emit event to parent to clear context
      if (this.onClearContext) {
        this.onClearContext();
      }
    }
  }

  /**
   * Clear the display
   */
  clear() {
    this.model.artifacts = {};
    this.model.operationHistory = [];
    this.model.statistics.lastUpdated = new Date().toISOString();
    
    this.renderVariables();
    this.renderOperations();
    this.updateStats();
  }

  /**
   * Set clear context callback
   */
  setClearContextCallback(callback) {
    this.onClearContext = callback;
  }

  /**
   * Add context state data
   * @param {Object} contextData - Context state data to add and display
   */
  addContextState(contextData) {
    console.log('📝 ContextDisplayComponent: Adding context state:', contextData);
    
    // Update model with new context data
    this.model.contextState = contextData;
    this.model.artifacts = contextData.artifacts || {};
    this.model.statistics = {
      variableCount: Object.keys(this.model.artifacts).length,
      operationCount: contextData.operationCount || 0,
      lastUpdated: new Date().toLocaleTimeString()
    };
    
    // Re-render the display
    this.updateStats();
    this.updateArtifacts();
  }

  /**
   * Get current context state for debugging
   */
  getState() {
    return {
      model: this.model,
      hasElements: Object.keys(this.elements).length > 0
    };
  }
}