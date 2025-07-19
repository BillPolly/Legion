# @jsenvoy/code-agent

An intelligent coding agent that generates, tests, and validates vanilla JavaScript projects with automated quality assurance. Now with **real runtime testing** capabilities!

## Overview

The Code Agent is a specialized AI-powered tool that can:

- 🎯 **Plan** multi-file project structures with AI-driven architecture
- 📝 **Generate** vanilla JavaScript code (frontend and backend)
- 🧪 **Test** code with real Jest execution (not mocked!)
- ✅ **Validate** code with real ESLint execution
- 🌐 **Browser Test** with Playwright automation
- 📊 **Analyze Logs** for intelligent debugging
- 🔄 **Auto-Fix** issues using AI with log insights
- ⚡ **Optimize** performance with parallel execution
- 💾 **Track** progress and maintain state across sessions

## 🚀 New: Enhanced Runtime Testing

The enhanced version provides real-world validation:
- **Real Test Execution**: Actually runs Jest tests, not simulated
- **Browser Automation**: Full E2E testing with Playwright
- **Server Testing**: Starts and validates real servers
- **Log Analysis**: Captures and analyzes all logs for insights
- **Performance Monitoring**: Tracks CPU, memory, and execution time
- **AI-Powered Fixes**: Uses log data to generate targeted fixes

## Key Features

### No Frameworks Required
- Generates vanilla HTML, CSS, and JavaScript for frontend
- Creates Node.js modules with ES6+ for backend
- No build systems or compilation required
- Code runs directly in browsers and Node.js

### Programmatic Quality Control
- ESLint rules defined entirely in code (no config files)
- Dynamic rule configuration based on project type
- Automatic fixing and iterative improvement
- Jest tests generated and executed programmatically

### Intelligent Planning
- Analyzes requirements to create optimal project structures
- Plans directory layouts and file organization
- Coordinates frontend/backend architecture
- Maintains consistency across project components

### State Management
- Always knows what it's working on
- Never finishes until all tests pass and ESLint validates
- Persists state across interruptions
- Can resume work from any point

## Installation

```bash
npm install @jsenvoy/code-agent
```

## Quick Start

### Basic Usage (Mocked Testing)

```javascript
import { CodeAgent } from '@jsenvoy/code-agent';

const agent = new CodeAgent();

// Initialize in a project directory
await agent.initialize('./my-project');

// Generate a complete project
await agent.develop({
  projectName: 'Todo App',
  description: 'A todo list application',
  features: [
    'Add and remove tasks',
    'Mark tasks as complete',
    'Filter by status'
  ]
});
```

### Enhanced Usage (Real Testing) 🆕

```javascript
import { EnhancedCodeAgent } from '@jsenvoy/code-agent';

const agent = new EnhancedCodeAgent({
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true
  }
});

// Initialize with runtime options
await agent.initialize('./my-project', {
  runtimeConfig: {
    logLevel: 'info',
    captureConsole: true
  }
});

// Generate and test with real execution
const result = await agent.develop({
  projectName: 'Todo App',
  description: 'A todo list application with real testing',
  features: ['CRUD operations', 'User authentication']
});

// Access detailed metrics
console.log(`Tests executed: ${result.enhanced.runtimeTesting.testsExecuted}`);
console.log(`Coverage: ${result.enhanced.runtimeTesting.coverage}%`);
```

### Fixing Mode

```javascript
// Fix specific issues with AI-powered analysis
await agent.fix({
  issues: [
    'Tests are failing for user authentication',
    'ESLint errors in api.js'
  ]
});
```

## Project Structure Generated

The Code Agent creates well-organized project structures:

```
my-project/
├── frontend/
│   ├── index.html          # Main HTML file
│   ├── styles/
│   │   └── main.css        # Styling
│   └── scripts/
│       └── app.js          # Frontend logic
├── backend/
│   ├── server.js           # Express server
│   ├── routes/
│   │   └── api.js          # API routes
│   └── models/
│       └── todo.js         # Data models
├── tests/
│   ├── frontend/
│   │   └── app.test.js     # Frontend tests
│   └── backend/
│       └── server.test.js  # Backend tests
└── package.json            # Project configuration
```

## Quality Gates

The agent enforces strict quality requirements:

### ESLint Validation
- ✅ Zero errors allowed
- ✅ Zero warnings (configurable)
- ✅ Consistent code style
- ✅ Modern JavaScript practices

### Jest Testing
- ✅ All tests must pass
- ✅ Minimum 80% coverage
- ✅ No skipped tests
- ✅ Comprehensive test scenarios

### Code Quality
- ✅ No broken imports/exports
- ✅ Proper error handling
- ✅ Consistent naming conventions
- ✅ Clean architecture patterns

## Operating Modes

### 1. Initial Development Mode
Perfect for starting new projects from scratch:
- Analyzes requirements
- Plans project architecture
- Generates complete codebase
- Creates comprehensive tests
- Validates everything works

### 2. Iterative Fixing Mode
Ideal for fixing issues and making improvements:
- Analyzes specific errors
- Plans targeted fixes
- Applies fixes incrementally
- Re-validates quality gates
- Continues until successful

## Integration with jsEnvoy

The Code Agent seamlessly integrates with the jsEnvoy ecosystem:

- **File Operations**: Uses `@jsenvoy/general-tools` for file system operations
- **LLM Integration**: Leverages `@jsenvoy/llm` for intelligent code generation
- **Module Loading**: Follows `@jsenvoy/module-loader` patterns
- **Resource Management**: Can be managed by `@jsenvoy/resource-manager`

## Configuration

### Basic Configuration

```javascript
const agent = new CodeAgent({
  eslintRules: {
    // Custom ESLint rules
    'prefer-const': 'error',
    'no-var': 'error'
  },
  testCoverage: {
    threshold: 85 // Minimum coverage percentage
  },
  projectType: 'fullstack' // 'frontend', 'backend', or 'fullstack'
});
```

### Enhanced Configuration 🆕

```javascript
const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  qualityGates: {
    eslintErrors: 0,
    eslintWarnings: 5,
    testCoverage: 90,
    allTestsPass: true
  },
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true,
    enablePerformanceMonitoring: true,
    runtimeTimeout: 300000, // 5 minutes
    browserHeadless: true,
    parallelExecution: true,
    browserConfig: {
      browsers: ['chromium', 'firefox'],
      viewport: { width: 1920, height: 1080 }
    }
  }
});
```

## Examples

### Todo List Application
```javascript
await agent.develop({
  task: "Todo list with persistence",
  requirements: {
    frontend: "Add, display, delete todos with local storage",
    backend: "REST API with file-based persistence"
  }
});
```

### API Server
```javascript
await agent.develop({
  task: "User management API",
  requirements: {
    backend: "CRUD operations for users, validation, error handling"
  }
});
```

### Interactive Website
```javascript
await agent.develop({
  task: "Interactive portfolio site",
  requirements: {
    frontend: "Responsive design, smooth animations, contact form"
  }
});
```

## Documentation

- [Design Document](./docs/DESIGN.md) - Original technical design
- [Enhanced Design](./docs/ENHANCED_DESIGN.md) - Enhanced runtime testing design
- [API Reference](./docs/API.md) - Complete API documentation
- [Migration Guide](./docs/MIGRATION.md) - Migrate from mocked to real testing
- [Development Plan](./docs/DEVELOPMENT_PLAN.md) - Implementation roadmap
- [Examples](./examples/) - Working code examples

## Enhanced Features 🚀

### Real Test Execution
- Executes actual Jest tests with coverage reporting
- Captures test output and analyzes failures
- Provides detailed test metrics and insights

### Browser Testing
- Automated browser testing with Playwright
- Visual regression testing
- Cross-browser compatibility checks
- Performance benchmarking

### Log Analysis
- Captures all logs from tests, servers, and browsers
- AI-powered log correlation and pattern detection
- Root cause analysis for failures
- Actionable fix suggestions

### Performance Monitoring
- Real-time CPU and memory tracking
- Execution time optimization
- Resource usage alerts
- Performance trend analysis

### AI-Powered Fixing
- Analyzes logs to understand failures
- Generates targeted fixes based on root causes
- Validates fixes through iterative testing
- Learns from fix patterns

## Requirements

- Node.js >= 18.0.0
- ES6 modules support
- Internet connection for LLM integration

### Additional Requirements for Enhanced Features
- `@jsenvoy/log-manager` - Log capture and analysis
- `@jsenvoy/node-runner` - Process execution
- `@jsenvoy/playwright` - Browser automation
- Jest, ESLint, and Puppeteer as peer dependencies

## License

MIT - See [LICENSE](./LICENSE) for details.

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For issues, questions, or feature requests, please use our GitHub issues tracker.