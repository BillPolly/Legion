export class ContextManager {
  constructor() {
    this.providers = new Map();
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  unregisterProvider(name) {
    this.providers.delete(name);
  }

  async getContext(session) {
    const context = {};
    
    for (const [name, provider] of this.providers) {
      try {
        const providerContext = await provider.getContext(session);
        context[name] = providerContext;
      } catch (error) {
        console.error(`Error getting context from provider ${name}:`, error);
      }
    }
    
    return context;
  }
}