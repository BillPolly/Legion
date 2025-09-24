# @legion/code-agent - Comprehensive Documentation

## Overview

The **@legion/code-agent** is an AI-powered code generation platform that creates, tests, and validates complete JavaScript projects using real-world testing capabilities. Unlike traditional code generators, it provides end-to-end validation through actual test execution, browser automation, and comprehensive log analysis.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Core Features](#core-features)
4. [API Reference](#api-reference)
5. [Configuration](#configuration)
6. [Enhanced Runtime Testing](#enhanced-runtime-testing)
7. [Browser Testing & Automation](#browser-testing--automation)
8. [Examples](#examples)
9. [Testing Framework](#testing-framework)
10. [Migration Guide](#migration-guide)
11. [Development & Contributing](#development--contributing)

## Quick Start

### Installation

```bash
npm install @legion/code-agent
```

### Basic Usage (Mock Testing)

```javascript
import { CodeAgent } from '@legion/code-agent';

const agent = new CodeAgent({
  projectType: 'fullstack',
  enableConsoleOutput: true
});

await agent.initialize('./my-project');

const result = await agent.develop({
  projectName: 'Todo App',
  description: 'A todo list application',
  features: [
    'Add and remove tasks',
    'Mark tasks as complete',
    'Filter by status'
  ]
});
```

### Enhanced Usage (Real Testing + Browser Automation)

```javascript
import { EnhancedCodeAgent } from '@legion/code-agent';

const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true,
    enablePerformanceMonitoring: true
  }
});

await agent.initialize('./my-project', {
  llmConfig: {
    provider: 'openai', // or 'anthropic'
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  }
});

const result = await agent.develop({
  projectName: 'Interactive Dashboard',
  description: 'Real-time dashboard with API integration',
  features: [
    'Real-time data visualization',
    'User authentication',
    'REST API with Express.js',
    'Responsive design with animations'
  ]
});

console.log(`✅ Project completed successfully!`);
console.log(`📊 Tests executed: ${result.enhanced.runtimeTesting.testsExecuted}`);
console.log(`📈 Coverage: ${result.enhanced.runtimeTesting.coverage}%`);
console.log(`🌐 Browser tests: ${result.enhanced.browserTesting.testsRun}`);
```

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced Code Agent                      │
├─────────────────────────────────────────────────────────────┤
│  Planning Layer (AI-Powered)                              │
│  ├── UnifiedPlanner      (LLM-based architecture planning) │
│  ├── TaskTracker         (Progress & state management)     │
│  └── Requirements Analysis (Feature extraction & validation)│
├─────────────────────────────────────────────────────────────┤
│  Code Generation Layer                                     │
│  ├── HTMLGenerator       (Semantic HTML5 generation)       │
│  ├── CSSGenerator        (Modern CSS with Flexbox/Grid)    │
│  ├── JSGenerator         (ES6+ vanilla JavaScript)         │
│  └── TestGenerator       (Jest test suite generation)      │
├─────────────────────────────────────────────────────────────┤
│  Runtime Testing Layer (REAL EXECUTION)                   │
│  ├── TestExecutionEngine (Real Jest execution)             │
│  ├── RealESLintExecutor  (Actual ESLint validation)        │
│  ├── ParallelTestExecutor (Multi-threaded test execution)  │
│  └── ServerExecutionManager (Real server startup/testing)  │
├─────────────────────────────────────────────────────────────┤
│  Browser Testing Layer (PLAYWRIGHT INTEGRATION)           │
│  ├── BrowserTestGenerator (E2E test generation)            │
│  ├── E2ETestRunner       (Cross-browser test execution)    │
│  ├── VisualRegressionTester (Screenshot comparison)        │
│  ├── PerformanceBenchmark (Page speed & metrics)           │
│  ├── AccessibilityTester  (WCAG compliance testing)        │
│  └── ResponsiveDesignTester (Multi-device testing)         │
├─────────────────────────────────────────────────────────────┤
│  Log Analysis & Intelligence Layer                        │
│  ├── TestLogManager      (Comprehensive log capture)       │
│  ├── LogAnalysisEngine   (Pattern recognition & insights)  │
│  ├── EnhancedSuggestionGenerator (AI-powered fixes)        │
│  └── EnhancedCorrelationEngine (Cross-system log analysis) │
├─────────────────────────────────────────────────────────────┤
│  Quality & Monitoring Layer                               │
│  ├── EnhancedQualityPhase (Real quality validation)        │
│  ├── SecurityScanner     (Vulnerability detection)         │
│  ├── PerformanceMonitor  (Real-time resource tracking)     │
│  └── SystemHealthMonitor (System resource management)      │
├─────────────────────────────────────────────────────────────┤
│  Orchestration & Management Layer                         │
│  ├── ComprehensiveTestingPhase (Test orchestration)        │
│  ├── EnhancedFixingPhase (AI-powered issue resolution)     │
│  ├── TestOrchestrator    (Parallel test coordination)      │
│  └── E2EValidator        (End-to-end workflow validation)  │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
Requirements → Planning → Code Generation → Real Testing → Browser Testing → Analysis → Fixes → Validation
     ↓             ↓            ↓              ↓              ↓              ↓          ↓         ↓
   AI Analysis → Architecture → HTML/CSS/JS → Jest+ESLint → Playwright E2E → Log AI → Auto-Fix → Quality Gates
```

## Core Features

### 🎯 AI-Powered Planning
- **Intelligent Architecture Design**: Analyzes requirements to create optimal project structures
- **Feature Extraction**: Automatically identifies frontend/backend requirements
- **Dependency Planning**: Determines optimal file creation order and dependencies
- **Test Strategy Planning**: Creates comprehensive testing strategies

### 📝 Code Generation
- **Vanilla JavaScript**: No frameworks required - generates clean, modern ES6+
- **Semantic HTML5**: Accessible, standards-compliant markup
- **Modern CSS**: Flexbox/Grid layouts, responsive design, animations
- **Modular Architecture**: Clean separation of concerns

### 🧪 Real Testing (Not Mocked!)
- **Actual Jest Execution**: Runs real Jest tests with coverage reporting
- **Real ESLint Validation**: Executes actual ESLint with custom rules
- **Server Testing**: Starts and validates real Express.js servers
- **Parallel Test Execution**: Multi-threaded testing for performance

### 🌐 Browser Automation
- **Playwright Integration**: Cross-browser testing (Chromium, Firefox, WebKit)
- **Visual Regression**: Screenshot comparison and change detection
- **Performance Testing**: Page speed, Core Web Vitals, resource analysis
- **Accessibility Testing**: WCAG compliance validation
- **Responsive Testing**: Multi-device and viewport testing

### 📊 Log Analysis & Intelligence
- **Comprehensive Log Capture**: All test output, server logs, browser console
- **AI-Powered Analysis**: Pattern recognition and root cause analysis
- **Cross-System Correlation**: Connects errors across frontend/backend/tests
- **Intelligent Suggestions**: Actionable fix recommendations

### 🔧 AI-Powered Fixing
- **Log-Based Insights**: Uses captured logs to understand failures
- **Iterative Improvement**: Applies fixes and re-validates automatically
- **Root Cause Analysis**: Identifies underlying issues, not just symptoms
- **Learning System**: Improves fix suggestions over time

## API Reference

### Core Classes

#### CodeAgent (Base Class)
```javascript
class CodeAgent extends EventEmitter {
  constructor(config: CodeAgentConfig);
  
  // Initialize the agent
  async initialize(workingDirectory: string, options?: InitOptions): Promise<void>;
  
  // Generate a complete project
  async develop(requirements: Requirements): Promise<ProjectSummary>;
  
  // Fix specific issues
  async fix(fixRequirements: FixRequirements): Promise<FixSummary>;
  
  // Get current project summary
  getProjectSummary(): ProjectSummary;
  
  // State management
  async saveState(): Promise<void>;
  async loadState(): Promise<void>;
}
```

#### EnhancedCodeAgent (Enhanced with Real Testing)
```javascript
class EnhancedCodeAgent extends CodeAgent {
  constructor(config: EnhancedCodeAgentConfig);
  
  // Enhanced development with real testing
  async develop(requirements: Requirements): Promise<EnhancedProjectSummary>;
  
  // Run real quality checks
  async runEnhancedQualityChecks(): Promise<QualityResults>;
  
  // Execute comprehensive testing
  async runComprehensiveTesting(): Promise<TestResults>;
  
  // Apply AI-powered fixes
  async runEnhancedFixing(): Promise<FixResults>;
  
  // Generate enhanced summary with metrics
  async generateEnhancedSummary(): Promise<EnhancedSummary>;
}
```

### Configuration Types

#### CodeAgentConfig
```typescript
interface CodeAgentConfig {
  projectType: 'frontend' | 'backend' | 'fullstack';
  enableConsoleOutput?: boolean;
  eslintRules?: Record<string, any>;
  testCoverage?: {
    threshold: number;
  };
  qualityGates?: {
    eslintErrors: number;
    eslintWarnings: number;
    testCoverage: number;
    allTestsPass: boolean;
  };
}
```

#### EnhancedCodeAgentConfig
```typescript
interface EnhancedCodeAgentConfig extends CodeAgentConfig {
  enhancedConfig: {
    enableRuntimeTesting: boolean;
    enableBrowserTesting: boolean;
    enableLogAnalysis: boolean;
    enablePerformanceMonitoring?: boolean;
    runtimeTimeout?: number;
    browserHeadless?: boolean;
    parallelExecution?: boolean;
    browserConfig?: {
      browsers: string[];
      viewport: { width: number; height: number; };
    };
  };
}
```

#### Requirements
```typescript
interface Requirements {
  projectName: string;
  description: string;
  features: string[];
  projectType?: 'frontend' | 'backend' | 'fullstack';
  requirements?: {
    frontend?: string;
    backend?: string;
  };
}
```

### Events

The code agent emits detailed events for monitoring and integration:

```javascript
agent.on('phase-start', (data) => {
  console.log(`Starting ${data.phase}: ${data.message}`);
});

agent.on('progress', (data) => {
  console.log(`Progress: ${data.message}`);
});

agent.on('phase-complete', (data) => {
  console.log(`Completed ${data.phase}: ${data.message}`);
});

agent.on('error', (data) => {
  console.error(`Error in ${data.phase}: ${data.message}`);
});

// Enhanced events
agent.on('test-executed', (data) => {
  console.log(`Test executed: ${data.testName} - ${data.status}`);
});

agent.on('browser-test-complete', (data) => {
  console.log(`Browser test completed: ${data.browser} - ${data.results}`);
});

agent.on('performance-alert', (data) => {
  console.warn(`Performance alert: ${data.metric} exceeded threshold`);
});
```

## Configuration

### Environment Setup

The enhanced code agent integrates with the jsEnvoy ecosystem and requires environment variables for LLM providers:

```bash
# .env file
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Optional: Browser testing configuration
PLAYWRIGHT_BROWSERS=chromium,firefox
HEADLESS_MODE=true
```

### Basic Configuration

```javascript
const basicConfig = {
  projectType: 'fullstack',
  enableConsoleOutput: true,
  eslintRules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': 'warn'
  },
  testCoverage: {
    threshold: 80
  },
  qualityGates: {
    eslintErrors: 0,
    eslintWarnings: 5,
    testCoverage: 80,
    allTestsPass: true
  }
};
```

### Enhanced Configuration

```javascript
const enhancedConfig = {
  ...basicConfig,
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true,
    enablePerformanceMonitoring: true,
    runtimeTimeout: 300000, // 5 minutes
    browserHeadless: true,
    parallelExecution: true,
    browserConfig: {
      browsers: ['chromium', 'firefox', 'webkit'],
      viewport: { width: 1920, height: 1080 }
    }
  }
};
```

### Runtime Configuration

```javascript
const runtimeOptions = {
  llmConfig: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 4000
  },
  runtimeConfig: {
    logLevel: 'info',
    captureConsole: true,
    enableVerboseLogging: false
  }
};
```

## Enhanced Runtime Testing

### Real Test Execution

Unlike traditional code generators that simulate tests, the enhanced code agent executes actual Jest tests:

```javascript
// Real Jest execution with coverage
const testResults = await agent.runEnhancedQualityChecks();

console.log(`Tests executed: ${testResults.jest.totalTests}`);
console.log(`Passed: ${testResults.jest.passed}`);
console.log(`Failed: ${testResults.jest.failed}`);
console.log(`Coverage: ${testResults.jest.coverage}%`);
```

### Real ESLint Validation

Executes actual ESLint with custom rules:

```javascript
// Real ESLint execution
const lintResults = await agent.runEnhancedQualityChecks();

console.log(`ESLint errors: ${lintResults.eslint.errorCount}`);
console.log(`ESLint warnings: ${lintResults.eslint.warningCount}`);
console.log(`Files checked: ${lintResults.eslint.filesChecked}`);
```

### Server Testing

Starts and validates real Express.js servers:

```javascript
// Real server startup and testing
const serverResults = await agent.runComprehensiveTesting();

console.log(`Server started on port: ${serverResults.server.port}`);
console.log(`Health check: ${serverResults.server.healthStatus}`);
console.log(`API endpoints tested: ${serverResults.server.endpointsTested}`);
```

## Browser Testing & Automation

### Playwright Integration

The enhanced code agent includes comprehensive browser testing:

```javascript
// Browser testing with Playwright
const browserResults = await agent.runComprehensiveTesting();

console.log(`Browsers tested: ${browserResults.browser.browsers.join(', ')}`);
console.log(`Screenshots captured: ${browserResults.browser.screenshots}`);
console.log(`Performance score: ${browserResults.browser.performanceScore}`);
```

### Visual Regression Testing

Automatically captures and compares screenshots:

```javascript
// Visual regression testing
const visualResults = await agent.runVisualRegressionTests();

console.log(`Screenshots compared: ${visualResults.comparisons}`);
console.log(`Visual differences found: ${visualResults.differences}`);
console.log(`Regression threshold: ${visualResults.threshold}%`);
```

### Accessibility Testing

WCAG compliance validation:

```javascript
// Accessibility testing
const a11yResults = await agent.runAccessibilityTests();

console.log(`Accessibility violations: ${a11yResults.violations}`);
console.log(`WCAG level: ${a11yResults.wcagLevel}`);
console.log(`Score: ${a11yResults.score}/100`);
```

## Examples

### Complete Web Application

```javascript
import { EnhancedCodeAgent } from '@legion/code-agent';

const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true
  }
});

await agent.initialize('./todo-app');

const result = await agent.develop({
  projectName: 'Advanced Todo Application',
  description: 'A feature-rich todo list with real-time updates',
  features: [
    'User authentication with JWT',
    'Real-time todo updates via WebSocket',
    'Drag and drop task reordering',
    'Due date reminders',
    'Category-based filtering',
    'Export to CSV functionality',
    'Dark/light theme toggle',
    'Responsive design for mobile'
  ]
});

// Generated project structure:
// todo-app/
// ├── frontend/
// │   ├── index.html
// │   ├── styles/
// │   │   ├── main.css
// │   │   └── themes.css
// │   └── scripts/
// │       ├── app.js
// │       ├── auth.js
// │       └── websocket.js
// ├── backend/
// │   ├── server.js
// │   ├── routes/
// │   │   ├── auth.js
// │   │   └── todos.js
// │   ├── middleware/
// │   │   └── auth.js
// │   └── models/
// │       └── todo.js
// ├── tests/
// │   ├── frontend/
// │   │   ├── app.test.js
// │   │   └── auth.test.js
// │   ├── backend/
// │   │   ├── server.test.js
// │   │   └── routes.test.js
// │   └── e2e/
// │       └── todo-workflow.test.js
// └── package.json
```

### API Server with Database

```javascript
const result = await agent.develop({
  projectName: 'User Management API',
  description: 'RESTful API for user management with authentication',
  features: [
    'User registration and login',
    'JWT token authentication',
    'Password hashing with bcrypt',
    'Input validation and sanitization',
    'Rate limiting',
    'API documentation',
    'Error handling middleware',
    'Database integration with MongoDB'
  ]
});

// Automatically generates:
// - Express.js server with proper middleware
// - Authentication routes with JWT
// - Input validation schemas
// - Error handling middleware
// - Rate limiting configuration
// - API documentation
// - Comprehensive test suite
// - Security best practices
```

### Interactive Frontend

```javascript
const result = await agent.develop({
  projectName: 'Interactive Dashboard',
  description: 'Data visualization dashboard with real-time updates',
  features: [
    'Real-time data charts',
    'Interactive filters and controls',
    'Responsive grid layout',
    'Dark/light theme support',
    'Smooth animations',
    'WebSocket integration',
    'Export functionality',
    'Touch-friendly mobile interface'
  ]
});

// Automatically generates:
// - Semantic HTML5 structure
// - Modern CSS with Grid/Flexbox
// - Vanilla JavaScript with ES6+ features
// - Chart.js integration
// - WebSocket client
// - Responsive design
// - Accessibility features
// - Performance optimizations
```

## Testing Framework

### Comprehensive Test Suite

The code agent generates and executes comprehensive test suites:

#### Unit Tests
```javascript
// Generated Jest unit tests
describe('TodoService', () => {
  test('should add new todo', () => {
    const service = new TodoService();
    const todo = service.addTodo('Test task');
    expect(todo.text).toBe('Test task');
    expect(todo.completed).toBe(false);
  });
  
  test('should mark todo as complete', () => {
    const service = new TodoService();
    const todo = service.addTodo('Test task');
    service.completeTodo(todo.id);
    expect(todo.completed).toBe(true);
  });
});
```

#### Integration Tests
```javascript
// Generated integration tests
describe('API Integration', () => {
  test('should handle todo CRUD operations', async () => {
    const response = await request(app)
      .post('/api/todos')
      .send({ text: 'Integration test todo' });
    
    expect(response.status).toBe(201);
    expect(response.body.text).toBe('Integration test todo');
  });
});
```

#### E2E Tests
```javascript
// Generated Playwright E2E tests
test('complete todo workflow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Add new todo
  await page.fill('[data-testid="todo-input"]', 'E2E test todo');
  await page.click('[data-testid="add-todo"]');
  
  // Verify todo appears
  await expect(page.locator('[data-testid="todo-item"]')).toContainText('E2E test todo');
  
  // Mark as complete
  await page.click('[data-testid="todo-checkbox"]');
  await expect(page.locator('[data-testid="todo-item"]')).toHaveClass(/completed/);
});
```

### Real Test Execution Results

```javascript
// Example test execution results
const testResults = {
  jest: {
    totalTests: 45,
    passed: 43,
    failed: 2,
    skipped: 0,
    coverage: 87.5,
    duration: 2341
  },
  eslint: {
    errorCount: 0,
    warningCount: 3,
    filesChecked: 12,
    rulesApplied: 150
  },
  browser: {
    browsers: ['chromium', 'firefox'],
    testsRun: 15,
    screenshots: 8,
    performanceScore: 94,
    accessibilityScore: 98
  }
};
```

## Migration Guide

### From CodeAgent to EnhancedCodeAgent

#### Step 1: Update Import
```javascript
// Before
import { CodeAgent } from '@jsenvoy/code-agent';

// After
import { EnhancedCodeAgent } from '@jsenvoy/code-agent';
```

#### Step 2: Update Configuration
```javascript
// Before
const agent = new CodeAgent({
  projectType: 'fullstack'
});

// After
const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true
  }
});
```

#### Step 3: Handle Enhanced Results
```javascript
// Before
const result = await agent.develop(requirements);
console.log(`Files generated: ${result.filesGenerated}`);

// After
const result = await agent.develop(requirements);
console.log(`Files generated: ${result.filesGenerated}`);
console.log(`Tests executed: ${result.enhanced.runtimeTesting.testsExecuted}`);
console.log(`Browser tests: ${result.enhanced.browserTesting.testsRun}`);
```

### Performance Considerations

- **Memory Usage**: Enhanced testing requires more memory (2-4GB recommended)
- **Execution Time**: Real testing takes longer but provides actual validation
- **Browser Resources**: Playwright requires additional system resources
- **Parallel Execution**: Can run multiple tests in parallel for better performance

## Development & Contributing

### Project Structure

```
@legion/code-agent/
├── src/
│   ├── agent/                    # Core agent classes
│   │   ├── CodeAgent.js         # Base agent implementation
│   │   ├── EnhancedCodeAgent.js # Enhanced agent with real testing
│   │   └── phases/              # Development phases
│   ├── browser/                 # Browser testing components
│   ├── execution/               # Real test execution
│   ├── generation/              # Code generation
│   ├── integration/             # External integrations
│   ├── logging/                 # Log analysis
│   ├── monitoring/              # Performance monitoring
│   ├── planning/                # AI-powered planning
│   └── validation/              # Quality validation
├── __tests__/                   # Test suites (57 test files)
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── system/                  # System tests
├── docs/                        # Documentation
└── examples/                    # Working examples
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Key Dependencies

- **Core**: `eslint`, `jest`, `zod`, `@babel/parser`
- **Legion Integration**: Uses file operations, LLM client, module loader
- **Browser Testing**: Playwright integration
- **Enhanced Features**: Log manager, node runner integration

### Version Information

- **Current Version**: 0.0.1
- **Node.js Requirement**: >= 18.0.0
- **ES Module**: Full ES6+ module support
- **Test Files**: 57 comprehensive test files

## License

MIT License - See [LICENSE](../LICENSE) for details.

## Support

For issues, questions, or feature requests:
- **GitHub Issues**: [Report issues](https://github.com/maxximus-dev/Legion/issues)
- **Documentation**: This comprehensive guide
- **Examples**: See [examples/](../examples/) directory
- **Tests**: See [__tests__/](../__tests__/) for usage patterns

---

*This documentation reflects the current state of the enhanced @legion/code-agent with real runtime testing, browser automation, and AI-powered analysis capabilities.*
