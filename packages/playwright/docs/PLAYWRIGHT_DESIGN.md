# Playwright Package Design Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Design Patterns](#design-patterns)
5. [Browser Management](#browser-management)
6. [Error Handling System](#error-handling-system)
7. [Selector Strategies](#selector-strategies)
8. [Wait Mechanisms](#wait-mechanisms)
9. [API Design](#api-design)
10. [Integration Architecture](#integration-architecture)
11. [Performance Optimization](#performance-optimization)
12. [Security Considerations](#security-considerations)
13. [Testing Architecture](#testing-architecture)
14. [Future Enhancements](#future-enhancements)

## Overview

The `@jsenvoy/playwright` package is a sophisticated wrapper around Microsoft's Playwright library, designed specifically for AI agent usage. It provides a natural, intuitive API for browser automation while maintaining the full power of Playwright's capabilities.

### Design Philosophy

1. **Natural API**: Methods that mirror how developers think about browser automation
2. **AI-Agent Friendly**: Designed for programmatic use with clear, predictable interfaces
3. **Error Resilience**: Comprehensive error handling with automatic retry logic
4. **Resource Efficiency**: Lazy initialization and careful resource management
5. **Flexibility**: Support for multiple browsers, selectors, and wait strategies

### Key Capabilities

- **Multi-Browser Support**: Chromium, Firefox, WebKit (Safari)
- **Advanced Selectors**: CSS, XPath, text content, data-testid, ARIA
- **Smart Waiting**: Network idle, element stability, custom conditions
- **Form Automation**: Intelligent form filling with submit detection
- **Mobile Emulation**: Device presets and custom viewport configurations
- **Data Extraction**: Structured scraping with multiple element support
- **Screenshot Capture**: Full page, element-specific, multiple formats
- **JavaScript Execution**: Run custom scripts in browser context

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│            PlaywrightWrapper                     │
│  ┌───────────────────────────────────────────┐  │
│  │         Configuration & State              │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌─────────────┐  ┌────────────────────────┐   │
│  │   Browser    │  │    Operation Methods   │   │
│  │   Manager    │  │  • navigateToPage      │   │
│  │             │  │  • clickElement         │   │
│  │  • Lazy Init │  │  • fillForm            │   │
│  │  • Lifecycle │  │  • takeScreenshot      │   │
│  │  • Cleanup   │  │  • extractData         │   │
│  └──────┬──────┘  │  • waitForElement       │   │
│         │         │  • executeScript        │   │
│         │         └────────────┬─────────────┘  │
│         │                      │                 │
│  ┌──────▼──────────────────────▼──────────────┐ │
│  │           Utility Layer                     │ │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────┐ │ │
│  │  │ Errors  │  │Selectors │  │   Waits   │ │ │
│  │  └─────────┘  └──────────┘  └───────────┘ │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                          │
                          ▼
               ┌──────────────────┐
               │    Playwright    │
               │   Browser API    │
               └──────────────────┘
```

### Component Interaction Flow

```
User Request
     │
     ▼
PlaywrightWrapper.method()
     │
     ├─→ Parameter Validation
     │
     ├─→ Ensure Browser Ready (BrowserManager)
     │        │
     │        ├─→ Lazy Init if needed
     │        └─→ Return existing instance
     │
     ├─→ Execute Operation
     │        │
     │        ├─→ Apply Selector Strategy
     │        ├─→ Apply Wait Strategy
     │        └─→ Perform Action
     │
     ├─→ Handle Errors
     │        │
     │        ├─→ Retry if transient
     │        └─→ Enrich error context
     │
     └─→ Return Structured Response
```

## Core Components

### 1. PlaywrightWrapper (Main Class)

The central orchestrator that provides the public API and coordinates all operations.

**Responsibilities:**
- Public API exposure
- Configuration management
- Operation orchestration
- Error handling coordination
- Response formatting

**Key Properties:**
```javascript
class PlaywrightWrapper {
  constructor(config) {
    this.config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      retries: 3,
      ...config
    };
    this.isInitialized = false;
    this.browserManager = new BrowserManager(this.config);
  }
}
```

**Design Decisions:**
- Single entry point for all browser operations
- Consistent method signatures and return types
- Lazy initialization to reduce startup overhead
- Configuration immutability after construction

### 2. BrowserManager

Manages the Playwright browser lifecycle with careful resource management.

**Core Architecture:**
```javascript
class BrowserManager {
  constructor(config) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.config = config;
  }

  async ensurePage() {
    // Lazy initialization chain
    if (!this.browser) await this.launchBrowser();
    if (!this.context) await this.createContext();
    if (!this.page) await this.createPage();
    return this.page;
  }
}
```

**Resource Hierarchy:**
1. **Browser**: Top-level Playwright browser instance
2. **Context**: Isolated browser context (cookies, storage)
3. **Page**: Individual page/tab within context

**Lifecycle Management:**
- Lazy initialization on first use
- Resource reuse across operations
- Hierarchical cleanup (page → context → browser)
- Error-safe cleanup operations

### 3. Error System

A comprehensive error handling system with custom error types and rich context.

**Error Hierarchy:**
```
PlaywrightError (Base)
├── ElementNotFoundError
├── TimeoutError
├── NavigationError
├── FormError
└── ScreenshotError
```

**Error Enhancement:**
```javascript
class PlaywrightError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.action = details.action;
    this.selector = details.selector;
    this.url = details.url;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      action: this.action,
      selector: this.selector,
      url: this.url,
      details: this.details,
      stack: this.stack
    };
  }
}
```

**Error Handling Strategy:**
1. **Classification**: Transform generic errors into specific types
2. **Context Enrichment**: Add operation context to errors
3. **Retry Logic**: Automatic retry for transient failures
4. **Graceful Degradation**: Continue operation where possible

### 4. Selector Utilities

Flexible selector system supporting multiple strategies.

**Selector Strategies:**
```javascript
function parseSelector(selector) {
  // XPath
  if (selector.startsWith('//') || selector.startsWith('xpath=')) {
    return { type: 'xpath', value: selector.replace('xpath=', '') };
  }
  
  // Text content
  if (selector.startsWith('text=')) {
    return { type: 'text', value: selector.substring(5) };
  }
  
  // Data test ID
  if (selector.startsWith('data-testid=')) {
    return { 
      type: 'css', 
      value: `[data-testid="${selector.substring(12)}"]` 
    };
  }
  
  // Role selector
  if (selector.startsWith('role=')) {
    return { type: 'role', value: selector.substring(5) };
  }
  
  // Default CSS
  return { type: 'css', value: selector };
}
```

**Fallback Strategy:**
```javascript
async function getElementWithFallback(page, selector) {
  const strategies = [
    () => page.locator(selector),
    () => page.getByText(selector),
    () => page.getByPlaceholder(selector),
    () => page.getByLabel(selector),
    () => page.getByTitle(selector)
  ];
  
  for (const strategy of strategies) {
    try {
      const element = await strategy();
      if (await element.count() > 0) return element;
    } catch (e) {
      continue;
    }
  }
  
  throw new ElementNotFoundError(`Element not found: ${selector}`);
}
```

### 5. Wait Utilities

Sophisticated wait mechanisms for reliable automation.

**Core Wait Functions:**
```javascript
// Wait for network to be idle
async function waitForNetworkIdle(page, options = {}) {
  const { timeout = 30000, idleTime = 500 } = options;
  let idleTimer;
  let requestCount = 0;
  
  const checkIdle = () => {
    if (requestCount === 0) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(resolve, idleTime);
    }
  };
  
  page.on('request', () => {
    requestCount++;
    clearTimeout(idleTimer);
  });
  
  page.on('requestfinished', () => {
    requestCount--;
    checkIdle();
  });
  
  page.on('requestfailed', () => {
    requestCount--;
    checkIdle();
  });
}

// Wait for element to be stable (not moving)
async function waitForElementStable(element, options = {}) {
  const { timeout = 5000, checkInterval = 100 } = options;
  let lastPosition = await element.boundingBox();
  
  await waitForCondition(async () => {
    const currentPosition = await element.boundingBox();
    const isStable = JSON.stringify(lastPosition) === 
                     JSON.stringify(currentPosition);
    lastPosition = currentPosition;
    return isStable;
  }, { timeout, interval: checkInterval });
}
```

## Design Patterns

### 1. Singleton Pattern (Browser Management)
Ensures single browser instance per wrapper instance, preventing resource leaks.

```javascript
class BrowserManager {
  async ensureBrowser() {
    if (!this.browser) {
      this.browser = await this.launchBrowser();
    }
    return this.browser;
  }
}
```

### 2. Strategy Pattern (Selectors)
Different strategies for different selector types, allowing flexible element location.

```javascript
const selectorStrategies = {
  css: (page, value) => page.locator(value),
  xpath: (page, value) => page.locator(`xpath=${value}`),
  text: (page, value) => page.getByText(value),
  role: (page, value) => page.getByRole(value)
};
```

### 3. Decorator Pattern (Error Handling)
Wraps operations with error handling and retry logic.

```javascript
async function withRetry(operation, options = {}) {
  const { retries = 3, delay = 1000 } = options;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}
```

### 4. Template Method Pattern (Operations)
Common operation structure with customizable steps.

```javascript
async function executeOperation(operationName, operation) {
  try {
    // Ensure browser ready
    await this.browserManager.ensurePage();
    
    // Execute operation
    const result = await operation();
    
    // Format response
    return this.formatSuccess(result);
  } catch (error) {
    // Handle and format error
    return this.formatError(error);
  }
}
```

## Browser Management

### Lifecycle States

```
Not Initialized
      │
      ├─→ Launch Browser
      │
      ├─→ Create Context
      │
      ├─→ Create Page
      │
      ├─→ Ready
      │
      └─→ Closed
```

### Resource Management Strategy

**Lazy Initialization:**
- Browser launched on first operation
- Context created with browser
- Page created with context
- Resources reused across operations

**Configuration Application:**
```javascript
async launchBrowser() {
  const launchOptions = {
    headless: this.config.headless,
    timeout: this.config.timeout,
    ...this.config.browserOptions
  };
  
  return await playwright[this.config.browserType].launch(launchOptions);
}
```

**Context Isolation:**
- Each wrapper instance has isolated context
- Cookies and storage are separate
- Enables parallel operation with multiple instances

## Error Handling System

### Error Classification

**By Operation Type:**
- **Navigation Errors**: Page load failures, timeouts
- **Element Errors**: Not found, not interactable
- **Form Errors**: Field not found, submission failures
- **Screenshot Errors**: Capture failures
- **Script Errors**: Execution failures

### Retry Strategy

```javascript
async function retryableOperation(operation, config) {
  const errors = [];
  
  for (let attempt = 0; attempt < config.retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      errors.push(error);
      
      // Don't retry certain errors
      if (error instanceof ElementNotFoundError && attempt > 1) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All attempts failed
  throw new PlaywrightError('All retry attempts failed', { errors });
}
```

### Error Context Enhancement

```javascript
function enhanceError(error, context) {
  const enhanced = new PlaywrightError(error.message, {
    originalError: error.name,
    action: context.action,
    selector: context.selector,
    url: context.url,
    timestamp: new Date().toISOString()
  });
  
  // Preserve stack trace
  enhanced.stack = error.stack;
  
  return enhanced;
}
```

## Selector Strategies

### Multi-Strategy Approach

The package supports multiple selector strategies to accommodate different use cases:

1. **CSS Selectors** (Default)
   - Standard CSS selector syntax
   - Most performant option
   - Example: `button.submit`, `#login-form`

2. **XPath Selectors**
   - For complex DOM traversal
   - Prefix: `//` or `xpath=`
   - Example: `//button[contains(@class, 'submit')]`

3. **Text Content**
   - Human-readable selectors
   - Prefix: `text=`
   - Example: `text=Click me`

4. **Data Test IDs**
   - Recommended for testing
   - Prefix: `data-testid=`
   - Example: `data-testid=submit-button`

5. **ARIA Selectors**
   - Accessibility-focused
   - Role-based selection
   - Example: `role=button[name="Submit"]`

### Intelligent Fallbacks

```javascript
async function findElement(page, selector) {
  // Try primary selector
  try {
    return await page.locator(selector).first();
  } catch (error) {
    // Try fallback strategies
    const fallbacks = [
      () => page.getByText(selector, { exact: false }),
      () => page.getByLabel(selector),
      () => page.getByPlaceholder(selector),
      () => page.getByTitle(selector),
      () => page.getByRole('button', { name: selector }),
      () => page.getByRole('link', { name: selector })
    ];
    
    for (const fallback of fallbacks) {
      try {
        const element = await fallback();
        if (await element.isVisible()) return element;
      } catch (e) {
        continue;
      }
    }
    
    throw new ElementNotFoundError(`Cannot find element: ${selector}`);
  }
}
```

## Wait Mechanisms

### Wait Strategy Types

1. **Page Load Waits**
   - `load`: Wait for load event
   - `domcontentloaded`: Wait for DOM ready
   - `networkidle`: Wait for network to be quiet

2. **Element Waits**
   - `visible`: Element is visible
   - `hidden`: Element is hidden
   - `attached`: Element is in DOM
   - `detached`: Element removed from DOM
   - `stable`: Element not moving

3. **Custom Condition Waits**
   - Poll for arbitrary conditions
   - Configurable intervals and timeouts
   - Promise-based conditions

### Implementation Details

**Network Idle Detection:**
```javascript
class NetworkMonitor {
  constructor(page) {
    this.page = page;
    this.pendingRequests = new Set();
    
    page.on('request', request => {
      this.pendingRequests.add(request);
    });
    
    page.on('requestfinished', request => {
      this.pendingRequests.delete(request);
    });
    
    page.on('requestfailed', request => {
      this.pendingRequests.delete(request);
    });
  }
  
  async waitForIdle(timeout = 30000, idleTime = 500) {
    const deadline = Date.now() + timeout;
    
    while (Date.now() < deadline) {
      if (this.pendingRequests.size === 0) {
        await new Promise(resolve => setTimeout(resolve, idleTime));
        if (this.pendingRequests.size === 0) {
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new TimeoutError('Network did not become idle');
  }
}
```

## API Design

### Method Naming Convention

Methods follow a natural, action-oriented naming pattern:
- `navigateToPage()` - Navigate browser to URL
- `clickElement()` - Click on an element
- `fillForm()` - Fill out form fields
- `takeScreenshot()` - Capture screenshot
- `extractData()` - Extract structured data

### Consistent Response Format

All methods return a standardized response structure:

```typescript
interface OperationResponse<T = any> {
  success: boolean;
  error?: string;
  // Operation-specific data
  ...T
}

// Success example
{
  success: true,
  url: "https://example.com",
  title: "Example Page",
  loadTime: 1234
}

// Failure example
{
  success: false,
  error: "Navigation timeout",
  code: "NAVIGATION_TIMEOUT",
  url: "https://example.com"
}
```

### Parameter Design Philosophy

**Flexible Parameters:**
```javascript
// Simple usage
await wrapper.navigateToPage('https://example.com');

// Advanced usage with options
await wrapper.navigateToPage('https://example.com', {
  waitUntil: 'networkidle',
  timeout: 60000
});
```

**Sensible Defaults:**
- Timeout: 30 seconds
- Wait strategy: 'load'
- Headless: true
- Retries: 3

## Integration Architecture

### JSON Module Pattern

The package follows jsEnvoy's JSON module pattern for tool exposure:

```json
{
  "name": "playwright",
  "package": "./src/PlaywrightWrapper.js",
  "type": "constructor",
  "initialization": {
    "type": "constructor",
    "config": {
      "browserType": "chromium",
      "headless": true,
      "timeout": 30000
    }
  },
  "tools": [
    {
      "name": "navigate_to_page",
      "function": "navigateToPage",
      "instanceMethod": true,
      "async": true,
      "parameters": { /* schema */ },
      "output": { /* schema */ }
    }
  ]
}
```

### OpenAI Function Calling Compatibility

Tools are designed to be compatible with OpenAI's function calling format:

```javascript
{
  type: 'function',
  function: {
    name: 'navigate_to_page',
    description: 'Navigate to a web page',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' }
      },
      required: ['url']
    }
  }
}
```

## Performance Optimization

### Resource Efficiency

1. **Lazy Initialization**
   - Browser launched only when needed
   - Reduces startup time
   - Enables quick tool listing

2. **Resource Reuse**
   - Single browser instance per wrapper
   - Context and page reused
   - Reduces overhead for multiple operations

3. **Intelligent Waiting**
   - Network idle detection
   - Element stability checks
   - Avoid unnecessary delays

### Memory Management

```javascript
class PlaywrightWrapper {
  async close() {
    try {
      // Clear references before closing
      const { page, context, browser } = this.browserManager;
      
      this.browserManager.page = null;
      this.browserManager.context = null;
      this.browserManager.browser = null;
      
      // Close in order
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
```

### Operation Optimization

1. **Parallel Capability**
   - Promise-based operations
   - Can run multiple wrappers in parallel
   - Independent contexts prevent interference

2. **Smart Screenshots**
   - Base64 encoding for easy transport
   - Quality settings for JPEG
   - Viewport optimization

3. **Efficient Selectors**
   - CSS selectors preferred for speed
   - Fallback only when necessary
   - Cached element references where safe

## Security Considerations

### Script Execution Safety

```javascript
async executeScript(script, args = []) {
  // Validate script doesn't contain obvious malicious patterns
  const dangerous = [
    'eval(',
    'Function(',
    'setTimeout(',
    'setInterval(',
    '__proto__',
    'constructor['
  ];
  
  for (const pattern of dangerous) {
    if (script.includes(pattern)) {
      throw new Error(`Potentially dangerous script pattern: ${pattern}`);
    }
  }
  
  // Execute in page context with timeout
  return await this.page.evaluate(script, args);
}
```

### Resource Isolation

1. **Context Isolation**
   - Each wrapper has isolated browser context
   - No cookie/storage sharing
   - Prevents cross-contamination

2. **Process Isolation**
   - Playwright runs browsers in separate processes
   - Crash isolation
   - Security boundaries

### Input Validation

```javascript
function validateURL(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
      throw new Error(`Invalid protocol: ${parsed.protocol}`);
    }
    return parsed.href;
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}
```

## Testing Architecture

### Test Strategy

1. **Unit Tests**
   - Component isolation
   - Mock Playwright API
   - Error scenario coverage

2. **Integration Tests**
   - Real browser operations
   - Network interaction
   - Full operation flows

### Mock Strategy

```javascript
// Mock Playwright API
const mockPage = {
  goto: jest.fn(),
  click: jest.fn(),
  fill: jest.fn(),
  screenshot: jest.fn(),
  evaluate: jest.fn(),
  locator: jest.fn(() => mockLocator)
};

const mockBrowser = {
  newContext: jest.fn(() => mockContext),
  close: jest.fn()
};

// Test example
describe('PlaywrightWrapper', () => {
  it('should navigate to page', async () => {
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.title.mockResolvedValue('Test Page');
    
    const wrapper = new PlaywrightWrapper();
    const result = await wrapper.navigateToPage('https://example.com');
    
    expect(result.success).toBe(true);
    expect(result.title).toBe('Test Page');
  });
});
```

## Future Enhancements

### Planned Features

1. **Advanced Automation**
   - Record and replay functionality
   - Visual regression testing
   - Performance metrics collection
   - Accessibility testing

2. **Enhanced Selectors**
   - AI-powered element detection
   - Visual selectors (click on image)
   - Natural language selectors
   - Layout-based selection

3. **Network Control**
   - Request interception
   - Response mocking
   - Bandwidth throttling
   - Offline mode testing

4. **Parallel Execution**
   - Browser pool management
   - Concurrent operation support
   - Load distribution
   - Resource optimization

### Architecture Evolution

1. **Plugin System**
   ```javascript
   class PlaywrightWrapper {
     use(plugin) {
       plugin.install(this);
     }
   }
   ```

2. **Event System**
   ```javascript
   wrapper.on('navigation', (data) => {
     console.log(`Navigated to ${data.url}`);
   });
   ```

3. **Advanced Configuration**
   ```javascript
   const wrapper = new PlaywrightWrapper({
     browserType: 'chromium',
     pool: {
       min: 1,
       max: 5
     },
     plugins: [
       new ScreenshotPlugin(),
       new NetworkPlugin()
     ]
   });
   ```

### API Extensions

1. **Batch Operations**
   ```javascript
   await wrapper.batch([
     { action: 'navigate', url: 'https://example.com' },
     { action: 'click', selector: 'button' },
     { action: 'extract', selectors: { title: 'h1' } }
   ]);
   ```

2. **Conditional Operations**
   ```javascript
   await wrapper.conditionally({
     if: { exists: '.cookie-banner' },
     then: { click: '.accept-cookies' },
     else: { continue: true }
   });
   ```

3. **State Management**
   ```javascript
   const state = await wrapper.saveState();
   // ... other operations
   await wrapper.restoreState(state);
   ```

## Conclusion

The Playwright package demonstrates a well-architected solution for browser automation within the jsEnvoy ecosystem. Its design balances power and simplicity, providing a natural API for AI agents while maintaining the full capabilities of Playwright.

Key architectural strengths:
- **Robust error handling** with context-aware retry logic
- **Flexible selector strategies** accommodating various use cases
- **Resource efficiency** through lazy initialization and reuse
- **Clean API design** with consistent patterns and responses
- **Extensibility** through modular architecture and clear interfaces

The package successfully abstracts Playwright's complexity while remaining powerful enough for sophisticated browser automation tasks, making it an ideal tool for AI-driven web interaction.