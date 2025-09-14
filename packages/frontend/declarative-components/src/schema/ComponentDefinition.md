# Component Definition JSON Schema

## Overview
Both CNL (Controlled Natural Language) and DSL (Domain Specific Language) compile to this unified JSON component definition format, which is then processed by ComponentLifecycle and EquationSolver for reactive DOM rendering.

## Schema Structure

```json
{
  "name": "ComponentName",
  "entity": "entityParam",
  "structure": {
    "elementKey": {
      "element": "tagName",
      "class": "space-separated-classes",
      "id": "elementId",
      "parent": "parentKey",
      "attributes": {},
      "textContent": "static text"
    }
  },
  "bindings": [
    {
      "source": "entity.property",
      "target": "elementKey.targetProperty",
      "transform": "identity | expression"
    }
  ],
  "events": [
    {
      "element": "elementKey",
      "event": "eventType",
      "action": "actionExpression",
      "modifiers": ["prevent", "stop", "enter"]
    }
  ]
}
```

## Field Descriptions

### Top Level
- `name` (string): Component name for identification
- `entity` (string): Parameter name for data entity (e.g., "user", "state")
- `structure` (object): DOM structure definition
- `bindings` (array): Data binding definitions
- `events` (array): Event handler definitions

### Structure Object
Each key in the structure object represents a unique element identifier. The root element must have key "root".

- `element` (string): HTML tag name (div, span, button, etc.)
- `class` (string, optional): Space-separated CSS classes
- `id` (string, optional): HTML id attribute
- `parent` (string, optional): Parent element key (null/undefined for root)
- `attributes` (object, optional): Additional HTML attributes
- `textContent` (string, optional): Static text content

### Binding Object
Defines reactive data bindings between DataStore and DOM.

- `source` (string): Data path (e.g., "user.name", "state.count")
- `target` (string): Element property path (e.g., "root.textContent", "input_1.value")
- `transform` (string): Transform function or "identity" for no transform

### Event Object
Defines event handlers for user interactions.

- `element` (string): Element key from structure
- `event` (string): DOM event type (click, input, keyup, etc.)
- `action` (string): Action expression (e.g., "count++", "active = !active")
- `modifiers` (array, optional): Event modifiers (prevent, stop, enter)

## Examples

### Counter Component
```json
{
  "name": "Counter",
  "entity": "state",
  "structure": {
    "root": {
      "element": "div",
      "class": "counter"
    },
    "root_child_0": {
      "element": "h2",
      "parent": "root"
    },
    "root_child_1": {
      "element": "button",
      "parent": "root",
      "textContent": "+1"
    },
    "root_child_2": {
      "element": "button",
      "parent": "root",
      "textContent": "-1"
    },
    "root_child_3": {
      "element": "button",
      "parent": "root",
      "textContent": "Reset"
    }
  },
  "bindings": [
    {
      "source": "state.count",
      "target": "root_child_0.textContent",
      "transform": "identity"
    }
  ],
  "events": [
    {
      "element": "root_child_1",
      "event": "click",
      "action": "count++",
      "modifiers": []
    },
    {
      "element": "root_child_2",
      "event": "click",
      "action": "count--",
      "modifiers": []
    },
    {
      "element": "root_child_3",
      "event": "click",
      "action": "count = 0",
      "modifiers": []
    }
  ]
}
```

### User Profile Component
```json
{
  "name": "UserProfile",
  "entity": "user",
  "structure": {
    "root": {
      "element": "div",
      "class": "profile-card"
    },
    "root_child_0": {
      "element": "h1",
      "parent": "root"
    },
    "root_child_1": {
      "element": "p",
      "parent": "root",
      "class": "bio"
    },
    "root_child_2": {
      "element": "span",
      "parent": "root",
      "class": "status"
    }
  },
  "bindings": [
    {
      "source": "user.name",
      "target": "root_child_0.textContent",
      "transform": "identity"
    },
    {
      "source": "user.bio",
      "target": "root_child_1.textContent",
      "transform": "identity"
    },
    {
      "source": "user.active",
      "target": "root_child_2.textContent",
      "transform": "active => active ? 'Online' : 'Offline'"
    }
  ],
  "events": []
}
```

## Processing Pipeline

```
CNL Text → CNLParser → CNL AST → CNLTranspiler → JSON Component Definition
                                                           ↓
DSL Text → Parser → DSL AST → CodeGenerator → JSON Component Definition
                                                           ↓
                                              ComponentLifecycle.mount()
                                                           ↓
                                                    EquationSolver
                                                           ↓
                                                      Reactive DOM
```

## Implementation Notes

1. The `CodeGenerator` class already outputs this format correctly
2. The `CNLTranspiler` needs to be updated to output JSON instead of DSL
3. Element keys must be unique within a component
4. The root element must have key "root"
5. Child elements use pattern: `${parentKey}_child_${index}`
6. All bindings and events reference element keys from the structure