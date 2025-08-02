# Umbilical Component Guidelines

## Core Principle: DOM Persistence

**CRITICAL**: Umbilical components are NOT React components. They work with the real DOM and must:

1. **NEVER use `innerHTML = ''` to clear and recreate DOM**
2. **ALWAYS maintain references to created DOM elements**
3. **UPDATE existing elements instead of replacing them**
4. **Maintain two-way binding between component state and DOM**

## The Two-Way Mapping Rule

Every Umbilical component MUST maintain:

### 1. DOM Element References (Component → DOM)
```javascript
class MyComponent {
  constructor(container) {
    this.container = container;
    
    // Store references to ALL created elements
    this.elements = {
      wrapper: null,
      input: null,
      output: null,
      buttons: new Map(),
      items: new Map()
    };
  }
}
```

### 2. Reverse Mapping (DOM → Component)
```javascript
// Store component reference on DOM elements
element.dataset.componentId = this.id;
element.__component = this;

// Or use WeakMap for DOM → component mapping
const domToComponent = new WeakMap();
domToComponent.set(element, this);
```

## Correct DOM Manipulation Patterns

### ❌ WRONG - Recreating DOM
```javascript
// NEVER DO THIS
render() {
  this.container.innerHTML = '';  // ❌ Destroys existing DOM
  this.createElements();           // ❌ Recreates everything
}

update() {
  this.outputElement.innerHTML = newContent; // ❌ Destroys child elements
}
```

### ✅ CORRECT - Updating Existing DOM
```javascript
render() {
  // Only create if not exists
  if (!this.elements.wrapper) {
    this.elements.wrapper = this.createElement('div', ['wrapper']);
    this.container.appendChild(this.elements.wrapper);
  }
  
  // Update existing elements
  this.update();
}

update() {
  // Update text content without destroying elements
  if (this.elements.output) {
    this.elements.output.textContent = newContent;
  }
  
  // Update attributes
  if (this.elements.input) {
    this.elements.input.value = this.state.value;
    this.elements.input.disabled = this.state.disabled;
  }
}
```

## Component Lifecycle

### 1. Initial Render (called once)
```javascript
render(options = {}) {
  // Create DOM structure ONCE
  this.createDOMStructure();
  
  // Store element references
  this.storeElementReferences();
  
  // Bind event handlers ONCE
  this.bindEvents();
  
  // Initial update
  this.update(options);
}

createDOMStructure() {
  // Only create if elements don't exist
  if (!this.elements.container) {
    this.elements.container = document.createElement('div');
    this.elements.container.className = 'my-container';
    
    this.elements.input = document.createElement('input');
    this.elements.container.appendChild(this.elements.input);
    
    this.container.appendChild(this.elements.container);
  }
}
```

### 2. Updates (called multiple times)
```javascript
update(data) {
  // Update existing elements, never recreate
  if (this.elements.input) {
    this.elements.input.value = data.value || '';
  }
  
  if (this.elements.status) {
    this.elements.status.textContent = data.status || '';
    this.elements.status.className = `status ${data.statusClass || ''}`;
  }
}
```

### 3. Adding/Removing List Items
```javascript
addItem(id, data) {
  // Check if item already exists
  if (this.elements.items.has(id)) {
    this.updateItem(id, data);
    return;
  }
  
  // Create new item
  const item = document.createElement('div');
  item.dataset.itemId = id;
  item.className = 'list-item';
  
  // Store reference
  this.elements.items.set(id, item);
  
  // Add to DOM
  this.elements.list.appendChild(item);
  
  // Update content
  this.updateItem(id, data);
}

removeItem(id) {
  const item = this.elements.items.get(id);
  if (item) {
    item.remove();
    this.elements.items.delete(id);
  }
}

updateItem(id, data) {
  const item = this.elements.items.get(id);
  if (item) {
    // Update without recreating
    item.textContent = data.text;
    item.className = `list-item ${data.className || ''}`;
  }
}
```

## Event Handling Best Practices

### 1. Bind Events Once
```javascript
bindEvents() {
  // Use stored references
  if (this.elements.input) {
    // Store handler reference for cleanup
    this.handlers.inputHandler = (e) => this.handleInput(e);
    this.elements.input.addEventListener('input', this.handlers.inputHandler);
  }
}
```

### 2. Event Delegation for Dynamic Content
```javascript
bindEvents() {
  // Delegate events for dynamic items
  this.elements.container.addEventListener('click', (e) => {
    const item = e.target.closest('.list-item');
    if (item) {
      const id = item.dataset.itemId;
      this.handleItemClick(id);
    }
  });
}
```

## Common Pitfalls to Avoid

### 1. The Input Jump Bug
```javascript
// ❌ WRONG - Causes input to jump/duplicate
handleCommand() {
  this.render(); // Re-renders everything
}

// ✅ CORRECT - Update only what changed
handleCommand() {
  this.updateOutput();
  this.clearInput();
}
```

### 2. Lost Event Handlers
```javascript
// ❌ WRONG - Loses event handlers
this.buttonContainer.innerHTML = '<button>Click me</button>';

// ✅ CORRECT - Preserves event handlers
if (!this.elements.button) {
  this.elements.button = document.createElement('button');
  this.elements.button.textContent = 'Click me';
  this.elements.button.onclick = () => this.handleClick();
  this.buttonContainer.appendChild(this.elements.button);
}
```

### 3. Memory Leaks
```javascript
// ❌ WRONG - Creates memory leaks
destroy() {
  this.container.innerHTML = ''; // Doesn't clean up event handlers
}

// ✅ CORRECT - Proper cleanup
destroy() {
  // Remove event handlers
  if (this.elements.input && this.handlers.inputHandler) {
    this.elements.input.removeEventListener('input', this.handlers.inputHandler);
  }
  
  // Clear references
  this.elements.items.clear();
  
  // Then remove DOM
  if (this.elements.container) {
    this.elements.container.remove();
  }
  
  // Clear all references
  this.elements = {};
  this.handlers = {};
}
```

## Testing DOM Persistence

To verify your component maintains DOM properly:

```javascript
// Test that elements persist across updates
const input = container.querySelector('input');
const inputId = input.id;

component.update({ value: 'new value' });

const inputAfterUpdate = container.querySelector('input');
expect(inputAfterUpdate.id).toBe(inputId); // Same element
expect(inputAfterUpdate).toBe(input); // Same reference
```

## Summary Rules

1. **Create DOM elements ONCE in render()**
2. **Store references to ALL created elements**
3. **Update existing elements in update()**
4. **Never use innerHTML to clear containers**
5. **Maintain bidirectional element↔component mapping**
6. **Bind events once, use delegation for dynamic content**
7. **Properly cleanup in destroy()**

Following these guidelines ensures:
- No input jumping bugs
- No lost focus or scroll position
- No recreated elements losing state
- Better performance (no constant DOM recreation)
- Proper event handler management