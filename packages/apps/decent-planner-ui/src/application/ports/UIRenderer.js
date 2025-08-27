/**
 * UIRenderer Port
 * Interface for UI rendering operations
 */

export class UIRenderer {
  /**
   * Update UI component with new data
   * @param {string} componentId - Component identifier
   * @param {object} data - Data to render
   */
  updateComponent(componentId, data) {
    throw new Error('UIRenderer.updateComponent must be implemented');
  }
  
  /**
   * Show loading state
   * @param {string} componentId - Component identifier
   * @param {string} message - Loading message
   */
  showLoading(componentId, message) {
    throw new Error('UIRenderer.showLoading must be implemented');
  }
  
  /**
   * Show error state
   * @param {string} componentId - Component identifier
   * @param {string} error - Error message
   */
  showError(componentId, error) {
    throw new Error('UIRenderer.showError must be implemented');
  }
  
  /**
   * Clear component state
   * @param {string} componentId - Component identifier
   */
  clearComponent(componentId) {
    throw new Error('UIRenderer.clearComponent must be implemented');
  }
  
  /**
   * Enable/disable UI element
   * @param {string} elementId - Element identifier
   * @param {boolean} enabled - Enable state
   */
  setElementEnabled(elementId, enabled) {
    throw new Error('UIRenderer.setElementEnabled must be implemented');
  }
  
  /**
   * Switch to a different tab/view
   * @param {string} tabId - Tab identifier
   */
  switchTab(tabId) {
    throw new Error('UIRenderer.switchTab must be implemented');
  }
  
  /**
   * Update progress indicator
   * @param {string} componentId - Component identifier
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  updateProgress(componentId, percentage, message) {
    throw new Error('UIRenderer.updateProgress must be implemented');
  }
}