/**
 * Composition Demo - Shows how agents can compose umbilical components
 * 
 * This demonstrates the key agent workflow:
 * 1. Discover component requirements through introspection
 * 2. Create appropriate umbilical objects
 * 3. Compose components together
 * 4. Test the composition
 */

import { Counter } from '/src/components/counter/index.js';
import { Display } from '/src/components/display/index.js';
import { Button } from '/src/components/button/index.js';
import { UmbilicalUtils } from '/src/umbilical/index.js';

/**
 * Agent-style component discovery and composition
 */
class ComponentComposer {
  constructor() {
    this.components = new Map();
    this.instances = new Map();
  }

  /**
   * Discover component requirements (what an agent would do)
   */
  discoverRequirements(component, name) {
    console.log(`🔍 Discovering requirements for ${name}...`);
    
    const requirements = UmbilicalUtils.createRequirements();
    
    // Use introspection umbilical
    component.create({
      describe: (reqs) => {
        // Copy requirements from component
        Object.entries(reqs.getAll()).forEach(([key, spec]) => {
          requirements.add(key, spec.type, spec.description);
        });
      }
    });

    const discovered = requirements.getAll();
    console.log(`✅ ${name} requirements:`, discovered);
    
    this.components.set(name, { component, requirements: discovered });
    return discovered;
  }

  /**
   * Create a component instance with generated umbilical (what an agent would do)
   */
  createInstance(componentName, instanceName, customUmbilical = {}) {
    const componentInfo = this.components.get(componentName);
    if (!componentInfo) {
      throw new Error(`Component ${componentName} not discovered yet`);
    }

    console.log(`🏗️  Creating ${instanceName} (${componentName})...`);

    // Agent generates umbilical based on requirements + customization
    const umbilical = {
      // Standard logging capabilities
      log: (msg) => console.log(`[${instanceName}] ${msg}`),
      error: (err) => console.error(`[${instanceName}]`, err),
      warn: (msg) => console.warn(`[${instanceName}] ${msg}`),
      
      // Lifecycle hooks
      onMount: (instance) => {
        console.log(`✨ ${instanceName} mounted`);
        this.instances.set(instanceName, instance);
      },
      
      onDestroy: (instance) => {
        console.log(`💀 ${instanceName} destroyed`);
        this.instances.delete(instanceName);
      },

      // Merge custom capabilities
      ...customUmbilical
    };

    const instance = componentInfo.component.create(umbilical);
    return instance;
  }

  /**
   * Get a created instance
   */
  getInstance(name) {
    return this.instances.get(name);
  }

  /**
   * Validate component composition (what an agent would do before connecting)
   */
  validateComposition(connections) {
    console.log('🔗 Validating component composition...');
    
    connections.forEach(({ from, to, capability }) => {
      const fromInstance = this.getInstance(from);
      const toInstance = this.getInstance(to);
      
      if (!fromInstance || !toInstance) {
        console.error(`❌ Invalid connection: ${from} -> ${to} (missing instances)`);
        return false;
      }
      
      console.log(`✅ Valid connection: ${from} -> ${to} (${capability})`);
    });
    
    return true;
  }
}

/**
 * Demo: Agent discovers and composes a counter application
 */
export function runCompositionDemo() {
  console.log('🚀 Starting Umbilical Component Composition Demo\n');

  const composer = new ComponentComposer();

  // Step 1: Agent discovers all components
  composer.discoverRequirements(Counter, 'Counter');
  composer.discoverRequirements(Display, 'Display');
  composer.discoverRequirements(Button, 'Button');

  console.log('\n📝 Component discovery complete. Now composing application...\n');

  // Step 2: Agent creates mock DOM elements (in real scenario, would create actual elements)
  const mockDisplay = {
    nodeType: 1, // Node.ELEMENT_NODE
    textContent: '',
    classList: {
      add: (cls) => console.log(`  DOM: Added class '${cls}' to display`),
      remove: (cls) => console.log(`  DOM: Removed class '${cls}' from display`)
    }
  };

  const mockButton = {
    nodeType: 1,
    textContent: '',
    tagName: 'BUTTON',
    classList: { add: () => {}, remove: () => {} },
    setAttribute: () => {},
    removeAttribute: () => {},
    addEventListener: (event, handler) => {
      console.log(`  DOM: Button listener added for '${event}'`);
      // Store handler for demo purposes
      mockButton._handlers = mockButton._handlers || {};
      mockButton._handlers[event] = handler;
    },
    removeEventListener: () => {},
    click: function() {
      if (this._handlers && this._handlers.click) {
        this._handlers.click({ preventDefault: () => {} });
      }
    }
  };

  // Step 3: Agent creates instances with appropriate umbilicals
  const display = composer.createInstance('Display', 'CounterDisplay', {
    dom: mockDisplay,
    className: 'counter-value',
    format: (value) => `Count: ${value}`,
    onRender: (data) => {
      console.log(`  📺 Display rendered: ${data}`);
    }
  });

  const counter = composer.createInstance('Counter', 'MainCounter', {
    initialValue: 5,
    onChange: (newValue, oldValue, action) => {
      console.log(`  🔢 Counter ${action}: ${oldValue} → ${newValue}`);
      // Agent connects counter to display
      display.update(newValue);
    },
    onIncrement: (value) => {
      if (value % 5 === 0) {
        console.log(`  🎯 Multiple of 5 reached: ${value}`);
      }
    }
  });

  const incrementButton = composer.createInstance('Button', 'IncrementButton', {
    dom: mockButton,
    text: '+1',
    onClick: (event, buttonInstance, clickCount) => {
      console.log(`  👆 Button clicked (${clickCount} times)`);
      // Agent connects button to counter
      counter.increment();
    }
  });

  // Step 4: Agent validates the composition
  composer.validateComposition([
    { from: 'MainCounter', to: 'CounterDisplay', capability: 'data-binding' },
    { from: 'IncrementButton', to: 'MainCounter', capability: 'action-trigger' }
  ]);

  console.log('\n🎮 Running composition demo...\n');

  // Step 5: Agent tests the composition
  console.log('Initial state:');
  display.update(counter.value);

  console.log('\nSimulating button clicks:');
  mockButton.click(); // Should increment counter to 6
  mockButton.click(); // Should increment counter to 7
  mockButton.click(); // Should increment counter to 8

  console.log('\nTesting direct counter operations:');
  counter.increment(2); // Should increment to 10 (trigger milestone)
  counter.decrement(); // Should decrement to 9
  counter.reset(); // Should reset to 5

  console.log('\n✅ Composition demo complete!');
  
  return {
    composer,
    instances: {
      counter,
      display,
      incrementButton
    }
  };
}