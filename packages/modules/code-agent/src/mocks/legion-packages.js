/**
 * Stub implementations for missing Legion packages
 * This allows tests to run without failing on missing imports
 */

export class GenericPlanner {
  constructor(config = {}) {
    this.config = config;
  }

  async plan(objective, context = {}) {
    // Simple stub - return a basic plan structure
    return {
      steps: [
        {
          id: 'step-1',
          type: 'generate',
          description: 'Mock planning step',
          parameters: context
        }
      ],
      objective,
      context
    };
  }
}

export class ModuleLoader {
  constructor(config = {}) {
    this.config = config;
  }

  async loadModule(modulePath) {
    // Mock module loading
    return {
      id: 'mock-module',
      path: modulePath,
      loaded: true
    };
  }

  async initialize() {
    return true;
  }
}