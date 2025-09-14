# Declarative Components Design Document

## Overview

Declarative Components is a revolutionary approach to building user interfaces where components are defined as pure mathematical equations between state and DOM. Instead of imperative updates, the system maintains relationships between DataStore entities and DOM elements through a declarative DSL using JavaScript template literals.

The core philosophy: **Components don't create or manipulate - they declare relationships.**

## Core Concepts

### 1. DOM Projection

DOM elements are not created directly but **projected** from parent elements, similar to how entities are projected from a DataStore:

```javascript
// Just as we project entities from DataStore
const userEntity = dataStore.entity(123);
const friends = userEntity.friends();

// We project DOM elements from parents
const container = parentElement.div('user-card');
const title = container.h2();
```

Every DOM element is a Handle that can project child elements. Components receive a parent element and project their structure from it.

### 2. Declarative Equations

Components are defined as sets of equations that relate:
- **State → DOM**: How state values map to DOM properties
- **DOM → State**: How DOM events update state
- **Structure**: How DOM elements relate to each other

### 3. Point-Free Combinators

All transformations are expressed as point-free function compositions, avoiding imperative arrow functions in favor of pure mathematical combinators.

## DSL Syntax

The Declarative Components DSL uses JavaScript template literals to define components in a clean, equation-like syntax:

### Basic Component Definition

```javascript
const UserCard = component`
  UserCard :: user =>
    div.user-card [
      h2 { user.name }
      p { user.bio }
      span.status { user.active ? "Active" : "Inactive" }
    ]
`;
```

### With Event Handling

```javascript
const Counter = component`
  Counter :: state =>
    div.counter [
      h1 { state.count }
      button#increment { "+" } => state.count++
      button#decrement { "-" } => state.count--
    ]
`;
```

### With Iteration

```javascript
const TodoList = component`
  TodoList :: todos =>
    div.todo-list [
      h2 { "My Todos" }
      ul [
        todos.items => todo =>
          li.todo-item [
            input[type=checkbox] { todo.done } <=> todo.done
            span { todo.title }
            button.delete { "×" } => todos.remove(todo)
          ]
      ]
      input#new-todo => keyup.enter => todos.add({ title: this.value })
    ]
`;
```

### With Conditional Rendering

```javascript
const UserProfile = component`
  UserProfile :: user =>
    div.profile [
      h1 { user.name }
      
      ? user.isEditing [
        input { user.name } <=> user.name
        textarea { user.bio } <=> user.bio
        button#save { "Save" } => user.isEditing = false
      ] : [
        p { user.bio }
        button#edit { "Edit" } => user.isEditing = true
      ]
    ]
`;
```

## DSL Grammar

### Element Declaration
```
element[.class][#id][attributes] [
  children
]
```

### Text Content Binding
```
element { expression }
```

### Attribute Binding
```
element[attribute={ expression }]
```

### Event Handling
```
element => event => action
element { "text" } => action
```

### Two-Way Binding
```
element { value } <=> state.property
```

### Iteration
```
collection => item => element
```

### Conditional
```
? condition [ trueBranch ] : [ falseBranch ]
```

## JSON Representation

The DSL compiles to a JSON structure that represents the component's equations:

```json
{
  "name": "UserCard",
  "entity": "user",
  "structure": {
    "root": {
      "element": "div",
      "class": "user-card",
      "children": ["title", "bio", "status"]
    },
    "title": {
      "element": "h2",
      "parent": "root"
    },
    "bio": {
      "element": "p",
      "parent": "root"
    },
    "status": {
      "element": "span",
      "class": "status",
      "parent": "root"
    }
  },
  "bindings": [
    {
      "source": "user.name",
      "target": "title.textContent",
      "transform": "identity"
    },
    {
      "source": "user.bio",
      "target": "bio.textContent",
      "transform": "identity"
    },
    {
      "source": "user.active",
      "target": "status.textContent",
      "transform": "active => active ? 'Active' : 'Inactive'"
    }
  ],
  "events": []
}
```

## DOM Proxy System

### DOMElementProxy

Each DOM element becomes a proxy that:
1. Can project child elements
2. Acts as an event stream
3. Maintains bindings to state

```javascript
class DOMElementProxy extends Handle {
  // Project child elements
  div(className) { /* returns child div proxy */ }
  span(className) { /* returns child span proxy */ }
  
  // Properties are streams
  get textContent() { /* returns text content stream */ }
  get clicks() { /* returns click event stream */ }
  get value() { /* returns value change stream */ }
  
  // Binding methods
  bind(path) { /* binds to state path */ }
  sync(path) { /* two-way binding */ }
}
```

### Event Streams

DOM proxies expose events as streams:

```javascript
// button.clicks is a stream of click events
button.clicks => state.counter++

// input.values is a stream of value changes  
input.values => state.searchQuery

// checkbox.checked is a stream of checked states
checkbox.checked <=> state.isEnabled
```

## Component Lifecycle

### Mounting

When a component is mounted:
1. Parent element is provided
2. Structure is projected from parent
3. Bindings are established
4. Initial render occurs

```javascript
const userCard = UserCard.mount(parentElement, userEntity);
```

### Updates

Updates happen automatically through equations:
1. State changes trigger DOM updates via render equations
2. DOM events trigger state updates via event equations
3. No manual update calls needed

### Unmounting

When unmounting:
1. All subscriptions are cleaned up
2. DOM elements are removed
3. Proxies are destroyed

## Complete Example

### Todo App Component

```javascript
const TodoApp = component`
  TodoApp :: state =>
    div.todo-app [
      header [
        h1 { "Todo List" }
        div.stats [
          span { state.todos.length + " total" }
          span { state.completed + " completed" }
        ]
      ]
      
      div.input-group [
        input#new-todo[placeholder="What needs to be done?"] <=> state.newTodo
        button#add { "Add" } => state.addTodo()
      ]
      
      ul.todo-list [
        state.todos => todo =>
          li.todo-item[class.completed={ todo.done }] [
            input[type=checkbox] <=> todo.done
            ? todo.editing [
              input.edit { todo.title } <=> todo.title
            ] : [
              label { todo.title } => dblclick => todo.editing = true
            ]
            button.destroy { "×" } => state.removeTodo(todo)
          ]
      ]
      
      footer [
        button#clear-completed { "Clear completed" } => state.clearCompleted()
        div.filters [
          button[class.active={ state.filter === 'all' }] { "All" } 
            => state.filter = 'all'
          button[class.active={ state.filter === 'active' }] { "Active" } 
            => state.filter = 'active'
          button[class.active={ state.filter === 'completed' }] { "Completed" } 
            => state.filter = 'completed'
        ]
      ]
    ]
`;
```

This compiles to equations that maintain relationships between:
- `state.todos` and the DOM list
- `todo.done` and checkbox states
- `todo.title` and text content
- Button clicks and state mutations

### Usage

```javascript
// Create a DataStore entity for the todo app
const todoStore = dataStore.createEntity({
  ':todos/items': [],
  ':todos/filter': 'all',
  ':todos/newTodo': ''
});

// Mount the component
const app = TodoApp.mount(
  document.getElementById('app'),
  todoStore
);

// Any changes to todoStore automatically update the DOM
// Any user interactions automatically update todoStore
// The system maintains the equations - no manual updates needed!
```

## Architecture

### Component Compiler

The template literal tag function parses the DSL and generates:
1. Structure definition (projection hierarchy)
2. Binding equations (state ↔ DOM)
3. Event equations (events → state)

### Equation Solver

The solver maintains the equations by:
1. Subscribing to state changes
2. Updating DOM when state changes
3. Listening to DOM events
4. Updating state when events occur

### Integration with DataStore

Components bind directly to DataStore entities:
1. Entity attributes map to DOM properties
2. Entity updates trigger DOM updates
3. DOM events trigger entity updates
4. Subscriptions are managed automatically

## Benefits

1. **Truly Declarative**: Define what, not how
2. **Automatic Reactivity**: No manual DOM manipulation
3. **Clean Syntax**: Reads like mathematical equations
4. **Projection-Based**: Natural hierarchy through projection
5. **Event Streams**: Events are first-class streams
6. **Two-Way Binding**: Simple `<=>` operator
7. **Composable**: Components compose naturally

## Summary

Declarative Components transforms UI development from imperative manipulation to declarative equation definition. By combining:
- DataStore's reactive state management
- Handle pattern's projection model
- Template literal DSL for clean syntax
- DOM proxies for event streams

We achieve a system where the UI truly is a pure function of state, maintained automatically through mathematical equations rather than imperative updates.