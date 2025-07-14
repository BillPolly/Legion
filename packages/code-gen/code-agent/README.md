# @jsenvoy/code-agent

An intelligent coding agent that generates, tests, and validates vanilla JavaScript projects with automated quality assurance.

## Overview

The Code Agent is a specialized AI-powered tool that can:

- 🎯 **Plan** multi-file project structures
- 📝 **Generate** vanilla JavaScript code (frontend and backend)
- 🧪 **Test** code with automatically generated Jest tests
- ✅ **Validate** code with programmatic ESLint rules
- 🔄 **Iterate** until all quality gates pass
- 📊 **Track** progress and maintain state across sessions

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

### Basic Usage

```javascript
import { CodeAgent } from '@jsenvoy/code-agent';

const agent = new CodeAgent();

// Initialize in a project directory
await agent.initialize('./my-project');

// Generate a complete project
await agent.develop({
  task: "Create a todo list application",
  requirements: {
    frontend: "HTML form for adding todos, display list with delete functionality",
    backend: "REST API with CRUD operations, file-based storage"
  }
});
```

### Fixing Mode

```javascript
// Fix specific issues
await agent.fix({
  errors: [
    "Test failed: Expected 3 todos, received 2",
    "ESLint error: Unused variable 'todoId' in todo.js:15"
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

The agent can be configured for different project types:

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

- [Design Document](./docs/DESIGN.md) - Comprehensive technical design
- [API Reference](./docs/API.md) - Detailed API documentation
- [Workflows](./docs/WORKFLOWS.md) - Development workflow documentation
- [Examples](./docs/EXAMPLES.md) - Usage examples and patterns

## Requirements

- Node.js >= 18.0.0
- ES6 modules support
- Internet connection for LLM integration

## License

MIT - See [LICENSE](./LICENSE) for details.

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For issues, questions, or feature requests, please use our GitHub issues tracker.