/**
 * ForceParametersPanel - UI component for configuring force-directed layout parameters
 * 
 * Provides comprehensive controls for all force-directed layout settings including
 * simulation parameters, force strengths, collision settings, and stabilization options.
 */

export class ForceParametersPanel {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.body,
      onParameterChange: config.onParameterChange || (() => {}),
      initialValues: config.initialValues || this._getDefaultValues(),
      collapsed: config.collapsed !== false, // Default to collapsed
      theme: config.theme || 'light'
    };
    
    this.currentValues = { ...this.config.initialValues };
    this.element = null;
    this.sections = new Map();
    this.controls = new Map();
    
    this._createPanel();
  }
  
  /**
   * Get default force-directed layout values
   */
  _getDefaultValues() {
    return {
      // Simulation parameters
      alphaMin: 0.001,
      alphaDecay: 0.0228,
      alphaTarget: 0,
      velocityDecay: 0.4,
      
      // Force strengths  
      chargeStrength: -300,
      linkStrength: 1,
      centerStrength: 0.1,
      collisionRadius: 30,
      
      // Layout configuration
      linkDistance: 100,
      chargeDistance: 1000, // Use finite value instead of Infinity
      
      // Collision settings
      collisionStrength: 1,
      collisionIterations: 1,
      
      // Stabilization settings
      stabilizationEnabled: true,
      stabilizationThreshold: 0.01,
      stabilizationCheckInterval: 10,
      stabilizationMinIterations: 50,
      stabilizationMaxIterations: 1000
    };
  }
  
  /**
   * Create the main panel structure
   */
  _createPanel() {
    this.element = document.createElement('div');
    this.element.className = `force-parameters-panel force-parameters-panel--${this.config.theme}`;
    this.element.innerHTML = `
      <div class="force-parameters-panel__header">
        <h3 class="force-parameters-panel__title">Force Parameters</h3>
        <button class="force-parameters-panel__toggle" type="button">
          <span class="force-parameters-panel__toggle-icon">${this.config.collapsed ? '▶' : '▼'}</span>
        </button>
      </div>
      <div class="force-parameters-panel__content" style="display: ${this.config.collapsed ? 'none' : 'block'}">
        <div class="force-parameters-panel__sections"></div>
        <div class="force-parameters-panel__actions">
          <button class="force-parameters-panel__reset" type="button">Reset to Defaults</button>
          <button class="force-parameters-panel__apply" type="button">Apply Changes</button>
        </div>
      </div>
    `;
    
    this._attachEventListeners();
    this._createSections();
    this._addStyles();
    
    this.config.container.appendChild(this.element);
  }
  
  /**
   * Create parameter sections
   */
  _createSections() {
    const sectionsContainer = this.element.querySelector('.force-parameters-panel__sections');
    
    // Simulation parameters section
    this._createSection('simulation', 'Simulation', [
      { key: 'alphaMin', label: 'Alpha Min', type: 'number', min: 0.0001, max: 0.01, step: 0.0001, tooltip: 'Simulation stops when alpha < alphaMin' },
      { key: 'alphaDecay', label: 'Alpha Decay', type: 'number', min: 0.001, max: 0.1, step: 0.001, tooltip: 'Alpha decay rate (higher = faster cooling)' },
      { key: 'alphaTarget', label: 'Alpha Target', type: 'number', min: 0, max: 1, step: 0.01, tooltip: 'Target alpha value' },
      { key: 'velocityDecay', label: 'Velocity Decay', type: 'number', min: 0, max: 1, step: 0.01, tooltip: 'Velocity damping (friction)' }
    ], sectionsContainer);
    
    // Force strengths section
    this._createSection('forces', 'Force Strengths', [
      { key: 'chargeStrength', label: 'Charge Strength', type: 'number', min: -1000, max: 0, step: 10, tooltip: 'Node repulsion strength (negative = repel)' },
      { key: 'linkStrength', label: 'Link Strength', type: 'number', min: 0, max: 5, step: 0.1, tooltip: 'Edge spring strength' },
      { key: 'centerStrength', label: 'Center Strength', type: 'number', min: 0, max: 1, step: 0.01, tooltip: 'Center gravity strength' }
    ], sectionsContainer);
    
    // Layout configuration section
    this._createSection('layout', 'Layout Configuration', [
      { key: 'linkDistance', label: 'Link Distance', type: 'number', min: 10, max: 500, step: 10, tooltip: 'Default distance between connected nodes' },
      { key: 'chargeDistance', label: 'Charge Distance', type: 'number', min: 100, max: 2000, step: 50, tooltip: 'Maximum distance for charge force' }
    ], sectionsContainer);
    
    // Collision settings section
    this._createSection('collision', 'Collision Settings', [
      { key: 'collisionRadius', label: 'Collision Radius', type: 'number', min: 0, max: 100, step: 1, tooltip: 'Node collision avoidance radius' },
      { key: 'collisionStrength', label: 'Collision Strength', type: 'number', min: 0, max: 2, step: 0.1, tooltip: 'Collision force strength' },
      { key: 'collisionIterations', label: 'Collision Iterations', type: 'number', min: 1, max: 10, step: 1, tooltip: 'Collision resolution iterations' }
    ], sectionsContainer);
    
    // Stabilization settings section
    this._createSection('stabilization', 'Stabilization', [
      { key: 'stabilizationEnabled', label: 'Enable Stabilization', type: 'checkbox', tooltip: 'Enable automatic stabilization detection' },
      { key: 'stabilizationThreshold', label: 'Energy Threshold', type: 'number', min: 0.001, max: 0.1, step: 0.001, tooltip: 'Energy threshold for stabilization' },
      { key: 'stabilizationCheckInterval', label: 'Check Interval', type: 'number', min: 1, max: 50, step: 1, tooltip: 'Check stabilization every N iterations' },
      { key: 'stabilizationMinIterations', label: 'Min Iterations', type: 'number', min: 10, max: 200, step: 10, tooltip: 'Minimum iterations before checking' },
      { key: 'stabilizationMaxIterations', label: 'Max Iterations', type: 'number', min: 100, max: 5000, step: 100, tooltip: 'Maximum iterations' }
    ], sectionsContainer);
  }
  
  /**
   * Create a parameter section
   */
  _createSection(sectionKey, title, parameters, container) {
    const section = document.createElement('div');
    section.className = 'force-parameters-section';
    section.innerHTML = `
      <div class="force-parameters-section__header">
        <h4 class="force-parameters-section__title">${title}</h4>
        <button class="force-parameters-section__toggle" type="button">▼</button>
      </div>
      <div class="force-parameters-section__content">
        ${parameters.map(param => this._createParameterControl(param)).join('')}
      </div>
    `;
    
    this.sections.set(sectionKey, section);
    container.appendChild(section);
    
    // Add section toggle functionality
    const toggle = section.querySelector('.force-parameters-section__toggle');
    const content = section.querySelector('.force-parameters-section__content');
    
    toggle.addEventListener('click', () => {
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'block' : 'none';
      toggle.textContent = isCollapsed ? '▼' : '▶';
    });
    
    // Add control event listeners
    parameters.forEach(param => {
      const control = section.querySelector(`[data-param="${param.key}"]`);
      if (control) {
        this.controls.set(param.key, control);
        
        if (param.type === 'checkbox') {
          control.addEventListener('change', () => {
            this.currentValues[param.key] = control.checked;
            this._onParameterChange(param.key, control.checked);
          });
        } else {
          control.addEventListener('input', () => {
            const value = parseFloat(control.value);
            this.currentValues[param.key] = value;
            this._onParameterChange(param.key, value);
          });
        }
      }
    });
  }
  
  /**
   * Create HTML for a parameter control
   */
  _createParameterControl(param) {
    const value = this.currentValues[param.key];
    
    if (param.type === 'checkbox') {
      return `
        <div class="force-parameter-control">
          <label class="force-parameter-control__label">
            <input 
              type="checkbox" 
              data-param="${param.key}"
              ${value ? 'checked' : ''}
              class="force-parameter-control__checkbox"
            />
            <span class="force-parameter-control__text">${param.label}</span>
          </label>
          ${param.tooltip ? `<div class="force-parameter-control__tooltip">${param.tooltip}</div>` : ''}
        </div>
      `;
    } else {
      return `
        <div class="force-parameter-control">
          <label class="force-parameter-control__label">
            <span class="force-parameter-control__text">${param.label}</span>
            <input 
              type="number" 
              data-param="${param.key}"
              value="${value}"
              min="${param.min}"
              max="${param.max}"
              step="${param.step}"
              class="force-parameter-control__input"
            />
          </label>
          ${param.tooltip ? `<div class="force-parameter-control__tooltip">${param.tooltip}</div>` : ''}
        </div>
      `;
    }
  }
  
  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    // Panel toggle
    const toggle = this.element.querySelector('.force-parameters-panel__toggle');
    const content = this.element.querySelector('.force-parameters-panel__content');
    
    toggle.addEventListener('click', () => {
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'block' : 'none';
      toggle.querySelector('.force-parameters-panel__toggle-icon').textContent = isCollapsed ? '▼' : '▶';
    });
    
    // Reset button
    const resetButton = this.element.querySelector('.force-parameters-panel__reset');
    resetButton.addEventListener('click', () => {
      this.resetToDefaults();
    });
    
    // Apply button
    const applyButton = this.element.querySelector('.force-parameters-panel__apply');
    applyButton.addEventListener('click', () => {
      this.config.onParameterChange('apply', this.currentValues);
    });
  }
  
  /**
   * Handle parameter change
   */
  _onParameterChange(key, value) {
    this.config.onParameterChange(key, value, this.currentValues);
  }
  
  /**
   * Reset all parameters to defaults
   */
  resetToDefaults() {
    const defaults = this._getDefaultValues();
    this.currentValues = { ...defaults };
    
    // Update UI controls
    this.controls.forEach((control, key) => {
      if (control.type === 'checkbox') {
        control.checked = defaults[key];
      } else {
        control.value = defaults[key];
      }
    });
    
    this.config.onParameterChange('reset', this.currentValues);
  }
  
  /**
   * Update parameter values
   */
  updateValues(newValues) {
    Object.assign(this.currentValues, newValues);
    
    // Update UI controls
    this.controls.forEach((control, key) => {
      if (newValues.hasOwnProperty(key)) {
        if (control.type === 'checkbox') {
          control.checked = newValues[key];
        } else {
          control.value = newValues[key];
        }
      }
    });
  }
  
  /**
   * Get current parameter values
   */
  getValues() {
    return { ...this.currentValues };
  }
  
  /**
   * Convert UI values to ForceDirectedLayout config format
   */
  toForceDirectedConfig() {
    const values = this.currentValues;
    
    return {
      alphaMin: values.alphaMin,
      alphaDecay: values.alphaDecay,
      alphaTarget: values.alphaTarget,
      velocityDecay: values.velocityDecay,
      
      forces: {
        charge: values.chargeStrength,
        link: values.linkStrength,
        center: values.centerStrength,
        collide: values.collisionRadius
      },
      
      linkDistance: values.linkDistance,
      linkStrength: values.linkStrength,
      chargeDistance: values.chargeDistance,
      chargeStrength: values.chargeStrength,
      
      collisionRadius: values.collisionRadius,
      collisionStrength: values.collisionStrength,
      collisionIterations: values.collisionIterations,
      
      stabilization: {
        enabled: values.stabilizationEnabled,
        threshold: values.stabilizationThreshold,
        checkInterval: values.stabilizationCheckInterval,
        minIterations: values.stabilizationMinIterations,
        maxIterations: values.stabilizationMaxIterations
      }
    };
  }
  
  /**
   * Add CSS styles
   */
  _addStyles() {
    if (document.getElementById('force-parameters-panel-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'force-parameters-panel-styles';
    style.textContent = `
      .force-parameters-panel {
        --panel-bg: #ffffff;
        --panel-border: #e0e0e0;
        --text-primary: #333333;
        --text-secondary: #666666;
        --input-bg: #ffffff;
        --input-border: #cccccc;
        --button-bg: #f5f5f5;
        --button-hover: #e8e8e8;
        --section-bg: #f9f9f9;
        
        width: 320px;
        background: var(--panel-bg);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: var(--text-primary);
      }
      
      .force-parameters-panel--dark {
        --panel-bg: #2d2d2d;
        --panel-border: #444444;
        --text-primary: #ffffff;
        --text-secondary: #cccccc;
        --input-bg: #3d3d3d;
        --input-border: #555555;
        --button-bg: #404040;
        --button-hover: #4a4a4a;
        --section-bg: #353535;
      }
      
      .force-parameters-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--panel-border);
        background: var(--section-bg);
        border-radius: 8px 8px 0 0;
      }
      
      .force-parameters-panel__title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .force-parameters-panel__toggle {
        background: none;
        border: none;
        font-size: 14px;
        cursor: pointer;
        padding: 4px;
        color: var(--text-secondary);
      }
      
      .force-parameters-panel__content {
        padding: 16px;
      }
      
      .force-parameters-section {
        margin-bottom: 16px;
      }
      
      .force-parameters-section:last-child {
        margin-bottom: 0;
      }
      
      .force-parameters-section__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--section-bg);
        border-radius: 4px;
        cursor: pointer;
      }
      
      .force-parameters-section__title {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
      }
      
      .force-parameters-section__toggle {
        background: none;
        border: none;
        font-size: 12px;
        cursor: pointer;
        padding: 2px;
        color: var(--text-secondary);
      }
      
      .force-parameters-section__content {
        padding: 12px 0 0 0;
      }
      
      .force-parameter-control {
        margin-bottom: 12px;
      }
      
      .force-parameter-control:last-child {
        margin-bottom: 0;
      }
      
      .force-parameter-control__label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
      }
      
      .force-parameter-control__text {
        flex: 1;
        font-size: 13px;
        color: var(--text-primary);
      }
      
      .force-parameter-control__input {
        width: 80px;
        padding: 4px 8px;
        border: 1px solid var(--input-border);
        border-radius: 4px;
        background: var(--input-bg);
        color: var(--text-primary);
        font-size: 13px;
      }
      
      .force-parameter-control__checkbox {
        margin: 0;
      }
      
      .force-parameter-control__tooltip {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 4px;
        padding-left: 12px;
        line-height: 1.3;
      }
      
      .force-parameters-panel__actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--panel-border);
      }
      
      .force-parameters-panel__reset,
      .force-parameters-panel__apply {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--input-border);
        border-radius: 4px;
        background: var(--button-bg);
        color: var(--text-primary);
        font-size: 13px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .force-parameters-panel__reset:hover,
      .force-parameters-panel__apply:hover {
        background: var(--button-hover);
      }
      
      .force-parameters-panel__apply {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }
      
      .force-parameters-panel__apply:hover {
        background: #0056b3;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Destroy the panel
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.controls.clear();
    this.sections.clear();
  }
}

export default ForceParametersPanel;