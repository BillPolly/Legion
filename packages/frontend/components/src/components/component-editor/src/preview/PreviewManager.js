/**
 * PreviewManager - Manages component preview lifecycle
 * Phase 6.2
 *
 * Uses ComponentLifecycle to mount, unmount, and update preview components
 */

export class PreviewManager {
  constructor(dataStore, lifecycle = null) {
    this.dataStore = dataStore;

    // Allow lifecycle injection for testing, or lazy load for production
    if (lifecycle) {
      this.lifecycle = lifecycle;
    } else {
      // Lazy import ComponentLifecycle to avoid module resolution issues in tests
      this.lifecycle = null;
      this._initLifecycle();
    }

    this.currentComponent = null;
    this.container = null;
  }

  async _initLifecycle() {
    if (!this.lifecycle) {
      try {
        const { ComponentLifecycle } = await import('@legion/declarative-components');
        this.lifecycle = new ComponentLifecycle(this.dataStore);
      } catch (error) {
        console.error('Failed to load ComponentLifecycle:', error.message);
        throw new Error('ComponentLifecycle not available');
      }
    }
  }

  /**
   * Render component preview with DSL and sample data
   *
   * @param {string} dsl - Component DSL
   * @param {object} sampleData - Sample data for component
   * @param {HTMLElement} container - Container for preview
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async renderPreview(dsl, sampleData, container) {
    // Unmount previous component
    if (this.currentComponent) {
      await this.currentComponent.unmount();
    }

    this.container = container;

    try {
      // Mount component with sample data
      this.currentComponent = await this.lifecycle.mount(dsl, container, sampleData);
      return { success: true };
    } catch (error) {
      // Show error in preview
      container.innerHTML = `
        <div class="preview-error">
          <h3>Preview Error</h3>
          <pre>${this._escapeHtml(error.message)}</pre>
          <div class="error-stack">${this._escapeHtml(error.stack || '')}</div>
        </div>
      `;
      return { success: false, error: error.message };
    }
  }

  /**
   * Update sample data in current preview
   *
   * @param {object} newData - New sample data
   */
  async updateSampleData(newData) {
    if (this.currentComponent) {
      await this.currentComponent.update(newData);
    }
  }

  /**
   * Destroy preview and cleanup
   */
  destroy() {
    if (this.currentComponent) {
      this.currentComponent.unmount();
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
}
