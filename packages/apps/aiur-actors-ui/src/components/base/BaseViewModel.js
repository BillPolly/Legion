/**
 * BaseViewModel - Foundation class for MVVM ViewModel layer
 * Simplified version for aiur-actors-ui
 */
export class BaseViewModel {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.subscriptions = [];
  }

  /**
   * Initialize the view model
   */
  initialize() {
    // Override in subclasses
  }

  /**
   * Bind model to view
   */
  bind() {
    // Subscribe to model changes
    const unsubscribe = this.model.subscribe((event, data) => {
      this.onModelChange(event, data);
    });
    this.subscriptions.push(unsubscribe);
  }

  /**
   * Handle model changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  onModelChange(event, data) {
    // Override in subclasses
  }

  /**
   * Clean up
   */
  destroy() {
    // Unsubscribe from model
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
    
    // Destroy view and model
    if (this.view) {
      this.view.destroy();
    }
    if (this.model) {
      this.model.destroy();
    }
  }
}