# Umbilical Component Protocol - Proof of Concept

A minimal protocol for JavaScript component loading based on a single constraint: components should have one function `create` that takes a single object through which all communication and resources flow.

## Quick Start

```bash
npm install
npm start    # Starts server on port 3600 (or use PORT=xxxx npm start)
```

Then visit:
- `http://localhost:3600/examples/` - Interactive demos
- `http://localhost:3600/examples/counter-app.html` - Full counter application

## Project Structure

```
public/                 # Static content served by Express
├── index.html          # Redirects to examples
├── examples/           # Demo applications
├── favicon.ico
└── favicon.svg
src/                    # Source code
├── umbilical/          # Protocol base utilities
│   └── index.js        # UmbilicalUtils, UmbilicalError, etc.
├── components/         # Individual components
│   ├── counter/        # Pure state management
│   ├── display/        # DOM rendering
│   └── button/         # User interaction
└── utils.js            # Original utils
server/                 # Express server
test/                   # Component tests (Jest)
docs/                   # Protocol documentation
```

## Core Concept

Every component exposes exactly one function:

```js
Component.create(umbilical)
```

The umbilical object is the component's entire world. Everything it needs - DOM access, data sources, event handling, lifecycle management - must come through this single object interface.

## Demo Components

### Counter Component
```js
import { Counter } from './src/components/counter/index.js';

const counter = Counter.create({
  initialValue: 0,
  onChange: (newValue, oldValue, action) => {
    console.log(`Counter ${action}: ${oldValue} → ${newValue}`);
  }
});

counter.increment();  // Logs: Counter increment: 0 → 1
```

### Display Component
```js
import { Display } from './src/components/display/index.js';

const display = Display.create({
  dom: document.getElementById('output'),
  format: (value) => `Count: ${value}`
});

display.update(42);  // Renders "Count: 42" to DOM
```

### Button Component
```js
import { Button } from './src/components/button/index.js';

const button = Button.create({
  dom: document.getElementById('btn'),
  text: 'Click Me',
  onClick: (event) => {
    console.log('Button clicked!');
  }
});
```

## Agent-Centric Design

This protocol is specifically designed for AI agents to discover, test, and compose components:

### 1. Component Discovery
```js
Counter.create({
  describe: (requirements) => {
    // Agent discovers what Counter needs
    console.log(requirements.getAll());
  }
});
```

### 2. Component Validation
```js
Counter.create({
  validate: (testUmbilical) => {
    // Agent tests if an umbilical will work
    return testUmbilical.onChange && typeof testUmbilical.onChange === 'function';
  }
});
```

### 3. Component Composition
```js
// Agent creates instances with generated umbilicals
const display = Display.create({ dom: element, format: formatter });
const counter = Counter.create({ 
  onChange: (value) => display.update(value) 
});
const button = Button.create({ 
  dom: buttonElement, 
  onClick: () => counter.increment() 
});
```

## Key Benefits

- **Perfect Isolation**: Components can't access anything outside their umbilical
- **Universal Testing**: Mock one object to test any component
- **Agent-Friendly**: Programmatic discovery and composition
- **Framework Agnostic**: Works with any internal implementation
- **Hot Swappable**: Replace components with identical interfaces

## Running Examples

1. **Interactive Counter App**: Visit `/examples/counter-app.html`
2. **Agent Composition Demo**: Visit `/examples/` and run the composition demo
3. **Component Introspection**: Visit `/examples/` and discover component requirements

## Testing

```bash
npm test  # Run all tests (some Jest/ES module issues to resolve)
```

The testing patterns demonstrate how agents would test components:
- Individual component isolation tests
- Integration composition tests  
- Agent discovery and validation workflows

## Philosophy

This protocol represents the **assembly language of component systems** - a minimal, powerful primitive that higher-level patterns can build upon.

**One function. One parameter. Infinite possibilities.**

The umbilical component protocol reduces component architecture to its essence: give a component its world, and let it build itself however it sees fit within that world.