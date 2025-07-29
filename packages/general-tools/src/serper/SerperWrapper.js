/**
 * SerperWrapper - A wrapper that properly initializes Serper with API key
 */

import Serper from './index.js';

class SerperWrapper {
  constructor(config = {}) {
    // Create the Serper instance
    this.serper = new Serper(config);
    
    // If apiKey is provided in config, set it
    if (config.apiKey) {
      this.serper.apiKey = config.apiKey;
    }
  }
  
  /**
   * Delegate all method calls to the wrapped Serper instance
   */
  async search(...args) {
    if (!this.serper.apiKey) {
      throw new Error('Serper API key not configured. Please set SERPER environment variable.');
    }
    return this.serper.search(...args);
  }
  
  async invoke(...args) {
    if (!this.serper.apiKey) {
      // Try to get from initialization if not set
      const config = args[0]?.config;
      if (config?.apiKey) {
        this.serper.apiKey = config.apiKey;
      }
    }
    return this.serper.invoke(...args);
  }
  
  getToolDescription() {
    return this.serper.getToolDescription();
  }
  
  initialize(config) {
    return this.serper.initialize(config);
  }
}

export default SerperWrapper;