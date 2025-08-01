/**
 * BaseModel - Foundation class for MVVM Model layer
 * Simplified version for aiur-actors-ui
 */
export class BaseModel {
  constructor() {
    this.listeners = new Set();
    this.data = {};
  }

  /**
   * Subscribe to model changes
   * @param {Function} listener - Callback function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  notify(event, data) {
    this.listeners.forEach(listener => {
      listener(event, data);
    });
  }

  /**
   * Set data property
   * @param {string} key - Property key
   * @param {*} value - Property value
   */
  set(key, value) {
    const oldValue = this.data[key];
    this.data[key] = value;
    this.notify('change', { key, value, oldValue });
  }

  /**
   * Get data property
   * @param {string} key - Property key
   * @returns {*} Property value
   */
  get(key) {
    return this.data[key];
  }

  /**
   * Clean up
   */
  destroy() {
    this.listeners.clear();
    this.data = {};
  }
}