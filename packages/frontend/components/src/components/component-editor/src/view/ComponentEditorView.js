/**
 * ComponentEditorView - DOM rendering and user interface
 * Phase 4.2
 *
 * Manages UI structure, element references, and visual updates
 */

export class ComponentEditorView {
  constructor({ dom, theme }) {
    this.container = dom;
    this.theme = theme || 'light';

    // DOM element cache
    this.elements = {
      toolbar: null,
      editorPane: null,
      previewPane: null,
      browserPane: null,
      dataModelPane: null,
      testPane: null
    };

    // Render UI on construction
    this.render();
  }

  /**
   * Render complete UI structure
   */
  render() {
    this.container.innerHTML = `
      <div class="component-editor ${this.theme}">
        <!-- Toolbar -->
        <div class="editor-toolbar">
          <button class="btn-save">Save</button>
          <button class="btn-test">Test</button>
          <button class="btn-preview">Preview</button>
          <select class="format-selector">
            <option value="dsl">DSL</option>
            <option value="cnl">CNL</option>
            <option value="json">JSON</option>
            <option value="dataModel">Data Model</option>
          </select>
        </div>

        <!-- Main Layout (3-pane) -->
        <div class="editor-layout">
          <!-- Left: Browser -->
          <div class="browser-pane">
            <div class="browser-header">Component Library</div>
            <div class="browser-filter">
              <input type="text" class="filter-input" placeholder="Filter by name..." />
              <select class="filter-tag">
                <option value="">All Tags</option>
              </select>
              <select class="filter-author">
                <option value="">All Authors</option>
              </select>
            </div>
            <div class="browser-list"></div>
          </div>

          <!-- Center: Editor -->
          <div class="editor-pane">
            <div class="editor-tabs">
              <button class="tab active" data-tab="dsl">DSL</button>
              <button class="tab" data-tab="cnl">CNL</button>
              <button class="tab" data-tab="json">JSON</button>
              <button class="tab" data-tab="dataModel">Data Model</button>
            </div>
            <div class="editor-content">
              <textarea class="editor-dsl" placeholder="Enter DSL..."></textarea>
              <textarea class="editor-cnl" style="display:none" placeholder="Enter CNL..."></textarea>
              <textarea class="editor-json" style="display:none" placeholder="JSON..."></textarea>
              <div class="editor-datamodel" style="display:none">
                <!-- Data model editor (schema builder) -->
              </div>
            </div>
            <div class="editor-status">
              <span class="validation-status"></span>
            </div>
          </div>

          <!-- Right: Preview + Tests -->
          <div class="preview-pane">
            <div class="preview-tabs">
              <button class="tab active" data-tab="preview">Preview</button>
              <button class="tab" data-tab="tests">Tests</button>
            </div>
            <div class="preview-content">
              <div class="preview-container"></div>
              <div class="test-results" style="display:none"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache DOM references
    this._cacheElements();
  }

  /**
   * Cache DOM element references
   * @private
   */
  _cacheElements() {
    this.elements.toolbar = this.container.querySelector('.editor-toolbar');
    this.elements.editorPane = this.container.querySelector('.editor-pane');
    this.elements.previewPane = this.container.querySelector('.preview-pane');
    this.elements.browserPane = this.container.querySelector('.browser-pane');
    this.elements.dataModelPane = this.container.querySelector('.editor-datamodel');
    this.elements.testPane = this.container.querySelector('.test-results');
  }

  /**
   * Set editor content for specific format
   */
  setEditorContent(format, content) {
    const editor = this.container.querySelector(`.editor-${format}`);
    if (editor) {
      if (editor.tagName === 'TEXTAREA') {
        editor.value = content;
      } else {
        editor.textContent = content;
      }
    }
  }

  /**
   * Get editor content for specific format
   */
  getEditorContent(format) {
    const editor = this.container.querySelector(`.editor-${format}`);
    if (!editor) {
      return '';
    }

    if (editor.tagName === 'TEXTAREA') {
      return editor.value || '';
    } else {
      return editor.textContent || '';
    }
  }

  /**
   * Render component list in browser pane
   */
  renderComponentList(components) {
    const list = this.container.querySelector('.browser-list');
    if (!list) return;

    list.innerHTML = components.map(component => `
      <div class="component-item" data-id="${component.id}">
        <div class="component-name">${this._escapeHtml(component.name)}</div>
        <div class="component-tags">${this._escapeHtml(component.tags.join(', '))}</div>
      </div>
    `).join('');
  }

  /**
   * Render preview of component instance
   */
  renderPreview(componentInstance) {
    const container = this.container.querySelector('.preview-container');
    if (!container) return;

    container.innerHTML = '';
    // Component instance rendering handled by lifecycle
  }

  /**
   * Show test results
   */
  showTestResults(results) {
    const testContainer = this.container.querySelector('.test-results');
    if (!testContainer) return;

    testContainer.innerHTML = `
      <div class="test-summary">
        ${results.passed} passed, ${results.failed} failed
      </div>
      ${results.tests.map(test => `
        <div class="test-result ${test.passed ? 'pass' : 'fail'}">
          <div class="test-name">${this._escapeHtml(test.name)}</div>
          <div class="test-message">${this._escapeHtml(test.message || '')}</div>
        </div>
      `).join('')}
    `;
  }

  /**
   * Show validation errors
   */
  showValidationErrors(errors) {
    const status = this.container.querySelector('.validation-status');
    if (!status) return;

    if (errors.length === 0) {
      status.textContent = '✓ Valid';
      status.className = 'validation-status valid';
      status.title = '';
    } else {
      status.textContent = `✗ ${errors.length} error(s)`;
      status.className = 'validation-status invalid';
      status.title = errors.join('\n');
    }
  }

  /**
   * Attach click handler to Save button
   */
  onSaveClick(handler) {
    const btn = this.container.querySelector('.btn-save');
    if (btn) {
      btn.addEventListener('click', handler);
    }
  }

  /**
   * Attach click handler to Test button
   */
  onTestClick(handler) {
    const btn = this.container.querySelector('.btn-test');
    if (btn) {
      btn.addEventListener('click', handler);
    }
  }

  /**
   * Attach change handler to format selector
   */
  onFormatChange(handler) {
    const selector = this.container.querySelector('.format-selector');
    if (selector) {
      selector.addEventListener('change', handler);
    }
  }

  /**
   * Attach input handler to editor
   */
  onEditorChange(format, handler) {
    const editor = this.container.querySelector(`.editor-${format}`);
    if (editor) {
      editor.addEventListener('input', handler);
    }
  }

  /**
   * Attach click handler to component list
   */
  onComponentSelect(handler) {
    const list = this.container.querySelector('.browser-list');
    if (list) {
      list.addEventListener('click', (e) => {
        const item = e.target.closest('.component-item');
        if (item) {
          handler(item.dataset.id);
        }
      });
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy view and cleanup
   */
  destroy() {
    this.container.innerHTML = '';
    this.elements = {};
  }
}
