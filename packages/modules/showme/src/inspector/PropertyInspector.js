/**
 * PropertyInspector
 * 
 * Property inspection and editing panel for diagram elements
 * Provides dynamic property editors with validation and binding support
 */

import { PropertyBinding } from './PropertyBinding.js';

export class PropertyInspector {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.body,
      width: config.width || 250,
      collapsible: config.collapsible !== false,
      position: config.position || 'right',
      groupProperties: config.groupProperties !== false,
      enableSearch: config.enableSearch !== false,
      ...config
    };

    this.selection = null;
    this.properties = {};
    this.bindings = new Map();
    this.validators = new Map();
    this.templates = new Map();
    this.listeners = new Map();
    this.visible = false;
    this.collapsed = false;
    this.searchFilter = '';
    
    // Undo/redo tracking
    this.undoTracking = false;
    this.undoHistory = [];
    this.redoHistory = [];
    
    this.initializeDOM();
    this.attachEventListeners();
  }

  /**
   * Initialize DOM structure
   * @private
   */
  initializeDOM() {
    // Create main panel
    this.panel = document.createElement('div');
    this.panel.className = `property-inspector position-${this.config.position}`;
    this.panel.style.width = `${this.config.width}px`;
    this.panel.style.display = 'none';
    
    // Create header
    this.header = document.createElement('div');
    this.header.className = 'property-inspector-header';
    this.header.innerHTML = `
      <span class="property-inspector-title">Properties</span>
      ${this.config.collapsible ? '<button class="property-inspector-collapse">▼</button>' : ''}
    `;
    
    // Create search bar if enabled
    if (this.config.enableSearch) {
      this.searchBar = document.createElement('div');
      this.searchBar.className = 'property-inspector-search';
      this.searchBar.innerHTML = `
        <input type="text" placeholder="Search properties..." class="property-search-input">
      `;
      this.header.appendChild(this.searchBar);
    }
    
    // Create content area
    this.content = document.createElement('div');
    this.content.className = 'property-inspector-content';
    
    // Assemble panel
    this.panel.appendChild(this.header);
    this.panel.appendChild(this.content);
    
    // Add to container
    if (typeof this.config.container === 'string') {
      this.config.container = document.querySelector(this.config.container);
    }
    this.config.container.appendChild(this.panel);
    
    // Add styles
    this.injectStyles();
  }

  /**
   * Inject CSS styles
   * @private
   */
  injectStyles() {
    if (document.getElementById('property-inspector-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'property-inspector-styles';
    style.textContent = `
      .property-inspector {
        position: absolute;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
      }
      
      .property-inspector.position-right {
        right: 10px;
        top: 10px;
        bottom: 10px;
      }
      
      .property-inspector.position-left {
        left: 10px;
        top: 10px;
        bottom: 10px;
      }
      
      .property-inspector-header {
        padding: 10px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .property-inspector-title {
        font-weight: 600;
        color: #333;
      }
      
      .property-inspector-collapse {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 6px;
        color: #666;
      }
      
      .property-inspector-search {
        margin-top: 8px;
        width: 100%;
      }
      
      .property-search-input {
        width: 100%;
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 3px;
        font-size: 11px;
      }
      
      .property-inspector-content {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }
      
      .property-inspector.collapsed .property-inspector-content {
        display: none;
      }
      
      .property-group {
        margin-bottom: 15px;
      }
      
      .property-group-title {
        font-weight: 600;
        color: #666;
        margin-bottom: 6px;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.5px;
      }
      
      .property-row {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .property-row.hidden {
        display: none;
      }
      
      .property-label {
        flex: 0 0 40%;
        color: #666;
        padding-right: 8px;
      }
      
      .property-value {
        flex: 1;
      }
      
      .property-value input,
      .property-value select {
        width: 100%;
        padding: 3px 6px;
        border: 1px solid #ddd;
        border-radius: 3px;
        font-size: 11px;
      }
      
      .property-value input[type="checkbox"] {
        width: auto;
      }
      
      .property-value input[type="color"] {
        padding: 1px;
        height: 24px;
      }
      
      .property-value input[type="range"] {
        padding: 0;
      }
      
      .property-error {
        color: #e74c3c;
        font-size: 10px;
        margin-top: 2px;
      }
      
      .property-multi-value {
        color: #999;
        font-style: italic;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   * @private
   */
  attachEventListeners() {
    // Collapse/expand
    if (this.config.collapsible) {
      const collapseBtn = this.panel.querySelector('.property-inspector-collapse');
      collapseBtn.addEventListener('click', () => this.toggleCollapse());
    }
    
    // Search
    if (this.config.enableSearch) {
      const searchInput = this.panel.querySelector('.property-search-input');
      searchInput.addEventListener('input', (e) => this.setSearchFilter(e.target.value));
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Select single element
   */
  selectElement(element) {
    const previousSelection = this.selection;
    this.selection = element;
    this.properties = element ? { ...element.properties } : {};
    
    this.updateDisplay();
    this.show();
    
    this.emit('selectionChanged', {
      selection: this.selection,
      previousSelection
    });
  }

  /**
   * Select multiple elements
   */
  selectElements(elements) {
    const previousSelection = this.selection;
    this.selection = elements;
    
    // Find common properties
    if (elements && elements.length > 0) {
      this.properties = this.findCommonProperties(elements);
    } else {
      this.properties = {};
    }
    
    this.updateDisplay();
    this.show();
    
    this.emit('selectionChanged', {
      selection: this.selection,
      previousSelection
    });
  }

  /**
   * Find common properties among elements
   * @private
   */
  findCommonProperties(elements) {
    if (elements.length === 0) return {};
    
    const common = {};
    const first = elements[0];
    
    // Check type consistency
    const sameType = elements.every(el => el.type === first.type);
    if (sameType) {
      common.type = first.type;
    }
    
    // Find properties that exist in all elements
    for (const prop in first.properties) {
      const exists = elements.every(el => prop in el.properties);
      if (exists) {
        const values = elements.map(el => el.properties[prop]);
        const sameValue = values.every(v => v === values[0]);
        
        if (sameValue) {
          common[prop] = values[0];
        } else {
          common[prop] = '(Multiple values)';
        }
      }
    }
    
    return common;
  }

  /**
   * Clear selection
   */
  clearSelection() {
    const previousSelection = this.selection;
    this.selection = null;
    this.properties = {};
    
    this.updateDisplay();
    this.hide();
    
    this.emit('selectionChanged', {
      selection: null,
      previousSelection
    });
  }

  /**
   * Get current selection
   */
  getSelection() {
    return this.selection;
  }

  /**
   * Get selection count
   */
  getSelectionCount() {
    if (!this.selection) return 0;
    return Array.isArray(this.selection) ? this.selection.length : 1;
  }

  /**
   * Get properties
   */
  getProperties() {
    return { ...this.properties };
  }

  /**
   * Get common properties for multi-selection
   */
  getCommonProperties() {
    if (!Array.isArray(this.selection)) return this.properties;
    return this.findCommonProperties(this.selection);
  }

  /**
   * Update display
   * @private
   */
  updateDisplay() {
    this.content.innerHTML = '';
    
    if (!this.selection) return;
    
    const groups = this.config.groupProperties ? 
      this.groupProperties(this.properties) : 
      { 'Properties': this.properties };
    
    for (const [groupName, props] of Object.entries(groups)) {
      const groupEl = this.createPropertyGroup(groupName, props);
      this.content.appendChild(groupEl);
    }
  }

  /**
   * Group properties by category
   * @private
   */
  groupProperties(properties) {
    const groups = {
      'Position': {},
      'Dimensions': {},
      'Style': {},
      'Other': {}
    };
    
    for (const [key, value] of Object.entries(properties)) {
      if (['x', 'y', 'z'].includes(key)) {
        groups.Position[key] = value;
      } else if (['width', 'height', 'depth', 'radius'].includes(key)) {
        groups.Dimensions[key] = value;
      } else if (['color', 'backgroundColor', 'borderColor', 'borderWidth', 'opacity', 'fontSize', 'fontFamily'].includes(key)) {
        groups.Style[key] = value;
      } else {
        groups.Other[key] = value;
      }
    }
    
    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, props]) => Object.keys(props).length > 0)
    );
  }

  /**
   * Create property group element
   * @private
   */
  createPropertyGroup(name, properties) {
    const group = document.createElement('div');
    group.className = 'property-group';
    group.setAttribute('data-group', name.toLowerCase());
    
    if (name !== 'Properties') {
      const title = document.createElement('div');
      title.className = 'property-group-title';
      title.textContent = name;
      group.appendChild(title);
    }
    
    for (const [key, value] of Object.entries(properties)) {
      const row = this.createPropertyRow(key, value);
      group.appendChild(row);
    }
    
    return group;
  }

  /**
   * Create property row element
   * @private
   */
  createPropertyRow(key, value) {
    const row = document.createElement('div');
    row.className = 'property-row';
    
    // Apply search filter
    if (this.searchFilter && !key.toLowerCase().includes(this.searchFilter.toLowerCase())) {
      row.classList.add('hidden');
    }
    
    const label = document.createElement('div');
    label.className = 'property-label';
    label.textContent = this.formatPropertyName(key);
    
    const valueContainer = document.createElement('div');
    valueContainer.className = 'property-value';
    
    const editor = this.createPropertyEditor(key, value);
    valueContainer.appendChild(editor);
    
    row.appendChild(label);
    row.appendChild(valueContainer);
    
    return row;
  }

  /**
   * Format property name for display
   * @private
   */
  formatPropertyName(name) {
    // Convert camelCase to Title Case
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }

  /**
   * Create property editor based on value type
   * @private
   */
  createPropertyEditor(key, value) {
    // Check for custom template
    if (this.templates.has(key)) {
      return this.createCustomEditor(key, value);
    }
    
    // Check for multiple values
    if (value === '(Multiple values)') {
      const span = document.createElement('span');
      span.className = 'property-multi-value';
      span.textContent = value;
      return span;
    }
    
    // Determine editor type based on value
    const type = this.getEditorType(key, value);
    
    switch (type) {
      case 'checkbox':
        return this.createCheckboxEditor(key, value);
      case 'color':
        return this.createColorEditor(key, value);
      case 'number':
        return this.createNumberEditor(key, value);
      case 'range':
        return this.createRangeEditor(key, value);
      case 'select':
        return this.createSelectEditor(key, value);
      default:
        return this.createTextEditor(key, value);
    }
  }

  /**
   * Determine editor type for property
   * @private
   */
  getEditorType(key, value) {
    if (typeof value === 'boolean') return 'checkbox';
    if (key.toLowerCase().includes('color') && typeof value === 'string') return 'color';
    if (typeof value === 'number') {
      if (key === 'opacity' || key === 'alpha') return 'range';
      return 'number';
    }
    return 'text';
  }

  /**
   * Create text editor
   * @private
   */
  createTextEditor(key, value) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.setAttribute('data-property', key);
    
    input.addEventListener('input', (e) => this.handlePropertyChange(key, e.target.value));
    
    return input;
  }

  /**
   * Create number editor
   * @private
   */
  createNumberEditor(key, value) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value || 0;
    input.setAttribute('data-property', key);
    
    input.addEventListener('input', (e) => {
      const numValue = parseFloat(e.target.value);
      if (!isNaN(numValue)) {
        this.handlePropertyChange(key, numValue);
      }
    });
    
    return input;
  }

  /**
   * Create checkbox editor
   * @private
   */
  createCheckboxEditor(key, value) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value || false;
    input.setAttribute('data-property', key);
    
    input.addEventListener('change', (e) => this.handlePropertyChange(key, e.target.checked));
    
    return input;
  }

  /**
   * Create color editor
   * @private
   */
  createColorEditor(key, value) {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = value || '#000000';
    input.setAttribute('data-property', key);
    
    input.addEventListener('input', (e) => this.handlePropertyChange(key, e.target.value));
    
    return input;
  }

  /**
   * Create range editor
   * @private
   */
  createRangeEditor(key, value) {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = value || 0;
    input.setAttribute('data-property', key);
    
    input.addEventListener('input', (e) => {
      const numValue = parseFloat(e.target.value);
      this.handlePropertyChange(key, numValue);
    });
    
    return input;
  }

  /**
   * Create select editor
   * @private
   */
  createSelectEditor(key, value, options) {
    const select = document.createElement('select');
    select.setAttribute('data-property', key);
    
    for (const option of options) {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      if (option === value) {
        optionEl.selected = true;
      }
      select.appendChild(optionEl);
    }
    
    select.addEventListener('change', (e) => this.handlePropertyChange(key, e.target.value));
    
    return select;
  }

  /**
   * Create custom editor from template
   * @private
   */
  createCustomEditor(key, value) {
    const template = this.templates.get(key);
    
    if (template.type === 'select') {
      return this.createSelectEditor(key, value, template.options);
    }
    
    // Default to text editor
    return this.createTextEditor(key, value);
  }

  /**
   * Handle property change
   * @private
   */
  handlePropertyChange(key, newValue) {
    const oldValue = this.properties[key];
    
    // Validate
    if (this.validators.has(key)) {
      const validation = this.validators.get(key)(newValue);
      if (!validation.valid) {
        this.showError(key, validation.error);
        return;
      }
    }
    
    this.clearError(key);
    
    // Track for undo if enabled
    if (this.undoTracking) {
      this.undoHistory.push({
        property: key,
        oldValue,
        newValue,
        timestamp: Date.now()
      });
      this.redoHistory = []; // Clear redo on new change
    }
    
    // Update property
    this.properties[key] = newValue;
    
    // Update actual element(s)
    if (Array.isArray(this.selection)) {
      for (const element of this.selection) {
        element.properties[key] = newValue;
      }
    } else if (this.selection) {
      this.selection.properties[key] = newValue;
    }
    
    // Emit change event
    this.emit('propertyChanged', {
      element: this.selection,
      property: key,
      oldValue,
      newValue
    });
  }

  /**
   * Show validation error
   * @private
   */
  showError(key, message) {
    // Remove existing error
    this.clearError(key);
    
    const input = this.panel.querySelector(`[data-property="${key}"]`);
    if (!input) return;
    
    const error = document.createElement('div');
    error.className = 'property-error';
    error.setAttribute('data-property', key);
    error.textContent = message;
    
    input.parentElement.appendChild(error);
  }

  /**
   * Clear validation error
   * @private
   */
  clearError(key) {
    const error = this.panel.querySelector(`.property-error[data-property="${key}"]`);
    if (error) {
      error.remove();
    }
  }

  /**
   * Get property value
   */
  getPropertyValue(key) {
    return this.properties[key];
  }

  /**
   * Set property value
   */
  setPropertyValue(key, value) {
    this.handlePropertyChange(key, value);
  }

  /**
   * Update multiple properties
   */
  updateProperties(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this.setPropertyValue(key, value);
    }
  }

  /**
   * Register property validator
   */
  registerValidator(property, validator) {
    this.validators.set(property, validator);
  }

  /**
   * Register property template
   */
  registerPropertyTemplate(property, template) {
    this.templates.set(property, template);
  }

  /**
   * Create property binding
   */
  createBinding(source, sourceProperty, target, targetProperty, options = {}) {
    const binding = new PropertyBinding(source, sourceProperty, target, targetProperty, options);
    this.bindings.set(binding.getId(), binding);
    return binding;
  }

  /**
   * Create two-way binding
   */
  createTwoWayBinding(obj1, prop1, obj2, prop2) {
    return this.createBinding(obj1, prop1, obj2, prop2, { 
      twoWay: true 
    });
  }

  /**
   * Update all bindings
   */
  updateAllBindings() {
    for (const binding of this.bindings.values()) {
      binding.update();
    }
  }

  /**
   * Remove binding
   */
  removeBinding(binding) {
    if (typeof binding === 'string') {
      const b = this.bindings.get(binding);
      if (b) {
        b.destroy();
        this.bindings.delete(binding);
      }
    } else if (binding) {
      binding.destroy();
      this.bindings.delete(binding.getId());
    }
  }

  /**
   * Get all bindings
   */
  getAllBindings() {
    return Array.from(this.bindings.values());
  }

  /**
   * Show inspector
   */
  show() {
    this.visible = true;
    this.panel.style.display = 'flex';
  }

  /**
   * Hide inspector
   */
  hide() {
    this.visible = false;
    this.panel.style.display = 'none';
  }

  /**
   * Toggle visibility
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if visible
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Toggle collapse state
   */
  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.panel.classList.toggle('collapsed', this.collapsed);
    
    const btn = this.panel.querySelector('.property-inspector-collapse');
    if (btn) {
      btn.textContent = this.collapsed ? '▶' : '▼';
    }
    
    return this.collapsed;
  }

  /**
   * Check if collapsed
   */
  isCollapsed() {
    return this.collapsed;
  }

  /**
   * Set search filter
   */
  setSearchFilter(term) {
    this.searchFilter = term;
    
    const rows = this.panel.querySelectorAll('.property-row');
    rows.forEach(row => {
      const property = row.querySelector('[data-property]');
      if (property) {
        const name = property.getAttribute('data-property');
        const matches = name.toLowerCase().includes(term.toLowerCase());
        row.classList.toggle('hidden', !matches);
      }
    });
  }

  /**
   * Clear search filter
   */
  clearSearchFilter() {
    this.searchFilter = '';
    const rows = this.panel.querySelectorAll('.property-row');
    rows.forEach(row => row.classList.remove('hidden'));
    
    const searchInput = this.panel.querySelector('.property-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
  }

  /**
   * Enable undo tracking
   */
  enableUndoTracking(enabled) {
    this.undoTracking = enabled;
    if (!enabled) {
      this.undoHistory = [];
      this.redoHistory = [];
    }
  }

  /**
   * Get undo history
   */
  getUndoHistory() {
    return [...this.undoHistory];
  }

  /**
   * Undo last change
   */
  undo() {
    if (this.undoHistory.length === 0) return;
    
    const change = this.undoHistory.pop();
    this.redoHistory.push(change);
    
    // Apply undo without triggering new undo history
    const wasTracking = this.undoTracking;
    this.undoTracking = false;
    this.setPropertyValue(change.property, change.oldValue);
    this.undoTracking = wasTracking;
  }

  /**
   * Redo last undone change
   */
  redo() {
    if (this.redoHistory.length === 0) return;
    
    const change = this.redoHistory.pop();
    this.undoHistory.push(change);
    
    // Apply redo without triggering new undo history
    const wasTracking = this.undoTracking;
    this.undoTracking = false;
    this.setPropertyValue(change.property, change.newValue);
    this.undoTracking = wasTracking;
  }

  /**
   * Add event listener
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   * @private
   */
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in PropertyInspector event handler:`, error);
        }
      }
    }
  }

  /**
   * Destroy inspector
   */
  destroy() {
    // Clear selection
    this.selection = null;
    this.properties = {};
    
    // Clear bindings
    for (const binding of this.bindings.values()) {
      binding.destroy();
    }
    this.bindings.clear();
    
    // Clear other data
    this.validators.clear();
    this.templates.clear();
    this.listeners.clear();
    this.undoHistory = [];
    this.redoHistory = [];
    
    // Remove DOM
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }
}