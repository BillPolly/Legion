/**
 * CompositeResourceProvider - Chains multiple resource providers
 * Implements Chain of Responsibility pattern
 */

import { ResourceProvider } from './ResourceProvider.js';

export class CompositeResourceProvider extends ResourceProvider {
  constructor(providers = []) {
    super();
    this.providers = [...providers].sort((a, b) => {
      // Sort by priority (higher priority first)
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Add a provider with optional priority
   * @param {ResourceProvider} provider - Provider to add
   * @param {number} priority - Priority (higher = checked first)
   */
  addProvider(provider, priority = 0) {
    this.providers.push({ provider, priority });
    // Re-sort by priority
    this.providers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async getResource(path, req) {
    // Try each provider in priority order
    for (const providerInfo of this.providers) {
      const provider = providerInfo.provider || providerInfo; // Handle both formats
      
      try {
        const result = await provider.getResource(path, req);
        if (result) {
          return result;
        }
      } catch (error) {
        console.warn(`Provider ${provider.constructor.name} failed for ${path}:`, error.message);
        // Continue to next provider
      }
    }
    
    return null; // No provider could handle this resource
  }

  async listResources() {
    const allResources = new Set();
    
    for (const providerInfo of this.providers) {
      const provider = providerInfo.provider || providerInfo;
      try {
        const resources = await provider.listResources();
        resources.forEach(resource => allResources.add(resource));
      } catch (error) {
        console.warn(`Provider ${provider.constructor.name} failed to list resources:`, error.message);
      }
    }
    
    return Array.from(allResources);
  }

  /**
   * Remove a provider
   * @param {ResourceProvider} provider - Provider to remove
   */
  removeProvider(provider) {
    this.providers = this.providers.filter(p => 
      (p.provider || p) !== provider
    );
  }

  /**
   * Get count of registered providers
   * @returns {number} Number of providers
   */
  getProviderCount() {
    return this.providers.length;
  }
}