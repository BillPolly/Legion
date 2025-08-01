/**
 * BaseView - Foundation class for MVVM View layer
 * Simplified version for aiur-actors-ui
 */
export class BaseView {
  constructor() {
    this.element = null;
    this.listeners = [];
  }

  /**
   * Render the view
   * @param {*} data - Data to render
   */
  render(data) {
    // Override in subclasses
  }

  /**
   * Update the view
   * @param {*} data - Data to update
   */
  update(data) {
    // Override in subclasses
  }

  /**
   * Clean up
   */
  destroy() {
    // Remove event listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
    
    // Clear element
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  /**
   * Add event listener with tracking
   * @param {Element} element - DOM element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  addTrackedListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.push({ element, event, handler });
  }
}