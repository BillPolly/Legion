/**
 * Component Editor ViewModel
 * Implements MVVM pattern with Model and 3 bidirectional Views (DSL, CNL, JSON)
 */

import { CNLParser } from '../cnl/CNLParser.js';
import { DSLParser } from '../cnl/DSLParser.js';
import { JsonToDSLConverter } from '../cnl/JsonToDSLConverter.js';
import { JsonToCNLConverter } from '../cnl/JsonToCNLConverter.js';

export class ComponentEditorViewModel {
  constructor(options = {}) {
    this.parsers = {
      cnl: new CNLParser(),
      dsl: new DSLParser()
    };

    this.converters = {
      jsonToDSL: new JsonToDSLConverter(),
      jsonToCNL: new JsonToCNLConverter()
    };

    // MODEL: The central JSON component definition
    this._model = null;

    // VIEWS: Three editable text areas
    this.views = {
      dsl: null,
      cnl: null,
      json: null
    };

    // Sync flags to prevent infinite loops
    this._syncing = false;
  }

  /**
   * Initialize with DOM container
   */
  initialize(container) {
    // Create view elements
    this.views.dsl = this._createTextarea('dsl', 'Write DSL here...');
    this.views.cnl = this._createTextarea('cnl', 'Write CNL here...');
    this.views.json = this._createTextarea('json', 'Edit JSON component definition...');

    // Set up bidirectional bindings
    this._setupBindings();

    return this;
  }

  /**
   * Get the current model
   */
  get model() {
    return this._model;
  }

  /**
   * Set model and update all views
   */
  set model(newModel) {
    if (this._syncing) return;

    this._model = newModel;
    this._updateAllViews();
  }

  /**
   * Sync from DSL view to model and other views
   */
  async syncFromDSL() {
    if (this._syncing) return;

    try {
      this._syncing = true;

      const dslText = this.views.dsl.value;
      const ast = this.parsers.dsl.parse(dslText);

      this._model = ast;
      this._updateViewsExcept('dsl');

    } finally {
      this._syncing = false;
    }
  }

  /**
   * Sync from CNL view to model and other views
   */
  async syncFromCNL() {
    if (this._syncing) return;

    try {
      this._syncing = true;

      const cnlText = this.views.cnl.value;
      const json = this.parsers.cnl.parse(cnlText, { toJSON: true });

      this._model = json;
      this._updateViewsExcept('cnl');

    } finally {
      this._syncing = false;
    }
  }

  /**
   * Sync from JSON view to model and other views
   */
  async syncFromJSON() {
    if (this._syncing) return;

    try {
      this._syncing = true;

      const jsonText = this.views.json.value;
      const json = JSON.parse(jsonText);

      this._model = json;
      this._updateViewsExcept('json');

    } finally {
      this._syncing = false;
    }
  }

  /**
   * Update all views from current model
   */
  _updateAllViews() {
    if (!this._model || this._syncing) return;

    try {
      this._syncing = true;

      // Update JSON view
      this.views.json.value = JSON.stringify(this._model, null, 2);

      // Update DSL view (if we have JSON → DSL converter)
      try {
        const dsl = this.converters.jsonToDSL.convert(this._model);
        this.views.dsl.value = dsl;
      } catch (error) {
        console.warn('[ComponentEditorViewModel] Cannot convert JSON to DSL:', error);
      }

      // Update CNL view (if we have JSON → CNL converter)
      try {
        const cnl = this.converters.jsonToCNL.convert(this._model);
        this.views.cnl.value = cnl;
      } catch (error) {
        console.warn('[ComponentEditorViewModel] Cannot convert JSON to CNL:', error);
      }

    } finally {
      this._syncing = false;
    }
  }

  /**
   * Update views except the specified one
   */
  _updateViewsExcept(exceptView) {
    if (!this._model) return;

    // Update JSON view
    if (exceptView !== 'json') {
      this.views.json.value = JSON.stringify(this._model, null, 2);
    }

    // Update DSL view
    if (exceptView !== 'dsl') {
      try {
        const dsl = this.converters.jsonToDSL.convert(this._model);
        this.views.dsl.value = dsl;
      } catch (error) {
        console.warn('[ComponentEditorViewModel] Cannot convert JSON to DSL:', error);
      }
    }

    // Update CNL view
    if (exceptView !== 'cnl') {
      try {
        const cnl = this.converters.jsonToCNL.convert(this._model);
        this.views.cnl.value = cnl;
      } catch (error) {
        console.warn('[ComponentEditorViewModel] Cannot convert JSON to CNL:', error);
      }
    }
  }

  /**
   * Create a textarea element
   */
  _createTextarea(type, placeholder) {
    const textarea = document.createElement('textarea');
    textarea.className = `component-editor-${type}`;
    textarea.placeholder = placeholder;
    textarea.style.cssText = `
      width: 100%;
      height: 100%;
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      padding: 16px;
      border: none;
      resize: none;
      outline: none;
      box-sizing: border-box;
    `;
    return textarea;
  }

  /**
   * Set up bidirectional bindings between views and model
   */
  _setupBindings() {
    // Debounced sync on DSL change
    let dslDebounce = null;
    this.views.dsl.addEventListener('input', () => {
      clearTimeout(dslDebounce);
      dslDebounce = setTimeout(() => this.syncFromDSL(), 500);
    });

    // Debounced sync on CNL change
    let cnlDebounce = null;
    this.views.cnl.addEventListener('input', () => {
      clearTimeout(cnlDebounce);
      cnlDebounce = setTimeout(() => this.syncFromCNL(), 500);
    });

    // Debounced sync on JSON change
    let jsonDebounce = null;
    this.views.json.addEventListener('input', () => {
      clearTimeout(jsonDebounce);
      jsonDebounce = setTimeout(() => this.syncFromJSON(), 500);
    });
  }
}
