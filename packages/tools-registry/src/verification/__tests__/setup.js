/**
 * Test Setup and Utilities for Verification Framework Tests
 */

/**
 * Create a mock module with configurable properties
 */
export function createMockModule(overrides = {}) {
  return {
    name: 'test-module',
    version: '1.0.0',
    description: 'Test module',
    author: 'Test Author',
    license: 'MIT',
    category: 'test',
    tags: ['test'],
    stability: 'stable',
    ...overrides
  };
}

/**
 * Create a mock tool with configurable properties
 */
export function createMockTool(overrides = {}) {
  return {
    name: 'test-tool',
    description: 'Test tool',
    version: '1.0.0',
    execute: async (input) => ({ result: 'success' }),
    validate: (input) => ({ valid: true }),
    getMetadata: () => ({
      name: 'test-tool',
      description: 'Test tool',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        properties: {
          test: { type: 'string' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' }
        }
      }
    }),
    ...overrides
  };
}

/**
 * Create a valid JSON Schema for testing
 */
export function createTestSchema(type = 'object', overrides = {}) {
  const schemas = {
    object: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['id', 'name']
    },
    array: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 10
    },
    string: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-zA-Z0-9]+$'
    },
    number: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      multipleOf: 0.1
    },
    boolean: {
      type: 'boolean'
    }
  };
  
  return { ...schemas[type], ...overrides };
}

/**
 * Create test metadata
 */
export function createTestMetadata(type = 'module', overrides = {}) {
  if (type === 'module') {
    return {
      name: 'test-module',
      version: '1.0.0',
      description: 'A test module for unit testing',
      author: 'Test Suite',
      license: 'MIT',
      category: 'testing',
      tags: ['test', 'mock'],
      stability: 'stable',
      documentation: {
        overview: 'Test module overview',
        examples: ['Example 1', 'Example 2']
      },
      ...overrides
    };
  } else if (type === 'tool') {
    return {
      name: 'test-tool',
      description: 'A test tool',
      version: '1.0.0',
      inputSchema: createTestSchema('object'),
      outputSchema: createTestSchema('object', {
        properties: { result: { type: 'string' } },
        required: ['result']
      }),
      examples: [
        {
          input: { id: '1', name: 'test' },
          output: { result: 'success' }
        }
      ],
      category: 'testing',
      tags: ['test'],
      ...overrides
    };
  }
  
  throw new Error(`Unknown metadata type: ${type}`);
}

/**
 * Mock file system for testing
 */
export class MockFileSystem {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
  }
  
  addFile(path, content) {
    this.files.set(path, content);
    // Add parent directories
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      this.directories.add(parts.slice(0, i).join('/'));
    }
  }
  
  addDirectory(path) {
    this.directories.add(path);
  }
  
  async readFile(path) {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return this.files.get(path);
  }
  
  async writeFile(path, content) {
    this.addFile(path, content);
  }
  
  async access(path) {
    if (!this.files.has(path) && !this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
  }
  
  async readdir(path) {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }
    
    const entries = [];
    const pathWithSlash = path.endsWith('/') ? path : path + '/';
    
    // Find direct children
    for (const file of this.files.keys()) {
      if (file.startsWith(pathWithSlash)) {
        const relative = file.substring(pathWithSlash.length);
        const parts = relative.split('/');
        if (parts.length === 1) {
          entries.push({
            name: parts[0],
            isFile: () => true,
            isDirectory: () => false
          });
        }
      }
    }
    
    for (const dir of this.directories) {
      if (dir.startsWith(pathWithSlash) && dir !== path) {
        const relative = dir.substring(pathWithSlash.length);
        const parts = relative.split('/');
        if (parts.length === 1) {
          entries.push({
            name: parts[0],
            isFile: () => false,
            isDirectory: () => true
          });
        }
      }
    }
    
    return entries;
  }
  
  async mkdir(path, options = {}) {
    this.addDirectory(path);
    if (options.recursive) {
      const parts = path.split('/');
      for (let i = 1; i <= parts.length; i++) {
        this.addDirectory(parts.slice(0, i).join('/'));
      }
    }
  }
  
  async rm(path, options = {}) {
    if (options.recursive) {
      // Remove all files and directories starting with path
      for (const file of Array.from(this.files.keys())) {
        if (file.startsWith(path)) {
          this.files.delete(file);
        }
      }
      for (const dir of Array.from(this.directories)) {
        if (dir.startsWith(path)) {
          this.directories.delete(dir);
        }
      }
    } else {
      this.files.delete(path);
      this.directories.delete(path);
    }
  }
  
  existsSync(path) {
    return this.files.has(path) || this.directories.has(path);
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Create a simple event collector for testing event emissions
 */
export class EventCollector {
  constructor(emitter) {
    this.events = [];
    this.emitter = emitter;
    this.listeners = new Map();
  }
  
  listen(eventName) {
    const listener = (data) => {
      this.events.push({ name: eventName, data, timestamp: Date.now() });
    };
    this.listeners.set(eventName, listener);
    this.emitter.on(eventName, listener);
  }
  
  listenAll(eventNames) {
    eventNames.forEach(name => this.listen(name));
  }
  
  getEvents(eventName) {
    return this.events.filter(e => e.name === eventName);
  }
  
  hasEvent(eventName) {
    return this.events.some(e => e.name === eventName);
  }
  
  clear() {
    this.events = [];
  }
  
  cleanup() {
    for (const [eventName, listener] of this.listeners) {
      this.emitter.off(eventName, listener);
    }
    this.listeners.clear();
    this.events = [];
  }
}

/**
 * Mock LLM client for testing
 */
export class MockLLMClient {
  constructor(responses = {}) {
    this.responses = responses;
    this.calls = [];
  }
  
  async sendRequest(prompt, options = {}) {
    this.calls.push({ prompt, options, timestamp: Date.now() });
    
    // Return predefined response or default
    const responseKey = Object.keys(this.responses).find(key => 
      prompt.includes(key)
    );
    
    if (responseKey) {
      return { content: this.responses[responseKey] };
    }
    
    // Default response
    return {
      content: JSON.stringify({
        valid: true,
        score: 80,
        recommendations: []
      })
    };
  }
  
  getCalls() {
    return this.calls;
  }
  
  reset() {
    this.calls = [];
  }
}