/**
 * ComponentEditorViewModel - Coordinates Model and View layers
 * Phase 5.2 / Phase 6.4
 *
 * Handles event binding, data flow, and synchronization between Model and View
 */

import { PreviewManager } from '../preview/PreviewManager.js';

export class ComponentEditorViewModel {
  constructor({ model, view, dataStore = null, previewManager = null }) {
    this.model = model;
    this.view = view;
    this.dataStore = dataStore;

    // Preview manager (allow injection for testing)
    if (previewManager) {
      this.previewManager = previewManager;
    } else if (dataStore) {
      this.previewManager = new PreviewManager(dataStore);
    } else {
      this.previewManager = null;
    }

    // Preview update timeout
    this.previewTimeout = undefined;

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup all event handlers connecting View to Model
   */
  setupEventHandlers() {
    // Save button
    this.view.onSaveClick(() => this.handleSave());

    // Test button
    this.view.onTestClick(() => this.handleTest());

    // Format selector
    this.view.onFormatChange((e) => this.handleFormatChange(e.target.value));

    // Editor changes
    this.view.onEditorChange('dsl', () => this.handleDSLChange());
    this.view.onEditorChange('cnl', () => this.handleCNLChange());
    this.view.onEditorChange('json', () => this.handleJSONChange());

    // Component selection
    this.view.onComponentSelect((id) => this.loadComponent(id));

    // Filter events (Phase 8.3)
    this._setupFilterHandlers();
  }

  /**
   * Setup filter event handlers
   * Phase 8.3
   * @private
   */
  _setupFilterHandlers() {
    // Name filter
    const nameInput = this.view.container.querySelector('.filter-input');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.handleNameFilter(e.target.value);
      });
    }

    // Tag filter
    const tagSelect = this.view.container.querySelector('.filter-tag');
    if (tagSelect) {
      tagSelect.addEventListener('change', (e) => {
        this.handleTagFilter(e.target.value);
      });
    }

    // Author filter
    const authorSelect = this.view.container.querySelector('.filter-author');
    if (authorSelect) {
      authorSelect.addEventListener('change', (e) => {
        this.handleAuthorFilter(e.target.value);
      });
    }
  }

  /**
   * Load component into editor
   */
  async loadComponent(componentId) {
    await this.model.loadComponent(componentId);

    // Update view with component content
    this.view.setEditorContent('dsl', this.model.dslContent);
    this.view.setEditorContent('cnl', this.model.cnlContent);
    this.view.setEditorContent('json', JSON.stringify(this.model.jsonContent, null, 2));
  }

  /**
   * Load component list for browser
   * Phase 8.3 - Component Browser Filtering
   */
  async loadComponentList() {
    const components = await this.model.loadComponentList();
    this.view.renderComponentList(components);
    return components;
  }

  /**
   * Handle name filter change
   * Phase 8.3
   */
  async handleNameFilter(name) {
    const filtered = this.model.filterComponentsByName(name);
    this.view.renderComponentList(filtered);
  }

  /**
   * Handle tag filter change
   * Phase 8.3
   */
  async handleTagFilter(tag) {
    const filtered = this.model.filterComponentsByTag(tag);
    this.view.renderComponentList(filtered);
  }

  /**
   * Handle author filter change
   * Phase 8.3
   */
  async handleAuthorFilter(author) {
    const filtered = this.model.filterComponentsByAuthor(author);
    this.view.renderComponentList(filtered);
  }

  /**
   * Handle Save button click
   */
  async handleSave() {
    try {
      const component = await this.model.saveComponent();
      console.log('Component saved:', component.id);
      return component;
    } catch (error) {
      console.error('Save failed:', error.message);
      throw error;
    }
  }

  /**
   * Handle Test button click
   * Phase 7.5
   */
  async handleTest() {
    try {
      const results = await this.model.runTests();
      this.view.showTestResults(results);
      return results;
    } catch (error) {
      console.error('Test execution failed:', error.message);
      // Show error in test results
      this.view.showTestResults({
        total: 0,
        passed: 0,
        failed: 0,
        tests: [],
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle format selector change
   */
  handleFormatChange(format) {
    this.model.activeFormat = format;
    // Show/hide appropriate editor tabs will be implemented later
  }

  /**
   * Handle DSL editor changes
   */
  handleDSLChange() {
    // Read content from view
    this.model.dslContent = this.view.getEditorContent('dsl');
    this.model.isDirty = true;

    // Auto-convert to other formats
    this.model.convertDSLtoCNL();
    this.model.convertToJSON();

    // Update other editors
    this.view.setEditorContent('cnl', this.model.cnlContent);
    this.view.setEditorContent('json', JSON.stringify(this.model.jsonContent, null, 2));

    // Validate
    this.model.validate();
    this.view.showValidationErrors(this.model.validationErrors);

    // Update preview (debounced)
    this.debouncePreviewUpdate();
  }

  /**
   * Handle CNL editor changes
   */
  handleCNLChange() {
    // Read content from view
    this.model.cnlContent = this.view.getEditorContent('cnl');
    this.model.isDirty = true;

    // Auto-convert to DSL and JSON
    this.model.convertCNLtoDSL();
    this.model.convertToJSON();

    // Update other editors
    this.view.setEditorContent('dsl', this.model.dslContent);
    this.view.setEditorContent('json', JSON.stringify(this.model.jsonContent, null, 2));

    // Validate
    this.model.validate();
    this.view.showValidationErrors(this.model.validationErrors);

    // Update preview (debounced)
    this.debouncePreviewUpdate();
  }

  /**
   * Handle JSON editor changes
   */
  handleJSONChange() {
    try {
      // Read and parse JSON content from view
      const jsonText = this.view.getEditorContent('json');
      this.model.jsonContent = JSON.parse(jsonText);
      this.model.isDirty = true;

      // Update preview (debounced)
      this.debouncePreviewUpdate();
    } catch (error) {
      // Invalid JSON - don't update model
      console.error('Invalid JSON:', error.message);
    }
  }

  /**
   * Debounce preview update to avoid rapid re-renders
   */
  debouncePreviewUpdate() {
    clearTimeout(this.previewTimeout);
    this.previewTimeout = setTimeout(() => {
      this.updatePreview();
    }, 500);
  }

  /**
   * Update preview with current component
   * Phase 6.4
   */
  async updatePreview() {
    if (!this.previewManager) {
      // No preview manager - preview disabled
      return;
    }

    // Get preview container from view
    const container = this.view.container.querySelector('.preview-container');
    if (!container) {
      console.error('Preview container not found');
      return;
    }

    // Get current DSL and sample data
    const dsl = this.model.dslContent;
    const sampleData = this.model.dataModelContent?.sampleData || {};

    // Render preview
    await this.previewManager.renderPreview(dsl, sampleData, container);
  }

  /**
   * Update sample data in preview
   * Phase 6.4
   */
  async updateSampleData(newData) {
    if (!this.previewManager) {
      return;
    }

    await this.previewManager.updateSampleData(newData);
  }

  /**
   * Destroy ViewModel and cleanup
   */
  destroy() {
    clearTimeout(this.previewTimeout);

    if (this.previewManager) {
      this.previewManager.destroy();
    }
  }
}
