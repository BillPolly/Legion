# Hierarchical Components Design Document

## Overview

This document defines the design for a hierarchical component system that enables parent components to orchestrate child components through state-based communication. The system provides a generic architecture where everything routes through state, including parent node mounting, child state projection, event bubbling, and sibling communication.

## Architecture Principles

### State-Centric Design
- **All communication flows through state** - No direct component-to-component communication
- **Parent components project state down** to children via scoped DataStore adapters
- **Child events bubble up** through parent subscription system
- **Sibling communication** routed through parent orchestration

### Generic Composition
- Components are completely agnostic to their hierarchical position
- Parent components provide read/write views on all child components
- Dynamic child creation/deletion through state changes
- Consistent interface regardless of nesting depth

## Core Components

### 1. HierarchicalComponent Class

Extends `ComponentInstance` to add orchestration capabilities:

```javascript
class HierarchicalComponent extends ComponentInstance {
  constructor(options) {
    super(options);
    this.children = new Map();          // childId -> HierarchicalComponent
    this.childStateAdapters = new Map(); // childId -> DataStoreAdapter  
    this.parentStateAdapter = null;      // Scoped adapter from parent
    this.eventSubscriptions = new Map(); // childId -> Set<Subscription>
  }
}
```

**Key Responsibilities:**
- Manage child component lifecycle
- Create scoped state projections for children
- Route events between children
- Provide read/write access to child state

### 2. HierarchicalComponentLifecycle

Extends `ComponentLifecycle` for nested component management:

```javascript
class HierarchicalComponentLifecycle extends ComponentLifecycle {
  async mountHierarchical(dsl, container, initialData, parentAdapter) {
    // Parse child component definitions from DSL
    // Create scoped state adapters for each child
    // Mount children with projected state
    // Setup parent-child event routing
  }
}
```

**Key Features:**
- Parses DSL for child component definitions
- Creates hierarchical mounting with proper state scoping
- Manages parent-child relationships through ProjectionRoot

### 3. ScopedDataStoreAdapter

Extends `DataStoreAdapter` to provide isolated state views:

```javascript
class ScopedDataStoreAdapter extends DataStoreAdapter {
  constructor(parentAdapter, scope, projectionRules) {
    this.parentAdapter = parentAdapter;
    this.scope = scope;                 // e.g., "child1", "child2"
    this.projectionRules = projectionRules; // Define what parent state maps to child
    this.childWritebacks = new Map();   // Track child changes for parent notification
  }
}
```

**State Projection:**
- Maps parent state properties to child-accessible names
- Isolates child state within defined scope
- Provides writeback mechanism for child-to-parent updates

## DSL Extensions

### Child Component Definition

```dsl
component TodoApp {
  entity: app
  
  structure: {
    root: { element: "div", class: "todo-app" }
    header: { element: "h1", parent: "root" }
    todoList: { element: "div", parent: "root", class: "todo-list" }
    addButton: { element: "button", parent: "root" }
  }
  
  children: {
    todoItems: {
      component: "TodoItem",
      mountPoint: "todoList", 
      repeat: "app.todos",
      stateProjection: {
        "item.text": "app.todos[${index}].text",
        "item.completed": "app.todos[${index}].completed"
      }
    }
  }
  
  bindings: [
    { source: "app.title", target: "header.textContent" }
  ]
  
  events: [
    { element: "addButton", event: "click", action: "addTodo()" }
  ]
}

component TodoItem {
  entity: item
  
  structure: {
    root: { element: "div", class: "todo-item" }
    text: { element: "span", parent: "root" }
    checkbox: { element: "input", parent: "root", attributes: { type: "checkbox" } }
  }
  
  bindings: [
    { source: "item.text", target: "text.textContent" },
    { source: "item.completed", target: "checkbox.checked" }
  ]
  
  events: [
    { element: "checkbox", event: "change", action: "toggleCompleted()" }
  ]
}
```

### Key DSL Features:
- **`children`** block defines child components
- **`mountPoint`** specifies where child mounts in parent DOM
- **`repeat`** enables dynamic child creation from arrays
- **`stateProjection`** maps parent state to child scope

## State Management

### Parent-to-Child State Projection

```javascript
class StateProjector {
  project(parentState, projectionRules, childScope) {
    const childState = {};
    
    for (const [childProp, parentPath] of Object.entries(projectionRules)) {
      // Resolve parent path (may include array indexing)
      const value = this.resolvePath(parentState, parentPath);
      this.setNestedProperty(childState, childProp, value);
    }
    
    return childState;
  }
}
```

**Example Projection:**
- Parent state: `{ app: { todos: [{ text: "Task 1", completed: false }] } }`
- Child projection rule: `"item.text": "app.todos[0].text"`
- Child receives: `{ item: { text: "Task 1" } }`

### Child-to-Parent Event Bubbling

```javascript
class EventBubbler {
  setupChildEventRouting(parent, child, childId) {
    // Subscribe to all child state changes
    child.dataAdapter.onAnyChange((path, value) => {
      const parentPath = this.mapChildPathToParent(path, childId);
      parent.handleChildStateChange(childId, parentPath, value);
    });
    
    // Subscribe to child events
    child.eventStream.subscribe((event) => {
      parent.handleChildEvent(childId, event);
    });
  }
}
```

## Component Communication Patterns

### 1. Parent Controls Child State

```javascript
// Parent component can directly modify child state
parentComponent.setChildState('todoItem1', { 
  'item.completed': true 
});

// This updates child through scoped adapter
// Child reactive bindings update DOM automatically
```

### 2. Child Events Bubble to Parent

```javascript
// Child checkbox change event
{ element: "checkbox", event: "change", action: "toggleCompleted()" }

// Bubbles to parent as:
parent.handleChildEvent('todoItem1', {
  type: 'toggleCompleted',
  source: 'todoItem1',
  data: { completed: true }
});
```

### 3. Sibling Communication via Parent

```javascript
// Parent routes data between siblings
parent.handleChildEvent('sidebar', sidebarEvent) => {
  if (sidebarEvent.type === 'filterChanged') {
    // Update all todo item children
    for (const [childId, child] of parent.children) {
      if (child.definition.name === 'TodoItem') {
        parent.setChildState(childId, {
          'item.visible': this.applyFilter(child.state, sidebarEvent.data.filter)
        });
      }
    }
  }
}
```

## Dynamic Child Management

### Child Creation from State Changes

```javascript
class DynamicChildManager {
  handleArrayStateChange(arrayPath, newArray) {
    const childDef = this.getChildDefinitionForArray(arrayPath);
    
    // Calculate what children need to be added/removed
    const currentChildren = this.getChildrenForArray(arrayPath);
    const requiredChildren = newArray.length;
    
    // Add missing children
    for (let i = currentChildren; i < requiredChildren; i++) {
      this.createDynamicChild(childDef, i, newArray[i]);
    }
    
    // Remove excess children  
    for (let i = requiredChildren; i < currentChildren; i++) {
      this.removeDynamicChild(childDef, i);
    }
  }
}
```

### Child Lifecycle Integration

```javascript
// Child component lifecycle hooks
parentComponent.addChildHook('beforeChildMount', (context) => {
  console.log(`Mounting child ${context.childId} of type ${context.definition.name}`);
});

parentComponent.addChildHook('afterChildMount', (context) => {
  // Setup custom parent-child communication
  this.setupCustomChildEventHandlers(context.childId, context.child);
});
```

## Read/Write Views

### Parent Access to Child State

```javascript
class ChildStateView {
  constructor(parent, childId) {
    this.parent = parent;
    this.childId = childId;
  }
  
  // Read access
  get(path) {
    return this.parent.getChildState(this.childId, path);
  }
  
  // Write access  
  set(path, value) {
    return this.parent.setChildState(this.childId, path, value);
  }
  
  // Subscribe to changes
  subscribe(path, callback) {
    return this.parent.subscribeToChildState(this.childId, path, callback);
  }
}

// Usage
const todoItem1View = parentComponent.getChildView('todoItem1');
todoItem1View.set('item.text', 'Updated task text');
const currentText = todoItem1View.get('item.text');
```

## Integration with Existing Architecture

### Leveraging ProjectionRoot Hierarchy

```javascript
class HierarchicalComponentLifecycle {
  async mount(dsl, container, initialData, parentProjection = null) {
    // Create new ProjectionRoot for this component
    const projection = parentProjection 
      ? parentProjection.div() 
      : new ProjectionRoot(container);
    
    // Mount component using projection as container
    const component = await super.mount(dsl, projection.element, initialData);
    
    // Convert to HierarchicalComponent
    return this.wrapAsHierarchical(component, projection);
  }
}
```

### EventStream Integration

```javascript
class HierarchicalEventStream extends EventStream {
  constructor(element, eventType, parentBubbler = null) {
    super(element, eventType);
    this.parentBubbler = parentBubbler;
  }
  
  subscribe(callback) {
    const unsubscribe = super.subscribe((event) => {
      // Normal callback
      callback(event);
      
      // Bubble to parent if configured
      if (this.parentBubbler) {
        this.parentBubbler.handleChildEvent(event);
      }
    });
    
    return unsubscribe;
  }
}
```

### DataStoreAdapter Scoping

```javascript
class ScopedDataStoreAdapter extends DataStoreAdapter {
  getProperty(path) {
    // Check if this is a scoped path
    if (this.projectionRules.has(path)) {
      const parentPath = this.projectionRules.get(path);
      return this.parentAdapter.getProperty(parentPath);
    }
    
    // Otherwise use scoped access
    const scopedPath = `${this.scope}.${path}`;
    return this.parentAdapter.getProperty(scopedPath);
  }
  
  setProperty(path, value) {
    // Write to parent with proper scoping
    const scopedPath = `${this.scope}.${path}`;
    this.parentAdapter.setProperty(scopedPath, value);
    
    // Notify parent of child state change
    this.notifyParentOfChange(path, value);
  }
}
```

## Example Usage

### Complete Hierarchical Component

```javascript
// Mount hierarchical todo app
const todoAppLifecycle = new HierarchicalComponentLifecycle(dataStore);

const app = await todoAppLifecycle.mountHierarchical(`
  component TodoApp {
    entity: app
    
    structure: {
      root: { element: "div", class: "todo-app" }
      list: { element: "div", parent: "root", class: "todo-list" }
      addButton: { element: "button", parent: "root" }
    }
    
    children: {
      todoItems: {
        component: "TodoItem",
        mountPoint: "list",
        repeat: "app.todos",
        stateProjection: {
          "item.text": "app.todos[${index}].text",
          "item.completed": "app.todos[${index}].completed"
        }
      }
    }
    
    bindings: [
      { source: "app.todos.length", target: "addButton.textContent", transform: "count => 'Add Item (' + count + ')'" }
    ]
    
    events: [
      { element: "addButton", event: "click", action: "addTodoItem()" }
    ]
  }
`, container, {
  app: {
    todos: [
      { text: "Learn hierarchical components", completed: false },
      { text: "Build todo app", completed: true }
    ]
  }
});

// Parent can access child state
const firstTodoView = app.getChildView('todoItems_0');
console.log(firstTodoView.get('item.text')); // "Learn hierarchical components"

// Parent can modify child state
firstTodoView.set('item.completed', true);

// Parent can listen to child events
app.onChildEvent('todoItems_0', 'toggleCompleted', (event) => {
  console.log(`Todo item toggled: ${event.data.completed}`);
});

// Add new todo (creates new child component dynamically)
app.update({
  'app.todos': [
    ...app.getData('app.todos'),
    { text: "New todo item", completed: false }
  ]
});
```

## Technical Considerations

### Performance
- **Scoped state adapters minimize unnecessary updates** - Children only reactive to their projected state
- **Event bubbling is opt-in** - Only subscribed events bubble to reduce overhead  
- **DOM diffing occurs per-component** - Isolated component updates prevent cascading re-renders

### Memory Management
- **Automatic cleanup** - Child components cleaned up when parent unmounts
- **Subscription tracking** - All parent-child subscriptions tracked for proper cleanup
- **Weak references** where appropriate to prevent memory leaks

### Error Handling  
- **Graceful degradation** - Child component failures don't crash parent
- **Error boundaries** - Errors contained within component hierarchy level
- **Validation** - State projection rules validated at mount time

## Conclusion

This hierarchical component system provides a complete solution for building complex, composable UIs where all communication flows through state. By leveraging the existing reactive binding system and extending it with scoped adapters and event bubbling, we achieve a generic architecture that supports dynamic composition while maintaining clean separation of concerns.

The system enables:
- **Pure state-based parent-child communication**
- **Generic component composition** without tight coupling
- **Dynamic child management** through state changes  
- **Complete parent orchestration** with read/write views on children
- **Seamless integration** with existing component infrastructure

This design fulfills the requirements for a hierarchical component system where "everything goes through the state" while providing the flexibility and power needed for complex UI composition.