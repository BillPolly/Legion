# @jsenvoy/code-gen

AI-powered code generation framework for creating complete JavaScript projects with automated testing and quality assurance.

## Overview

The code-gen package provides two main components:

1. **`@jsenvoy/code-agent`** - Intelligent coding agent that generates complete projects
2. **`@jsenvoy/llm-planner`** - Hierarchical planning engine for complex workflows

## Features

- 🚀 **Complete Project Generation** - Generates frontend, backend, or fullstack projects
- 🧪 **Automated Testing** - Creates comprehensive Jest test suites with coverage
- ✅ **Quality Assurance** - Built-in ESLint validation and automatic fixing
- 📋 **Intelligent Planning** - LLM-powered architecture and dependency planning
- 🔄 **Iterative Improvement** - Automatically fixes issues until quality gates pass
- 💾 **State Persistence** - Resume interrupted workflows seamlessly

## Installation

```bash
npm install @jsenvoy/code-agent
# or
yarn add @jsenvoy/code-agent
```

## Quick Start

```javascript
import { CodeAgent } from '@jsenvoy/code-agent';

// Create and initialize agent
const agent = new CodeAgent({
  projectType: 'fullstack'
});

await agent.initialize('./my-project', {
  llmConfig: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY
  }
});

// Generate a complete project
const result = await agent.develop({
  task: 'Create a todo list application',
  frontend: {
    description: 'React-like interface with forms and lists',
    features: ['Add todos', 'Mark complete', 'Filter by status']
  },
  backend: {
    description: 'REST API with Express',
    features: ['CRUD operations', 'Persistence', 'Validation']
  }
});
```

## Architecture

### Code Agent Workflow

```
Requirements → Planning → Code Generation → Test Generation → Quality Checks → Iterative Fixing
     ↓            ↓             ↓                ↓                ↓                ↓
   Analyze    Architecture   HTML/JS/CSS    Jest Tests      ESLint/Jest    Auto-fix
```

### Component Structure

```
@jsenvoy/code-gen/
├── code-agent/          # Main code generation agent
│   ├── planning/        # LLM-powered planning system
│   ├── generation/      # Code generators (HTML, JS, CSS, Tests)
│   ├── config/          # ESLint, Jest, State management
│   └── tracking/        # Progress and task tracking
└── llm-planner/         # Hierarchical planning engine
    └── models/          # Plan, Step, Action models
```

## Core Components

### Generators

- **`HTMLGenerator`** - Semantic HTML with forms, components, and templates
- **`JSGenerator`** - ES6+ JavaScript modules, classes, and functions
- **`CSSGenerator`** - Modern CSS with layouts, themes, and animations
- **`TestGenerator`** - Jest unit, integration, and e2e tests

### Planning System

- **`UnifiedPlanner`** - Single planner for all domains
- **`GenericPlanner`** - LLM-based hierarchical planning
- **Planning Domains**: Requirements, Directory, Dependencies, Architecture, APIs

### Quality Assurance

- **`EslintConfigManager`** - Dynamic ESLint rule management
- **`JestConfigManager`** - Test configuration and coverage
- **Iterative Fixing** - Automatic issue resolution

## API Reference

### CodeAgent

```javascript
class CodeAgent {
  constructor(config?: {
    projectType?: 'frontend' | 'backend' | 'fullstack';
    testCoverage?: { threshold: number };
    qualityGates?: { eslintErrors: number; eslintWarnings: number };
  })
  
  async initialize(workingDirectory: string, options?: {
    llmConfig?: { provider: string; apiKey: string };
  }): Promise<void>
  
  async develop(requirements: {
    task: string;
    frontend?: { description: string; features: string[] };
    backend?: { description: string; features: string[] };
  }): Promise<{
    filesGenerated: number;
    testsCreated: number;
    qualityGatesPassed: boolean;
    duration: number;
  }>
  
  async fix(fixRequirements: {
    errors: string[];
  }): Promise<{
    issuesFixed: number;
    qualityGatesPassed: boolean;
  }>
}
```

## Advanced Usage

### Custom Generators

```javascript
import { JSGenerator, CSSGenerator } from '@jsenvoy/code-agent';

const jsGen = new JSGenerator({
  target: 'es2022',
  semicolons: false,
  quotes: 'double'
});

const moduleCode = await jsGen.generateModule({
  name: 'userService',
  functions: [{
    name: 'getUser',
    params: ['id'],
    isAsync: true,
    body: 'return await db.users.findById(id);'
  }]
});
```

### Planning Integration

```javascript
import { UnifiedPlanner } from '@jsenvoy/code-agent';

const planner = new UnifiedPlanner({
  provider: 'anthropic'
});

await planner.initialize();

const analysis = await planner.analyzeRequirements({
  task: 'Build a chat application'
});

const architecture = await planner.planBackendArchitecture(analysis);
```

## Configuration

### Environment Variables

```bash
# LLM Provider API Keys
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key

# Optional Configuration
CODE_AGENT_WORKING_DIR=/path/to/projects
CODE_AGENT_TEST_COVERAGE=80
```

### Quality Gates

```javascript
const agent = new CodeAgent({
  qualityGates: {
    eslintErrors: 0,        // No errors allowed
    eslintWarnings: 5,      // Max 5 warnings
    testCoverage: 80,       // Minimum 80% coverage
    allTestsPass: true      // All tests must pass
  }
});
```

## Examples

See the `examples/` directory for complete examples:

- `simple-project.js` - Generate a basic todo app
- `api-service.js` - Create a REST API service
- `frontend-app.js` - Build a frontend application

## Testing

```bash
# Run all tests
npm test

# Run specific package tests
npm run test:code-agent
npm run test:llm-planner

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT © jsEnvoy

## Status

- ✅ Planning System (UnifiedPlanner, GenericPlanner)
- ✅ Code Generators (HTML, JS, CSS, Tests)
- ✅ Quality Assurance (ESLint, Jest integration)
- ✅ State Management & Persistence
- ✅ Iterative Fixing Workflow
- 🚧 Real-world Testing & Optimization
- 🚧 Additional Language Support

## Roadmap

- [ ] TypeScript support
- [ ] React/Vue/Angular templates
- [ ] Database integration helpers
- [ ] Docker configuration generation
- [ ] CI/CD pipeline generation
- [ ] Custom template system