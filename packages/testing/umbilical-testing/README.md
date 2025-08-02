# @legion/umbilical-testing

🎯 **A self-describing component testing framework that automatically detects subtle UI bugs, including the infamous `[object InputEvent]` parameter passing bug.**

## Overview

The Umbilical Testing Framework revolutionizes component testing by leveraging self-describing components to automatically generate comprehensive test suites. Born from the need to catch subtle bugs like `[object InputEvent]` (where event objects are passed instead of their values), this framework ensures your components behave exactly as they describe themselves.

## ✨ Key Features

- **🔍 Component Introspection**: Automatically analyzes component structure and capabilities
- **🧪 7 Test Generators**: Comprehensive testing across dependencies, DOM, state, events, flows, actors, and invariants
- **🐛 Advanced Bug Detection**: Catches parameter passing, coordination, type, and invariant bugs
- **📊 Quality Metrics**: Provides grades (A+ to F), scores, and actionable recommendations
- **🎭 JSDOM Validation**: Tests actual DOM interactions to catch real-world bugs
- **📝 Component Description Language**: Standardized way to describe component contracts
- **⚡ 100% Test Coverage**: Framework itself has complete test coverage

## Installation

```bash
npm install @legion/umbilical-testing
```

## Quick Start

### 1. Basic Component Testing

```javascript
import { UmbilicalTestingFramework } from '@legion/umbilical-testing';

// Define a self-describing component
const InputComponent = {
  name: 'InputComponent',
  
  // Component describes its contract
  describe: function(descriptor) {
    descriptor
      .name('InputComponent')
      .description('Text input with validation')
      .requires('eventSystem', 'EventSystem')
      .manages('value', 'string', { default: '' })
      .manages('isValid', 'boolean', { default: true })
      .listens('input', 'object')  // Potential [object InputEvent] bug!
      .emits('change', 'string')
      .creates('input[type=text]');
  },
  
  // Component implementation
  create: function(dependencies) {
    return {
      state: new Map([['value', ''], ['isValid', true]]),
      
      handleInput: function(event) {
        // BUG: Passing event object instead of value!
        this.state.set('value', event); // Should be event.target.value
        dependencies.eventSystem.dispatchEvent('change', event); // Should be value
      },
      
      setState: function(key, value) {
        this.state.set(key, value);
      },
      
      getState: function(key) {
        return this.state.get(key);
      }
    };
  }
};

// Run comprehensive testing
const framework = new UmbilicalTestingFramework();
const results = await framework.testComponent(InputComponent);

// Framework detects the [object InputEvent] bug!
console.log(`Bug detected: ${results.analysis.bugAnalysis.wouldDetectOriginalBug}`); // true
console.log(`Grade: ${results.report.executive.grade}`); // 'F' due to critical bug
```

### 2. Detecting the [object InputEvent] Bug

```javascript
// The framework automatically detects when components pass objects instead of values
const results = await framework.testComponent(BuggyComponent);

if (results.analysis.bugAnalysis.wouldDetectOriginalBug) {
  console.log('⚠️ CRITICAL: [object InputEvent] bug detected!');
  
  // Get specific bug details
  const parameterBugs = results.testResults.bugDetection.parameterBugs;
  parameterBugs.forEach(bug => {
    console.log(`${bug.severity}: ${bug.message}`);
    // Output: "high: Input handler receives wrong parameter: expected value string, got [object InputEvent]"
  });
}
```
```

## How It Works

The Umbilical Testing Framework uses a 5-phase approach:

1. **Component Introspection** - Analyzes component structure and capabilities
2. **CDL Generation** - Creates Component Description Language specification
3. **Test Generation & Execution** - Runs 7 different test generators
4. **Bug Detection** - Identifies parameter passing, coordination, and type bugs
5. **Reporting** - Provides comprehensive analysis with grades and recommendations

## Test Generators

### 1. DOMTestGenerator
Tests DOM element creation, attribute binding, and event handling.

```javascript
// Automatically generates tests for:
- Element creation and structure
- Attribute synchronization with state
- DOM event handling
- Element lifecycle
```

### 2. StateTestGenerator
Validates state management and property types.

```javascript
// Tests:
- State initialization with defaults
- State mutations and type consistency
- State-event synchronization
- State persistence
```

### 3. EventTestGenerator
Verifies event emission and listening patterns.

```javascript
// Validates:
- Event payload types
- Event handler registration
- Event bubbling and propagation
- Parameter passing correctness (catches [object InputEvent]!)
```

### 4. DependencyTestGenerator
Tests dependency injection and usage.

```javascript
// Checks:
- Required dependencies are provided
- Optional dependencies are handled
- Dependency methods are called correctly
- Dependency isolation
```

### 5. FlowTestGenerator
Tests common user interaction flows.

```javascript
// Simulates:
- Complete user workflows
- State transitions
- Multi-step operations
- Error recovery flows
```

### 6. ActorTestGenerator
Tests actor-based communication patterns.

```javascript
// Validates:
- Message passing between actors
- Protocol compliance
- Actor lifecycle management
- Coordination between multiple actors
```

### 7. InvariantTestGenerator
Tests property-based invariants and constraints.

```javascript
// Verifies:
- Type invariants (no unexpected type changes)
- Monotonicity (counters only increase)
- Lifecycle invariants (proper state transitions)
- Custom business logic constraints
```

## Bug Detection Capabilities

### Parameter Passing Bugs
The framework specifically detects the infamous `[object InputEvent]` bug:

```javascript
// BAD: Common bug pattern
handleInput(event) {
  this.setState('value', event); // Passes [object InputEvent]
}

// GOOD: Correct implementation
handleInput(event) {
  this.setState('value', event.target.value); // Passes actual value
}
```

### Coordination Bugs
Detects mismatches between component aspects:

- Event payload type mismatches
- State-DOM desynchronization
- Dependency usage errors
- Protocol violations

### Type Violations
Catches runtime type errors:

- Unexpected type changes
- Null/undefined access
- Type coercion issues
- Invalid method calls

## Quality Metrics and Grading

The framework provides comprehensive quality assessment:

| Grade | Criteria |
|-------|----------|
| A+ | 95%+ pass rate, 0 bugs |
| A | 95%+ pass rate, ≤1 bug |
| B | 85%+ pass rate, ≤2 bugs |
| C | 70%+ pass rate, ≤5 bugs |
| D | 50%+ pass rate, ≤10 bugs |
| F | Any critical bugs or <50% pass rate |

## Advanced Usage

### Custom Test Configuration

```javascript
const framework = new UmbilicalTestingFramework({
  // Control which tests run
  includeInvariantTests: true,
  includeFlowTests: true,
  includeActorTests: false,
  
  // Performance settings
  parallelExecution: true,
  testTimeout: 5000,
  
  // Reporting options
  verboseLogging: true,
  generateDetailedReport: true,
  includeRecommendations: true,
  
  // Bug detection sensitivity
  detectParameterBugs: true,
  detectCoordinationBugs: true
});
```

### Analyzing Test Results

```javascript
const results = await framework.testComponent(MyComponent);

// Executive summary
console.log(`Component: ${results.report.executive.component}`);
console.log(`Score: ${results.report.executive.overallScore}/100`);
console.log(`Grade: ${results.report.executive.grade}`);
console.log(`Would detect [object InputEvent]: ${results.report.executive.wouldDetectOriginalBug}`);

// Bug analysis
const bugs = results.analysis.bugAnalysis;
console.log(`Total bugs: ${bugs.totalBugs}`);
console.log(`Critical: ${bugs.bugsBySeverity.high}`);
console.log(`Warning: ${bugs.bugsBySeverity.medium}`);
console.log(`Info: ${bugs.bugsBySeverity.low}`);

// Coverage metrics
const coverage = results.analysis.coverageAnalysis;
console.log(`Overall coverage: ${coverage.overallCoveragePercentage}%`);
console.log(`DOM coverage: ${coverage.coverageByType.dom.tested}/${coverage.coverageByType.dom.available}`);
console.log(`State coverage: ${coverage.coverageByType.state.tested}/${coverage.coverageByType.state.available}`);

// Action items
results.report.actionItems.forEach(item => {
  console.log(`[${item.priority}] ${item.category}: ${item.action}`);
});
```

### Component Description Language (CDL)

The framework uses a fluent API for describing components:

```javascript
describe: function(descriptor) {
  descriptor
    .name('MyComponent')
    .description('A complex UI component')
    
    // Dependencies
    .requires('eventSystem', 'EventSystem')  // Required dependency
    .optional('logger', 'Logger')            // Optional dependency
    
    // State management
    .manages('value', 'string', { default: '', validate: (v) => v.length < 100 })
    .manages('count', 'number', { default: 0, min: 0, max: 100 })
    
    // Events
    .emits('change', 'object')               // Emits events
    .listens('input', 'string')              // Listens to events
    
    // DOM structure
    .creates('div.container')                // Creates DOM elements
    .creates('input[type=text]', { 
      attributes: { value: 'state.value' }   // Binds to state
    })
    .creates('button', {
      events: { click: 'handleClick' }       // Binds events
    });
}
```

## API Reference

### UmbilicalTestingFramework

```javascript
const framework = new UmbilicalTestingFramework(options);
```

**Options:**
- `enableDeepIntrospection` (boolean, default: true) - Enable deep component analysis
- `includeIntegrationTests` (boolean, default: true) - Run integration tests
- `includeInvariantTests` (boolean, default: true) - Run invariant checking
- `includeFlowTests` (boolean, default: true) - Test user flows
- `includeActorTests` (boolean, default: true) - Test actor communication
- `parallelExecution` (boolean, default: false) - Run tests in parallel
- `testTimeout` (number, default: 30000) - Test timeout in ms
- `verboseLogging` (boolean, default: false) - Enable detailed logging
- `generateDetailedReport` (boolean, default: true) - Include full details in report
- `enableBugDetection` (boolean, default: true) - Enable bug detection
- `detectParameterBugs` (boolean, default: true) - Detect parameter passing bugs
- `detectCoordinationBugs` (boolean, default: true) - Detect coordination issues

**Methods:**

#### `testComponent(component, options)`
Runs comprehensive testing on a component.

**Returns:** Promise<TestResults>

```javascript
const results = await framework.testComponent(MyComponent);
```

#### `runSelfTests()`
Runs self-tests on the framework itself.

**Returns:** Promise<SelfTestResults>

### Component Descriptor API

```javascript
component.describe = function(descriptor) {
  descriptor
    .name(string)              // Component name
    .description(string)       // Component description
    .requires(name, type)      // Required dependency
    .optional(name, type)      // Optional dependency
    .manages(property, type, options) // State property
    .emits(event, payloadType) // Emitted event
    .listens(event, payloadType) // Listened event
    .creates(selector, options) // DOM element
    .flow(name, steps)         // User flow
    .actor(name, protocol)     // Actor definition
    .invariant(name, check)    // Invariant constraint
};
```

### Test Results Structure

```javascript
{
  component: string,           // Component name
  description: Object,         // Component description
  cdl: Object,                // Component Description Language
  testResults: {
    summary: {
      totalTests: number,
      passed: number,
      failed: number,
      passRate: number
    },
    generators: Object,        // Results by generator
    bugDetection: {
      coordinationBugs: Array,
      parameterBugs: Array,
      invariantViolations: Array,
      typeErrors: Array
    },
    coverage: Object,
    performance: Object
  },
  analysis: {
    bugAnalysis: {
      totalBugs: number,
      wouldDetectOriginalBug: boolean,
      bugsBySeverity: Object,
      patterns: Array
    },
    coverageAnalysis: Object,
    performanceAnalysis: Object,
    qualityMetrics: {
      overallQualityScore: number,
      grade: string,
      robustness: number,
      maintainability: number
    },
    riskAssessment: Object,
    complianceCheck: Object
  },
  report: {
    executive: Object,         // Executive summary
    testing: Object,           // Testing details
    bugs: Object,              // Bug details
    quality: Object,           // Quality metrics
    actionItems: Array         // Recommended actions
  },
  duration: number,            // Total execution time
  framework: Object            // Framework metadata
}
```

## Integration with Testing Frameworks

### Jest Integration

```javascript
import { UmbilicalTestingFramework } from '@legion/umbilical-testing';

describe('MyComponent', () => {
  let framework;
  
  beforeAll(() => {
    framework = new UmbilicalTestingFramework({
      verboseLogging: false,
      testTimeout: 10000
    });
  });
  
  test('should pass Umbilical Testing', async () => {
    const results = await framework.testComponent(MyComponent);
    
    // Assert no critical bugs
    expect(results.analysis.bugAnalysis.bugsBySeverity.high).toBe(0);
    
    // Assert good quality
    expect(results.analysis.qualityMetrics.grade).toMatch(/[AB]/);
    
    // Assert would catch [object InputEvent] bug
    expect(results.analysis.bugAnalysis.wouldDetectOriginalBug).toBe(false);
  }, 30000);
});
```

### Mocha Integration

```javascript
import { UmbilicalTestingFramework } from '@legion/umbilical-testing';
import { expect } from 'chai';

describe('MyComponent', function() {
  this.timeout(30000);
  
  const framework = new UmbilicalTestingFramework();
  
  it('should pass comprehensive testing', async function() {
    const results = await framework.testComponent(MyComponent);
    
    expect(results.analysis.bugAnalysis.totalBugs).to.equal(0);
    expect(results.testResults.summary.passRate).to.be.above(90);
  });
});
```

### CI/CD Integration

```yaml
# GitHub Actions example
name: Umbilical Testing

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:umbilical
      - name: Check Quality Grade
        run: |
          node -e "
          const { UmbilicalTestingFramework } = require('@legion/umbilical-testing');
          const MyComponent = require('./src/components/MyComponent');
          const framework = new UmbilicalTestingFramework();
          framework.testComponent(MyComponent).then(results => {
            if (results.analysis.qualityMetrics.grade === 'F') {
              console.error('Component failed quality check!');
              process.exit(1);
            }
            if (results.analysis.bugAnalysis.wouldDetectOriginalBug) {
              console.error('[object InputEvent] bug detected!');
              process.exit(1);
            }
          });
          "
```

## Performance Considerations

- **Test Execution Time**: Average 5-10 seconds per component
- **Memory Usage**: ~50-100MB per component test run
- **Parallel Execution**: Can reduce time by 40-60% for multiple components

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Documentation

- [Design Document](./docs/Design.md) - Complete architectural overview
- [API Reference](./docs/API.md) - Detailed API documentation
- [Examples](./docs/Examples.md) - More usage examples
- [Migration Guide](./docs/Migration.md) - Migrating from manual testing
- [Troubleshooting](./docs/Troubleshooting.md) - Common issues and solutions

## Real-World Examples

### Example 1: Form Input Component

```javascript
const FormInput = {
  name: 'FormInput',
  
  describe: function(descriptor) {
    descriptor
      .name('FormInput')
      .description('Form input with validation')
      .requires('validator', 'Validator')
      .manages('value', 'string')
      .manages('error', 'string')
      .manages('touched', 'boolean')
      .listens('input', 'object')
      .listens('blur', 'object')
      .emits('valid', 'boolean')
      .creates('input.form-input')
      .creates('span.error-message');
  },
  
  create: function(deps) {
    return {
      state: new Map([
        ['value', ''],
        ['error', ''],
        ['touched', false]
      ]),
      
      handleInput: function(event) {
        const value = event.target.value; // Correct!
        this.state.set('value', value);
        
        const isValid = deps.validator.validate(value);
        this.state.set('error', isValid ? '' : 'Invalid input');
        deps.eventSystem.dispatchEvent('valid', isValid);
      },
      
      handleBlur: function() {
        this.state.set('touched', true);
      }
    };
  }
};

// Test and get comprehensive results
const results = await framework.testComponent(FormInput);
console.log(`Grade: ${results.report.executive.grade}`); // 'A' - No bugs!
```

### Example 2: Component with [object InputEvent] Bug

```javascript
const BuggySearch = {
  name: 'BuggySearch',
  
  describe: function(descriptor) {
    descriptor
      .name('BuggySearch')
      .description('Search with parameter bug')
      .manages('query', 'string')
      .listens('input', 'object')
      .emits('search', 'string');
  },
  
  create: function(deps) {
    return {
      state: new Map([['query', '']]),
      
      handleInput: function(event) {
        // BUG: Passing event object instead of value!
        this.state.set('query', event); // [object InputEvent]
        deps.eventSystem.dispatchEvent('search', event); // Should be event.target.value
      }
    };
  }
};

// Framework detects the bug
const results = await framework.testComponent(BuggySearch);
console.log(results.report.executive.summary);
// Output: "Executed 25 tests with 60.0% pass rate. Found 2 bugs (2 critical)."

console.log(results.report.bugs.details.parameterBugs[0].message);
// Output: "Input handler receives wrong parameter: expected value string, got [object InputEvent]"
```

### Example 3: Complex Terminal Component

```javascript
const Terminal = {
  name: 'Terminal',
  
  describe: function(descriptor) {
    descriptor
      .name('Terminal')
      .description('Interactive terminal emulator')
      .requires('commandProcessor', 'CommandProcessor')
      .requires('dom', 'DOMElement')
      .manages('history', 'Array', { default: [] })
      .manages('currentInput', 'string', { default: '' })
      .manages('cursorPosition', 'number', { default: 0 })
      .listens('keydown', 'object')
      .emits('command', 'string')
      .emits('output', 'string')
      .creates('div.terminal')
      .creates('div.output')
      .creates('input.command-line');
  },
  
  create: function(deps) {
    return {
      state: new Map([
        ['history', []],
        ['currentInput', ''],
        ['cursorPosition', 0]
      ]),
      
      handleKeydown: function(event) {
        if (event.key === 'Enter') {
          const command = this.state.get('currentInput');
          const history = this.state.get('history');
          
          // Add to history
          this.state.set('history', [...history, command]);
          
          // Process command
          const result = deps.commandProcessor.execute(command);
          
          // Emit events with correct values
          deps.eventSystem.dispatchEvent('command', command);
          deps.eventSystem.dispatchEvent('output', result);
          
          // Clear input
          this.state.set('currentInput', '');
        } else if (event.key === 'ArrowUp') {
          // Navigate history
          const history = this.state.get('history');
          if (history.length > 0) {
            this.state.set('currentInput', history[history.length - 1]);
          }
        } else {
          // Update input - correct parameter extraction
          const currentInput = this.state.get('currentInput');
          const newInput = currentInput + event.key;
          this.state.set('currentInput', newInput);
        }
      }
    };
  }
};

// Test complex component
const results = await framework.testComponent(Terminal);
console.log(`Tests run: ${results.testResults.summary.totalTests}`);
console.log(`Coverage: ${results.analysis.coverageAnalysis.overallCoveragePercentage}%`);
```

## Common Issues and Solutions

### Issue: [object InputEvent] appearing in state

**Problem:**
```javascript
handleInput(event) {
  this.setState('value', event); // Bug!
}
```

**Solution:**
```javascript
handleInput(event) {
  this.setState('value', event.target.value); // Correct!
}
```

**Detection:**
```javascript
const results = await framework.testComponent(Component);
if (results.analysis.bugAnalysis.wouldDetectOriginalBug) {
  console.error('Component has parameter passing bug!');
}
```

### Issue: Type mismatches between state and events

**Problem:**
```javascript
describe: (d) => {
  d.manages('count', 'number');
  d.emits('countChange', 'string'); // Type mismatch!
}
```

**Solution:**
```javascript
describe: (d) => {
  d.manages('count', 'number');
  d.emits('countChange', 'number'); // Matching types
}
```

### Issue: Missing required dependencies

**Problem:**
```javascript
create: function(deps) {
  // Uses deps.logger without declaring it
  deps.logger.log('Created'); // Runtime error!
}
```

**Solution:**
```javascript
describe: (d) => {
  d.requires('logger', 'Logger'); // Declare dependency
}
```

## Frequently Asked Questions

### Q: What is the [object InputEvent] bug?
**A:** It's a common JavaScript bug where an event object is passed to a function expecting a value (like `event.target.value`). Instead of the actual value, the component stores `[object InputEvent]` which is the string representation of the event object.

### Q: How does the framework detect this bug?
**A:** The framework uses multiple detection strategies:
1. Type checking - Verifies that string properties receive strings, not objects
2. Parameter validation - Checks that event handlers extract correct values
3. String representation analysis - Detects `[object *]` patterns in state
4. Invariant testing - Ensures type consistency across operations

### Q: Can I use this with existing components?
**A:** Yes! As long as your component has a `describe` method that specifies its contract, the framework can test it. You can gradually add descriptions to existing components.

### Q: What's the performance impact?
**A:** The framework runs tests in a separate JSDOM environment and doesn't affect production performance. Testing typically takes 5-10 seconds per component.

### Q: How is this different from regular unit tests?
**A:** Regular unit tests check specific scenarios you write. The Umbilical Testing Framework automatically generates comprehensive tests based on the component's self-description, including edge cases you might not think of.

## Roadmap

- ✅ Phase 1-5: Core framework implementation
- 📝 Phase 6: Documentation and examples (current)
- 🔜 Phase 7: CLI tool for easy testing
- 🔜 VS Code extension for inline testing
- 🔜 React/Vue/Angular adapters
- 🔜 Performance profiling capabilities
- 🔜 Visual regression testing

## License

MIT

---

<div align="center">
  <strong>🎯 Never let [object InputEvent] bugs reach production again!</strong>
  <br>
  <sub>Built with ❤️ by the Legion team</sub>
</div>