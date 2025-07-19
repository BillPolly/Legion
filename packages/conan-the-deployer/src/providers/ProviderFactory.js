import BaseProvider from './BaseProvider.js';
import LocalProvider from './LocalProvider.js';
import DockerProvider from './DockerProvider.js';
import RailwayProvider from './RailwayProvider.js';

/**
 * ProviderFactory - Factory for creating and managing deployment providers
 */
class ProviderFactory {
  constructor() {
    this.providers = new Map();
    this.registerDefaultProviders();
  }
  
  registerDefaultProviders() {
    this.providers.set('local', LocalProvider);
    this.providers.set('docker', DockerProvider);
    this.providers.set('railway', RailwayProvider);
  }
  
  /**
   * Register a custom provider
   */
  registerProvider(name, ProviderClass) {
    if (this.providers.has(name)) {
      throw new Error(`Provider already registered: ${name}`);
    }
    
    // Validate that the provider extends BaseProvider
    const testInstance = Object.create(ProviderClass.prototype);
    if (!(testInstance instanceof BaseProvider)) {
      throw new Error('Provider must extend BaseProvider');
    }
    
    this.providers.set(name, ProviderClass);
  }
  
  /**
   * Check if a provider is registered
   */
  hasProvider(name) {
    return this.providers.has(name);
  }
  
  /**
   * Create a provider instance
   */
  createProvider(name, config = {}) {
    if (!this.providers.has(name)) {
      throw new Error(`Unknown provider: ${name}`);
    }
    
    const ProviderClass = this.providers.get(name);
    return new ProviderClass(config);
  }
  
  /**
   * List all registered providers
   */
  listProviders() {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Get provider capabilities without creating instance
   */
  getProviderCapabilities(name) {
    if (!this.providers.has(name)) {
      throw new Error(`Unknown provider: ${name}`);
    }
    
    const ProviderClass = this.providers.get(name);
    const tempInstance = new ProviderClass({});
    return tempInstance.getCapabilities();
  }
}

export default ProviderFactory;