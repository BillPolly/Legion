/**
 * Test utilities for browser-monitor package
 */

import { EventEmitter } from 'events';

/**
 * Mock Browser implementation for testing
 */
export class MockBrowser extends EventEmitter {
  constructor() {
    super();
    this.pages = [];
    this.closed = false;
    this.isConnected = true;
  }

  async newPage() {
    const page = new MockPage(this);
    this.pages.push(page);
    return page;
  }

  async close() {
    this.closed = true;
    this.isConnected = false;
    this.emit('disconnected');
  }

  async version() {
    return 'Mock Browser 1.0.0';
  }
}

/**
 * Mock Page implementation for testing
 */
export class MockPage extends EventEmitter {
  constructor(browser) {
    super();
    this.browser = browser;
    this.url = null;
    this.closed = false;
    this.consoleLogs = [];
    this.networkRequests = [];
    this.screenshots = [];
    this.evaluatedScripts = [];
    this._viewport = { width: 1280, height: 720 };
  }

  async goto(url, options = {}) {
    this.url = url;
    this.emit('load');
    return { status: 200 };
  }

  async close() {
    this.closed = true;
    this.emit('close');
  }

  async evaluate(fn, ...args) {
    const script = fn.toString();
    this.evaluatedScripts.push({ script, args });
    
    // Simulate some basic evaluations
    if (script.includes('document.title')) {
      return 'Test Page';
    }
    if (script.includes('window.location.href')) {
      return this.url;
    }
    return undefined;
  }

  async evaluateOnNewDocument(fn, ...args) {
    this.evaluatedScripts.push({ 
      script: fn.toString(), 
      args, 
      onNewDocument: true 
    });
  }

  async screenshot(options = {}) {
    const screenshot = {
      timestamp: new Date(),
      options,
      data: Buffer.from('mock-screenshot-data')
    };
    this.screenshots.push(screenshot);
    return screenshot.data;
  }

  async setViewport(viewport) {
    this._viewport = viewport;
  }

  async click(selector) {
    this.emit('click', { selector });
  }

  async type(selector, text) {
    this.emit('type', { selector, text });
  }

  async waitForSelector(selector, options = {}) {
    return { selector };
  }

  on(event, handler) {
    super.on(event, handler);
    
    // Simulate console events
    if (event === 'console') {
      this._consoleHandler = handler;
    }
    
    // Simulate request events
    if (event === 'request') {
      this._requestHandler = handler;
    }
    
    // Simulate response events
    if (event === 'response') {
      this._responseHandler = handler;
    }
  }

  // Helper to simulate console messages
  simulateConsoleMessage(type, text) {
    const msg = new MockConsoleMessage(type, text);
    this.consoleLogs.push(msg);
    if (this._consoleHandler) {
      this._consoleHandler(msg);
    }
  }

  // Helper to simulate network requests
  simulateRequest(url, method = 'GET', headers = {}) {
    const request = new MockRequest(url, method, headers);
    this.networkRequests.push(request);
    if (this._requestHandler) {
      this._requestHandler(request);
    }
    return request;
  }

  // Helper to simulate network responses
  simulateResponse(request, status = 200, headers = {}) {
    const response = new MockResponse(request, status, headers);
    if (this._responseHandler) {
      this._responseHandler(response);
    }
    return response;
  }
}

/**
 * Mock Console Message
 */
export class MockConsoleMessage {
  constructor(type, text) {
    this._type = type;
    this._text = text;
    this._timestamp = new Date();
  }

  type() {
    return this._type;
  }

  text() {
    return this._text;
  }

  args() {
    return [this._text];
  }
}

/**
 * Mock Network Request
 */
export class MockRequest {
  constructor(url, method = 'GET', headers = {}) {
    this._url = url;
    this._method = method;
    this._headers = headers;
    this._timestamp = new Date();
    this._resourceType = 'xhr';
  }

  url() {
    return this._url;
  }

  method() {
    return this._method;
  }

  headers() {
    return this._headers;
  }

  resourceType() {
    return this._resourceType;
  }

  postData() {
    return this._postData;
  }

  setPostData(data) {
    this._postData = data;
  }
}

/**
 * Mock Network Response
 */
export class MockResponse {
  constructor(request, status = 200, headers = {}) {
    this._request = request;
    this._status = status;
    this._headers = headers;
    this._timestamp = new Date();
  }

  request() {
    return this._request;
  }

  status() {
    return this._status;
  }

  headers() {
    return this._headers;
  }

  async text() {
    return '{"success": true}';
  }

  async json() {
    return { success: true };
  }
}

/**
 * Mock ResourceManager for testing
 */
export class MockResourceManager {
  constructor() {
    this.resources = new Map();
    this.resources.set('BROWSER_TYPE', 'mock');
  }

  get(key) {
    if (!this.resources.has(key)) {
      throw new Error(`Resource not found: ${key}`);
    }
    return this.resources.get(key);
  }

  set(key, value) {
    this.resources.set(key, value);
  }

  has(key) {
    return this.resources.has(key);
  }
}

/**
 * Mock Driver for testing browser automation
 */
export class MockDriver {
  constructor(type = 'mock') {
    this.type = type;
    this.launches = [];
  }

  async launch(options = {}) {
    this.launches.push(options);
    return new MockBrowser();
  }
}

/**
 * Helper to wait for event
 */
export function waitForEvent(emitter, event, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    emitter.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Helper to collect events
 */
export class EventCollector {
  constructor(emitter, events) {
    this.collected = {};
    
    events.forEach(event => {
      this.collected[event] = [];
      emitter.on(event, (data) => {
        this.collected[event].push(data);
      });
    });
  }

  get(event) {
    return this.collected[event] || [];
  }

  clear() {
    Object.keys(this.collected).forEach(key => {
      this.collected[key] = [];
    });
  }
}