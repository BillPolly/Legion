/**
 * ComponentEditorModel - Business logic for component editing
 * Phase 3.2
 *
 * Manages component editing state, format conversions, validation, and persistence
 */

import { ComponentTestRunner } from '../testing/ComponentTestRunner.js';

export class ComponentEditorModel {
  constructor({ componentStore, backend, testRunner = null }) {
    this.componentStore = componentStore;  // ComponentLibraryHandle
    this.backend = backend;                // Backend Actor (optional)
    this.testRunner = testRunner;          // For testing (optional)

    // Current state
    this.currentComponent = null;          // Loaded component
    this.isDirty = false;                  // Unsaved changes flag
    this.validationErrors = [];            // Validation error messages

    // Component browser state
    this.componentList = [];               // Loaded component list for filtering

    // Editing state
    this.activeFormat = 'dsl';             // Active editor: 'dsl'|'cnl'|'json'|'dataModel'
    this.dslContent = '';
    this.cnlContent = '';
    this.jsonContent = {};
    this.dataModelContent = {};
    this.testsContent = [];                // Component tests
  }

  /**
   * Load component from store
   */
  async loadComponent(componentId) {
    const component = await this.componentStore.getComponent(componentId);

    if (!component) {
      throw new Error('Component not found');
    }

    this.currentComponent = component;

    // Populate editing content from loaded component
    this.dslContent = component.dsl || '';
    this.cnlContent = component.cnl || '';
    this.jsonContent = component.json || {};
    this.dataModelContent = component.dataModel || {};
    this.testsContent = component.tests || [];

    this.isDirty = false;
    this.validationErrors = [];

    return component;
  }

  /**
   * Save current component (create or update)
   */
  async saveComponent() {
    // Validate before saving
    if (!this.validate()) {
      throw new Error('Validation failed: ' + this.validationErrors.join(', '));
    }

    const componentData = {
      dsl: this.dslContent,
      cnl: this.cnlContent,
      json: this.jsonContent,
      dataModel: this.dataModelContent,
      tests: this.testsContent,
      modified: new Date().toISOString()
    };

    let saved;

    if (this.currentComponent && this.currentComponent.id) {
      // Update existing component
      saved = await this.componentStore.updateComponent(
        this.currentComponent.id,
        componentData
      );
    } else {
      // Create new component
      saved = await this.componentStore.createComponent(componentData);
    }

    this.currentComponent = saved;
    this.isDirty = false;

    return saved;
  }

  /**
   * Delete current component
   */
  async deleteComponent() {
    if (!this.currentComponent) {
      return false;
    }

    const result = await this.componentStore.deleteComponent(this.currentComponent.id);

    if (result) {
      this.currentComponent = null;
      this.isDirty = false;
      this.clearContent();
    }

    return result;
  }

  /**
   * Load component list from store
   * Phase 8.3 - Component Browser Filtering
   */
  async loadComponentList() {
    this.componentList = await this.componentStore.listComponents();
    return this.componentList;
  }

  /**
   * Filter components by name (case-insensitive)
   * Phase 8.3
   */
  filterComponentsByName(nameFilter) {
    if (!nameFilter || nameFilter.trim() === '') {
      return this.componentList;
    }

    const lowerFilter = nameFilter.toLowerCase();
    return this.componentList.filter(component =>
      component.name.toLowerCase().includes(lowerFilter)
    );
  }

  /**
   * Filter components by tag
   * Phase 8.3
   */
  filterComponentsByTag(tag) {
    if (!tag || tag.trim() === '') {
      return this.componentList;
    }

    return this.componentStore.byTag(tag);
  }

  /**
   * Filter components by author
   * Phase 8.3
   */
  filterComponentsByAuthor(author) {
    if (!author || author.trim() === '') {
      return this.componentList;
    }

    return this.componentStore.byAuthor(author);
  }

  /**
   * Mark model as dirty (unsaved changes)
   */
  markDirty() {
    this.isDirty = true;
  }

  /**
   * Clear all editing content
   * @private
   */
  clearContent() {
    this.dslContent = '';
    this.cnlContent = '';
    this.jsonContent = {};
    this.dataModelContent = {};
  }

  /**
   * Convert DSL to CNL
   */
  convertDSLtoCNL() {
    // Simple conversion for Phase 3 MVP
    // TODO: Use proper DSL→CNL converter in later phases
    this.cnlContent = this._dslToCNLSimple(this.dslContent);
    this.markDirty();
  }

  /**
   * Convert CNL to DSL
   */
  convertCNLtoDSL() {
    // Simple conversion for Phase 3 MVP
    // TODO: Use proper CNL→DSL converter in later phases
    this.dslContent = this._cnlToDSLSimple(this.cnlContent);
    this.markDirty();
  }

  /**
   * Convert DSL to JSON
   */
  convertToJSON() {
    // Simple conversion for Phase 3 MVP
    // TODO: Use proper parser in later phases
    this.jsonContent = this._parseToJSON(this.dslContent);
    this.markDirty();
  }

  /**
   * Validate current component data
   */
  validate() {
    this.validationErrors = [];

    // Validate DSL syntax
    if (this.dslContent) {
      const dslErrors = this._validateDSL(this.dslContent);
      this.validationErrors.push(...dslErrors);
    }

    // Validate data model
    if (!this.dataModelContent.entityName) {
      this.validationErrors.push('Data model: Entity name required');
    }

    return this.validationErrors.length === 0;
  }

  /**
   * Set active editing format
   */
  setActiveFormat(format) {
    if (['dsl', 'cnl', 'json', 'dataModel'].includes(format)) {
      this.activeFormat = format;
    } else {
      throw new Error(`Invalid format: ${format}`);
    }
  }

  /**
   * Run component tests using ComponentTestRunner
   * Phase 7.5
   */
  async runTests() {
    // If no tests defined, return empty results
    if (!this.testsContent || this.testsContent.length === 0) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
      };
    }

    // For MVP, we need a test runner with lifecycle
    // In production, this would use the actual ComponentLifecycle
    // For now, return mock results indicating tests need lifecycle
    if (!this.testRunner) {
      // Create a mock lifecycle for testing
      const mockLifecycle = {
        async mount(dsl, container, data) {
          // Simple mock rendering for testing
          // In real implementation, this would use ComponentLifecycle
          return {
            unmount: async () => {}
          };
        }
      };

      this.testRunner = new ComponentTestRunner(mockLifecycle);
    }

    // Run tests using the test runner
    const results = await this.testRunner.runTests(
      this.dslContent,
      this.testsContent
    );

    return results;
  }

  // Private helper methods

  /**
   * Simple DSL to CNL conversion (MVP)
   * @private
   */
  _dslToCNLSimple(dsl) {
    // Very basic conversion for MVP
    // Format: "ComponentName :: entity => element"
    // Converts to: "ComponentName with entity shows element"

    const match = dsl.match(/(\w+)\s*::\s*(\w+)\s*=>\s*(.+)/);
    if (match) {
      const [, name, entity, element] = match;
      return `${name} with ${entity} shows ${element}`;
    }
    return dsl;
  }

  /**
   * Simple CNL to DSL conversion (MVP)
   * @private
   */
  _cnlToDSLSimple(cnl) {
    // Very basic conversion for MVP
    // Format: "ComponentName with entity shows element"
    // Converts to: "ComponentName :: entity => element"

    const match = cnl.match(/(\w+)\s+with\s+(\w+)\s+shows\s+(.+)/);
    if (match) {
      const [, name, entity, element] = match;
      return `${name} :: ${entity} => ${element}`;
    }
    return cnl;
  }

  /**
   * Parse DSL to JSON (MVP)
   * @private
   */
  _parseToJSON(dsl) {
    // Very basic parsing for MVP
    try {
      const match = dsl.match(/(\w+)\s*::\s*(\w+)\s*=>\s*(\w+)/);
      if (match) {
        const [, name, entity, element] = match;
        return {
          name,
          entity,
          type: element,
          children: []
        };
      }
      return {};
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Validate DSL syntax (MVP)
   * @private
   */
  _validateDSL(dsl) {
    const errors = [];

    // Basic DSL validation - check for required structure
    if (!dsl.includes('::')) {
      errors.push('DSL: Missing :: separator');
    }

    if (!dsl.includes('=>')) {
      errors.push('DSL: Missing => arrow');
    }

    // Check for component name
    const nameMatch = dsl.match(/^(\w+)\s*::/);
    if (!nameMatch) {
      errors.push('DSL: Component name required before ::');
    }

    return errors;
  }
}
