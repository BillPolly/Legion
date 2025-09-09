const path = require('path');

// Example context test file
class ContextExample {
  constructor() {
    this.projectRoot = process.cwd();
  }

  getContextInfo() {
    return {
      projectType: 'Node.js',
      packageName: '@legion/gemini-compatible-agent',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  async loadProjectFiles() {
    // Example method showing typical project structure
    const coreFiles = ['GeminiCompatibleAgent.js'];
    const testFiles = ['GeminiCompatibleAgent.test.js'];
    return { coreFiles, testFiles };
  }
}

module.exports = ContextExample;
